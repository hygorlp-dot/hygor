import {useState} from "react";
import {Button} from "../../design-system/primitives/Button.jsx";
import {Input} from "../../design-system/primitives/Input.jsx";
import {PageHeader} from "../../design-system/patterns/PageHeader.jsx";
import {Alert,AlertDescription} from "../../components/ui/alert.jsx";
import {changeClientPortalPassword} from "../services/clientPortalApi.js";
export function ClientAccountPage({onSessionEnded}) {
  const [currentPassword,setCurrentPassword]=useState("");
  const [password,setPassword]=useState("");
  const [confirmation,setConfirmation]=useState("");
  const [state,setState]=useState({busy:false,error:"",done:false});
  const submit=async event=>{
    event.preventDefault();
    if(state.busy)return;
    if(password!==confirmation){setState({busy:false,error:"A confirmação precisa ser igual à nova senha."});return;}
    setState({busy:true,error:""});
    try {
      await changeClientPortalPassword(currentPassword,password);
      setCurrentPassword("");setPassword("");setConfirmation("");
      setState({busy:false,error:"",done:true});
    }catch(error){setState({busy:false,error:error.message});}
  };
  return <section className="arcd-client-page"><PageHeader headingLevel={2} title="Minha conta" description="Altere a senha usada para acompanhar suas obras."/>{state.done?<Alert><AlertDescription>Senha alterada. Todas as sessões foram encerradas. <Button onClick={onSessionEnded}>Entrar novamente</Button></AlertDescription></Alert>:<form className="arcd-client-account" onSubmit={submit}>
    <Input label="Senha atual" type="password" autoComplete="current-password" required value={currentPassword} disabled={state.busy} onChange={event=>setCurrentPassword(event.target.value)}/>
    <Input label="Nova senha" description="Use pelo menos 12 caracteres, com letras e números." type="password" minLength={12} autoComplete="new-password" required value={password} disabled={state.busy} onChange={event=>setPassword(event.target.value)}/>
    <Input label="Confirmar nova senha" type="password" minLength={12} autoComplete="new-password" required value={confirmation} disabled={state.busy} onChange={event=>setConfirmation(event.target.value)}/>
    {state.error&&<Alert variant="destructive"><AlertDescription>{state.error}</AlertDescription></Alert>}
    <Button type="submit" disabled={state.busy} loading={state.busy}>Alterar senha</Button>
  </form>}</section>;
}
