// Projeção de horas do período, somente leitura. Não é um banco homologado:
// não existe aqui saldo anterior, calendário de trabalho, compensação ou
// lançamento na grade/folha. A jornada é a cadastrada AGORA. Dias sem
// registros nunca criam débito; dias incompletos não entram nos totais.
import { formatMinutes } from "../ponto/timekeeping.js";
import { proporApropriacoes, validarApropriacao } from "./apropriacao.js";
import { dataLocal, FUSO_OBRA } from "./painel.js";

export const MAX_DIAS_BANCO_HORAS = 62;
const DIA_MS = 86_400_000;
const texto = valor => String(valor ?? "").trim();
const lista = valor => Array.isArray(valor) ? valor : [];
const dataValida = valor => /^\d{4}-\d{2}-\d{2}$/.test(valor)
  && Number.isFinite(Date.parse(`${valor}T00:00:00Z`))
  && new Date(`${valor}T00:00:00Z`).toISOString().slice(0, 10) === valor;
const diaSeguinte = dia => new Date(Date.parse(`${dia}T00:00:00Z`) + DIA_MS).toISOString().slice(0, 10);
const diaAnterior = dia => new Date(Date.parse(`${dia}T00:00:00Z`) - DIA_MS).toISOString().slice(0, 10);
const aviso = (codigo, mensagem) => ({ codigo, mensagem });
const incluirAviso = (destino, item) => {
  if (!destino.some(atual => atual.codigo === item.codigo)) destino.push(item);
};

export function validarPeriodoBancoHoras(de, ate) {
  de = texto(de);
  ate = texto(ate);
  if (!dataValida(de) || !dataValida(ate)) return { ok: false, erro: "Informe datas válidas para o início e o fim do período." };
  if (de > ate) return { ok: false, erro: "O início do período deve ser anterior ou igual ao fim." };
  const totalDias = Math.round((Date.parse(`${ate}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`)) / DIA_MS) + 1;
  if (totalDias > MAX_DIAS_BANCO_HORAS) return { ok: false, erro: `Escolha um período de até ${MAX_DIAS_BANCO_HORAS} dias.` };
  const dias = Array.from({ length: totalDias }, (_, indice) => new Date(Date.parse(`${de}T00:00:00Z`) + indice * DIA_MS).toISOString().slice(0, 10));
  return { ok: true, de, ate, totalDias, dias };
}

export function formatarSaldoMinutos(valor) {
  if (valor == null || texto(valor) === "" || !Number.isFinite(Number(valor))) return "—";
  const minutos = Math.round(Number(valor));
  return `${minutos > 0 ? "+" : minutos < 0 ? "−" : ""}${formatMinutes(Math.abs(minutos))}`;
}

// Uma data/hora sem fuso não pode depender do fuso do navegador. A API
// fornece ISO com offset; datas impossíveis também não são normalizadas.
const instante = valor => {
  const iso = texto(valor);
  const partes = /^(\d{4}-\d{2}-\d{2})T([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d+)?)?(?:Z|[+-](?:0\d|1[0-4]):[0-5]\d)$/i.exec(iso);
  if (!partes || !dataValida(partes[1])) return null;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? { ms, iso: new Date(ms).toISOString(), data: dataLocal(new Date(ms).toISOString()) } : null;
};

const resolverJornada = (employee, config) => {
  const especifica = employee?.workdayHours;
  const temEspecifica = especifica != null && texto(especifica) !== "";
  const valor = temEspecifica ? especifica : config?.payrollWorkdayHours;
  const horas = Number(valor);
  if (valor == null || typeof valor === "boolean" || texto(valor) === "" || !Number.isFinite(horas) || horas < 1 || horas > 24) {
    return { minutos: null, fonte: null };
  }
  return { minutos: Math.round(horas * 60), fonte: temEspecifica ? "funcionario" : "empresa" };
};

const alertasDasBatidas = batidas => {
  const alertas = [];
  if (batidas.some(b => b.horaConfiavel !== true)) alertas.push(aviso("hora_nao_confirmada", "Há batida com hora não confirmada pelo servidor."));
  if (batidas.some(b => b.relogioAlterado)) alertas.push(aviso("relogio_alterado", "Há batida com aviso de alteração do relógio do aparelho."));
  if (batidas.some(b => b.metodo === "encarregado")) alertas.push(aviso("identificacao_encarregado", "Há identificação feita pelo encarregado."));
  return alertas;
};

const intervalo = (inicio, fim, obraId, extras = {}) => ({
  inicio, fim, obraId, minutos: (Date.parse(fim) - Date.parse(inicio)) / 60_000, ...extras,
});

const obrasDosIntervalos = intervalos => {
  const porObra = new Map();
  intervalos.forEach(i => porObra.set(i.obraId, (porObra.get(i.obraId) || 0) + i.minutos));
  return [...porObra].map(([obraId, minutos]) => ({ obraId, minutos: Math.round(minutos) }))
    .sort((a, b) => b.minutos - a.minutos || a.obraId.localeCompare(b.obraId));
};

// Reutilizável depois dos filtros da tela. Créditos e débitos são magnitudes
// positivas das diferenças dos dias considerados, sem percentuais da folha.
export function resumirLinhasBancoHoras(linhas = []) {
  const resumo = {
    funcionarios: lista(linhas).length, funcionariosComRegistros: 0, funcionariosComSaldo: 0, funcionariosComPendencias: 0,
    diasComRegistro: 0, diasConsiderados: 0, diasPendentes: 0, diasSemRegistro: 0,
    trabalhadosMinutos: 0, previstosMinutos: 0, creditosMinutos: 0, debitosMinutos: 0, saldoMinutos: null,
  };
  for (const linha of lista(linhas)) {
    if (linha.diasComRegistro > 0) resumo.funcionariosComRegistros += 1;
    if (linha.diasConsiderados > 0) resumo.funcionariosComSaldo += 1;
    if (linha.diasPendentes > 0 || linha.pendencias?.length) resumo.funcionariosComPendencias += 1;
    for (const campo of ["diasComRegistro", "diasConsiderados", "diasPendentes", "diasSemRegistro", "trabalhadosMinutos", "previstosMinutos", "creditosMinutos", "debitosMinutos"]) {
      resumo[campo] += Number(linha[campo]) || 0;
    }
  }
  if (resumo.diasConsiderados > 0) resumo.saldoMinutos = resumo.creditosMinutos - resumo.debitosMinutos;
  return resumo;
}

/**
 * As duas fontes devem cobrir TODOS os funcionários/obras no período antes
 * dos filtros visuais. `cobertura.completa === true` é obrigatório para
 * totalizar; limite ou falha de consulta nunca vira saldo parcial silencioso.
 * Apropriações ativas prevalecem sobre a interpretação das batidas do dia.
 * Apropriações do dia anterior/posterior servem apenas de contexto para
 * identificar jornadas noturnas nas bordas; não entram nos totais do período.
 */
export function construirBancoHoras({ employees = [], config = {}, marcacoes = [], apropriacoes = [], de, ate, cobertura } = {}) {
  const periodo = validarPeriodoBancoHoras(de, ate);
  if (!periodo.ok) return { ok: false, erro: periodo.erro, periodo, linhas: [], resumo: resumirLinhasBancoHoras(), avisos: [], cobertura: { completa: false } };

  const cadastros = new Map(lista(employees).filter(e => e && texto(e.id)).map(e => [texto(e.id), e]));
  const grupos = new Map();
  const problemasFuncionario = new Map();
  const avisosGerais = [];
  let duplicatasIgnoradas = 0;
  let registrosInvalidos = 0;
  let semFuncionario = false;
  const grupo = (employeeId, data, aceitarContexto = false) => {
    const foraPeriodo = data < periodo.de || data > periodo.ate;
    if (foraPeriodo && (!aceitarContexto || data < diaAnterior(periodo.de) || data > diaSeguinte(periodo.ate))) return null;
    const chave = `${employeeId}__${data}`;
    if (!grupos.has(chave)) grupos.set(chave, {
      employeeId, data, foraPeriodo, batidas: [], apropriacoes: [], temApropriacao: false,
      problemasBatidas: [], problemasApropriacoes: [],
    });
    return grupos.get(chave);
  };
  const semDataValida = (employeeId, fonte) => {
    registrosInvalidos += 1;
    if (!problemasFuncionario.has(employeeId)) problemasFuncionario.set(employeeId, []);
    incluirAviso(problemasFuncionario.get(employeeId), aviso(`data_invalida_${fonte}`, `Há ${fonte === "batida" ? "batida" : "apropriação"} sem data/hora válida; não foi possível atribuí-la a um dia.`));
  };
  const semIdentidade = () => {
    registrosInvalidos += 1;
    semFuncionario = true;
    incluirAviso(avisosGerais, aviso("registro_sem_funcionario", "Há registro sem funcionário; a cobertura precisa ser conferida antes de totalizar."));
  };
  const unicos = (vistos, id, assinatura, g, campo) => {
    if (!id) return true;
    const anterior = vistos.get(id);
    if (!anterior) { vistos.set(id, { assinatura, g }); return true; }
    if (anterior.assinatura === assinatura) { duplicatasIgnoradas += 1; return false; }
    const problema = aviso("identificador_conflitante", "O mesmo identificador veio com dados diferentes; confira a consulta.");
    incluirAviso(g[campo], problema);
    incluirAviso(anterior.g[campo], problema);
    return true;
  };

  const batidasVistas = new Map();
  for (const m of lista(marcacoes)) {
    if (!m || (m.tipoRegistro || "ponto") !== "ponto") continue;
    const employeeId = texto(m.employeeId);
    if (!employeeId) { semIdentidade(); continue; }
    const quando = instante(m.marcadoEm);
    if (!quando) { semDataValida(employeeId, "batida"); continue; }
    const g = grupo(employeeId, quando.data);
    if (!g) continue;
    const obraCapturaId = texto(m.obraCapturaId || m.obraId);
    const id = texto(m.eventId || m.id);
    const assinatura = JSON.stringify([employeeId, quando.iso, obraCapturaId, m.horaConfiavel, m.relogioAlterado, m.metodo]);
    if (!unicos(batidasVistas, id, assinatura, g, "problemasBatidas")) continue;
    const batida = { ...m, employeeId, eventId: id, marcadoEm: quando.iso, obraCapturaId };
    g.batidas.push(batida);
    if (!obraCapturaId) incluirAviso(g.problemasBatidas, aviso("obra_ausente", "Há batida sem obra de captura; a sequência precisa ser conferida."));
  }

  const apropriacoesVistas = new Map();
  const idsCancelados = new Set(lista(apropriacoes)
    .filter(a => a && ["cancelada", "cancelado"].includes(texto(a.status).toLowerCase()))
    .map(a => texto(a.id)).filter(Boolean));
  for (const a of lista(apropriacoes)) {
    if (!a || ["cancelada", "cancelado"].includes(texto(a.status).toLowerCase())) continue;
    const employeeId = texto(a.employeeId);
    if (!employeeId) { semIdentidade(); continue; }
    const data = texto(a.data);
    if (!dataValida(data)) { semDataValida(employeeId, "apropriacao"); continue; }
    const g = grupo(employeeId, data, true);
    if (!g) continue;
    g.temApropriacao = true;
    if (texto(a.id) && idsCancelados.has(texto(a.id))) {
      incluirAviso(g.problemasApropriacoes, aviso("identificador_conflitante", "A mesma apropriação veio ativa e cancelada; confira a consulta."));
    }
    if (texto(a.status).toLowerCase() !== "ativa") {
      incluirAviso(g.problemasApropriacoes, aviso("apropriacao_nao_confirmada", "A apropriação não está ativa; confira o tratamento do dia."));
      continue;
    }
    const inicio = instante(a.inicio), fim = instante(a.fim);
    const normalizada = { ...a, employeeId, data, inicio: inicio?.iso, fim: fim?.iso, obraApropriadaId: texto(a.obraApropriadaId) };
    // Não é uma edição: a exigência de motivo de alteração não se aplica à leitura.
    const validacao = validarApropriacao({ ...normalizada, id: undefined });
    if (!inicio || !fim || !validacao.ok) {
      incluirAviso(g.problemasApropriacoes, aviso("apropriacao_invalida", "Há apropriação com intervalo ou obra inválidos; confira o tratamento do dia."));
      continue;
    }
    // A data da jornada é explícita: a base não impõe se uma jornada noturna
    // pertence ao dia da entrada ou da saída. Aceitamos os dias adjacentes,
    // preservando essa atribuição; datas distantes precisam de conferência.
    if (inicio.data < diaAnterior(data) || inicio.data > diaSeguinte(data)) {
      incluirAviso(g.problemasApropriacoes, aviso("data_apropriacao_divergente", "A data da apropriação não corresponde ao dia da jornada."));
    }
    const assinatura = JSON.stringify([employeeId, data, inicio.iso, fim.iso, normalizada.obraApropriadaId, a.origem]);
    if (!unicos(apropriacoesVistas, texto(a.id), assinatura, g, "problemasApropriacoes")) continue;
    g.apropriacoes.push(normalizada);
  }

  const completa = cobertura?.completa === true && !semFuncionario;
  const pendenciaCobertura = aviso("cobertura_incompleta", "A consulta do período está incompleta; os registros não entram no saldo.");
  if (!completa) incluirAviso(avisosGerais, pendenciaCobertura);
  if (registrosInvalidos) incluirAviso(avisosGerais, aviso("registros_invalidos", `${registrosInvalidos} registro(s) com identificação ou data inválida precisam de conferência.`));
  const ids = new Set([...cadastros.keys(), ...[...grupos.values()].filter(g => !g.foraPeriodo).map(g => g.employeeId), ...problemasFuncionario.keys()]);

  const linhas = [...ids].map(employeeId => {
    const employee = cadastros.get(employeeId);
    const jornada = resolverJornada(employee, config);
    const problemas = problemasFuncionario.get(employeeId) || [];
    const dias = periodo.dias.map(data => {
      const g = grupos.get(`${employeeId}__${data}`);
      const batidas = [...(g?.batidas || [])].sort((a, b) => Date.parse(a.marcadoEm) - Date.parse(b.marcadoEm));
      const temRegistro = !!g && (batidas.length > 0 || g.temApropriacao);
      const origem = g?.temApropriacao ? "apropriacao" : temRegistro ? "batidas" : "sem_registro";
      const pendencias = [...(origem === "apropriacao" ? g.problemasApropriacoes : g?.problemasBatidas || [])];
      const alertas = alertasDasBatidas(batidas);
      let intervalos = [];
      if (origem === "apropriacao") {
        intervalos = g.apropriacoes.map(a => intervalo(a.inicio, a.fim, a.obraApropriadaId, { apropriacaoId: a.id }));
      } else if (origem === "batidas") {
        if (new Set(batidas.map(b => b.marcadoEm)).size !== batidas.length) {
          incluirAviso(pendencias, aviso("batidas_simultaneas", "Há batidas distintas no mesmo instante; confira possíveis duplicatas."));
        }
        const proposta = proporApropriacoes(batidas);
        intervalos = proposta.intervalos.map(i => intervalo(i.inicio, i.fim, i.obraApropriadaId, { eventos: i.eventos, mudouDeObra: i.mudouDeObra }));
        if (proposta.avisos.length) incluirAviso(pendencias, aviso("sem_saida", "Há batida sem saída; o dia inteiro fica fora do saldo até o tratamento."));
        if (intervalos.some(i => i.mudouDeObra)) alertas.push(aviso("mudanca_obra", "A sequência entre obras foi interpretada pela chegada à próxima obra; confira os intervalos."));
      }
      if (temRegistro) problemas.filter(p => origem === "batidas" || p.codigo === "data_invalida_apropriacao")
        .forEach(p => incluirAviso(pendencias, p));
      intervalos.sort((a, b) => Date.parse(a.inicio) - Date.parse(b.inicio));
      if (temRegistro && jornada.minutos == null) incluirAviso(pendencias, aviso("jornada_ausente", "Cadastre uma jornada válida no funcionário ou na empresa para estimar a diferença."));
      if (temRegistro && !completa) incluirAviso(pendencias, pendenciaCobertura);
      if (temRegistro && (!intervalos.length || intervalos.some(i => !(i.minutos > 0)))) {
        incluirAviso(pendencias, aviso("duracao_insuficiente", "Não há uma duração válida e completa para este dia."));
      }
      if (intervalos.length && Date.parse(intervalos.at(-1).fim) - Date.parse(intervalos[0].inicio) > DIA_MS) {
        incluirAviso(pendencias, aviso("jornada_maior_24h", "Os intervalos atribuídos ao dia ultrapassam 24 horas."));
      }
      const minutos = intervalos.reduce((soma, i) => soma + Math.max(0, i.minutos), 0);
      const intervaloMinutos = intervalos.length ? Math.max(0, Math.round((Date.parse(intervalos.at(-1).fim) - Date.parse(intervalos[0].inicio)) / 60_000 - minutos)) : 0;
      return {
        data, origem, temRegistro, situacao: temRegistro ? "pendente" : "sem_registro", confianca: "insuficiente",
        jornadaMinutos: jornada.minutos, previstosMinutos: temRegistro ? jornada.minutos : null,
        trabalhadosMinutos: temRegistro ? Math.round(minutos) : null, intervaloMinutos,
        saldoMinutos: null, acumuladoMinutos: null, intervalos, batidas, obras: obrasDosIntervalos(intervalos), pendencias, alertas,
      };
    });

    // O banco já rejeita sobreposição entre apropriações; a leitura também
    // se protege contra snapshots/importações conflitantes, inclusive entre
    // datas declaradas diferentes. Intervalos adjacentes são permitidos.
    const diasContexto = [...grupos.values()].filter(g => g.employeeId === employeeId && g.foraPeriodo).map(g => ({
      data: g.data, origem: "apropriacao", foraPeriodo: true, pendencias: [...g.problemasApropriacoes],
      intervalos: g.apropriacoes.map(a => intervalo(a.inicio, a.fim, a.obraApropriadaId)),
    }));
    const todosIntervalos = [...dias, ...diasContexto].flatMap(dia => dia.intervalos.map(i => ({ dia, inicio: Date.parse(i.inicio), fim: Date.parse(i.fim) })))
      .sort((a, b) => a.inicio - b.inicio);
    let abertos = [];
    for (const atual of todosIntervalos) {
      abertos = abertos.filter(anterior => anterior.fim > atual.inicio);
      for (const anterior of abertos) {
        const contexto = [atual.dia, anterior.dia].find(d => d.foraPeriodo);
        const sobreposicao = aviso("intervalos_sobrepostos", contexto
          ? `Há intervalo sobreposto à apropriação de ${contexto.data.split("-").reverse().join("/")}, fora do período; confira a jornada noturna.`
          : "Há intervalos sobrepostos; confira o tratamento antes de totalizar.");
        if (atual.dia.origem === anterior.dia.origem) {
          incluirAviso(atual.dia.pendencias, sobreposicao);
          incluirAviso(anterior.dia.pendencias, sobreposicao);
        } else {
          incluirAviso((atual.dia.origem === "batidas" ? atual : anterior).dia.pendencias, sobreposicao);
        }
      }
      abertos.push(atual);
    }
    const tratados = todosIntervalos.filter(i => i.dia.origem === "apropriacao");
    for (const dia of dias.filter(d => d.origem === "batidas")) {
      const datasTratadas = [...new Set(tratados.filter(i => i.dia.data !== dia.data
        && dia.batidas.some(b => Date.parse(b.marcadoEm) >= i.inicio && Date.parse(b.marcadoEm) <= i.fim)).map(i => i.dia.data))];
      if (datasTratadas.length) {
        incluirAviso(dia.pendencias, aviso("batida_em_outra_jornada", `Há batida abrangida pela apropriação de ${datasTratadas.sort().map(d => d.split("-").reverse().join("/")).join(", ")}; confira a jornada noturna.`));
      }
    }

    let acumulado = null;
    let trabalhadosMinutos = 0, previstosMinutos = 0, creditosMinutos = 0, debitosMinutos = 0;
    for (const dia of dias) {
      if (dia.temRegistro && !dia.pendencias.length) {
        dia.situacao = "considerado";
        dia.confianca = dia.alertas.length ? "conferir" : dia.origem === "apropriacao" ? "tratado" : "estimado";
        dia.saldoMinutos = dia.trabalhadosMinutos - dia.previstosMinutos;
        acumulado = (acumulado ?? 0) + dia.saldoMinutos;
        trabalhadosMinutos += dia.trabalhadosMinutos;
        previstosMinutos += dia.previstosMinutos;
        creditosMinutos += Math.max(0, dia.saldoMinutos);
        debitosMinutos += Math.max(0, -dia.saldoMinutos);
      }
      dia.acumuladoMinutos = acumulado;
    }
    const diasConsiderados = dias.filter(d => d.situacao === "considerado").length;
    return {
      employeeId, nome: texto(employee?.name || employee?.nome) || "Funcionário fora do cadastro", funcao: texto(employee?.role || employee?.funcao),
      lotacaoObraId: texto(employee?.obra || employee?.lotacaoObraId), foraDoCadastro: !employee,
      jornadaMinutos: jornada.minutos, fonteJornada: jornada.fonte,
      saldoMinutos: acumulado, trabalhadosMinutos, previstosMinutos, creditosMinutos, debitosMinutos,
      diasComRegistro: dias.filter(d => d.temRegistro).length, diasConsiderados,
      diasPendentes: dias.filter(d => d.situacao === "pendente").length, diasSemRegistro: dias.filter(d => d.situacao === "sem_registro").length,
      pendencias: problemas, dias,
      obrasIds: [...new Set(dias.flatMap(d => [...d.obras.map(o => o.obraId), ...d.batidas.map(b => b.obraCapturaId)]).filter(Boolean))],
      evolucao: dias.map(d => ({ data: d.data, situacao: d.situacao, saldoMinutos: d.saldoMinutos, acumuladoMinutos: d.acumuladoMinutos })),
    };
  }).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR") || a.employeeId.localeCompare(b.employeeId));

  return {
    ok: true, periodo: { ...periodo, fuso: FUSO_OBRA }, linhas, resumo: resumirLinhasBancoHoras(linhas), avisos: avisosGerais,
    cobertura: { ...cobertura, completa, duplicatasIgnoradas, registrosInvalidos },
  };
}
