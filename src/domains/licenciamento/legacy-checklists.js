// Declarações extraídas literalmente da entrada legada; não importar LegacyApp aqui.
import { C } from "../../legacy/palette.js";
import { LIC_SIMPLIFICADA_DOCS, LIC_SIMPLIFICADA_PRE } from "./catalog.js";
export {
  LICENCAS, LIC_SIMPLIFICADA_DOCS, LIC_SIMPLIFICADA_PRE,
  LIC_TERRAS_ALPHA_DOCS, LIC_TERRAS_ALPHA_PRE, LIC_TERRAS_ALPHA_VERIFICACAO, licencaPorId,
} from "./catalog.js";

// Situacoes de cada documento. "na" = nao se aplica a esta obra (some da conta).
export const LIC_STATUS = [
  { v:"pendente",     l:"Pendente",     cor:C.muted  },
  { v:"em_andamento", l:"Em andamento", cor:C.orange },
  { v:"entregue",     l:"Entregue",     cor:C.blue   },
  { v:"aprovado",     l:"Aprovado",     cor:C.green  },
  { v:"na",           l:"Não necessário",cor:C.border },
];

export const licStatusInfo = v => LIC_STATUS.find(s => s.v === v) || LIC_STATUS[0];


// Andamento do checklist: so conta o que se aplica a esta obra.
export const progressoChecklist = (check, docs) => {
  const defs = docs || LIC_SIMPLIFICADA_DOCS;
  const st = id => check?.itens?.[id]?.status || "pendente";
  const aplicaveis = defs.filter(d => st(d.id) !== "na");
  const ok = aplicaveis.filter(d => ["entregue","aprovado"].includes(st(d.id)));
  return {
    total: defs.length, aplicaveis: aplicaveis.length,
    concluidos: ok.length,
    aprovados: aplicaveis.filter(d => st(d.id) === "aprovado").length,
    pendentes: aplicaveis.filter(d => st(d.id) === "pendente").length,
    naoAplica: defs.length - aplicaveis.length,
    pct: aplicaveis.length ? (ok.length / aplicaveis.length) * 100 : 0,
    pronto: aplicaveis.length > 0 && ok.length === aplicaveis.length,
  };
};


// Elegibilidade: a licenca simplificada so vale se TODOS os pre-requisitos
// forem atendidos. Se faltar um, o caminho e outro tipo de licenca.
export const preRequisitosOk = (check, pre) => {
  const lista = pre || LIC_SIMPLIFICADA_PRE;
  const faltando = lista.filter(p => !check?.pre?.[p.id]);
  return { marcados: lista.length - faltando.length, total: lista.length,
           ok: faltando.length === 0, faltando };
};


export const CONTRACT_LABELS = {
  fixed_labor:       "Somente MO",
  admin_only:        "Só Administração",
  fixed_labor_admin: "MO + Admin %",
};


// Dias de vencimento padrao do contrato ARCD: 15 e 30.
export const DIA_VENC_1_PADRAO = 15;

export const DIA_VENC_2_PADRAO = 30;


// Prende o dia ao ultimo dia real do mes: pedir dia 30 em fevereiro devolve
// 28 (ou 29 em ano bissexto), em vez de escorregar para 1/3 ou 2/3.
export const clampDiaNoMes = (ano, mesIdx, dia) => {
  const ultimo = new Date(ano, mesIdx + 1, 0).getDate();
  return Math.min(Math.max(Number(dia) || 1, 1), ultimo);
};
