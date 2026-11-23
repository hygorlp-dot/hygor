import {TaskDisclosure} from '../../../design-system/patterns/TaskDisclosure.jsx';
import {ScopeNote} from '../../../design-system/patterns/ScopeNote.jsx';
import {fmt} from '../../../legacy/format.js';

export function DashboardFinancialReading({dre,period,showCash=false,showResult=false}){
 if(!showCash&&!showResult)return null;
 return <TaskDisclosure summary="Como ler os indicadores">
  <ScopeNote title="Faturamento por competência">{fmt(dre.faturamento)} em {period}. É a receita reconhecida no mês, independentemente da data do recebimento.</ScopeNote>
  {showResult&&<ScopeNote title="Custos reconhecidos">{fmt(dre.totalCustos)} na mesma competência. A comparação percentual usa o faturamento, não as entradas de caixa.</ScopeNote>}
  {showCash&&<ScopeNote title="Movimento de caixa">Entradas de {fmt(dre.entradasCaixa)} e saídas de {fmt(dre.saidasCaixa)} no mês. O movimento líquido é {fmt(dre.saldoCaixa)}; não é o saldo acumulado das contas bancárias.</ScopeNote>}
  <ScopeNote title="Situação das obras">O cartão Obras ativas conta os cadastros que não estão concluídos ou pausados. A contagem de críticas do critério executivo considera o cadastro completo disponível: prazo vencido com avanço abaixo de 100%, margem negativa ou faturamento mais de 20 pontos à frente do avanço. O Placar das obras segue os critérios operacionais descritos no próprio quadro.</ScopeNote>
 </TaskDisclosure>;
}
