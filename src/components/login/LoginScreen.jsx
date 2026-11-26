import {useEffect, useRef, useState} from "react";
import {ChevronLeft, Delete, Eye, EyeOff} from "lucide-react";
import {alterarMinhaSenha, criarPrimeiroAdmin, entrarComEmail, entrarComPin} from "../../api.js";
import {BRAND} from "../../brand/identity.js";
import accessArchitecture from "../../assets/login-architectural-landscape.webp";
import {uid} from "../../legacy/format.js";
import {Checkbox} from "../../design-system/primitives/Checkbox.jsx";
import {Dialog} from "../../design-system/primitives/Dialog.jsx";
import {Alert, AlertDescription} from "../ui/alert";
import {Button} from "../ui/button";
import {Input} from "../ui/input";
import {Label} from "../ui/label";
import {Tabs, TabsContent, TabsList, TabsTrigger} from "../ui/tabs";

function AccessError({message}) {
  if (!message) return null;
  return <Alert variant="destructive" className="mrc-access__notice">
    <AlertDescription>{message}</AlertDescription>
  </Alert>;
}

function PasswordChangeDialog({email, onClose, onChanged, triggerRef}) {
  const [account,setAccount]=useState(email);
  const [current,setCurrent]=useState("");
  const [next,setNext]=useState("");
  const [confirmation,setConfirmation]=useState("");
  const [error,setError]=useState("");
  const [saving,setSaving]=useState(false);

  async function submit(event){
    event.preventDefault();
    if(saving)return;
    if(next.length<8||next!==confirmation){
      setError(next.length<8?"Use pelo menos 8 caracteres na nova senha.":"A confirmação deve ser igual à nova senha.");
      return;
    }
    setSaving(true);
    setError("");
    const result=await alterarMinhaSenha(account.trim(),current,next);
    if(result.ok)onChanged(account.trim());
    else {setSaving(false);setError(result.erro);}
  }

  return <Dialog open onOpenChange={open=>{if(!open&&!saving)onClose();}} title="Alterar senha" triggerRef={triggerRef}
    size="compact" className="mrc-access__password-dialog" protectEdits={false} footer={<>
      <Button type="button" variant="secondary" disabled={saving} onClick={onClose}>Cancelar</Button>
      <Button type="submit" form="login-change-password" loading={saving} loadingLabel="Salvando senha…">Salvar nova senha</Button>
    </>}>
    <form id="login-change-password" className="mrc-dialog-fields" onSubmit={submit}>
      <p className="mrc-access__hint">Confirme a senha atual. Se você a esqueceu, fale com o administrador da sua empresa.</p>
      <div className="mrc-access__field">
        <Label htmlFor="change-account">E-mail corporativo</Label>
        <Input id="change-account" required type="email" autoComplete="username" value={account} onChange={event=>setAccount(event.target.value)}/>
      </div>
      <div className="mrc-access__field">
        <Label htmlFor="change-current">Senha atual</Label>
        <Input id="change-current" required type="password" autoComplete="current-password" value={current} onChange={event=>setCurrent(event.target.value)}/>
      </div>
      <div className="mrc-access__field">
        <Label htmlFor="change-next">Nova senha</Label>
        <Input id="change-next" required type="password" autoComplete="new-password" value={next} onChange={event=>setNext(event.target.value)}/>
      </div>
      <div className="mrc-access__field">
        <Label htmlFor="change-confirmation">Confirmar nova senha</Label>
        <Input id="change-confirmation" required type="password" autoComplete="new-password" value={confirmation} onChange={event=>setConfirmation(event.target.value)}/>
      </div>
      <AccessError message={error}/>
    </form>
  </Dialog>;
}

export default function LoginScreen({ onLogin, erroInicial="", precisaSetup=false }) {
  const [metodo,setMetodo]=useState("email");
  const [email,setEmail]=useState("");
  const [senha,setSenha]=useState("");
  const [mostrarSenha,setMostrarSenha]=useState(false);
  const [step,setStep]=useState("select");
  const [identificador,setIdentificador]=useState("");
  const [pin,setPin]=useState("");
  const [erro,setErro]=useState("");
  const [loading,setLoading]=useState(false);
  const [rememberMe,setRememberMe]=useState(false);
  const [changingPassword,setChangingPassword]=useState(false);
  const [changedPassword,setChangedPassword]=useState(false);
  const [setupForm,setSetupForm]=useState({nome:"",email:"",pin:"",confirmacao:""});
  const identifierField=useRef(null);
  const firstPinKey=useRef(null);
  const changePasswordTrigger=useRef(null);

  useEffect(()=>{
    const target=step==="pin"?firstPinKey.current:identifierField.current;
    target?.focus();
  },[step]);

  const handleBackspace=()=>setPin(p=>p.slice(0,-1));
  const iniciarPin=()=>{
    if(!identificador.trim()){setErro("Informe seu e-mail ou nome completo.");return;}
    setStep("pin");setPin("");setErro("");
  };
  const tentarEntrar=async valor=>{
    if(!identificador.trim())return;
    if(valor.length<4){setErro("O PIN tem no mínimo 4 dígitos.");return;}
    setLoading(true);setErro("");
    const r=await entrarComPin(identificador.trim(),valor);
    if(!r.ok){setErro(r.erro||"Identificação ou PIN incorretos.");setPin("");setLoading(false);return;}
    onLogin(r.usuario,r.data);setLoading(false);
  };
  const handleLogin=()=>tentarEntrar(pin);
  const tentarEmail=async()=>{
    if(!email.trim()||!senha){setErro("Informe e-mail e senha.");return;}
    setLoading(true);setErro("");setChangedPassword(false);
    const r=await entrarComEmail(email.trim(),senha,{rememberMe});
    if(!r.ok){setErro(r.erro||"E-mail ou senha inválidos.");setLoading(false);return;}
    onLogin(r.usuario,r.data);setLoading(false);
  };
  const handleDigit=d=>{
    if(loading)return;
    const novo=pin.length<6?pin+d:pin;setPin(novo);setErro("");
    if(novo.length===6)tentarEntrar(novo);
  };
  const trocarMetodo=v=>{setMetodo(v);setStep("select");setErro("");setPin("");};
  const concluirPrimeiroAcesso=async()=>{
    const nome=setupForm.nome.trim(),email=setupForm.email.trim().toLowerCase(),pin=setupForm.pin;
    if(!nome){setErro("Informe o nome do administrador.");return;}
    if(pin.length<4){setErro("O PIN tem no mínimo 4 dígitos.");return;}
    if(pin!==setupForm.confirmacao){setErro("Os PINs não coincidem.");return;}
    setLoading(true);setErro("");
    try{
      const usuario={id:uid(),nome,role:"admin",email,pinPlain:pin,active:true,createdAt:new Date().toISOString()};
      const criado=await criarPrimeiroAdmin({usuarios:[usuario]});
      if(!criado.ok)throw new Error(criado.erro||"Não foi possível criar o administrador.");
      const acesso=await entrarComPin(email||nome,pin);
      if(!acesso.ok)throw new Error(acesso.erro||"Administrador criado, mas não foi possível iniciar a sessão.");
      onLogin(acesso.usuario,acesso.data);
    }catch(error){setErro(error.message||"Não foi possível concluir o primeiro acesso.");}
    finally{setLoading(false);}
  };

  return (
    <div className="mrc-access arcd-access-shell">
      <header className="mrc-access__brand">
        <img className="mrc-access__photo" src={accessArchitecture} alt="" width="1600" height="900" fetchPriority="high"/>
        <img src={BRAND.fullLogoOnDark} alt="MARCELL" width="400" height="369" className="mrc-login-signature"/>
        <p className="mrc-access__statement">Gestão de obras</p>
      </header>

      <main className="mrc-access__column" aria-labelledby="login-title">
        <div className="mrc-access__form">
          <header className="mrc-access__heading">
            <h1 id="login-title">{precisaSetup ? "Primeiro acesso" : "Entrar na plataforma"}</h1>
            <p>{precisaSetup
              ? "Crie a conta do administrador para iniciar o acesso à empresa."
              : "Use seu e-mail corporativo ou PIN de acesso."}</p>
          </header>

          <AccessError message={erroInicial}/>

          {precisaSetup ? (
            <form className="mrc-access__fields" noValidate onSubmit={event=>{event.preventDefault();if(!loading)concluirPrimeiroAcesso();}}>
              <div className="mrc-access__field">
                <Label htmlFor="setup-nome">Nome do administrador</Label>
                <Input id="setup-nome" autoComplete="name" value={setupForm.nome}
                  onChange={event=>setSetupForm(form=>({...form,nome:event.target.value}))}/>
              </div>
              <div className="mrc-access__field">
                <Label htmlFor="setup-email">E-mail corporativo</Label>
                <Input id="setup-email" type="email" autoComplete="email" value={setupForm.email}
                  onChange={event=>setSetupForm(form=>({...form,email:event.target.value}))}/>
              </div>
              <div className="mrc-access__setup-pins">
                <div className="mrc-access__field">
                  <Label htmlFor="setup-pin">PIN</Label>
                  <Input id="setup-pin" type="password" inputMode="numeric" value={setupForm.pin}
                    onChange={event=>setSetupForm(form=>({...form,pin:event.target.value}))}/>
                </div>
                <div className="mrc-access__field">
                  <Label htmlFor="setup-confirmacao">Confirmar PIN</Label>
                  <Input id="setup-confirmacao" type="password" inputMode="numeric" value={setupForm.confirmacao}
                    onChange={event=>setSetupForm(form=>({...form,confirmacao:event.target.value}))}/>
                </div>
              </div>
              <p className="mrc-access__hint">Os dados existentes da empresa serão preservados.</p>
              <AccessError message={erro}/>
              <Button type="submit" size="lg" loading={loading} loadingLabel="Criando administrador…">
                Criar administrador e entrar
              </Button>
            </form>
          ) : (
            <>
              <Tabs value={metodo} onValueChange={trocarMetodo}>
                <TabsList className="mrc-submenu" aria-label="Método de acesso">
                  <TabsTrigger value="email" disabled={loading}>E-mail e senha</TabsTrigger>
                  <TabsTrigger value="pin" disabled={loading}>PIN de acesso</TabsTrigger>
                </TabsList>

                <TabsContent value="email" className="mrc-access__method-panel">
                  <form className="mrc-access__fields" noValidate onSubmit={event=>{event.preventDefault();if(!loading)tentarEmail();}}>
                    <div className="mrc-access__field">
                      <Label htmlFor="login-email">E-mail corporativo</Label>
                      <Input id="login-email" type="email" autoComplete="username" autoCapitalize="none"
                        spellCheck={false} value={email} onChange={event=>setEmail(event.target.value)}
                        placeholder="nome@empresa.com.br"/>
                    </div>
                    <div className="mrc-access__field">
                      <div className="mrc-access__field-heading">
                        <Label htmlFor="login-senha">Senha</Label>
                        <Button ref={changePasswordTrigger} type="button" variant="link" size="sm" disabled={loading}
                          aria-haspopup="dialog" onClick={()=>{setChangedPassword(false);setChangingPassword(true);}}>Alterar senha</Button>
                      </div>
                      <div className="mrc-access__password">
                        <Input id="login-senha" type={mostrarSenha ? "text" : "password"}
                          autoComplete="current-password" value={senha} onChange={event=>setSenha(event.target.value)}/>
                        <Button type="button" variant="ghost" size="icon" onClick={()=>setMostrarSenha(visible=>!visible)}
                          aria-label={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}>
                          {mostrarSenha ? <EyeOff data-icon="inline-start"/> : <Eye data-icon="inline-start"/>}
                        </Button>
                      </div>
                    </div>
                    <Checkbox className="mrc-access__preferences" checked={rememberMe}
                      onChange={event=>setRememberMe(event.target.checked)} disabled={loading}
                      aria-labelledby="login-remember-label" aria-describedby="login-remember-note"
                      label={<span className="mrc-access__preferences-copy">
                        <span id="login-remember-label">Manter conectado neste dispositivo</span>
                        <small id="login-remember-note" className="mrc-access__hint">Até 7 dias. Use apenas em dispositivo pessoal.</small>
                      </span>}/>
                    <AccessError message={erro}/>
                    {changedPassword&&<Alert role="status" className="mrc-access__notice"><AlertDescription>Senha alterada. Entre com a nova senha.</AlertDescription></Alert>}
                    <Button type="submit" size="lg" loading={loading} loadingLabel="Verificando acesso…">
                      Acessar central MARCELL
                    </Button>
                  </form>
                </TabsContent>

                <TabsContent value="pin" className="mrc-access__method-panel">
                  {step === "select" ? (
                    <form className="mrc-access__fields" onSubmit={event=>{event.preventDefault();iniciarPin();}}>
                      <div className="mrc-access__field">
                        <Label htmlFor="login-identificador">E-mail ou nome completo</Label>
                        <Input id="login-identificador" ref={identifierField} autoComplete="username" autoCapitalize="none" spellCheck={false}
                          value={identificador} onChange={event=>{setIdentificador(event.target.value);setErro("");}}/>
                      </div>
                      <AccessError message={erro}/>
                      <Button type="submit" size="lg">Continuar com PIN</Button>
                    </form>
                  ) : (
                    <div className="mrc-access__fields">
                      <Button type="button" variant="ghost" disabled={loading}
                        className="mrc-access__back" onClick={()=>{setStep("select");setPin("");setErro("");}}>
                        <ChevronLeft data-icon="inline-start"/> Alterar identificação
                      </Button>
                      <div className="mrc-access__pin-identity">
                        <strong>{identificador.trim()}</strong>
                        <p className="mrc-access__hint">Informe seu PIN de acesso.</p>
                      </div>
                      <div className="mrc-access__pin-dots" role="status" aria-label={`${pin.length} de 6 dígitos informados`}>
                        {Array.from({length:6},(_,index)=>(
                          <span key={index} data-filled={index<pin.length} aria-hidden="true"/>
                        ))}
                      </div>
                      <AccessError message={erro}/>
                      <div className="mrc-access__keypad" role="group" aria-label="Teclado do PIN">
                        {[1,2,3,4,5,6,7,8,9,0].map(digit=>(
                          <Button key={digit} ref={digit===1?firstPinKey:undefined} type="button" variant="outline" disabled={loading}
                            onClick={()=>handleDigit(String(digit))}>{digit}</Button>
                        ))}
                        <Button type="button" variant="outline" disabled={loading} aria-label="Apagar último dígito"
                          onClick={handleBackspace}><Delete data-icon="inline-start"/></Button>
                      </div>
                      {(loading || pin.length>=4) && (
                        <Button type="button" onClick={handleLogin} size="lg" loading={loading}
                          loadingLabel="Verificando acesso…">Confirmar acesso</Button>
                      )}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
              <p className="mrc-access__support">Precisa de acesso? Fale com o administrador da sua empresa.</p>
            </>
          )}
        </div>
      </main>
      {changingPassword&&<PasswordChangeDialog email={email} triggerRef={changePasswordTrigger}
        onClose={()=>setChangingPassword(false)} onChanged={account=>{
          setEmail(account);setSenha("");setErro("");setChangedPassword(true);setChangingPassword(false);
        }}/>}
    </div>
  );
}
