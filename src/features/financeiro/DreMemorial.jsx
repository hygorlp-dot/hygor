import { Button } from "../../components/ui/button.jsx";
import { ANNUAL_SOURCES, annualSourceValues } from "../../domains/dre/annual-statement.js";

const money=value=>(Number(value||0)/100).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const labels={id:"Identificador",obraId:"Obra",sourceId:"Registro de origem",sourceType:"Tipo de origem",dueDate:"Vencimento",paidAmountCents:"Valor pago (centavos)",lastSettlementDate:"Último pagamento",expenseDetails:"Dados da despesa",documentos:"Documentos anexados",invoices:"Notas fiscais vinculadas",calculation:"Memória de cálculo",dataEmissao:"Data de emissão",dataVencimento:"Vencimento",dataPagamento:"Data de pagamento",competencia:"Competência",valorTotal:"Valor total",valorBruto:"Valor bruto",valorLiquido:"Valor líquido",fornecedorNome:"Fornecedor",numero:"Número",url:"Abrir documento",webUrl:"Abrir documento",nome:"Nome",descricao:"Descrição",observacao:"Observação",status:"Situação",itens:"Itens",pagamentos:"Pagamentos",recebimentos:"Recebimentos",metadata:"Dados complementares"};
const label=key=>labels[key]||key.replace(/([a-z])([A-Z])/g,"$1 $2").replaceAll("_"," ").replace(/^./,c=>c.toUpperCase());
export const safeDocumentUrl=value=>{
  if(typeof value!=="string")return null;
  try{const url=new URL(value);return ["https:","http:"].includes(url.protocol)?url.href:null;}catch{return null;}
};
function Documents({item}){
  const links=new Map();
  const visit=(value,name="Documento anexado")=>{
    if(!value)return;
    if(Array.isArray(value)){value.forEach(child=>visit(child,name));return;}
    if(typeof value==="object"){
      Object.values(value).forEach(child=>visit(child,value.nome||value.name||value.legenda||name));return;
    }
    const url=safeDocumentUrl(value);if(url)links.set(url,name);
  };
  visit(item.record);visit(item.invoices);visit(item.documents);visit(item.metadata);
  return <div className="dre-memorial__documents"><h5>Notas fiscais e documentos</h5>{links.size?<ul>{[...links].map(([url,name])=><li key={url}><a href={url} target="_blank" rel="noopener noreferrer">{name} · Abrir em nova aba</a></li>)}</ul>:<p>Nenhum link de nota fiscal ou documento anexado a este lançamento.</p>}</div>;
}
function Value({value}){
  if(value==null||value==="")return "Não informado";
  if(typeof value==="boolean")return value?"Sim":"Não";
  if(Array.isArray(value))return value.length?<ol>{value.map((item,index)=><li key={index}><Value value={item}/></li>)}</ol>:"Nenhum registro";
  if(typeof value==="object")return <dl className="dre-memorial__fields">{Object.entries(value).map(([key,item])=><div key={key}><dt>{label(key)}</dt><dd><Value value={item}/></dd></div>)}</dl>;
  const url=safeDocumentUrl(value);
  if(url)return <a href={url} target="_blank" rel="noopener noreferrer">Abrir documento em nova aba</a>;
  if(/^\d{4}-\d{2}-\d{2}$/.test(String(value)))return String(value).split("-").reverse().join("/");
  return String(value);
}
export default function DreMemorial({row,month,onOpenWork}){
  const values=annualSourceValues(month);
  return <div className="dre-memorial"><p>Memorial dos lançamentos por competência. Expanda um lançamento para consultar todos os seus dados e documentos.</p>
    {!month.memorial&&<p role="status">Este demonstrativo foi salvo sem o memorial dos lançamentos. O total histórico foi preservado; os documentos de origem não estão disponíveis neste fechamento.</p>}
    {row.sources.map(source=>{
      const items=month.memorial?.[source]||[],total=values[source]||0;
      const sum=items.reduce((acc,item)=>acc+item.amountCents,0),difference=total-sum;
      const rate=month.memorialRates?.[source];
      const base=source.startsWith("deducao")?Math.max(0,Number(month.faturamentoTotal||0)-Number(month.descontoLocacoes||0)):Math.max(0,Number(month.lair||0));
      return <section key={source} className="dre-memorial__source" aria-label={ANNUAL_SOURCES.find(item=>item.id===source)?.label}>
        <h4>{ANNUAL_SOURCES.find(item=>item.id===source)?.label} <span>{money(total)}</span></h4>
        {rate!=null?<p>Provisão calculada: {money(Math.round(base*100))} × {rate.toLocaleString("pt-BR")}% = {money(total)}. Não corresponde a uma nota fiscal.</p>:<>
          {items.map((item,index)=><details key={`${item.id}:${index}`} className="dre-memorial__entry">
            <summary><span>{item.description||"Lançamento"}<small>{item.obra} · <Value value={item.date}/></small></span><strong>{money(item.amountCents)}</strong></summary>
            <div className="dre-memorial__body">
              <dl className="dre-memorial__fields">
                <div><dt>Obra</dt><dd>{item.obra}{item.obraId&&onOpenWork&&<Button variant="outline" size="sm" onClick={()=>onOpenWork(item.obraId)}>Abrir obra</Button>}</dd></div>
                <div><dt>Data do lançamento</dt><dd><Value value={item.date}/></dd></div>
                <div><dt>Competência</dt><dd>{item.competence}</dd></div>
                <div><dt>Cliente / fornecedor</dt><dd>{item.counterparty||item.record?.fornecedor||item.record?.fornecedorNome||"Não informado"}</dd></div>
                <div><dt>Documento</dt><dd>{item.documentNumber||item.record?.documento||"Não informado"}</dd></div>
                <div><dt>Valor apropriado no DRE</dt><dd>{money(item.amountCents)}</dd></div>
                <div><dt>Origem</dt><dd>{item.sourceType} · {item.sourceId}</dd></div>
                <div><dt>Situação</dt><dd>{{recognized:"Reconhecido no DRE",open:"Em aberto",paid:"Pago"}[item.record?.status||item.status]||item.record?.status||item.status||"Não informada"}</dd></div>
              </dl>
              {item.note&&<p>{item.note}</p>}
              <Documents item={item}/>
              {item.record?<><h5>Dados completos do lançamento</h5><Value value={item.record}/></>:<p>Não há ficha operacional vinculada a este registro.</p>}
              {item.invoices?.length>0&&<><h5>Notas fiscais vinculadas</h5><Value value={item.invoices}/></>}
              {item.documents?.length>0&&<><h5>Documentos da movimentação</h5><Value value={item.documents}/></>}
              {item.calculation&&<><h5>Memória de cálculo</h5><Value value={item.calculation}/></>}
              {item.metadata&&Object.keys(item.metadata).length>0&&<><h5>Informações complementares</h5><Value value={item.metadata}/></>}
            </div>
          </details>)}
          {!items.length&&<p>{total===0?"Sem lançamentos nesta competência.":"Não há lançamentos individualizados disponíveis para esta fonte."}</p>}
          {items.length>0&&<p>Soma dos lançamentos: <strong>{money(sum)}</strong></p>}
          {difference!==0&&<p role="status">Parcela do total sem detalhamento individual: <strong>{money(difference)}</strong>. Pode incluir ajustes do demonstrativo; não representa um documento adicional.</p>}
        </>}
      </section>;
    })}
    {!row.sources.length&&<p>Esta linha ainda não tem fonte vinculada. Use Ajustar linhas para transferir uma fonte existente.</p>}
  </div>;
}
