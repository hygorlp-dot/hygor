// Contrato canônico de análise: a tela pode renderizá-lo, mas não o altera.
import { criarRegistroIdentidades, identificarContraparte } from "./identity.js";
import { criarIndicesFinanceiros } from "./selectors.js";
import { gerarCandidatosConciliacao } from "./matching.js";
import { paraCentavos } from "./calculations.js";
import { active } from "../financeiro/ledger.js";

const VERSAO_MOTOR_CONCILIACAO="2026.07.01";
const ACAO_CONCILIACAO=Object.freeze({
  VINCULAR_PAGAMENTO_EXISTENTE:"VINCULAR_PAGAMENTO_EXISTENTE",
  REGISTRAR_PAGAMENTO_E_CONCILIAR:"REGISTRAR_PAGAMENTO_E_CONCILIAR",
  REGISTRAR_RECEBIMENTO_E_CONCILIAR:"REGISTRAR_RECEBIMENTO_E_CONCILIAR",
  CONCILIAR_MUITOS_PARA_MUITOS:"CONCILIAR_MUITOS_PARA_MUITOS",
  MARCAR_TRANSFERENCIA_INTERNA:"MARCAR_TRANSFERENCIA_INTERNA",
  MARCAR_ESTORNO:"MARCAR_ESTORNO",
  CRIAR_LANCAMENTO_NOVO_COM_REVISAO:"CRIAR_LANCAMENTO_NOVO_COM_REVISAO",
  IGNORAR_COM_MOTIVO:"IGNORAR_COM_MOTIVO",
  SOLICITAR_CORRECAO_CADASTRAL:"SOLICITAR_CORRECAO_CADASTRAL",
  SEM_CORRESPONDENCIA:"SEM_CORRESPONDENCIA",
});

const classification=(candidate, second)=>{
  if(!candidate)return "sem_correspondencia";
  if(candidate.bloqueios?.length)return "bloqueada";
  const margin=Number(candidate.score||0)-Number(second?.score||0);
  if(candidate.score>=95&&(!second||margin>=15))return "pronta";
  if(candidate.score>=80)return "revisar";
  if(candidate.score>=60)return "investigar";
  return "sem_correspondencia";
};
const actionFor=(transaction,candidate,identity)=>{
  if(identity?.conflito)return ACAO_CONCILIACAO.SOLICITAR_CORRECAO_CADASTRAL;
  if(!candidate)return ACAO_CONCILIACAO.SEM_CORRESPONDENCIA;
  if(candidate.tipo==="pixRegistrado"&&candidate.metadados?.pixTipo==="empresa")return ACAO_CONCILIACAO.MARCAR_TRANSFERENCIA_INTERNA;
  if(candidate.tipo==="pagamentoNota"||candidate.tipo==="pagamentoPedido")return ACAO_CONCILIACAO.VINCULAR_PAGAMENTO_EXISTENTE;
  if(candidate.tipo==="medicao"||candidate.tipo==="entradaContrato")return ACAO_CONCILIACAO.REGISTRAR_RECEBIMENTO_E_CONCILIAR;
  if(["nota","pedido","medicaoTerc","terceiro","funcionario","tituloFolha"].includes(candidate.tipo))return ACAO_CONCILIACAO.REGISTRAR_PAGAMENTO_E_CONCILIAR;
  return Number(transaction?.valor)>0?ACAO_CONCILIACAO.REGISTRAR_RECEBIMENTO_E_CONCILIAR:ACAO_CONCILIACAO.CRIAR_LANCAMENTO_NOVO_COM_REVISAO;
};

const canonicalCandidate=(candidate,identity)=>{
  if(!candidate)return null;
  const bloqueios=[...(candidate.bloqueios||[])];
  if(identity?.conflito)bloqueios.push("Chave PIX, CPF/CNPJ ou nome está associado a mais de um cadastro.");
  return {...candidate,bloqueios:[...new Set(bloqueios)],podeVincular:candidate.podeVincular&&!bloqueios.length,podeRegistrarPagamento:candidate.podeRegistrarPagamento&&!bloqueios.length};
};

export const analisarMovimentoConciliacao=(transaction,data,options={})=>{
  const registry=options.registry||criarRegistroIdentidades(data);
  const identity=identificarContraparte(transaction,registry);
  const raw=gerarCandidatosConciliacao(transaction,data,options.indices||criarIndicesFinanceiros(data),options.config);
  const candidates=raw.map(candidate=>canonicalCandidate(candidate,identity)).sort((a,b)=>b.score-a.score);
  const best=candidates[0]||null, second=candidates[1]||null;
  const operational=classification(best,second);
  // Elegível para o lote de confirmação em massa (25/08/2026, pedido do
  // usuário para ampliar além de só "pronta"): "pronta" sempre entra. Dentro
  // de "revisar" (score 80-94), só entra o subconjunto SEM ambiguidade real
  // - quando há uma segunda candidata a menos de 15 pontos da melhor,
  // classification() já classifica como "revisar" mesmo que o score da
  // melhor seja alto, porque não dá para saber com segurança qual das duas
  // é o fato certo. Confirmar isso em lote, sem revisão individual, seria
  // arriscar pagar/receber contra o registro errado - por isso fica de fora,
  // mesmo estando em "revisar".
  const margin=best?Number(best.score||0)-Number(second?.score||0):0;
  const semAmbiguidade=!second||margin>=15;
  const elegivelLote=operational==="pronta"||(operational==="revisar"&&semAmbiguidade);
  const missing=[];
  if(!identity.registro)missing.push("contraparte identificada");
  if(!transaction?.fitid&&!transaction?.endToEndId&&!transaction?.txid)missing.push("identificador bancário único");
  if(!best)missing.push("fato financeiro compatível");
  const bestOut=best?{...best,contratoId:best.metadados?.contratoId||null}:null;
  return {
    transacaoId:String(transaction?.id||""),direcao:Number(transaction?.valor)>=0?"entrada":"saida",valorCentavos:Math.abs(paraCentavos(transaction?.valor)),
    classificacaoOperacional:operational,elegivelLote,melhorCandidata:bestOut,alternativas:candidates.slice(1),
    identidadeProvavel:{tipo:identity.registro?.tipo||"outro",id:identity.registro?.id||null,nome:identity.registro?.nome||"",score:identity.registro?(identity.conflito?0:Math.min(100,identity.evidencias.length*35)):0,evidencias:identity.evidencias,conflito:identity.conflito},
    acaoRecomendada:actionFor(transaction,bestOut,identity),camposParaConfirmacao:operational==="pronta"?["confirmação humana"]:["contraparte","fato financeiro","confirmação humana"],
    efeitoDRE:best?.tipo==="medicao"||best?.tipo==="entradaContrato"?"receita_existente":best?"custo_existente":"novo_lancamento_revisado",
    auditoria:{versaoMotor:VERSAO_MOTOR_CONCILIACAO,regraIds:[],dadosUsados:[...identity.evidencias,...(best?.motivos||[])],dadosAusentes:missing},
  };
};

export const priorizarFilaConciliacao=(transactions,data,options={})=>{
  const registry=options.registry||criarRegistroIdentidades(data),indices=options.indices||criarIndicesFinanceiros(data);
  const rank={pronta:0,revisar:1,investigar:2,sem_correspondencia:3,bloqueada:4};
  return (transactions||[]).map(transaction=>({transaction,analysis:analisarMovimentoConciliacao(transaction,data,{...options,registry,indices})})).sort((a,b)=>{
    const aRank=rank[a.analysis.classificacaoOperacional],bRank=rank[b.analysis.classificacaoOperacional];
    if(aRank!==bRank)return aRank-bRank;
    if(aRank===2)return Math.abs(Number(b.transaction.valor||0))-Math.abs(Number(a.transaction.valor||0));
    return String(b.transaction.data||"").localeCompare(String(a.transaction.data||""));
  });
};

// Traduz a recomendação do motor para o comando real do servidor - usado
// pela revisão em lote (confirmar de uma vez todas as transações com
// elegivelLote===true: "pronta", mais o subconjunto de "revisar" sem
// ambiguidade real - ver o cálculo de elegivelLote acima). Só cobre os 3
// tipos de acaoRecomendada que essas classificações podem de fato ter:
// MARCAR_TRANSFERENCIA_INTERNA nunca passa de score 40 (pontuarPix em
// matching.js, abaixo do piso 80 de "revisar"), e
// CRIAR_LANCAMENTO_NOVO_COM_REVISAO/SOLICITAR_CORRECAO_CADASTRAL só
// aparecem quando não há candidata ou há conflito de identidade - as duas
// situações que classification() (acima) já classifica como
// "sem_correspondencia"/"bloqueada", nunca "pronta"/"revisar". Por isso os
// demais casos devolvem null em vez de tentar adivinhar um comando.
export const comandoConciliacaoAutomatica=(analise)=>{
  const candidata=analise?.melhorCandidata;
  if(!candidata)return null;
  const observacao=`Confirmação em lote · candidata ${analise.classificacaoOperacional}`;
  const transactionId=analise.transacaoId;
  if(analise.acaoRecomendada===ACAO_CONCILIACAO.VINCULAR_PAGAMENTO_EXISTENTE){
    return {type:"LINK_EXISTING_PAYMENT",payload:{transactionId,targetType:candidata.tipo,targetId:candidata.entidadeId,paymentId:candidata.pagamentoId||"",observacao}};
  }
  if(analise.acaoRecomendada===ACAO_CONCILIACAO.REGISTRAR_PAGAMENTO_E_CONCILIAR){
    return {type:"CONFIRM_PAYMENT",payload:{transactionId,targetType:candidata.tipo,targetId:candidata.entidadeId,targetObraId:candidata.obraId||"",observacao}};
  }
  if(analise.acaoRecomendada===ACAO_CONCILIACAO.REGISTRAR_RECEBIMENTO_E_CONCILIAR){
    return {type:"CONFIRM_RECEIPT",payload:{transactionId,targetType:candidata.tipo,targetId:candidata.entidadeId,observacao}};
  }
  return null;
};

export const resumoQuinzenaConciliacao=(data,{inicio,fim}={})=>{
  const inPeriod=value=>!inicio||!fim||(String(value||"")>=inicio&&String(value||"")<=fim);
  const transactions=(data.transacoes||[]).filter(item=>inPeriod(item.data));
  const titles=(data.titulosFolha||[]).filter(item=>inPeriod(item.periodoFim||item.vencimento));
  const people=new Map(); const byWork=new Map();
  titles.forEach(title=>{
    const employee=(data.employees||[]).find(item=>item.id===title.employeeId)||{};
    const expected=Number(title.liquido||title.valor||0),paid=(title.liquidacoes||[]).filter(active).reduce((sum,item)=>sum+Number(item.valor||0),0);
    const key=employee.id||title.employeeId; const row=people.get(key)||{pessoaId:key,nome:employee.name||employee.nome||title.funcionarioNome||"Não identificado",previsto:0,pago:0,obraId:employee.obra||"",pixTitular:employee.pixHolder||""};
    row.previsto+=expected;row.pago+=paid;people.set(key,row);
    const workKey=row.obraId||"sem_obra";const work=byWork.get(workKey)||{obraId:workKey,previsto:0,pago:0};work.previsto+=expected;work.pago+=paid;byWork.set(workKey,work);
  });
  const pixTitularDivergente=transactions.filter(item=>item.recebedorMaoObra?.pixHolder&&item.recebedorMaoObra.pixHolder!==item.recebedorMaoObra.employeeName);
  const pagamentosParciais=[...people.values()].filter(item=>item.pago>0&&item.pago<item.previsto);
  const foraCompetencia=transactions.filter(item=>item.recebedorMaoObra&&titles.every(title=>String(title.employeeId)!==String(item.recebedorMaoObra.employeeId)||!inPeriod(title.periodoFim||title.vencimento)));
  const previsto=[...people.values()].reduce((sum,item)=>sum+item.previsto,0),pago=[...people.values()].reduce((sum,item)=>sum+item.pago,0);
  return {inicio,fim,totalPrevisto:previsto,totalPago:pago,saldoPendente:previsto-pago,totalOperarios:people.size,totalTerceirizados:(data.medicoesTerc||[]).filter(item=>inPeriod(item.data)).length,porPessoa:[...people.values()].map(item=>({...item,saldo:item.previsto-item.pago})),porObra:[...byWork.values()].map(item=>({...item,saldo:item.previsto-item.pago})),pagamentosParciais,foraCompetencia,pixTitularDivergente,transacoes:transactions};
};
