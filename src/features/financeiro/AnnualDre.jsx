import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { consultarDreAnual, salvarLayoutDreAnual } from "../../api.js";
import { ANNUAL_GROUPS, ANNUAL_SOURCES, buildAnnualStatement } from "../../domains/dre/annual-statement.js";
import DreMemorial from "./DreMemorial.jsx";
import "./annual-dre.css";

const MONTHS=["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
const money=value=>(value/100).toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2});
const percentage=value=>value==null?"—":`${value.toLocaleString("pt-BR",{maximumFractionDigits:1})}%`;

export default function AnnualDre({update,onOpenWork}){
  const [year,setYear]=useState(new Date().getFullYear());
  const [report,setReport]=useState(null),[loading,setLoading]=useState(false),[error,setError]=useState("");
  const [draft,setDraft]=useState(null),[selected,setSelected]=useState(""),[busy,setBusy]=useState(false),[status,setStatus]=useState("");
  const [hideZero,setHideZero]=useState(true),[detail,setDetail]=useState(null);
  const dialog=useRef(null),request=useRef(0),saving=useRef(false);
  const load=useCallback(async()=>{
    const token=++request.current;setLoading(true);setError("");setReport(null);
    try{
      const result=await consultarDreAnual(year);
      if(token!==request.current)return;
      if(!result.ok)throw new Error(result.error||"Não foi possível consultar o DRE anual.");
      setReport(result);
    }catch(cause){if(token===request.current)setError(cause.message);}
    finally{if(token===request.current)setLoading(false);}
  },[year]);
  useEffect(()=>{load();return()=>{request.current+=1;};},[load]);
  useEffect(()=>{if((draft||detail)&&!dialog.current?.open)dialog.current?.showModal();},[draft,detail]);
  const matrix=useMemo(()=>report?buildAnnualStatement(report.months,report.layout):[],[report]);
  const edited=draft?.find(row=>row.id===selected);
  const patch=changes=>setDraft(rows=>rows.map(row=>row.id===selected?{...row,...changes}:row));
  const close=()=>{if(saving.current)return;dialog.current?.close();setDraft(null);setDetail(null);};
  const move=direction=>setDraft(rows=>{
    const peers=rows.filter(row=>row.group===edited.group),index=peers.findIndex(row=>row.id===selected),other=peers[index+direction];
    if(!other)return rows;
    const copy=rows.slice(),a=copy.findIndex(row=>row.id===selected),b=copy.findIndex(row=>row.id===other.id);
    [copy[a],copy[b]]=[copy[b],copy[a]];return copy;
  });
  const save=async()=>{
    if(saving.current)return;saving.current=true;setBusy(true);setError("");setStatus("Salvando…");
    try{
      const sync=await update({__aguardarFila:true});
      if(!sync?.ok)throw new Error("Conclua o salvamento pendente antes de ajustar o DRE.");
      const result=await salvarLayoutDreAnual({rows:draft,expectedVersion:report.layout.version});
      if(!result.ok)throw new Error(result.error||"Não foi possível salvar a estrutura.");
      await update({__adotarServidorPatch:true,sections:result.sections||{},updatedAt:result.updatedAt});
      setReport(current=>({...current,layout:result.layout}));
      dialog.current.close();setDraft(null);setStatus("Salvo");
    }catch(cause){setError(cause.message);setStatus("Falha ao salvar");}
    finally{saving.current=false;setBusy(false);}
  };
  const openEditor=()=>{setError("");setDraft(report.layout.rows.map(row=>({...row,sources:row.sources.slice()})));setSelected(report.layout.rows[0].id);};
  const exportCsv=()=>{
    const escape=value=>`"${String(value).replace(/"/g,'""')}"`;
    const safeLabel=value=>/^[\s]*[=+@-]/.test(value)?`'${value}`:value;
    const csv=[[`DRE anual ${year} · competência · valores em R$`,...MONTHS,"Total do ano"],...matrix.map(row=>[safeLabel(row.label),...(row.values||Array(12).fill(null)).map(value=>value==null?"":row.kind==="margin"?percentage(value):money(value)),row.total==null?"":row.kind==="margin"?percentage(row.total):money(row.total)])].map(row=>row.map(escape).join(";")).join("\r\n");
    const url=URL.createObjectURL(new Blob(["\uFEFF",csv],{type:"text/csv;charset=utf-8;"})),link=document.createElement("a");
    link.href=url;link.download=`DRE-${year}.csv`;link.click();URL.revokeObjectURL(url);
  };
  const net=matrix.find(row=>row.id==="netProfit"),revenue=matrix.find(row=>row.id==="netRevenue"),margin=matrix.find(row=>row.id==="netMargin");
  return <section className="annual-dre" aria-label="DRE anual ajustável">
    <header className="annual-dre__header"><div><span className="annual-dre__eyebrow">RESULTADO DA EMPRESA · COMPETÊNCIA</span><h2>DRE mês a mês</h2><p>Obras, locações e despesas da empresa em uma visão anual. Valores em reais.</p></div><div className="annual-dre__tools">
      <label>Ano<input type="number" min="2000" max="2100" value={year} disabled={!!draft} onChange={event=>setYear(event.target.value)}/></label>
      <button type="button" disabled={loading||!!draft} onClick={load}>Atualizar</button>
      <button type="button" disabled={!report||loading} onClick={exportCsv}>Exportar CSV</button>
      <button type="button" className="annual-dre__primary" disabled={!report||loading} onClick={openEditor}>Ajustar linhas</button>
    </div></header>
    <div role="status" className="annual-dre__status">{loading?"Consultando os 12 meses…":status}</div>
    {error&&!draft&&<p role="alert" className="annual-dre__error">{error}</p>}
    {report&&<>
      <div className="annual-dre__summary"><div>Receita líquida no ano<strong>R$ {money(revenue.total)}</strong></div><div>Lucro líquido no ano<strong data-negative={net.total<0}>R$ {money(net.total)}</strong></div><div>Margem líquida anual<strong>{percentage(margin.total)}</strong></div></div>
      <div className="annual-dre__table-tools"><label><input type="checkbox" checked={hideZero} onChange={event=>setHideZero(event.target.checked)}/> Ocultar linhas sem movimento</label><span>Clique em um valor para consultar lançamentos, obras e documentos.</span></div>
      {report.issues?.length>0&&<p className="annual-dre__error" role="alert">Há {report.issues.length} registro(s) com classificação pendente no razão. Confira a gestão financeira antes de concluir a análise.</p>}
      <div className="annual-dre__scroll" role="region" aria-label="Tabela mensal do DRE; role horizontalmente para consultar os meses" tabIndex={0}>
        <table><caption>DRE {year} · regime de competência · R$</caption><thead><tr><th scope="col">Conta de resultado</th>{MONTHS.map(month=><th key={month} scope="col">{month}</th>)}<th scope="col">Total do ano</th></tr></thead><tbody>
          {matrix.filter(row=>!hideZero||row.kind!=="line"||row.values.some(value=>value!==0)).map(row=><tr key={row.id} className={`annual-dre__${row.kind}`}>
            <th scope="row">{row.label}</th>{row.kind==="group"?<td colSpan={13}/>:<>{row.values.map((value,index)=><td key={index} data-negative={value<0}>{row.kind==="line"?<button type="button" aria-label={`${row.label}, ${MONTHS[index]}: R$ ${money(value)}`} onClick={()=>setDetail({row,index})}>{value===0?"—":money(value)}</button>:row.kind==="margin"?percentage(value):money(value)}</td>)}<td data-negative={row.total<0}>{row.kind==="margin"?percentage(row.total):money(row.total)}</td></>}
          </tr>)}
        </tbody></table>
      </div><p className="annual-dre__note">Os subtotais seguem o razão do DRE da empresa. Aportes e transferências não compõem receita. A margem anual usa o resultado e a receita do ano inteiro. Provisões seguem as alíquotas configuradas; valores futuros podem conter registros já programados.</p>
    </>}
    <dialog ref={dialog} className="annual-dre__dialog" aria-labelledby="annual-dialog-title" onCancel={event=>{event.preventDefault();close();}}>
      {draft&&<><header><div><h3 id="annual-dialog-title">Ajustar estrutura do DRE</h3><p>Personalize nomes e ordem. Cada fonte pertence a uma única linha.</p></div><button type="button" onClick={close} disabled={busy} aria-label="Fechar ajustes">×</button></header>
        {error&&<p role="alert" className="annual-dre__error">{error}</p>}
        <div className="annual-dre__editor"><nav aria-label="Linhas do DRE">{ANNUAL_GROUPS.map(group=><div key={group.id}><strong>{group.label}</strong>{draft.filter(row=>row.group===group.id).map(row=><button type="button" key={row.id} aria-pressed={selected===row.id} onClick={()=>setSelected(row.id)} disabled={busy}>{row.label||"Sem nome"}</button>)}</div>)}</nav>
          {edited&&<fieldset disabled={busy}><legend>Editar linha</legend><label>Nome da linha<input maxLength={120} value={edited.label} onChange={event=>patch({label:event.target.value})}/></label><p>Grupo: <strong>{ANNUAL_GROUPS.find(group=>group.id===edited.group).label}</strong></p>
            <div className="annual-dre__tools"><button type="button" onClick={()=>move(-1)}>Subir linha</button><button type="button" onClick={()=>move(1)}>Descer linha</button><button type="button" disabled={edited.sources.length>0||draft.length<=1} onClick={()=>{setDraft(rows=>rows.filter(row=>row.id!==selected));setSelected(draft.find(row=>row.id!==selected).id);}}>Excluir linha vazia</button></div>
            <h4>Dados que alimentam esta linha</h4><p>Marcar uma fonte transfere seu valor da linha indicada para esta. Os totais são preservados.</p>
            {ANNUAL_SOURCES.filter(item=>item.group===edited.group).map(item=>{const owner=draft.find(row=>row.sources.includes(item.id));return <label key={item.id} className="annual-dre__source"><input type="checkbox" checked={owner?.id===selected} onChange={()=>{if(owner?.id===selected)return;setDraft(rows=>rows.map(row=>({...row,sources:row.id===selected?[...row.sources,item.id]:row.sources.filter(id=>id!==item.id)})));}}/><span>{item.label}<small>{owner?.id===selected?"Nesta linha":`Transferir de: ${owner?.label}`}</small></span></label>;})}
            <p>Para retirar uma fonte, selecione outra linha deste grupo e transfira a fonte para ela.</p>
            <button type="button" onClick={()=>{const row={id:`custom_${crypto.randomUUID()}`,label:"Nova linha",group:edited.group,sources:[]};setDraft(rows=>[...rows,row]);setSelected(row.id);}}>+ Adicionar linha neste grupo</button>
          </fieldset>}
        </div><footer><span role="status">{busy?"Salvando…":"A estrutura é compartilhada entre todos os anos."}</span><button type="button" disabled={busy} onClick={close}>Cancelar</button><button type="button" disabled={busy} className="annual-dre__primary" onClick={save}>Salvar estrutura</button></footer></>}
      {detail&&<><header><h3 id="annual-dialog-title">{detail.row.label} · {MONTHS[detail.index]} / {year}</h3><button type="button" onClick={close} aria-label="Fechar memorial">×</button></header><DreMemorial row={detail.row} month={report.months[detail.index]} onOpenWork={onOpenWork?obraId=>{close();onOpenWork(obraId);}:undefined}/><p>Total: <strong>R$ {money(detail.row.values[detail.index])}</strong></p><footer><button type="button" onClick={close}>Fechar</button></footer></>}
    </dialog>
  </section>;
}
