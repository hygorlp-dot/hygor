import { useEffect,useRef,useState } from "react";
import { consultarProjecaoMaoObra } from "../../../api.js";
import { Button } from "../../../components/ui/button.jsx";
import { Input } from "../../../components/ui/input.jsx";
import { Label } from "../../../components/ui/label.jsx";
import { laborProjectionHtml,laborProjectionSheets } from "../../../reports/labor-projection.js";
import { LaborAreaTabs } from "../../rh/components/LaborAreaTabs.jsx";
import "./labor-projection.css";
import { podeAcessarAba } from "../../administracao/abas-acesso.js";

const money=value=>value==null?"Indisponível":(value/100).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const displayDate=value=>value.split("-").reverse().join("/");
const percent=value=>value==null?"Indisponível":`${(value*100).toFixed(1).replace(".",",")}%`;
export function LaborProjection({data,area,obraId,onTab,currentUser}) {
  const [localArea,setLocalArea]=useState("all"),[work,setWork]=useState(obraId||"all"),[mode,setMode]=useState("all"),[role,setRole]=useState(""),[employeeId,setEmployeeId]=useState(""),[pendingOnly,setPendingOnly]=useState(false);
  const [report,setReport]=useState(null),[loading,setLoading]=useState(true),[error,setError]=useState(""),[revision,setRevision]=useState(0);
  const sequence=useRef(0);
  const scope=area||localArea;
  useEffect(()=>{setWork(obraId||"all");setEmployeeId("");},[obraId,scope]);
  useEffect(()=>{
    const request=++sequence.current;setLoading(true);setError("");
    consultarProjecaoMaoObra({area:scope,obraId:work,mode,role,employeeId,pendingOnly:String(pendingOnly)}).then(result=>{
      if(sequence.current!==request)return;
      if(!result.ok)throw new Error(result.error||result.erro||"Não foi possível consultar a projeção.");
      setReport(result);setLoading(false);
    }).catch(cause=>{if(sequence.current===request){setError(cause.message);setLoading(false);}});
    return ()=>{sequence.current++;};
  },[scope,work,mode,role,employeeId,pendingOnly,revision]);
  const exportPdf=()=>{const popup=window.open("","_blank");if(!popup){setError("Permita abrir a prévia do PDF neste navegador.");return;}popup.document.write(laborProjectionHtml(report));popup.document.close();};
  const exportExcel=async()=>{try{const XLSX=await import("../../../lib/spreadsheet.js");const book=XLSX.utils.book_new();for(const sheet of laborProjectionSheets(report))XLSX.utils.book_append_sheet(book,XLSX.utils.aoa_to_sheet(sheet.rows),sheet.name);XLSX.writeFile(book,`Projecao_${report.period.key}_${report.version}.xlsx`);}catch{setError("Não foi possível gerar o Excel. Tente novamente.");}};
  return <section className="payroll-projection" aria-label="Projeção de mão de obra" aria-busy={loading}>
    <div className="payroll-section-heading"><div><h2>Projeção da quinzena ativa</h2><p>Previsão provisória de custo e necessidade de recursos.</p></div><Button onClick={()=>setRevision(value=>value+1)} disabled={loading}>Atualizar</Button></div>
    {!area&&<LaborAreaTabs value={localArea} onChange={setLocalArea}/>}
    <div className="labor-projection-filters">
      {scope!=="central"&&<Label>Obra<select value={work} onChange={event=>setWork(event.target.value)}><option value="all">Todas as obras</option>{(data.obras||[]).map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></Label>}
      <Label>Modalidade<select value={mode} onChange={event=>setMode(event.target.value)}><option value="all">Todas</option><option value="daily">Diária</option><option value="clt">CLT mensal</option></select></Label>
      <Label>Função<Input value={role} onChange={event=>setRole(event.target.value)} placeholder="Função exata"/></Label>
      {report?.canSeePeople&&<Label>Pessoa<select value={employeeId} onChange={event=>setEmployeeId(event.target.value)}><option value="">Todas as pessoas</option>{report.people.map(person=><option key={person.id} value={person.id}>{person.name}</option>)}</select></Label>}
      <Label><input type="checkbox" checked={pendingOnly} onChange={event=>setPendingOnly(event.target.checked)}/> Apenas pessoas com pendências</Label>
    </div>
    {loading&&<p role="status">Consultando dados e arquivos autorizados no servidor…</p>}
    {error&&<p role="alert">{error} Use Atualizar para tentar novamente.{report?" Os valores abaixo pertencem à última consulta concluída.":""}</p>}
    {report&&<>
      <p>Quinzena {report.period.key}: <strong>{displayDate(report.period.start)} a {displayDate(report.period.end)}</strong> · Corte {displayDate(report.cutoff)} ({report.timeZone}) · Pagamento previsto {displayDate(report.payment.paymentDate)}</p>
      <p>Histórico {displayDate(report.period.historyStart)} a {displayDate(report.period.historyEnd)} · Atualizado {new Intl.DateTimeFormat("pt-BR",{timeZone:report.timeZone,dateStyle:"short",timeStyle:"short"}).format(new Date(report.updatedAt))}</p>
      <dl className="labor-projection-summary">{[["Custo esperado",report.totals.totalCents],["Já apurado",report.totals.knownCents],["Programado",report.totals.scheduledCents],["Estimado futuro",report.totals.estimatedCents],["Pendências estimáveis",report.totals.pendingCents],["Reserva com presença integral",report.totals.reserveCents],["Líquido previsto",report.cash.netCents],["Saldo aos funcionários",report.cash.balanceCents]].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{money(value)}</dd></div>)}</dl>
      <p>{report.totals.unknown>0?`${report.totals.unknown} parcela(s) sem base: total parcial ${money(report.totals.partialCents)}.`:`Diferença entre cenários: ${money(report.totals.scenarioDifferenceCents)}.`} A reserva é um cenário, não um teto.</p>
      <p>Responsável pelo custo: construtora {money(report.responsibility.costBuilderCents)} · obras por administração {money(report.responsibility.costAdministrationCents)}. Essa divisão é distinta da área administrativa.</p>
      <p>Retenções: {money(report.cash.retentionCents)} — vencimento de repasse a confirmar. Custos e encargos não são o valor a transferir aos trabalhadores.</p>
      {report.thirdParties?.excludedCount>0&&<p role="status">O total cobre empregados. {report.thirdParties.excludedCount} contrato(s) de terceiros estão fora desta projeção: {report.thirdParties.reason}</p>}
      {report.coverage.archiveOnlyNotProjected>0&&<p>{report.coverage.archiveOnlyNotProjected} cadastro(s) presentes apenas no histórico não foram presumidos como equipe atual.</p>}
      {report.coverage.readError&&<p role="alert">Falha na leitura de arquivos. A consulta é parcial; use Atualizar para tentar novamente.</p>}
      {report.coverage.partial&&<p role="status">Base parcial: {report.coverage.missingArchives.length} arquivo(s) ausente(s) e {report.coverage.conflicts} conflito(s). A taxa histórica está indisponível.</p>}
      <div className="labor-projection-actions"><Button onClick={exportPdf} disabled={loading||!!error}>PDF</Button><Button variant="outline" onClick={exportExcel} disabled={loading||!!error}>Excel</Button>{onTab&&podeAcessarAba(currentUser,"ponto_geral")&&<Button variant="outline" onClick={()=>onTab("ponto_geral")}>Conferir pendências</Button>}</div>
      <div className="labor-projection-chart" aria-label="Comparação por centro; valores completos na tabela abaixo">{report.works.map(work=><div key={work.id}><span>{work.label}</span><div className="labor-projection-bar" aria-hidden="true" style={{width:`${Math.max(0,work.reserveCents)/Math.max(1,...report.works.map(item=>item.reserveCents))*100}%`}}><i style={{flex:Math.max(0,work.knownCents)}}/><b style={{flex:Math.max(0,work.scheduledCents+work.estimatedCents+work.pendingCents)}}/></div><span>{money(work.totalCents)}</span></div>)}<p>Escuro: apurado · Claro: programado e estimativas</p></div>
      <div className="labor-projection-table"><table><caption>Custo por obra e Administração Central</caption><thead><tr>{["Centro","Equipe","Dias restantes (pessoas)","Taxas aplicadas e origem","Apurado","Programado","Estimado","Pendências","Total","Reserva","Cobertura"].map(label=><th key={label} scope="col">{label}</th>)}</tr></thead><tbody>{report.works.map(work=><tr key={work.id}><th scope="row">{work.label}</th><td>{work.employeeCount}</td><td>{work.remainingDays}</td><td>{percent(work.rateMin)}{work.rateMax!==work.rateMin?` a ${percent(work.rateMax)}`:""} · {work.rateOrigins.join(", ")||"Fatos ou programação"}</td>{[work.knownCents,work.scheduledCents,work.estimatedCents,work.pendingCents,work.totalCents,work.reserveCents].map((value,index)=><td key={index}>{money(value)}</td>)}<td>{percent(work.coverage.coverage)}</td></tr>)}</tbody></table></div>
      {!report.works.length&&<p>Nenhuma equipe no escopo autorizado para a quinzena ativa.</p>}
      <details><summary>Memória de cálculo e qualidade do histórico</summary><p>Referência desta consulta: {report.version} · {report.methodology.version}</p><p>Taxa ponderada: F ÷ (P + M + F), somando os três intervalos. M não é falta. Mínimo de {report.methodology.minimumObserved} dias observados e {percent(report.methodology.minimumCoverage)} de cobertura; depois grupo de mesma modalidade, função, área e jornada. Sem base suficiente, somente a reserva integral fica disponível. São parâmetros de produto, sem garantia estatística.</p><ul>{report.warnings.map(warning=><li key={warning}>{warning}</li>)}</ul>
        {report.canSeePeople&&report.people.map(person=><details key={person.id}><summary>{person.name} · {person.role} · {percent(person.history.rate)} ({person.history.origin})</summary><p>{person.history.personal.observed}/{person.history.personal.expected} dias classificados/previstos · {person.history.personal.pending} pendentes · {person.history.personal.leaves} afastamentos excluídos · {person.history.personal.half} meios períodos · {person.history.personal.intervalsWithData}/3 intervalos com dados · Cobertura {percent(person.history.personal.coverage)}</p><ul>{person.history.personal.intervals.map(interval=><li key={interval.start}>{interval.start} a {interval.end}: F {interval.absences} / P+M+F {interval.observed} · Ausentes de informação {interval.pending}</li>)}</ul><p>{person.issues.join(" · ")}</p><div className="labor-projection-table"><table><thead><tr>{["Data","Obra","Parcela","Situação","Custo","Reserva","Origem da taxa"].map(label=><th key={label}>{label}</th>)}</tr></thead><tbody>{person.days.map(day=><tr key={`${day.date}-${day.component||"custo"}`}><td>{day.date}</td><td>{day.obraId||"Sem lotação"}</td><td>{day.partition}{day.conditional?" (condicional)":""}</td><td>{day.status||"Sem classificação"}</td><td>{money(day.expectedCents)}</td><td>{money(day.reserveCents)}</td><td>{day.rateOrigin}</td></tr>)}</tbody></table></div></details>)}
      </details>
    </>}
  </section>;
}
