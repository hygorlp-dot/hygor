import {lazy,Suspense,useMemo,useState} from "react";
import {Tabs,TabsContent,TabsList,TabsTrigger} from "../../../components/ui/tabs";
import {Button} from "../../../design-system/primitives/Button";
import {Input} from "../../../design-system/primitives/Input";
import {Select} from "../../../design-system/primitives/Select";
import {podeAcessarAba} from "../../administracao/abas-acesso";
import {serviceContractPositions,serviceContractsTotals} from "../service-contract-position";
import {pedidoVivo} from "../purchase-position";
import ContratosFornecimentoView from "./ContratosFornecimentoView";
import ServiceContractDetail from "./ServiceContractDetail";
import "./contracts-workspace.css";
const Terceiros=lazy(()=>import("../../terceirizados/components/TerceirosView"));
const money=c=>(Number(c||0)/100).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});

export default function PurchaseContractsWorkspace({data,update,dispatchCommand,currentUser,showToast,C,workIds,onOpenOrder}){
 const [tab,setTab]=useState("supply"),[query,setQuery]=useState(""),[filter,setFilter]=useState("all"),[includeInactive,setIncludeInactive]=useState(false),[selected,setSelected]=useState(""),[operating,setOperating]=useState(null);
 const allowed=new Set(workIds.filter(id=>id!=null&&String(id)!=="").map(String)),canReadServices=podeAcessarAba(currentUser,"terc");
 const canOperate=canReadServices&&allowed.size>0&&["admin","rh","engenheiro","engenheiro_auditor","financeiro"].includes(currentUser?.role);
 const canMeasure=canReadServices&&["admin","engenheiro","engenheiro_auditor"].includes(currentUser?.role);
 const scopeKey=workIds.join("|");
 const rows=useMemo(()=>canReadServices?serviceContractPositions(data,{workIds,includeInactive}):[],[data,scopeKey,includeInactive,canReadServices]);
 const visible=rows.filter(r=>`${r.contract.name||""} ${(data.obras||[]).find(o=>o.id===r.contract.obraId)?.name||""}`.toLocaleLowerCase("pt-BR").includes(query.trim().toLocaleLowerCase("pt-BR"))&&(filter==="all"||filter==="review"&&r.counts.pending>0||filter==="pay"&&r.balanceCents>1||filter==="unmeasured"&&!r.measurements.length));
 const totals=serviceContractsTotals(visible),detail=rows.find(r=>String(r.contract.id)===selected);
 const supplyContracts=(data.contratosFornecimento||[]).filter(c=>allowed.size>0&&(!c.obraId||allowed.has(String(c.obraId))));
 const supplyData={...data,obras:(data.obras||[]).filter(o=>allowed.has(String(o.id))),contratosFornecimento:supplyContracts};
 const supplyIds=new Set(supplyContracts.map(c=>String(c.id)));
 const orders=(data.pedidos||[]).filter(p=>allowed.has(String(p.obraId))&&pedidoVivo(p)&&(p.itens||[]).some(i=>supplyIds.has(String(i.contratoId))));
 const openOperation=(contract,newMeasurement)=>setOperating({contratoId:contract?.id||"",obraId:contract?.obraId||(workIds.length===1?workIds[0]:""),novaMedicao:newMeasurement,nonce:Date.now()});
 // Um recorte diferente invalida a abertura anterior sem reaproveitar seus dados.
 const operatingVisible=operating&&(!operating.obraId||allowed.has(String(operating.obraId)));
 if(operatingVisible&&canOperate)return <section className="purchase-contracts" aria-label="Operação de contrato existente"><Button variant="secondary" onClick={()=>setOperating(null)}>Voltar a Contratos e medições</Button><Suspense fallback={<p role="status">Carregando a operação de Terceiros…</p>}><Terceiros key={operating.nonce} data={data} update={update} showToast={showToast} currentUser={currentUser} dispatchCommand={dispatchCommand} obraIdFixo={operating.obraId} contratoInicial={operating}/></Suspense></section>;
 return <section className="purchase-contracts" aria-label="Contratos e medições"><header><h2>Contratos e medições</h2><p>Fornecimento acompanha preço e quantidade contratada. Serviços acompanham execução, aprovação e baixa das medições já registradas em Terceiros.</p></header>
 <Tabs value={tab} onValueChange={setTab}><TabsList aria-label="Tipos de contrato" className="contracts-tabs"><TabsTrigger value="supply">Fornecimento</TabsTrigger><TabsTrigger value="services">Serviços e medições</TabsTrigger></TabsList>
 <TabsContent value="supply"><ContratosFornecimentoView data={supplyData} dispatchCommand={dispatchCommand} currentUser={currentUser} showToast={showToast} C={C} podeEditar={["admin","compras"].includes(currentUser?.role)&&!currentUser?.obraId}/><section className="supply-linked-orders" aria-label="Pedidos dos contratos de fornecimento"><h3>Pedidos vinculados no recorte</h3><p>O saldo de um contrato geral considera seu consumo em todas as obras. Os pedidos abaixo respeitam a obra selecionada; pagamentos e notas permanecem na ficha da compra.</p>{!orders.length?<p>Nenhum pedido ativo vinculado a estes contratos no recorte.</p>:orders.map(p=><div className="contracts-linked-row" key={p.id}><span>{p.numero||p.id} · {(data.obras||[]).find(o=>o.id===p.obraId)?.name||"Obra"}</span><Button variant="secondary" onClick={()=>onOpenOrder(p.id)}>Ficha da compra {p.numero||p.id}</Button></div>)}</section></TabsContent>
 <TabsContent value="services">{!canReadServices?<p>Seu perfil não tem acesso ao módulo Terceiros. A consulta de serviços e medições mantém essa permissão.</p>:detail?<ServiceContractDetail row={detail} onClose={()=>setSelected("")} canOperate={canOperate} canMeasure={canMeasure} onOperate={openOperation}/>:<>
 <div className="contracts-filters"><Input label="Buscar contrato de serviço ou obra" value={query} onChange={e=>setQuery(e.target.value)}/><Select label="Situação das medições" value={filter} onChange={e=>setFilter(e.target.value)} options={[{value:"all",label:"Todos os contratos"},{value:"review",label:"Com medição para aprovar"},{value:"pay",label:"Com saldo a pagar"},{value:"unmeasured",label:"Sem medição"}]}/><label className="contracts-history-toggle"><input type="checkbox" checked={includeInactive} onChange={e=>setIncludeInactive(e.target.checked)}/>Incluir contratos arquivados e cancelados</label></div>
 <dl className="contracts-summary">{[["Contratado",totals.contractCents],["Medido (inclui revisão)",totals.measuredCents],["Aprovado",totals.approvedCents],["Baixado",totals.paidCents],["A pagar",totals.balanceCents]].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{money(value)}</dd></div>)}</dl>
 <p>{visible.length} contrato(s) no recorte. Aprovação e pagamentos continuam nas operações de origem; esta consulta não gera lançamentos.</p>
 {!visible.length?<p>Nenhum contrato por medição neste recorte. Ajuste os filtros ou consulte a gestão de Terceiros.</p>:<div className="contracts-table-scroll" role="region" aria-label="Contratos de serviços" tabIndex={0}><table><thead><tr>{["Contrato / obra","Contratado","Aprovado","Baixado","A pagar","Revisão","Consulta"].map(h=><th scope="col" key={h}>{h}</th>)}</tr></thead><tbody>{visible.map(r=><tr key={r.contract.id}><th scope="row">{r.contract.name}<small>{(data.obras||[]).find(o=>o.id===r.contract.obraId)?.name||"Obra"} · {r.canMeasure?"Ativo":"Histórico"}</small></th><td data-label="Contratado">{money(r.contractCents)}</td><td data-label="Aprovado">{money(r.approvedCents)}</td><td data-label="Baixado">{money(r.paidCents)}</td><td data-label="A pagar">{money(r.balanceCents)}</td><td data-label="Revisão">{r.counts.pending} pendente(s){r.progress!=null&&<small>{r.progress.toLocaleString("pt-BR")}% de avanço aprovado</small>}</td><td data-label="Consulta"><Button variant="secondary" onClick={()=>setSelected(String(r.contract.id))}>Ficha do contrato {r.contract.name}</Button></td></tr>)}</tbody></table></div>}
 {canOperate&&<Button variant="secondary" onClick={()=>openOperation(null,false)}>Abrir gestão de serviços em Terceiros</Button>}
 </>}</TabsContent></Tabs></section>;
}
