import {useMemo,useState} from "react";
import {Button} from "../../design-system/primitives/Button.jsx";
import {Dialog} from "../../design-system/primitives/Dialog.jsx";
import {Input} from "../../design-system/primitives/Input.jsx";
import {Select} from "../../design-system/primitives/Select.jsx";
import {PageHeader} from "../../design-system/patterns/PageHeader.jsx";
import {EmptyState} from "../../design-system/patterns/FeedbackState.jsx";
import {TaskDisclosure} from "../../design-system/patterns/TaskDisclosure.jsx";
import {contar} from "../../design-system/copy.js";
import {podeAcessarAba} from "../../domains/administracao/abas-acesso.js";
import {active,toCents} from "../../domains/financeiro/facts.js";
import {financialDateLabel,isFinancialDate} from "../../domains/financeiro/dates.js";
import {documentEvidenceInfo,entryEvidenceDocuments} from "../../domains/financeiro/document-evidence.js";
import {calculateWorkCash,workCashNature} from "../../domains/financeiro/work-cash.js";
import {WORK_CASH_COMMAND} from "../../domains/financeiro/work-cash-commands.js";
import {fmt,today,uid} from "../../legacy/format.js";
import {useWorkflow} from "../workflow/WorkflowNavigation.jsx";
import {useSyncedWorkObra,workContextObraId} from "../workflow/work-context.js";
import FinancialDocumentLink from "./FinancialDocumentLink.jsx";
import "./work-cash.css";

const newMovement = type=>({id:uid(),data:today(),tipo:type,categoria:type==="aporte"?"aporte":"material",descricao:"",valor:"",comprovante:""});

export default function WorkCashView({data,currentUser,dispatchCommand,showToast,categories,onReport}){
  const {intent,navigate}=useWorkflow();
  const works=data.obras || [];
  const enabled=works.filter(work=>work.hasCaixa && active(work));
  const [selected,setSelected]=useState(()=>workContextObraId() || enabled[0]?.id || "");
  const [form,setForm]=useState(null);
  const [pending,setPending]=useState(false);
  useSyncedWorkObra(selected,setSelected,{allowedIds:works.map(work=>work.id),fixed:form?selected:""});
  const obra=enabled.find(work=>work.id===selected);
  const cash=useMemo(()=>calculateWorkCash(data,selected),[data.caixaObra,selected]);
  const scoped=!currentUser?.obraId || currentUser.obraId===selected;
  const canManage=scoped && podeAcessarAba(currentUser,"caixa") && ["admin","financeiro"].includes(currentUser?.role);
  const canBank=scoped && navigate && podeAcessarAba(currentUser,"conc") && ["admin","financeiro"].includes(currentUser?.role);
  const opening=intent?.tabId==="caixa" && intent.action==="review-work-cash" ? intent.record?.movementId : null;
  const focused=cash.movimentos.find(item=>item.id===opening);
  const rows=focused ? [focused,...cash.movimentos.filter(item=>item.id!==focused.id)] : cash.movimentos;
  const amount=toCents(form?.valor);
  const nextBalance=cash.saldo+(form?.tipo==="aporte"?amount:-amount)/100;
  const canSave=amount>0 && isFinancialDate(form?.data) && (form.tipo==="aporte" || toCents(nextBalance)>=0);
  const setField=(key,value)=>setForm(current=>({...current,[key]:value}));

  const save=async event=>{
    event.preventDefault();
    if(!canManage||!obra||!canSave||!dispatchCommand||pending)return;
    setPending(true);
    try{
      const result=await dispatchCommand({
        type:WORK_CASH_COMMAND.WORK_CASH_MOVEMENT_CREATED,idempotencyKey:`work-cash-create-${form.id}`,expectedVersion:0,
        payload:{movement:{...form,obraId:obra.id,valor:amount/100}},
      });
      if(!result?.ok)throw new Error(result?.reason || "Não foi possível registrar o movimento.");
      setForm(null);
      const low=form.tipo==="despesa"&&nextBalance<=Math.max(500,cash.totalAportes*.10);
      showToast(low?`Despesa registrada. Saldo baixo de ${fmt(nextBalance)}.` : form.tipo==="aporte"?"Aporte registrado.":"Despesa registrada.",low?"warn":undefined);
    }catch(error){showToast(error.message,"error");}
    finally{setPending(false);}
  };

  const cancel=async movement=>{
    if(!canManage||pending||!dispatchCommand)return;
    const reason=window.prompt("Motivo do cancelamento deste lançamento:")?.trim();
    if(!reason)return;
    setPending(true);
    try{
      const result=await dispatchCommand({
        type:WORK_CASH_COMMAND.WORK_CASH_MOVEMENT_CANCELLED,
        idempotencyKey:`work-cash-cancel-${movement.id}-${uid()}`,expectedVersion:Number(movement.version||0),
        payload:{movementId:movement.id,reason},
      });
      if(!result?.ok)throw new Error(result?.reason || "Não foi possível cancelar o movimento.");
      showToast("Lançamento cancelado e preservado no histórico.");
    }catch(error){showToast(error.message,"error");}
    finally{setPending(false);}
  };

  const history=(data.caixaObra||[]).filter(item=>item.obraId===obra?.id&&!active(item));
  return <div className="work-cash">
    <PageHeader className="workspace-header" title="Caixa da obra" description="Saldo, movimentações e comprovantes por obra."/>
    {!enabled.length ? <EmptyState title="Nenhuma obra com caixa ativado" description="No cadastro da obra, confira a opção Esta obra possui caixa de obra."/> : <>
      <Select label="Obra do caixa" value={selected} disabled={Boolean(form)} onChange={event=>setSelected(event.target.value)}>
        {!obra&&<option value={selected} disabled>{works.find(work=>work.id===selected)?.name || "Obra não disponível"} · Caixa não ativado</option>}
        {enabled.map(work=><option key={work.id} value={work.id}>{work.name}</option>)}
      </Select>
      {!obra ? <EmptyState title="A obra em foco não possui caixa ativado" description="Escolha uma obra em Obra do caixa ou confira a ativação no cadastro."/> : <>
        <dl className="page-hero__stats" aria-label={`Resumo do caixa de ${obra.name}`}>
          {[["Saldo em caixa",cash.saldo],["Entradas",cash.totalAportes],["Despesas",cash.totalDespesas],["Devoluções",cash.totalDevolucoes]].map(([label,value])=>
            <div className="page-hero__stat" key={label}><dt className="page-hero__stat-label">{label}</dt><dd className="page-hero__stat-value">{fmt(value)}</dd></div>)}
        </dl>
        {canManage&&<div className="work-cash__actions">
          <Button disabled={pending} onClick={()=>setForm(newMovement("despesa"))}>Registrar despesa</Button>
          <Button variant="outline" disabled={pending} onClick={()=>setForm(newMovement("aporte"))}>Registrar aporte</Button>
        </div>}
        <section className="work-cash__panel" aria-label="Extrato do caixa">
          <header className="work-cash__row"><h2>Extrato do caixa</h2>
            {rows.length>0&&<Button variant="ghost" onClick={()=>onReport(obra,cash)}>PDF do extrato</Button>}
          </header>
          {opening&&!focused&&<p role="status">O movimento de origem não está disponível neste caixa.</p>}
          {!rows.length&&<EmptyState title="Nenhum movimento no caixa" description="Para recursos que passaram pelo banco, comece na Conciliação. A transferência aparece aqui com o vínculo bancário."/>}
          {rows.map(movement=>{
            const transaction=(data.transacoes||[]).find(item=>movement.transacaoId && item.id===movement.transacaoId && active(item));
            const bankId=transaction?.id;
            const documents=entryEvidenceDocuments({record:movement,documents:transaction?.documentos});
            const nature=workCashNature(movement);
            const linked=Boolean(movement.pagamentoId||movement.pedidoId||movement.notaFiscalId||movement.medicaoId);
            const date=movement.data;
            return <article className="work-cash__movement" key={movement.id}>
              <div className="work-cash__row">
                <div><h3>{movement.descricao || nature}</h3><p>{nature} · {financialDateLabel(date)}</p></div>
                <div className="work-cash__amount"><strong>{movement.tipo==="aporte"?"+":"−"} {fmt(movement.valor)}</strong><p>Saldo após {fmt(movement.saldoAcumulado)}</p></div>
              </div>
              <TaskDisclosure key={movement.id+String(movement.id===opening)} defaultOpen={movement.id===opening} summary="Origem, comprovante e DRE">
                <p>{bankId?"Movimento do extrato bancário vinculado.":movement.transacaoId?"Movimento bancário indisponível neste recorte.":linked?"Movimento gerado por um registro financeiro vinculado.":"Lançamento registrado diretamente no caixa."}</p>
                {movement.comprovante&&<p>Referência do comprovante · {movement.comprovante}</p>}
                {documents.length>0 ? <ul>{documents.map((item,index)=>{
                  const {url,reference}=documentEvidenceInfo(item);
                  return <li key={item.id || index}>{url||reference?<FinancialDocumentLink href={url} reference={reference}>{item.legenda||item.nome||"Abrir comprovante"}</FinancialDocumentLink>:"Comprovante cadastrado sem link disponível."}</li>;
                })}</ul> : !movement.comprovante&&<p>Sem comprovante vinculado.</p>}
                <p>{movement.tipo==="despesa"?(linked?"O custo é apurado no registro de origem.":"A despesa é reconhecida no DRE da obra."):"Movimento de caixa sem efeito no resultado."}</p>
                <div className="work-cash__actions">
                  {bankId&&canBank&&<Button variant="outline" onClick={()=>navigate("conc",{obraId:obra.id},{
                    action:"review-financial-origin",record:{transactionIds:[bankId],accountId:transaction.contaBancariaId||"",label:movement.descricao||nature},
                  })}>Ver na Conciliação</Button>}
                  {navigate&&scoped&&podeAcessarAba(currentUser,"dre")&&isFinancialDate(date)&&<Button variant="ghost"
                    onClick={()=>navigate("dre",{obraId:obra.id,year:Number(date.slice(0,4)),month:Number(date.slice(5,7))-1})}>Ver DRE por obra</Button>}
                  {canManage&&!linked&&!movement.transacaoId&&<Button variant="ghost" disabled={pending} onClick={()=>cancel(movement)}>Cancelar lançamento</Button>}
                </div>
              </TaskDisclosure>
            </article>;
          })}
        </section>
        {history.length>0&&<TaskDisclosure summary={contar(history.length,"lançamento cancelado ou estornado","lançamentos cancelados ou estornados")}>
          <ul>{history.map(item=><li key={item.id}>{item.descricao || workCashNature(item)} · {fmt(item.valor)}{item.motivoCancelamento ? ` · ${item.motivoCancelamento}` : ""}</li>)}</ul>
        </TaskDisclosure>}
      </>}
      <TaskDisclosure summary="Saldos das obras">
        {enabled.map(work=><Button key={work.id} variant="ghost" aria-pressed={work.id===selected} disabled={Boolean(form)} onClick={()=>setSelected(work.id)}>
          {work.name} · {fmt(calculateWorkCash(data,work.id).saldo)}
        </Button>)}
      </TaskDisclosure>
    </>}
    {form&&obra&&<Dialog open title={form.tipo==="aporte"?"Registrar aporte":"Registrar despesa"} onOpenChange={()=>!pending&&setForm(null)}>
      <form className="work-cash" onSubmit={save}>
        <p>Obra do lançamento <strong>{obra.name}</strong></p>
        <Input label="Data" type="date" required value={form.data} onChange={event=>setField("data",event.target.value)}/>
        {form.tipo==="despesa"&&<Select label="Categoria" value={form.categoria} onChange={event=>setField("categoria",event.target.value)}
          options={categories.map(item=>({value:item.v,label:item.l}))}/>}
        <Input label="Descrição" value={form.descricao} onChange={event=>setField("descricao",event.target.value)}/>
        <Input label="Valor (R$)" type="number" inputMode="decimal" required min=".01" step=".01"
          value={form.valor} onChange={event=>setField("valor",event.target.value)}/>
        <Input label="Referência da nota ou comprovante" value={form.comprovante} onChange={event=>setField("comprovante",event.target.value)}/>
        {amount>0&&<p role="status">Saldo após o lançamento <strong>{fmt(nextBalance)}</strong>{toCents(nextBalance)<0&&". A despesa supera o saldo disponível."}</p>}
        <p>{form.tipo==="aporte"?"Se o valor veio do banco, registre o vínculo pela Conciliação.":"Se a despesa já veio de Compras ou da Conciliação, consulte o registro de origem antes de lançar."}</p>
        <div className="work-cash__actions">
          <Button variant="ghost" disabled={pending} onClick={()=>setForm(null)}>Cancelar</Button>
          <Button type="submit" disabled={!canSave||pending}>Confirmar lançamento</Button>
        </div>
      </form>
    </Dialog>}
  </div>;
}
