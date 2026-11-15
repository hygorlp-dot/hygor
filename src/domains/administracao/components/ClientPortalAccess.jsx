import {useEffect,useState} from "react";
import {gerenciarAcessoPortalCliente} from "../../../api.js";
import {Button} from "../../../design-system/primitives/Button.jsx";
import {Input} from "../../../design-system/primitives/Input.jsx";
import {Select} from "../../../design-system/primitives/Select.jsx";
import {PageHeader} from "../../../design-system/patterns/PageHeader.jsx";
import {FormSection} from "../../../design-system/patterns/FormSection.jsx";
import {Dialog} from "../../../design-system/primitives/Dialog.jsx";
import {Alert,AlertDescription} from "../../../components/ui/alert.jsx";
import {useHelpTopic} from "../../../features/help/HelpContext.jsx";
import {HelpButton} from "../../../features/help/HelpButton.jsx";
import {CLIENT_PORTAL_ORIGIN,portalLoginUrl} from "../../../client-portal/routes.js";
import "./client-portal-access.css";
const profiles=[{value:"owner",label:"Proprietário"},{value:"spouse",label:"Cônjuge"},{value:"representative",label:"Representante"},{value:"financial",label:"Financeiro"},{value:"external_architect",label:"Arquiteto externo"},{value:"observer",label:"Observador"}];
const emptyForm={email:"",phone:"",profile:"owner",password:""};
export default function ClientPortalAccess({data,currentUser}){
  useHelpTopic("admin_central","cliente_acessos");
  const works=(data.obras||[]).filter(work=>!currentUser?.obraId||work.id===currentUser.obraId);
  const [workId,setWorkId]=useState(()=>works[0]?.id||"");
  const [form,setForm]=useState(emptyForm),[accesses,setAccesses]=useState([]),[busy,setBusy]=useState(false);
  const [error,setError]=useState(""),[message,setMessage]=useState(""),[revision,setRevision]=useState(0),[confirm,setConfirm]=useState(null),[invitation,setInvitation]=useState("");
  const field=key=>event=>setForm(previous=>({...previous,[key]:event.target.value}));
  useEffect(()=>{
    let active=true;setAccesses([]);setError("");setInvitation("");
    if(!workId)return;
    gerenciarAcessoPortalCliente({operation:"list",obraId:workId}).then(result=>{
      if(!active)return;
      if(result.status!==200)throw new Error(result.error||"Não foi possível consultar os acessos.");
      setAccesses(result.accesses||[]);
    }).catch(failure=>{if(active)setError(failure.message);});
    return ()=>{active=false;};
  },[workId,revision]);
  const submit=async event=>{
    event.preventDefault();if(busy)return;
    setBusy(true);setError("");setMessage("");
    try{
      const result=await gerenciarAcessoPortalCliente({operation:"provision",obraId:workId,...form});
      if(result.status!==200)throw new Error(result.error||"Não foi possível salvar o acesso.");
      setInvitation(`Portal MARCELL: ${CLIENT_PORTAL_ORIGIN}/\nE-mail: ${form.email.trim()}\nSenha inicial: ${form.password}`);
      setForm(previous=>({...previous,password:""}));
      setMessage("Acesso salvo. Copie o convite e compartilhe somente com o destinatário. Libere o conteúdo em Portal do cliente, na obra.");
      const list=await gerenciarAcessoPortalCliente({operation:"list",obraId:workId});
      if(list.status===200)setAccesses(list.accesses||[]);
    }catch(failure){setError(failure.message);}finally{setBusy(false);}
  };
  const revoke=async()=>{
    setBusy(true);setError("");
    try{
      const result=await gerenciarAcessoPortalCliente({operation:"revoke",obraId:workId,membershipId:confirm.id});
      if(result.status!==200)throw new Error(result.error||"Não foi possível revogar o acesso.");
      setConfirm(null);setMessage("Acesso à obra revogado e sessões encerradas.");setRevision(value=>value+1);
    }catch(failure){setError(failure.message);}finally{setBusy(false);}
  };
  const copy=async()=>{try{await navigator.clipboard.writeText(invitation);setInvitation("");setMessage("Convite copiado. Envie-o somente ao destinatário correto.");}catch{setError("Não foi possível copiar. Permita acesso à área de transferência e tente novamente.");}};
  if(currentUser?.role!=="admin")return null;
  return <section className="client-portal-access">
    <PageHeader headingLevel={2} title="Acessos de clientes" description="Cadastre login, senha e vínculo à obra." secondaryActions={<HelpButton pageId="cliente_acessos" allowedTabs={["cliente_acessos"]}/>}/>
    <p>Endereço do cliente: <a href={portalLoginUrl(window.location)} target="_blank" rel="noreferrer">{CLIENT_PORTAL_ORIGIN}</a></p>
    <Select label="Obra do cliente" value={workId} disabled={busy} placeholder="Selecione a obra" options={works.map(work=>({value:work.id,label:work.name}))} onChange={event=>{setWorkId(event.target.value);setMessage("");setForm(emptyForm);}}/>
    {error&&<Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}{message&&<p role="status">{message}</p>}
    <form onSubmit={submit}><FormSection title="Login e senha do cliente" description="O mesmo e-mail usa uma conta para todas as obras. Redefinir a senha encerra as sessões existentes."><div className="client-portal-access__fields">
      <Input label="E-mail de login" type="email" required autoComplete="off" value={form.email} disabled={busy||!workId} onChange={field("email")}/>
      <Input label="Telefone do cliente" type="tel" value={form.phone} disabled={busy||!workId} onChange={field("phone")}/>
      <Select label="Perfil de acesso do cliente" value={form.profile} options={profiles} disabled={busy||!workId} onChange={field("profile")}/>
      <Input label="Senha inicial ou nova senha" type="password" required minLength={12} autoComplete="new-password" description="Pelo menos 12 caracteres, com letras e números." value={form.password} disabled={busy||!workId} onChange={field("password")}/>
    </div></FormSection><div className="client-portal-access__actions"><Button type="submit" disabled={busy||!workId} loading={busy}>Salvar acesso do cliente</Button>{invitation&&<Button variant="secondary" onClick={copy}>Copiar convite do cliente</Button>}<Button variant="secondary" disabled={busy||!workId} onClick={()=>setRevision(value=>value+1)}>Atualizar acessos</Button></div></form>
    <section aria-label="Clientes vinculados à obra">{!accesses.length?<p>Nenhum acesso individual nesta obra.</p>:accesses.map(access=><article key={access.id}><div><strong>{access.email}</strong><p>{profiles.find(profile=>profile.value===access.profile)?.label||access.profile} · {access.active?"Ativo":"Revogado"}</p></div><div className="client-portal-access__actions"><Button variant="secondary" disabled={busy} onClick={()=>{setForm({email:access.email,phone:access.phone,profile:access.profile,password:""});setInvitation("");}}>Editar acesso e senha</Button>{access.active&&<Button variant="destructive" disabled={busy} onClick={()=>setConfirm(access)}>Revogar acesso</Button>}</div></article>)}</section>
    <Dialog open={Boolean(confirm)} onOpenChange={open=>{if(!open&&!busy)setConfirm(null);}} title="Revogar acesso do cliente"><p>Encerrar o acesso de {confirm?.email} a esta obra? As sessões da conta serão encerradas.</p><div className="client-portal-access__actions"><Button variant="destructive" disabled={busy} loading={busy} onClick={revoke}>Confirmar revogação</Button><Button variant="secondary" disabled={busy} onClick={()=>setConfirm(null)}>Cancelar</Button></div></Dialog>
  </section>;
}
