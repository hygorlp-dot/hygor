import { useEffect, useState } from "react";
import { Badge, Btn, C, Ic } from "../../../LegacyApp";
import { consultarSombraFinanceira } from "../../../api";

const CHECK_LABELS={
  snapshot_writers:"Escritores por snapshot",
  shadow_has_facts:"Cobertura da sombra",
  shadow_run:"Carga em sombra registrada",
  ledger_divergence:"Razão legado × canônico",
  dre_divergence:"DRE legado × canônico",
  procurement_dre_divergence:"Compras × DRE",
  legacy_links:"Vínculos legado → canônico",
  quality_cases:"Casos de qualidade financeira",
  canonical_integrity:"Integridade estrutural do razão",
};

const card={background:C.card,border:`1px solid ${C.border}`,borderRadius:9,padding:12};

const fmtDate=value=>{
  if(!value)return "—";
  try{return new Date(value).toLocaleString("pt-BR");}catch{return String(value);}
};

export default function FinanceiroCanonicoAdmin({currentUser}){
  const [estado,setEstado]=useState("carregando");
  const [relatorio,setRelatorio]=useState(null);
  const [erro,setErro]=useState("");

  const carregar=async()=>{
    setEstado("carregando");setErro("");
    const resultado=await consultarSombraFinanceira();
    if(!resultado?.ok){
      setErro(resultado?.error||"Não foi possível consultar o gate financeiro.");
      setEstado("erro");
      return;
    }
    setRelatorio(resultado);
    setEstado("pronto");
  };

  useEffect(()=>{carregar();},[]);

  if(currentUser?.role!=="admin"){
    return <div style={{padding:30,textAlign:"center",color:C.red}}>Acesso exclusivo da administração.</div>;
  }

  if(estado==="carregando"){
    return <p style={{padding:24,textAlign:"center",fontSize:"var(--arcd-type-label)",color:C.muted}}>Validando o motor financeiro...</p>;
  }

  if(estado==="erro"){
    return <div style={{background:`${C.red}0C`,border:`1px solid ${C.red}44`,borderRadius:9,padding:14}}>
      <p style={{fontSize:"var(--arcd-type-label)",color:C.red,fontWeight:600}}>{erro}</p>
      <Btn size="sm" v="ghost" onClick={carregar} style={{marginTop:8}}><Ic n="refresh"/> Tentar novamente</Btn>
    </div>;
  }

  const gate=relatorio?.activationGate||null;
  const checks=Array.isArray(gate?.checks)?gate.checks:[];
  const counts=relatorio?.contagens||{};
  const ready=gate?!!gate.ready:!!relatorio?.prontoParaAtivar;
  const blockers=Array.isArray(gate?.blockers)?gate.blockers:[];
  const divergencias=(relatorio?.divergencias?.length||0)
    +(relatorio?.divergenciasDRE?.length||0)
    +(relatorio?.divergenciasComprasDRE?.length||0);
  const totalChecks=checks.length;
  const passedChecks=checks.filter(check=>check.ok).length;

  return <div style={{display:"flex",flexDirection:"column",gap:12}}>
    <div style={{
      background:ready?`${C.green}0A`:`${C.orange}0B`,
      border:`1px solid ${ready?C.green+"44":C.orange+"55"}`,
      borderRadius:10,padding:14,
    }}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12,flexWrap:"wrap"}}>
        <div>
          <p style={{fontSize:"var(--arcd-type-caption)",fontWeight:600,color:ready?C.green:C.orange,textTransform:"uppercase"}}>FIN-003 · verdade financeira única</p>
          <p style={{fontSize:"var(--arcd-type-section-title)",fontWeight:600,color:C.text,marginTop:4}}>
            {ready?"Gate técnico aprovado":"Gate técnico ainda bloqueado"}
          </p>
          <p style={{fontSize:"var(--arcd-type-label)",color:C.muted,marginTop:5,lineHeight:1.55,maxWidth:780}}>
            O diagnóstico é somente leitura. Esta tela não ativa o motor financeiro. A chave de produção continua sendo controlada no deploy depois da homologação das evidências.
          </p>
        </div>
        <div style={{display:"flex",gap:7,alignItems:"center",flexWrap:"wrap"}}>
          <Badge color={relatorio?.engineEnforced?C.green:C.muted}>{relatorio?.engineEnforced?"ENFORCEMENT ATIVO":"ENFORCEMENT DESATIVADO"}</Badge>
          <Badge color={ready?C.green:C.orange}>{totalChecks?`${passedChecks}/${totalChecks} GATES`:"GATE INDISPONÍVEL"}</Badge>
          <Btn size="sm" v="ghost" onClick={carregar}><Ic n="refresh"/> Atualizar</Btn>
        </div>
      </div>
    </div>

    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(170px,1fr))",gap:8}}>
      {[
        ["Fatos legados",counts.fatosLegados??0,C.blue],
        ["Títulos canônicos",counts.titulos??0,C.purple],
        ["Liquidações ativas",counts.liquidacoes??0,C.green],
        ["Vínculos legado",counts.vinculosLegado??0,C.blue],
        ["Vínculos ausentes",counts.vinculosLegadoAusentes??0,(counts.vinculosLegadoAusentes??0)?C.red:C.green],
        ["Divergências",divergencias,divergencias?C.red:C.green],
        ["Casos qualidade abertos",counts.divergenciasAbertas??0,(counts.divergenciasAbertas??0)?C.red:C.green],
        ["Erros estruturais",counts.errosIntegridadeCanonica??0,(counts.errosIntegridadeCanonica??0)?C.red:C.green],
      ].map(([label,value,color])=><div key={label} style={{...card,borderTop:`3px solid ${color}`}}>
        <p style={{fontSize:"var(--arcd-type-caption)",fontWeight:600,color:C.muted,textTransform:"uppercase"}}>{label}</p>
        <p style={{fontSize:"var(--arcd-type-section-title)",fontWeight:600,color,marginTop:4}}>{value}</p>
      </div>)}
    </div>

    <div style={card}>
      <div style={{display:"flex",justifyContent:"space-between",gap:8,alignItems:"baseline",flexWrap:"wrap"}}>
        <div>
          <b style={{fontSize:"var(--arcd-type-body)"}}>Evidências obrigatórias para ativação</b>
          <p style={{fontSize:"var(--arcd-type-caption)",color:C.muted,marginTop:3}}>Todas precisam permanecer verdes na mesma fotografia financeira.</p>
        </div>
        <span style={{fontSize:"var(--arcd-type-caption)",color:C.muted}}>Última carga: {fmtDate(relatorio?.ultimaCarga?.created_at)}</span>
      </div>

      <div style={{display:"grid",gap:7,marginTop:10}}>
        {checks.length?checks.map(check=><div key={check.code} style={{
          display:"grid",gridTemplateColumns:"auto minmax(0,1fr)",gap:9,alignItems:"start",
          padding:"9px 10px",borderRadius:8,border:`1px solid ${check.ok?C.green+"33":C.red+"44"}`,
          background:check.ok?`${C.green}08`:`${C.red}08`,
        }}>
          <span style={{
            width:22,height:22,borderRadius:99,display:"grid",placeItems:"center",
            background:check.ok?`${C.green}18`:`${C.red}16`,color:check.ok?C.green:C.red,
            fontWeight:700,fontSize:"var(--arcd-type-caption)",
          }}>{check.ok?"✓":"!"}</span>
          <div>
            <p style={{fontSize:"var(--arcd-type-label)",fontWeight:600,color:C.text}}>{CHECK_LABELS[check.code]||check.code}</p>
            <p style={{fontSize:"var(--arcd-type-caption)",color:check.ok?C.muted:C.red,marginTop:2,lineHeight:1.45}}>{check.detail}</p>
          </div>
        </div>):<div style={{padding:12,borderRadius:8,background:`${C.orange}0B`,border:`1px solid ${C.orange}44`}}>
          <p style={{fontSize:"var(--arcd-type-label)",color:C.orange}}>O backend ainda não devolveu o gate detalhado. Atualize o deploy antes de tomar qualquer decisão de ativação.</p>
        </div>}
      </div>
    </div>

    {!!relatorio?.missingLegacyLinks?.length&&<div style={{...card,borderColor:C.red+"44"}}>
      <b style={{fontSize:"var(--arcd-type-label)",color:C.red}}>Fatos legados sem vínculo canônico</b>
      <div style={{marginTop:7,display:"grid",gap:4}}>
        {relatorio.missingLegacyLinks.slice(0,20).map((item,index)=><p key={index} style={{fontSize:"var(--arcd-type-caption)",color:C.text}}>
          {item.legacyType||"fato"} · <code>{item.legacyId||"sem id"}</code>
        </p>)}
        {relatorio.missingLegacyLinks.length>20&&<p style={{fontSize:"var(--arcd-type-caption)",color:C.muted}}>+ {relatorio.missingLegacyLinks.length-20} vínculo(s) omitido(s) nesta visualização.</p>}
      </div>
    </div>}

    <div style={{padding:"10px 12px",borderRadius:9,border:`1px solid ${C.blue}33`,background:`${C.blue}07`}}>
      <p style={{fontSize:"var(--arcd-type-caption)",color:C.muted,lineHeight:1.5}}>
        Próximo gate operacional após 8/8: executar criação, liquidação, reversão e fechamento de competência em homologação, conferir o Golden Master e só então avaliar a ativação de produção.
      </p>
    </div>
  </div>;
}
