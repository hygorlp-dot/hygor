// Leitura para a prévia de banco de horas. Não escreve nem altera a ARP.
// Consulta a jornada inteira do funcionário, inclusive capturas em outras
// obras. A população autorizada vem do servidor, não dos filtros da tela.
import { intervaloDoDia } from "../../src/domains/ponto-eletronico/painel.js";
import { validarPeriodoBancoHoras } from "../../src/domains/ponto-eletronico/banco-horas.js";

const TAMANHO_PAGINA = 500;
const MAX_REGISTROS = 10_000;
const MAX_PAGINAS = 100;
const CAMPOS_MARCACAO = "employee_id,obra_id,marcado_em,hora_confiavel,relogio_alterado,metodo,recebido_em";
const CAMPOS_APROPRIACAO = "id,employee_id,data,inicio,fim,obra_apropriada_id,origem,status,version,atualizado_em";
const deslocarDia = (dia, quantidade) => new Date(Date.parse(`${dia}T12:00:00Z`) + quantidade * 86_400_000).toISOString().slice(0, 10);

class FalhaConsulta extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const limiteExcedido = () => new FalhaConsulta(422, "Há muitos registros neste período. Escolha um intervalo menor para consultar o banco de horas completo.");
const leituraAlterada = () => new FalhaConsulta(409, "Os registros mudaram durante a consulta. Atualize o banco de horas para conferir o período completo.");

// Contagem exata evita confundir o limite configurado no PostgREST com fim
// dos dados. A ordenação tem desempate único e cada resposta é conferida.
async function lerTodasAsPaginas(criarConsulta) {
  const linhas = [];
  let esperado = null;
  for (let pagina = 0; pagina < MAX_PAGINAS; pagina += 1) {
    const { data, error, count } = await criarConsulta().range(linhas.length, linhas.length + TAMANHO_PAGINA - 1);
    if (error) throw error;
    if (!Number.isSafeInteger(count) || count < 0 || !Array.isArray(data)) {
      throw new FalhaConsulta(503, "Não foi possível confirmar todos os registros do período. Tente atualizar novamente.");
    }
    if (count > MAX_REGISTROS) throw limiteExcedido();
    if (esperado === null) esperado = count;
    if (count !== esperado) throw leituraAlterada();
    linhas.push(...data);
    if (linhas.length > esperado) throw leituraAlterada();
    if (linhas.length === esperado) return { linhas, esperado, criarConsulta };
    if (!data.length) throw leituraAlterada();
  }
  throw limiteExcedido();
}

const lerMarcacao = (m, formato) => ({
  id: formato === 2 ? m.event_id : m.id,
  eventId: formato === 2 ? m.event_id : m.id,
  formato,
  employeeId: m.employee_id,
  obraId: m.obra_id,
  obraCapturaId: m.obra_id,
  tipoRegistro: "ponto",
  marcadoEm: m.marcado_em,
  horaConfiavel: m.hora_confiavel,
  relogioAlterado: m.relogio_alterado,
  metodo: m.metodo,
});

export async function consultarBancoHoras({ db, company, de, ate, employeeId = "", allowedEmployeeIds = null, consultadoEm }) {
  const periodo = validarPeriodoBancoHoras(de, ate);
  if (!periodo.ok) return { status: 400, json: { error: periodo.erro } };
  const inicio = intervaloDoDia(periodo.de).de;
  const fim = intervaloDoDia(periodo.ate).ate;
  // Uma apropriação pode cruzar a meia-noite (até 24 h). Os dias adjacentes
  // permitem reconhecer batidas já cobertas; não ampliam os dias totalizados.
  const inicioContexto = deslocarDia(periodo.de, -1);
  const fimContexto = deslocarDia(periodo.ate, 1);
  const corte = new Date(consultadoEm).toISOString();
  const funcionario = String(employeeId || "").trim();
  const autorizados = allowedEmployeeIds === null ? null
    : [...new Set((Array.isArray(allowedEmployeeIds) ? allowedEmployeeIds : []).map(id => String(id).trim()).filter(Boolean))];
  if (funcionario && autorizados && !autorizados.includes(funcionario)) {
    return { status: 403, json: { error: "Funcionário fora do escopo de consulta do usuário." } };
  }
  const resposta = (marcacoes = [], apropriacoes = []) => ({ status: 200, json: {
    marcacoes, apropriacoes,
    cobertura: { completa: true, totalMarcacoes: marcacoes.length, totalApropriacoes: apropriacoes.length, consultadoEm: corte },
    servidorMs: Date.parse(corte),
  } });
  // Um conjunto vazio é uma restrição real, nunca ausência de filtro.
  if (autorizados?.length === 0) return resposta();
  const filtrarFuncionario = q => funcionario ? q.eq("employee_id", funcionario)
    : autorizados ? q.in("employee_id", autorizados) : q;

  const marcacoes = (tabela, id) => () => {
    const q = db.from(tabela).select(`${id},${CAMPOS_MARCACAO}`, { count: "exact" })
      .eq("company_id", company).eq("tipo_registro", "ponto")
      .gte("marcado_em", inicio).lte("marcado_em", fim).lte("recebido_em", corte);
    return filtrarFuncionario(q).order("recebido_em", { ascending: true }).order(id, { ascending: true });
  };
  const apropriacoes = () => {
    const q = db.from("ponto_apropriacoes").select(CAMPOS_APROPRIACAO, { count: "exact" })
      .eq("company_id", company).eq("status", "ativa")
      .gte("data", inicioContexto).lte("data", fimContexto).lte("atualizado_em", corte);
    return filtrarFuncionario(q).order("id", { ascending: true });
  };

  try {
    const fontes = await Promise.all([
      lerTodasAsPaginas(marcacoes("ponto_eventos", "event_id")),
      lerTodasAsPaginas(marcacoes("ponto_marcacoes", "id")),
      lerTodasAsPaginas(apropriacoes),
    ]);
    if (fontes.reduce((total, fonte) => total + fonte.esperado, 0) > MAX_REGISTROS) throw limiteExcedido();
    // Intervalos tratados podem mudar durante a leitura. Reconfira a
    // cobertura após todas as páginas; nunca publique um total truncado.
    const verificacoes = await Promise.all(fontes.map(fonte => fonte.criarConsulta().range(0, 0)));
    for (const [indice, r] of verificacoes.entries()) {
      if (r.error) throw r.error;
      if (r.count !== fontes[indice].esperado) throw leituraAlterada();
    }
    const [atuais, legadas, tratadas] = fontes.map(fonte => fonte.linhas);
    const lista = [...atuais.map(m => lerMarcacao(m, 2)), ...legadas.map(m => lerMarcacao(m, 1))]
      .sort((a, b) => a.marcadoEm.localeCompare(b.marcadoEm) || a.eventId.localeCompare(b.eventId));
    return resposta(lista, tratadas.map(a => ({
      id: a.id, employeeId: a.employee_id, data: a.data, inicio: a.inicio, fim: a.fim,
      obraApropriadaId: a.obra_apropriada_id, origem: a.origem, status: a.status,
      version: a.version, atualizadoEm: a.atualizado_em,
    })));
  } catch (error) {
    if (error instanceof FalhaConsulta) return { status: error.status, json: { error: error.message } };
    throw error;
  }
}
