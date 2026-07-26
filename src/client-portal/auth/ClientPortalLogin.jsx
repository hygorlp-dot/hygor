import { useState } from "react";
import "../styles/portal.css";

export function ClientPortalLogin({ onAuthenticated, initialError = "" }) {
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [state,setState]=useState({loading:false,error:initialError});
  const submit=async event=>{
    event.preventDefault();
    setState({loading:true,error:""});
    try {
      const response=await fetch("/api/client/auth/login",{method:"POST",headers:{"Content-Type":"application/json"},credentials:"same-origin",body:JSON.stringify({email,password})});
      const body=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(body.error || "Não foi possível acessar o portal.");
      await onAuthenticated?.();
    } catch (error) { setState({loading:false,error:error.message || "Não foi possível acessar o portal."}); }
  };
  return <main className="arcd-client-login"><section aria-labelledby="client-login-title"><span className="arcd-client-loading__mark" aria-hidden="true"/><p className="arcd-client-login__eyebrow">Portal do Cliente ARCD</p><h1 id="client-login-title">Acompanhe sua obra com segurança</h1><p className="arcd-client-muted">Acesso protegido e individual. Use as credenciais enviadas pela equipe ARCD.</p><form onSubmit={submit} noValidate><label>E-mail<input type="email" autoComplete="email" value={email} onChange={event=>setEmail(event.target.value)} required disabled={state.loading}/></label><label>Senha<input type="password" autoComplete="current-password" value={password} onChange={event=>setPassword(event.target.value)} required disabled={state.loading}/></label>{state.error&&<p className="arcd-client-login__error" role="alert">{state.error}</p>}<button type="submit" disabled={state.loading}>{state.loading?"Verificando acesso…":"Entrar no portal"}</button></form><p className="arcd-client-login__help">Acesso protegido. Se não recebeu suas credenciais, fale com a equipe responsável pela sua obra.</p></section></main>;
}
