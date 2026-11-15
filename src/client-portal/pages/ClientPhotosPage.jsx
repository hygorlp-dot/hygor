import {useMemo,useState} from "react";
import {ChevronDown} from "lucide-react";
import {PageHeader} from "../../design-system/patterns/PageHeader.jsx";
import {Input} from "../../design-system/primitives/Input.jsx";
import {Button} from "../../design-system/primitives/Button.jsx";
import {Dialog} from "../../design-system/primitives/Dialog.jsx";
import {EmptyState} from "../../design-system/patterns/FeedbackState.jsx";
import {contar} from "../../design-system/copy.js";
import {portalDate} from "../format.js";
const climate=value=>({sol:"Sol",ensolarado:"Ensolarado",nublado:"Nublado",chuva:"Chuva",chuvoso:"Chuvoso",chuva_forte:"Chuva forte",chuva_fraca:"Chuva fraca"}[value]||value);
export function ClientPhotosPage({data}){
  const [day,setDay]=useState(""),[limit,setLimit]=useState(7),[selected,setSelected]=useState(null);
  const groups=useMemo(()=>{
    const grouped=new Map();
    for(const report of data.dailyReports||[]){
      const date=String(report.date||"").slice(0,10);
      if(day&&date!==day)continue;
      const reports=grouped.get(date)||[];
      reports.push({...report,photos:(data.publishedMedia||[]).filter(photo=>photo.reportId===report.id)});
      grouped.set(date,reports);
    }
    return [...grouped].sort(([a],[b])=>b.localeCompare(a));
  },[data.dailyReports,data.publishedMedia,day]);
  return <section className="arcd-client-page"><PageHeader headingLevel={2} title="Diário da obra" description="Todos os diários concluídos e liberados, organizados por dia, com o relato, os serviços e as fotos de cada registro."/>
    <div className="arcd-client-actions"><Input label="Dia do diário" type="date" value={day} onChange={event=>{setDay(event.target.value);setLimit(7);}}/>{day&&<Button variant="secondary" onClick={()=>{setDay("");setLimit(7);}}>Mostrar todos os dias</Button>}</div>
    {!groups.length?<EmptyState title="Nenhum diário neste recorte" description="Escolha outro dia ou aguarde a conclusão e liberação dos diários pela equipe."/>:groups.slice(0,limit).map(([date,reports])=><section key={date||"sem-data"} className="arcd-client-stack"><h3>{portalDate(date,"Data não informada")} · {contar(reports.length,"diário","diários")}</h3>{reports.map((report,index)=><details key={report.id} className="arcd-client-disclosure" open={index===0&&date===groups[0][0]}>
      <summary><div><strong>{report.code?`Diário ${report.code}`:"Diário da obra"}</strong><span>Relato, serviços e fotos do dia</span></div><span>{contar(report.photos.length,"foto","fotos")}</span><span className="arcd-client-disclosure__action"><span className="arcd-client-disclosure__show">Abrir diário</span><span className="arcd-client-disclosure__hide">Recolher diário</span><ChevronDown aria-hidden="true"/></span></summary>
      <div className="arcd-client-disclosure__body"><p>{report.summary||"Sem relato compartilhado neste diário."}</p>
        {Object.values(report.weather||{}).some(Boolean)&&<p>Clima: {[report.weather.morning&&`manhã — ${climate(report.weather.morning)}`,report.weather.afternoon&&`tarde — ${climate(report.weather.afternoon)}`,report.weather.night&&`noite — ${climate(report.weather.night)}`].filter(Boolean).join("; ")}</p>}
        <h4>Serviços executados</h4>{report.services?.length?<ul>{report.services.map((service,serviceIndex)=><li key={serviceIndex}>{service.description}{service.quantity!==null?` · ${service.quantity} ${service.unit}`:""} · avanço acumulado informado: {service.progress}%</li>)}</ul>:<p>Nenhum serviço detalhado neste registro.</p>}
        <h4>Fotos deste diário</h4>{report.photos.length?<div className="arcd-client-media-grid">{report.photos.map(photo=><figure key={photo.id}><Button variant="ghost" onClick={()=>setSelected(photo)} aria-label={`Ampliar foto: ${photo.caption||"registro da obra"}`}><img src={photo.url||photo.thumbnailUrl} alt={photo.caption||"Registro da obra"} loading="lazy"/></Button><figcaption>{photo.caption||"Registro da obra"}</figcaption></figure>)}</div>:<p>Nenhuma foto liberada neste diário.</p>}
      </div></details>)}</section>)}
    {groups.length>limit&&<Button variant="secondary" onClick={()=>setLimit(value=>value+7)}>Mostrar mais dias</Button>}
    <Dialog size="media" open={Boolean(selected)} onOpenChange={open=>{if(!open)setSelected(null);}} title={selected?.caption||"Foto da obra"}>{selected&&<><img className="arcd-client-photo-original" src={selected.url} alt={selected.caption||"Registro da obra"}/><a className="arcd-client-link" href={selected.url} target="_blank" rel="noreferrer">Abrir imagem original</a></>}</Dialog>
  </section>;
}
