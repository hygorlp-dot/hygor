import {Suspense,useState} from "react";
import {ChevronLeft,Delete,Eye,EyeOff} from "lucide-react";
import {criarPrimeiroAdmin,entrarComEmail,entrarComPin} from "../../api.js";
import {uid} from "../../legacy/format.js";
import {lazyWithCssRetry as lazy} from "../../lib/lazy-with-css-retry.js";
import {cn} from "../../lib/utils";
import {Alert,AlertDescription} from "../ui/alert";
import {Button} from "../ui/button";
import {Card,CardContent,CardDescription,CardFooter,CardHeader,CardTitle} from "../ui/card";
import {Input} from "../ui/input";
import {Label} from "../ui/label";
import {Tabs,TabsContent,TabsList,TabsTrigger} from "../ui/tabs";

const LazyLoginBrandPanel = lazy(() => import("./LoginProjectParallax"));

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
  const [setupForm,setSetupForm]=useState({nome:"",email:"",pin:"",confirmacao:""});

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
    setLoading(true);setErro("");
    const r=await entrarComEmail(email.trim(),senha);
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
    <div className="login-tech-shell">
      <Suspense fallback={<div className="login-project-visual" aria-hidden="true"/>}>
        <LazyLoginBrandPanel/>
      </Suspense>

      <main className="login-access-column">
      <Card className="login-access-card w-full shadow-none">
        <CardHeader className="pb-5 pt-8">
          <CardTitle className="font-display text-2xl tracking-[-0.02em]">Acesse seu ambiente</CardTitle>
          <CardDescription className="mt-2">Use sua credencial corporativa para continuar.</CardDescription>
        </CardHeader>

        <CardContent>
            {erroInicial&&<div role="alert" className="mb-4 rounded-md border border-red-400/35 bg-red-400/10 px-3 py-2 text-xs font-medium text-red-100">{erroInicial}</div>}
            {precisaSetup ? <div className="flex flex-col gap-4">
              <div className="login-setup-note rounded-md p-3 text-xs leading-relaxed">
                Crie o administrador inicial. Os dados existentes da empresa serão preservados.
              </div>
              <div className="flex flex-col gap-2"><Label htmlFor="setup-nome" className="text-xs font-semibold">Nome do administrador</Label><Input id="setup-nome" value={setupForm.nome} onChange={e=>setSetupForm(f=>({...f,nome:e.target.value}))} autoFocus className="h-12"/></div>
              <div className="flex flex-col gap-2"><Label htmlFor="setup-email" className="text-xs font-semibold">E-mail corporativo</Label><Input id="setup-email" type="email" value={setupForm.email} onChange={e=>setSetupForm(f=>({...f,email:e.target.value}))} className="h-12"/></div>
              <div className="grid grid-cols-2 gap-3"><div className="flex flex-col gap-2"><Label htmlFor="setup-pin" className="text-xs font-semibold">PIN</Label><Input id="setup-pin" type="password" inputMode="numeric" value={setupForm.pin} onChange={e=>setSetupForm(f=>({...f,pin:e.target.value}))} className="h-12"/></div><div className="flex flex-col gap-2"><Label htmlFor="setup-confirmacao" className="text-xs font-semibold">Confirmar PIN</Label><Input id="setup-confirmacao" type="password" inputMode="numeric" value={setupForm.confirmacao} onChange={e=>setSetupForm(f=>({...f,confirmacao:e.target.value}))} className="h-12"/></div></div>
              {erro&&<Alert key={erro} variant="destructive" className="py-2.5 login-error-shake"><AlertDescription className="text-xs">{erro}</AlertDescription></Alert>}
              <Button onClick={concluirPrimeiroAcesso} disabled={loading} className="login-primary-action h-12 w-full">{loading?"Criando ambiente...":"Criar administrador e entrar"}</Button>
            </div> : <Tabs value={metodo} onValueChange={trocarMetodo}>
              <TabsList fullWidth>
                <TabsTrigger value="email">E-mail e senha</TabsTrigger>
                <TabsTrigger value="pin">PIN de acesso</TabsTrigger>
              </TabsList>

              <TabsContent value="email" className="flex flex-col gap-4 mt-5">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="login-email" className="text-xs font-semibold">E-mail corporativo</Label>
                  <Input id="login-email" type="email" autoComplete="username" autoFocus
                         value={email} onChange={e=>setEmail(e.target.value)}
                         onKeyDown={e=>{if(e.key==="Enter")tentarEmail();}}
                         placeholder="nome@empresa.com.br"
                         className="h-12" />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="login-senha" className="text-xs font-semibold">Senha</Label>
                  <div className="relative">
                    <Input id="login-senha" type={mostrarSenha?"text":"password"} autoComplete="current-password"
                           value={senha} onChange={e=>setSenha(e.target.value)}
                           onKeyDown={e=>{if(e.key==="Enter")tentarEmail();}}
                           placeholder="Digite sua senha" className="h-12 pr-12" />
                    <Button type="button" variant="ghost" size="icon" onClick={()=>setMostrarSenha(v=>!v)}
                            aria-label={mostrarSenha?"Ocultar senha":"Mostrar senha"}
                            className="login-password-toggle absolute right-1 top-1/2 -translate-y-1/2">
                      {mostrarSenha ? <EyeOff className="w-4 h-4"/> : <Eye className="w-4 h-4"/>}
                    </Button>
                  </div>
                </div>

                {erro && (
                  <Alert key={erro} variant="destructive" className="py-2.5 login-error-shake">
                    <AlertDescription className="text-xs">{erro}</AlertDescription>
                  </Alert>
                )}

                <Button onClick={tentarEmail} disabled={loading} className="login-primary-action h-12 w-full">
                  {loading ? "Sincronizando operação..." : "Acessar central MARCELL"}
                </Button>
                <p className="text-center text-xs leading-relaxed">
                  Acesso individual, seguro e auditável.
                </p>
              </TabsContent>

              <TabsContent value="pin" className="mt-4">
                {step === "select" ? (
                  <form className="flex flex-col gap-4" onSubmit={e=>{e.preventDefault();iniciarPin();}}>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="login-identificador" className="text-xs font-semibold">E-mail ou nome completo</Label>
                      <Input id="login-identificador" autoComplete="username" autoCapitalize="none" spellCheck={false}
                             value={identificador} onChange={e=>{setIdentificador(e.target.value);setErro("");}}
                             placeholder="Digite seu e-mail ou nome completo"
                             className="h-12" />
                    </div>
                    {erro && (
                      <Alert key={erro} variant="destructive" className="py-2.5 login-error-shake">
                        <AlertDescription className="text-xs">{erro}</AlertDescription>
                      </Alert>
                    )}
                    <Button type="submit" disabled={loading} className="login-primary-action h-12 w-full">
                      Continuar com PIN
                    </Button>
                  </form>
                ) : (
                  <div className="flex flex-col gap-4">
                    <Button type="button" variant="ghost" onClick={()=>{setStep("select");setPin("");setErro("");}}
                            className="login-quiet-action flex min-h-11 items-center gap-1 text-xs font-semibold uppercase tracking-wide">
                      <ChevronLeft className="w-3.5 h-3.5"/> Alterar identificação
                    </Button>
                    <div className="text-center flex flex-col items-center gap-1">
                      <b className="max-w-full break-words text-sm">{identificador.trim()}</b>
                      <small className="text-xs">Informe seu PIN de acesso.</small>
                    </div>
                    <div className="flex justify-center gap-2.5" aria-label={`${pin.length} de 6 dígitos informados`}>
                      {Array.from({length:6},(_,i)=>(
                        <span key={i} data-filled={i < pin.length} className={cn(
                          "login-pin-dot w-3 h-3 rounded-full border-[1.5px] transition-colors"
                        )} />
                      ))}
                    </div>
                    {erro && (
                      <Alert key={erro} variant="destructive" className="py-2.5 login-error-shake">
                        <AlertDescription className="text-xs">{erro}</AlertDescription>
                      </Alert>
                    )}
                    <div className="grid grid-cols-3 gap-2">
                      {[1,2,3,4,5,6,7,8,9,"",0,"back"].map((d,i)=>(
                        <Button key={i} type="button" variant="outline" disabled={loading||d===""}
                                className={cn("login-key h-12 active:scale-95 transition-transform",d===""&&"invisible")}
                                onClick={()=>d===""?null:d==="back"?handleBackspace():handleDigit(String(d))}>
                          {d==="back" ? <Delete className="w-4 h-4"/> : d}
                        </Button>
                      ))}
                    </div>
                    {pin.length>=4 && pin.length<6 && (
                      <Button onClick={handleLogin} disabled={loading} className="login-primary-action w-full">
                        {loading ? "Validando credencial..." : "Confirmar acesso"}
                      </Button>
                    )}
                  </div>
                )}
              </TabsContent>
            </Tabs>}
        </CardContent>

        <CardFooter className="mrc-login-footer justify-between border-t pt-4 text-xs">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-green-600" /> Conexão segura
          </span>
          <span>Acesso individual</span>
        </CardFooter>
      </Card>
      </main>
    </div>
  );
}
