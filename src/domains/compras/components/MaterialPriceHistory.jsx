import {Line,LineChart,ResponsiveContainer,Tooltip,XAxis,YAxis} from "../../../components/charts/LazyRecharts";
import {useMemo,useState} from "react";
import {Input} from "../../../design-system/primitives/Input";
import {Select} from "../../../design-system/primitives/Select";
import {Button} from "../../../design-system/primitives/Button";
import {materialPriceHistory,priceHistorySummary} from "../material-price-history";
import {planilhaHistoricoMaterial} from "../export-sheets";
import "./material-price-history.css";
const money=v=>v==null?"Não disponível":v.toLocaleString("pt-BR",{style:"currency",currency:"BRL",minimumFractionDigits:2,maximumFractionDigits:4});
export default function MaterialPriceHistory({data,works,currentWorkId,onOpen}){
 const [exporting,setExporting]=useState(false),[exportError,setExportError]=useState("");
 const [work,setWork]=useState(currentWorkId||"all"),[material,setMaterial]=useState(""),[supplier,setSupplier]=useState(""),[start,setStart]=useState(""),[end,setEnd]=useState(""),[basis,setBasis]=useState("received"),[price,setPrice]=useState("final"),[query,setQuery]=useState(""),[unit,setUnit]=useState("");
 const availableWorks=works.map(w=>String(w.id)),scope=work==="all"?availableWorks:availableWorks.filter(id=>id===work);
 const base=useMemo(()=>materialPriceHistory(data,{workIds:scope,basis}),[data,scope.join("|"),basis]);
 const choices=[...new Map(base.map(r=>[String(r.materialId),{value:String(r.materialId),label:r.description}])).values()].filter(m=>m.label.toLocaleLowerCase("pt-BR").includes(query.toLocaleLowerCase("pt-BR")));
 const selected=material&&base.some(r=>String(r.materialId)===material)?material:"";
 const rows=selected?materialPriceHistory(data,{workIds:scope,basis,materialId:selected,supplierId:supplier,start,end,price,referenceUnit:unit}):[];
 const summary=priceHistorySummary(rows),units=[...new Set(base.filter(r=>String(r.materialId)===selected).map(r=>r.referenceUnit))];
 const suppliers=(data.fornecedores||[]).filter(f=>base.some(r=>String(r.materialId)===selected&&String(r.supplierId)===String(f.id)));
 const name=(list,id,fallback)=>(list||[]).find(x=>String(x.id)===String(id))?.nome||(list||[]).find(x=>String(x.id)===String(id))?.name||fallback;
 const exportHistory=async()=>{setExporting(true);setExportError("");try{const {writeTables}=await import("../../../lib/spreadsheet");await writeTables([planilhaHistoricoMaterial(data,rows,{basis,price})],"historico-precos-material.xlsx");}catch{setExportError("Não foi possível exportar o histórico. Tente novamente.");}finally{setExporting(false)}};
 return <section className="material-price-history" aria-label="Histórico de preços por material"><header><h2>Histórico de preços por material</h2><p>Compare o mesmo material e unidade. Pedidos e recebimentos são consultados separadamente; cotações não entram na média. Custos sem adicionais documentados ficam fora da comparação de custo final.</p></header>
 <div className="material-price-history__filters">
 <Select label="Obra do histórico" value={work} onChange={e=>setWork(e.target.value)} options={[{value:"all",label:"Todas as obras visíveis"},...works.map(w=>({value:String(w.id),label:w.name}))]}/>
 <Select label="Base do histórico" value={basis} onChange={e=>setBasis(e.target.value)} options={[{value:"received",label:"Recebimentos efetivos"},{value:"orders",label:"Pedidos emitidos"}]}/>
 <Input label="Pesquisar material" type="search" value={query} onChange={e=>{setQuery(e.target.value);setMaterial("");setSupplier("");setUnit("");}}/>
 <Select label="Material do histórico" value={selected} onChange={e=>{setMaterial(e.target.value);setSupplier("");setUnit("");}} options={[{value:"",label:"Selecione um material"},...choices]}/>
 <Select label="Fornecedor do histórico" value={supplier} onChange={e=>setSupplier(e.target.value)} options={[{value:"",label:"Todos os fornecedores"},...suppliers.map(f=>({value:String(f.id),label:f.nome}))]}/>
 <Select label="Preço comparado" value={price} onChange={e=>setPrice(e.target.value)} options={[{value:"final",label:"Custo final com adicionais"},{value:"raw",label:"Preço dos itens sem adicionais"}]}/>
 <Input label="Data inicial" type="date" value={start} onChange={e=>setStart(e.target.value)}/><Input label="Data final" type="date" value={end} onChange={e=>setEnd(e.target.value)}/>
 {units.length>1&&<Select label="Unidade de referência" value={unit} onChange={e=>setUnit(e.target.value)} options={[{value:"",label:"Todas — sem média conjunta"},...units.map(u=>({value:u,label:u}))]}/>}
 </div>
 {start&&end&&start>end?<p role="alert">A data inicial deve ser anterior à data final.</p>:!selected?<p>Selecione um material para consultar preços e abrir as compras de origem.</p>:<>
 <Button variant="secondary" disabled={exporting||!rows.length} onClick={exportHistory}>{exporting?"Exportando…":"Exportar histórico filtrado para Excel"}</Button>{exportError&&<p role="alert">{exportError}</p>}
 {summary&&<dl className="material-price-history__summary">{[["Último preço",money(summary.last)],["Menor preço",money(summary.min)],["Média ponderada",money(summary.weighted)],["Variação entre primeiro e último",`${summary.change.toFixed(1)}%`]].map(([label,value])=><div key={label}><dt>{label}{label.startsWith("Variação")?"":` / ${summary.unit}`}</dt><dd>{value}</dd></div>)}</dl>}
 {summary&&summary.count>1&&<figure className="material-price-history__chart" aria-label={`Evolução de preços por ${summary.unit}`}><figcaption>Evolução de {price==="final"?"custo final":"preço dos itens"} por {summary.unit}</figcaption><div style={{height:220,minWidth:0}}><ResponsiveContainer width="100%" height="100%"><LineChart data={[...rows].reverse().filter(r=>r.price!=null)} margin={{left:12,right:16,top:12,bottom:4}}><XAxis dataKey="date"/><YAxis width={70}/><Tooltip formatter={v=>money(Number(v))}/><Line dataKey="price" name={`Preço / ${summary.unit}`} stroke="var(--arcd-info-text)" strokeWidth={2} dot isAnimationActive={false}/></LineChart></ResponsiveContainer></div></figure>}
 <p>{rows.length} registro(s) · {rows.filter(r=>r.issue).length} fora da média por dados incompletos. {units.length>1&&!unit?"Selecione uma unidade para calcular a média sem misturar medidas.":"A média é ponderada pela quantidade na unidade de referência."}</p>
 {!rows.length?<p>Nenhuma compra neste recorte. Ajuste as datas, o fornecedor ou a base consultada.</p>:<div className="material-price-history__scroll" role="region" aria-label="Evolução e compras de origem" tabIndex={0}><table><thead><tr>{["Data / compra","Fornecedor / obra","Quantidade comprada","Preço do item / un. ref.","Custo final / un. ref.","Conferência","Origem"].map(h=><th key={h} scope="col">{h}</th>)}</tr></thead><tbody>{rows.map(r=><tr key={r.id}><th scope="row">{r.date||"Sem data"}<small>{r.orderNumber}{r.estimatedDate?" · data do pedido (legado)":""}</small></th><td data-label="Fornecedor / obra">{name(data.fornecedores,r.supplierId,"Fornecedor não informado")}<small>{name(works,r.workId,"Obra não informada")}</small></td><td data-label="Quantidade comprada">{r.quantity.toLocaleString("pt-BR")} {r.purchaseUnit}<small>{r.referenceQuantity?.toLocaleString("pt-BR",{maximumFractionDigits:4})} {r.referenceUnit}</small></td><td data-label="Preço do item / un. ref.">{money(r.rawPrice)} / {r.referenceUnit}</td><td data-label="Custo final / un. ref.">{money(r.finalPrice)} / {r.referenceUnit}</td><td data-label="Conferência">{r.issue||"Comparável"}</td><td data-label="Origem"><Button variant="secondary" onClick={()=>onOpen(r.orderId)}>Abrir compra {r.orderNumber}</Button></td></tr>)}</tbody></table></div>}</>}
 </section>;
}
