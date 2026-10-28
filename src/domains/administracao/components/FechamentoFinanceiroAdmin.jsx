import {useMemo,useState} from "react";
import {Badge,Btn,C,Inp} from "../../../LegacyApp";
import {consultarPreviaFechamentoFinanceiro} from "../../../api";

const card={background:C.card,border:`1px solid ${C.border}`,borderRadius:9,padding:12};
const moneyCents=value=>(Number(value||0)/100).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});

const previousMonth=()=>{
  const date=new Date();
  date.setDate(1);
  date.setMonth(date.getMonth()-1);
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}`;
};

const periodFromCompetence=value=>{
  const ym=String(value||"");
  if(!/^\d{4}-\d{2}$/.test(ym))return null;
  const [year,month]=ym.split("-").map(Number);
  return{
    startsOn:`${ym}-01`,
    endsOn:new Date(year,month,0).toISOString().slice(0,10),
  };
};

export default function FechamentoFinanceiroAdmin(){
  const [competencia,setCompetencia]=useState(previousMonth);
  const [estado,setEstado]=useState("idle");
  const [preview,setPreview]=useState(null);
  const [erro,setErro]=useState("");

  const period=useMemo(()=>periodFromCompetence(competencia),[competencia]);
  const snapshot=preview?.closing?.snapshot||null;
  const checks=Array.isArray(preview?.conference?.checks)?preview.conference.checks:[];
  const checksOk=checks.filter(check=>check.ok).length;

  const consultar=async()=>{
    if(!period){setErro("Informe uma competência válida.");return;}
    setEstado("loading");setErro("");setPreview(null);
    const result=await consultarPreviaFechamentoFinanceiro(period);
    if(!result?.ok){
      setErro(result?.error||"Não foi possível gerar a prévia de fechamento.");
      setPreview(result?.conference?{conference:result.conference}:null);
      setEstado("error");
      return;
    }
    setPreview(result);
    setEstado("ready");
  };

  return <section style={{...card,borderTop:`3px solid ${C.blue}`}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12,flexWrap:"wrap"}}>
      <div>
        <p style={{fontSize:"var(--arcd-type-caption)",fontWeight:600,color:C.blue,textTransform:"uppercase"}}>Fechamento mensal · homologação</p>
        <b style={{display:"block",fontSize:"var(--arcd-type-body)",marginTop:3}}>Prévia da competência</b>
        <p style={{fontSize:"var(--arcd-type-caption)",color:C.muted,marginTop:4,maxWidth:760,lineHeight:1.5}}>
          A prévia é somente leitura. O servidor recalcula razão, caixa e DRE canônica; nenhum valor desta tela é usado para fechar o mês.
        </p>
      </div>
      <Badge color={preview?.alreadyClosed?C.green:C.muted}>
        {preview?.alreadyClosed?"COMPETÊNCIA JÁ FECHADA":"SEM AÇÃO DE FECHAMENTO"}
      </Badge>
    </div>

    <div style={{display:"grid",gridTemplateColumns:"minmax(180px,240px) auto",gap:8,alignItems:"end",marginTop:12}}>
      <Inp label="Competência" type="month" value={competencia} onChange={value=>{setCompetencia(value);setPreview(null);setErro("");setEstado("idle");}}/>
      <Btn onClick={consultar} disabled={!period||estado==="loading"}>
        {estado==="loading"?"Conferindo...":"Gerar prévia"}
      </Btn>
    </div>

    {erro&&<div style={{marginTop:10,padding:"9px 10px",borderRadius:8,border:`1px solid ${C.red}44`,background:`${C.red}08`}}>
      <p style={{fontSize:"var(--arcd-type-label)",color:C.red,fontWeight:600}}>{erro}</p>
    </div>}

    {snapshot&&<>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:7,marginTop:12}}>
        {[
          ["Receita",snapshot.revenueCents,C.green],
          ["Custos",snapshot.costCents,C.red],
          ["Resultado",snapshot.resultCents,Number(snapshot.resultCents||0)>=0?C.green:C.red],
          ["Entradas de caixa",snapshot.cashInCents,C.green],
          ["Saídas de caixa",snapshot.cashOutCents,C.red],
          ["Saldo caixa no período",snapshot.cashBalanceCents,Number(snapshot.cashBalanceCents||0)>=0?C.green:C.red],
          ["A receber",snapshot.receivableCents,C.blue],
          ["A pagar",snapshot.payableCents,C.orange],
          ["Comprometido",snapshot.commitmentCents,C.purple],
        ].map(([label,value,color])=><div key={label} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:8,padding:9}}>
          <p style={{fontSize:"var(--arcd-type-caption)",color:C.muted}}>{label}</p>
          <p style={{fontSize:"var(--arcd-type-body)",fontWeight:600,color,marginTop:3}}>{moneyCents(value)}</p>
        </div>)}
      </div>

      <div style={{...card,marginTop:10,background:C.card}}>
        <div style={{display:"flex",justifyContent:"space-between",gap:8,alignItems:"center",flexWrap:"wrap"}}>
          <b style={{fontSize:"var(--arcd-type-label)"}}>Conferência financeira</b>
          <Badge color={checks.length&&checksOk===checks.length?C.green:C.orange}>
            {checks.length?`${checksOk}/${checks.length} CHECKS`:"SEM CHECKS"}
          </Badge>
        </div>
        <div style={{display:"grid",gap:5,marginTop:8}}>
          {checks.map((check,index)=><div key={check.code||index} style={{display:"flex",gap:7,alignItems:"flex-start"}}>
            <span style={{color:check.ok?C.green:C.red,fontWeight:700}}>{check.ok?"✓":"!"}</span>
            <div>
              <p style={{fontSize:"var(--arcd-type-caption)",fontWeight:600,color:C.text}}>{check.label||check.code||"Conferência"}</p>
              {check.detail&&<p style={{fontSize:"var(--arcd-type-caption)",color:check.ok?C.muted:C.red,marginTop:1}}>{check.detail}</p>}
            </div>
          </div>)}
        </div>
      </div>

      <div style={{marginTop:10,padding:"9px 10px",borderRadius:8,border:`1px solid ${C.orange}44`,background:`${C.orange}08`}}>
        <p style={{fontSize:"var(--arcd-type-caption)",color:C.orange,lineHeight:1.5}}>
          O botão de confirmar fechamento permanece deliberadamente indisponível até a homologação dos guards de imutabilidade de competência. Esta tela apenas antecipa a conferência.
        </p>
      </div>
    </>}
  </section>;
}
