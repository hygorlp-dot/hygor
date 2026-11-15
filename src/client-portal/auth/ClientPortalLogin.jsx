import {useState} from "react";
import {Button} from "../../design-system/primitives/Button.jsx";
import {Input} from "../../design-system/primitives/Input.jsx";
import {PageHeader} from "../../design-system/patterns/PageHeader.jsx";
import {Alert, AlertDescription} from "../../components/ui/alert.jsx";
import {HelpButton} from "../../features/help/HelpButton.jsx";
import {loginClientPortal} from "../services/clientPortalApi.js";
import "../styles/portal.css";

export function ClientPortalLogin({onAuthenticated, initialError = ""}) {
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [state,setState]=useState({loading:false,error:""});
  const submit=async event=>{
    event.preventDefault();
    if(state.loading)return;
    setState({loading:true,error:""});
    try {
      await loginClientPortal(email.trim(),password);
      setPassword("");
      await onAuthenticated();
    } catch(error) {setState({loading:false,error:error.message || "Não foi possível acessar o portal."});}
    finally {setState(current=>({...current,loading:false}));}
  };
  return <main className="arcd-client-login"><section className="arcd-material-panel" aria-label="Entrar no portal do cliente">
    <img className="arcd-client-brand" src="/brand/marcell/monogram-azul.svg" alt="MARCELL"/>
    <PageHeader title="Portal do cliente" description="Acompanhe sua obra com segurança." secondaryActions={<HelpButton pageId="cliente_login" allowedTabs={["cliente_login"]} showLabel/>}/>
    <p className="arcd-client-muted">Acesso protegido e individual. Use o e-mail e a senha informados pela equipe MARCELL.</p>
    <form onSubmit={submit}>
      <Input label="E-mail" type="email" autoComplete="username" value={email} onChange={event=>setEmail(event.target.value)} required disabled={state.loading}/>
      <Input label="Senha" type="password" autoComplete="current-password" value={password} onChange={event=>setPassword(event.target.value)} required disabled={state.loading}/>
      {(state.error||initialError)&&<Alert variant="destructive"><AlertDescription>{state.error||initialError}</AlertDescription></Alert>}
      <Button type="submit" loading={state.loading} disabled={state.loading}>{state.loading?"Verificando acesso…":"Entrar no portal"}</Button>
    </form>
    <p className="arcd-client-login__help">Se não recebeu o acesso ou esqueceu a senha, fale com a equipe responsável pela sua obra.</p>
  </section></main>;
}
