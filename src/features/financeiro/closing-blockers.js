import {documentRegister} from '../../domains/financeiro/document-register.js';

const receiving={title:'Recebimentos acima do valor a receber',reason:'Os recebimentos vinculados excedem o valor do documento.',next:'Confira o valor da cobrança e os comprovantes em Medições a faturar. Revise os vínculos na origem antes de tentar fechar novamente.'};
const paying={title:'Pagamentos acima do valor a pagar',reason:'Os pagamentos vinculados excedem o valor da obrigação.',next:'Confira a obrigação e os comprovantes em Pagamentos. Revise os vínculos na origem antes de tentar fechar novamente.'};
const messages={
 RECEIVABLE_OVERPAID:receiving,
 RECEIVABLE_NON_NEGATIVE:{...receiving,title:'Saldo a receber inconsistente',reason:'A conferência encontrou recebimentos acima dos valores a receber. Este aviso pode resumir diferenças já detalhadas acima.'},
 PAYABLE_OVERPAID:paying,
 PAYABLE_NON_NEGATIVE:{...paying,title:'Saldo a pagar inconsistente',reason:'A conferência encontrou pagamentos acima dos valores a pagar. Este aviso pode resumir diferenças já detalhadas acima.'},
 COMMITMENT_NON_NEGATIVE:{title:'Saldo dos compromissos inconsistente',reason:'Há baixas acima dos compromissos registrados.',next:'Confira os contratos, pedidos e seus vínculos antes de tentar fechar novamente.'},
};
const equations=new Set(['DRE_RESULT_EQUATION','CASH_BALANCE_EQUATION','DRE_REVENUE_DETAIL_MATCH','DRE_COST_DETAIL_MATCH','CASH_IN_DETAIL_MATCH','CASH_OUT_DETAIL_MATCH','CONSOLIDATION_EQUATION']);
const moneyCodes=new Set([...Object.keys(messages),...equations]);

// Presentation only: resolve the exact persisted origin. Never infer a link by name,
// amount or competence, and never turn a diagnostic difference into a ledger entry.
export function closingBlocker(data,error={},sources=documentRegister(data)){
 const copy=messages[error.code]||(equations.has(error.code)?{
  title:'Os totais não conferem com o detalhamento',reason:'A conferência encontrou uma diferença entre o resumo financeiro e os registros que o compõem.',next:'Confira os memoriais do DRE e do caixa. Se a diferença continuar, envie o diagnóstico ao administrador antes de fechar.'
 }:{title:'Conferência financeira necessária',reason:'O motor financeiro encontrou uma inconsistência que impede o fechamento.',next:'Consulte os registros de origem e compartilhe o diagnóstico com o administrador. Não altere valores apenas para eliminar o aviso.'});
 const difference=Number.isFinite(error.differenceCents)&&moneyCodes.has(error.code)?error.differenceCents:null;
 const source=error.sourceType&&error.sourceId!=null&&String(error.sourceId)!==''?sources.find(row=>row.type===error.sourceType&&String(row.record.id)===String(error.sourceId)&&(!error.obraId||String(row.entry.obraId)===String(error.obraId))):null;
 const origin=source?{...source.entry,description:`${source.label} · ${source.entry.documentNumber||source.entry.sourceId}`}:null;
 return {...copy,differenceCents:difference,origin,owner:'Financeiro / administrador',diagnostic:error.message||error.description||error.code||'Diagnóstico não informado',code:error.code||''};
}
