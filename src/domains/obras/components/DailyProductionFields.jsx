import {Input} from '../../../design-system/primitives/Input.jsx';
import {Select} from '../../../design-system/primitives/Select.jsx';
import {FilterBar} from '../../../design-system/patterns/FilterBar.jsx';
import {FormSection} from '../../../design-system/patterns/FormSection.jsx';
import {Alert,AlertDescription} from '../../../components/ui/alert.jsx';
import {dailyWorkforce,productionNumber} from '../../diario-obra/production.js';

export function DailyProductionFields({data,report,budget,production,onChange,equipe,tarefaId,onProgress}){
  const item=(budget?.itens||[]).find(row=>row.id===production.budgetItemId);
  const previous=(data.rdos||[]).filter(log=>log.obraId===report.obraId&&log.data<report.data&&log.status==='concluido'&&log.revisaoEngenheiro?.aprovado).sort((a,b)=>b.data.localeCompare(a.data)).flatMap(log=>log.servicos||[]).find(row=>row.budgetItemId===item?.id&&row.budgetId===budget?.id&&Number(row.budgetQuantity)===Number(item?.quantidade));
  const base=Number(previous?.progressoAte||0),roster=dailyWorkforce(data,report.obraId,report.data);
  return <FormSection title="Levantamento diário da atividade" description="O engenheiro registra a produção uma vez. Ponto, orçamento e este levantamento alimentam as previsões automaticamente após revisão e conclusão.">
    <FilterBar label="Produção executada no dia" layout="grid">
      <Select label="Item do orçamento da atividade" value={production.budgetItemId||''} onChange={event=>{const chosen=(budget?.itens||[]).find(row=>row.id===event.target.value);onChange({budgetQuantity:chosen?.quantidade??'',budgetId:budget?.id||'',budgetItemId:chosen?.id||'',unidade:chosen?.unidade||''});}}><option value="">Selecione o vínculo</option>{(budget?.itens||[]).filter(row=>row.tipo!=='titulo').map(row=><option key={row.id} value={row.id}>{row.descricao||row.nome||row.id}</option>)}</Select>
      <Input label="Unidade da produção" readOnly value={item?.unidade||''}/>
      <Input label="Quantidade executada hoje" type="number" min="0" step="any" value={production.quantidadeDia??''} onChange={event=>{const quantity=productionNumber(event.target.value);onChange({quantidadeDia:event.target.value});if(quantity!==null&&quantity>=0&&Number(item?.quantidade)>0)onProgress(String(Math.min(100,base+quantity/Number(item.quantidade)*100)));}} description="Informe zero se a equipe trabalhou sem produção aceita. Não repita a quantidade acumulada."/>
    </FilterBar>
    <p>{previous?`Acumulado anterior revisado: ${base.toLocaleString('pt-BR')}%.`:'Sem acumulado anterior revisado nesta base. A sugestão parte de zero; confirme a posição inicial no Progresso acumulado.'} A quantidade de hoje sugere o novo percentual acumulado; confira antes de salvar.</p>
    {!budget&&<Alert variant="warning"><AlertDescription>Orçamento de controle ausente. Vincule a base antes de concluir o levantamento.</AlertDescription></Alert>}
    {equipe.map(id=>{const person=roster.find(row=>row.employeeId===id),other=(report.servicos||[]).some(row=>row.tarefaId!==tarefaId&&(row.equipe||[]).includes(id));return <FilterBar key={id} label={`Horas da atividade para ${person?.name||id}`} layout="grid"><Input label={`Horas do ponto · ${person?.name||id}`} readOnly value={person?.hours??''} description={person?.hours==null?'Horários completos ainda não disponíveis no ponto.':'Horas efetivamente registradas, com intervalo descontado.'}/><Input label={`Horas nesta atividade · ${person?.name||id}`} type="number" min="0" max={person?.hours??24} step="0.01" value={production.horasPorPessoa?.[id]??(other?'':person?.hours??'')} onChange={event=>onChange({horasPorPessoa:{...production.horasPorPessoa,[id]:event.target.value}})} description={other?'Pessoa vinculada a mais de uma atividade: distribua as horas sem exceder o ponto.':'Toda a jornada é utilizada enquanto esta for a única atividade da pessoa; ajuste se houve trabalho fora dela.'}/></FilterBar>;})}
  </FormSection>;
}
