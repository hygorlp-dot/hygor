import React,{useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {ThemeProvider} from '../src/design-system/theme/ThemeProvider.jsx';
import {PageHeader} from '../src/design-system/patterns/PageHeader.jsx';
import {FormSection} from '../src/design-system/patterns/FormSection.jsx';
import {Input} from '../src/design-system/primitives/Input.jsx';
import {Button} from '../src/design-system/primitives/Button.jsx';
import {Alert,AlertDescription} from '../src/components/ui/alert.jsx';
import {HelpProvider,useHelpTopic} from '../src/features/help/HelpContext.jsx';
import {HelpButton} from '../src/features/help/HelpButton.jsx';
import '../src/index.css';
import '../src/client-portal/styles/portal.css';
import '../src/design-system/themes/marcell-clean.css';
import '../src/design-system/themes/marcell-workspaces.css';
import '../src/design-system/themes/operating-contract.css';
async function api(action,body){const response=await fetch(`/api/local-finance/${action}`,body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{});const result=await response.json();if(!response.ok)throw new Error(result.error);return result;}
function Connection(){
 useHelpTopic('cliente','cliente_conexao_financeiro');
 const [password,setPassword]=useState(''),[status,setStatus]=useState(null),[busy,setBusy]=useState(''),[error,setError]=useState(''),[simulation,setSimulation]=useState(null);
 useEffect(()=>{api('status').then(setStatus).catch(failure=>setError(failure.message));},[]);
 const run=async action=>{if(busy)return;setBusy(action);setError('');try{const result=await api(action,action==='connect'?{password}:{});action==='connect'?setStatus(result):setSimulation(result);}catch(failure){setError(failure.message);}finally{setPassword('');setBusy('');}};
 return <main className="arcd-client-page"><PageHeader title="Conexão do financeiro" description="Configuração privada neste computador. Nenhuma cobrança será enviada por esta tela." secondaryActions={<HelpButton pageId="cliente" allowedTabs={['cliente']} showLabel/>}/>
 <FormSection title="E-mail financeiro" description="Lark Mail · smtp.larksuite.com · porta 465 · conexão criptografada">
 <Input label="Remetente" value="financeiro@marcelleng.com.br" readOnly/>
 <p>No aplicativo Lark, abra sua foto → Configurações → E-mail → acesso por cliente de terceiros. Gere uma senha dedicada para esta conexão. Se a caixa for compartilhada, solicite ao administrador a credencial própria dela.</p>
 <Input label="Senha dedicada do Lark" type="password" value={password} autoComplete="off" onChange={event=>setPassword(event.target.value)} disabled={Boolean(busy)}/>
 <Button disabled={!password||Boolean(busy)} loading={busy==='connect'} onClick={()=>run('connect')}>Verificar e guardar conexão</Button>
 <p>A senha é enviada somente ao Lark para autenticação e guardada cifrada pelo Windows, fora do projeto. Não informe a senha neste chat. Verificar a conexão não envia e-mail nem comprova entrega ao destinatário.</p>
 {status?.email?.authenticated&&<p role="status">Configuração guardada após autenticação em {new Date(status.email.verifiedAt).toLocaleString('pt-BR',{timeZone:'America/Bahia'})}. Os envios reais continuam desativados.</p>}
 </FormSection>
 <FormSection title="WhatsApp do financeiro" description="(81) 98975-1300 · sessão local existente"><p>{!status?'Consultando conexão…':status.whatsapp.connected?'Sessão funcionando e remetente financeiro confirmado.':'Sessão indisponível ou remetente diferente. Não haverá envio.'}</p><p>A fila e os comprovantes de ponto dos funcionários permanecem separados.</p></FormSection>
 <FormSection title="Simular cobrança com PDF" description="Destinatário fictício, sem enviar e-mail ou mensagem."><Button variant="secondary" disabled={Boolean(busy)} loading={busy==='simulate'} onClick={()=>run('simulate')}>Simular os dois canais</Button>{simulation&&<p role="status">Simulação concluída. PDF preparado para e-mail e WhatsApp. Repetição bloqueada. Mensagens enviadas: {simulation.messagesSent}.</p>}</FormSection>
 {error&&<Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
 </main>;
}
createRoot(document.getElementById('root')).render(<ThemeProvider themeOverride="marcell"><HelpProvider><Connection/></HelpProvider></ThemeProvider>);
