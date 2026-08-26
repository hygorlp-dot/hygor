// Regras puras do contexto de Conciliação Bancária. Sem React, DOM ou
// persistência. Extraído de LegacyApp.jsx (funções que já existiam soltas
// no arquivo, usadas pelo componente Conciliacao) para o mesmo padrão dos
// domínios já migrados (compras, dre, equipamentos).
import { active } from "../financeiro/ledger.js";

// Normaliza texto para comparação (remove acento, caixa) - usado em toda
// comparação de nome/descrição do motor de conciliação.
export const semAcento = (s) =>
  String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// Datas no padrão OFX (YYYYMMDD[hhmmss][fuso]) → ISO "YYYY-MM-DD"
const dataOFXParaISO = (s) => {
  const m = String(s || "").match(/^(\d{4})(\d{2})(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : "";
};

// Extrai o nome da contraparte embutido na descrição de um PIX quando o
// extrato não traz a tag <NAME> estruturada - achado de 25/08/2026 (ver
// docs/BLUEPRINT_CONCORRENCIA_TRAVA.md, seção "Melhoria: extrair
// contraparte da descrição do PIX"): o extrato real de uma conta do Banco
// Inter (identificado no OFX pelo nome corporativo antigo "Banco
// Intermedium S/A") nunca envia <NAME>/<PIXKEY>/<CPF>/<CNPJ> - mas o nome
// completo sempre aparece dentro do MEMO em um de dois formatos
// confirmados contra 794 transações pendentes reais:
//   Pix enviado: "Cp :18236120-JOAO DA SILVA"
//   Pix enviado: "00019 247280631 JOAO DA SILVA"
// Sem essa extração, contraparteNome ficava sempre vazio e o motor de
// candidatos (matching.js) não tinha como cruzar com o cadastro de
// funcionários/terceiros/fornecedores por nome - só por PIX/CPF
// estruturado, que este banco nunca fornece, deixando a fila inteira sem
// nenhuma transação na classificação "pronta". Falha em vazio ("") sempre
// que o texto não bater com o padrão esperado - nunca inventa um nome a
// partir de um código numérico ou texto sem cara de nome (mínimo de duas
// palavras alfabéticas).
export const extrairContraparteDescricaoPix = (descricao) => {
  const bruto = String(descricao || "");
  const match = bruto.match(/^Pix\s+(?:enviado|recebido)\s*:\s*"(.+)"\s*$/i);
  const conteudo = match ? match[1].trim() : "";
  if (!conteudo) return "";
  const semPrefixo = conteudo
    .replace(/^Cp\s*:\s*\d+\s*-\s*/i, "")
    .replace(/^\d+\s+\d+\s+/, "")
    .trim();
  if (!/^[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'.\s-]*$/.test(semPrefixo)) return "";
  const palavras = semPrefixo.split(/\s+/).filter(Boolean);
  if (palavras.length < 2) return "";
  return semPrefixo;
};

// OFX é o formato que todo banco brasileiro exporta e, melhor, traz o FITID:
// um identificador único da transação. É ele que torna a deduplicação exata,
// em vez de heurística.
//
// Achado de 25/08/2026: até esta mudança existiam DUAS implementações
// deste parser - esta (nunca importada por nenhum código real, só pelo
// próprio teste deste arquivo) e uma cópia mais rica dentro de
// LegacyApp.jsx (a que o app de fato usa ao importar um extrato). A
// divergência só foi percebida ao investigar por que nenhuma transação
// bancária real chegava à classificação "pronta" - esta função agora É a
// única fonte, e LegacyApp.jsx importa daqui.
export const parseOFX = (texto) => {
  const tag = (bloco, t) => {
    const m = bloco.match(new RegExp(`<${t}>([^<\r\n]*)`, "i"));
    return m ? m[1].trim() : "";
  };
  const banco = tag(texto, "ORG") || tag(texto, "BANKID") || "";
  const conta = tag(texto, "ACCTID") || "";
  const blocos = texto.match(/<STMTTRN>[\s\S]*?<\/STMTTRN>/gi) || [];
  const trans = blocos.map(b => {
    const descricao = (tag(b, "MEMO") || tag(b, "NAME") || "").trim();
    const contraparteNome = tag(b, "NAME") || extrairContraparteDescricaoPix(descricao);
    return {
      data: dataOFXParaISO(tag(b, "DTPOSTED")),
      descricao, descricaoOriginal: descricao,
      valor: Number(String(tag(b, "TRNAMT")).replace(",", ".")),
      fitid: tag(b, "FITID"),
      endToEndId: tag(b, "ENDTOENDID") || tag(b, "E2EID"),
      txid: tag(b, "TXID") || tag(b, "REFNUM"),
      tipoOperacao: tag(b, "TRNTYPE"),
      contraparteNome,
      contraparteDocumento: tag(b, "CPF") || tag(b, "CNPJ") || tag(b, "DOCUMENTO"),
      chavePix: tag(b, "PIXKEY") || tag(b, "CHAVEPIX") || "",
      metadadosImportacao: {
        trnType: tag(b, "TRNTYPE"), checknum: tag(b, "CHECKNUM"),
        refnum: tag(b, "REFNUM"), memo: tag(b, "MEMO"), name: tag(b, "NAME"),
      },
    };
  }).filter(t => t.data && !isNaN(t.valor) && t.valor !== 0);
  return { banco, conta, trans };
};

// Chave de deduplicação: FITID quando existe; senão, impressão digital da linha.
export const chaveTransacao = (t) =>
  t.fitid ? `fit:${t.fitid}`
          : `h:${t.data}|${Number(t.valor).toFixed(2)}|${String(t.descricao).slice(0, 40).toLowerCase()}`;

// Hash simples (FNV-1a, síncrono, sem dependência) do conteúdo bruto do
// arquivo de extrato - complementa chaveTransacao (que é por linha) com uma
// impressão digital do ARQUIVO inteiro, para o relatório de importação e
// para detectar reimportação do mesmo arquivo físico.
export const hashArquivo = (texto) => {
  let h = 0x811c9dc5;
  const s = String(texto || "");
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
};

// Soma dos rateios. O fechamento (soma == valor da transação, 1 centavo) é
// verificado no componente, que precisa exibir a diferença ao vivo.
export const somaRateios = (rateios) =>
  (rateios || []).reduce((s, r) => s + Number(r.valor || 0), 0);

// Distância em dias entre duas datas ISO
export const diasEntre = (a, b) => {
  if (!a || !b) return 999;
  return Math.abs(Math.round(
    (new Date(a + "T12:00:00") - new Date(b + "T12:00:00")) / 86400000
  ));
};

// Painel de números da conciliação (KPIs da fila)
export const calcConciliacao = (data) => {
  const archivedStatements = new Set((data?.extratos || [])
    .filter(statement => statement?.status === "arquivado")
    .map(statement => String(statement.id)));
  const trans = (data?.transacoes || []).filter(transaction =>
    !archivedStatements.has(String(transaction?.extratoId || "")));
  const pend = trans.filter(t => t.status === "pendente");
  const conc = trans.filter(t => t.status === "conciliado");
  const ign = trans.filter(t => t.status === "ignorado");
  const vPend = pend.reduce((s, t) => s + Math.abs(Number(t.valor || 0)), 0);
  const entradas = conc.filter(t => t.valor > 0).reduce((s, t) => s + t.valor, 0);
  const saidas = conc.filter(t => t.valor < 0).reduce((s, t) => s + Math.abs(t.valor), 0);
  return {
    total: trans.length,
    pendentes: pend.length, conciliadas: conc.length, ignoradas: ign.length,
    valorPendente: vPend, entradas, saidas,
    pct: trans.length ? ((conc.length + ign.length) / trans.length) * 100 : 0,
  };
};

//
// VALORES FINANCEIROS EM CENTAVOS INTEIROS
//
// O app inteiro usa Number (ponto flutuante) para dinheiro. Não dá para
// reescrever tudo nesta entrega, mas toda comparação de igualdade, soma de
// rateio e validação de saldo DENTRO do motor de conciliação passa por aqui,
// para não sofrer de erro de arredondamento (0.1 + 0.2 !== 0.3).
//

export const paraCentavos = valor => Math.round(Number(valor || 0) * 100);
export const deCentavos = centavos => Number(centavos || 0) / 100;
export const igualCentavos = (a, b, toleranciaCentavos = 1) =>
  Math.abs(paraCentavos(a) - paraCentavos(b)) <= toleranciaCentavos;

//
// RECEBIMENTO DE MEDIÇÃO (correção do bug de recebimento parcial legado)
//
// Antes, marcar uma medição como recebida era um botão binário: sempre
// gravava valorRecebido = valorPrevisto, mesmo quando só uma parte entrou.
// Agora cada recebimento vira uma entrada em `recebimentos[]`; os campos
// antigos (`recebido`, `valorRecebido`, `dataPagamento`) continuam sendo
// escritos como espelho do total, para não quebrar quem ainda os lê.
export const totalRecebidoMedicao = medicao =>
  Array.isArray(medicao.recebimentos) && medicao.recebimentos.length
    ? medicao.recebimentos.filter(active).reduce((s, r) => s + Number(r.valor || 0), 0)
    : Number(medicao.valorRecebido || 0);

export const statusRecebimentoMedicao = medicao => {
  const previsto = Number(medicao.valorPrevisto || 0);
  const recebido = totalRecebidoMedicao(medicao);
  if (previsto <= 0) return recebido > 0 ? "recebida" : "em_aberto";
  if (recebido >= previsto - 0.01) return "recebida";
  if (recebido > 0) return "parcial";
  return "em_aberto";
};

// Aplica um novo recebimento (total ou parcial) a uma medição, devolvendo a
// medição atualizada. `valor` pode ser menor que o saldo (parcial) - nesse
// caso `recebido` só vira true quando o acumulado fechar com o previsto.
export const aplicarRecebimentoMedicao = (medicao, { id, valor, data, origem = "", transacaoId = "", actor = null, now = new Date().toISOString() }) => {
  const recebimentos = [
    ...(Array.isArray(medicao.recebimentos) ? medicao.recebimentos : []),
    {
      id: id || undefined, valor: Number(valor || 0), data: data || "", origem, transacaoId,
      ...(actor?.id ? { createdAt:now, createdById:actor.id, createdBy:actor.nome || actor.email || "Usuário autenticado" } : {}),
    },
  ];
  const total = recebimentos.filter(active).reduce((s, r) => s + Number(r.valor || 0), 0);
  const previsto = Number(medicao.valorPrevisto || 0);
  return {
    ...medicao,
    recebimentos,
    valorRecebido: total,
    dataPagamento: data || medicao.dataPagamento || "",
    recebido: previsto > 0 ? total >= previsto - 0.01 : total > 0,
  };
};

export const estornarRecebimentosMedicao = (medicao, { actor, reason, now = new Date().toISOString() }) => {
  if (!actor?.id) throw new Error("Sessão do usuário indisponível para estornar os recebimentos da medição.");
  const motivoEstorno=String(reason || "").trim();
  if (!motivoEstorno) throw new Error("Informe o motivo do estorno dos recebimentos.");
  const existentes=Array.isArray(medicao?.recebimentos) ? medicao.recebimentos : [];
  const recebimentos=existentes.length ? existentes : Number(medicao?.valorRecebido || 0) > 0 ? [{
    id:`legado-${medicao.id || "medicao"}-${medicao.dataPagamento || "sem-data"}`,
    valor:Number(medicao.valorRecebido || 0), data:medicao.dataPagamento || "", origem:"espelho_legado", legacy:true,
  }] : [];
  const ativos=recebimentos.filter(active);
  if (ativos.some(item=>item.transacaoId)) throw new Error("Desfaça a conciliação bancária antes de estornar este recebimento.");
  const userName=actor.nome || actor.email || "Usuário autenticado";
  return {
    ...medicao,
    recebimentos:recebimentos.map(item=>!active(item) ? item : ({
      ...item, status:"estornado", motivoEstorno, estornadoEm:now,
      estornadoPorId:actor.id, estornadoPor:userName,
    })),
    valorRecebido:0, dataPagamento:"", recebido:false,
  };
};

// Remove um recebimento (por id) de uma medição - usado pelo desfazer, para
// reverter só a parcela ligada a uma conciliação específica, não o total.
export const removerRecebimentoMedicao = (medicao, recebimentoId) => {
  const recebimentos = (Array.isArray(medicao.recebimentos) ? medicao.recebimentos : [])
    .map(r => r.id !== recebimentoId ? r : {
      ...r, status:"estornado", motivoEstorno:"Conciliação bancária desfeita",
      estornadoEm:new Date().toISOString(),
    });
  const ativos=recebimentos.filter(active);
  const total = ativos.reduce((s, r) => s + Number(r.valor || 0), 0);
  const previsto = Number(medicao.valorPrevisto || 0);
  return {
    ...medicao,
    recebimentos,
    valorRecebido: total,
    dataPagamento: ativos.length ? ativos[ativos.length - 1].data || "" : "",
    recebido: previsto > 0 ? total >= previsto - 0.01 : total > 0,
  };
};
