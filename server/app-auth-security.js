import crypto from "node:crypto";

export const APP_PIN_PREFIX="scrypt-v1";
const KEY_LENGTH=32;
const SCRYPT_OPTIONS={N:16384,r:8,p:1,maxmem:32*1024*1024};

const safeEqual=(left,right)=>{
  const a=Buffer.from(String(left||""));
  const b=Buffer.from(String(right||""));
  return a.length===b.length&&crypto.timingSafeEqual(a,b);
};

export const hashLegacyAppPin=pin=>
  crypto.createHash("sha256").update(String(pin||"")).digest("hex");

export const hashAppPin=pin=>{
  const salt=crypto.randomBytes(16).toString("base64url");
  const derived=crypto.scryptSync(String(pin||""),salt,KEY_LENGTH,SCRYPT_OPTIONS).toString("base64url");
  return `${APP_PIN_PREFIX}$${SCRYPT_OPTIONS.N}$${SCRYPT_OPTIONS.r}$${SCRYPT_OPTIONS.p}$${salt}$${derived}`;
};

export const verifyAppPin=(pin,stored)=>{
  const value=String(stored||"");
  if(value.startsWith(`${APP_PIN_PREFIX}$`)){
    const [prefix,n,r,p,salt,expected]=value.split("$");
    if(prefix!==APP_PIN_PREFIX||!salt||!expected)return {ok:false,needsUpgrade:false};
    try{
      const derived=crypto.scryptSync(String(pin||""),salt,KEY_LENGTH,{
        N:Number(n),r:Number(r),p:Number(p),maxmem:32*1024*1024,
      }).toString("base64url");
      return {ok:safeEqual(derived,expected),needsUpgrade:false};
    }catch{return {ok:false,needsUpgrade:false};}
  }
  const legacy=/^[a-f0-9]{64}$/i.test(value)&&safeEqual(hashLegacyAppPin(pin),value);
  return {ok:legacy,needsUpgrade:legacy};
};

export const authRateLimitSubject=(company,subject)=>
  crypto.createHash("sha256").update(`${company}|${subject||"unknown"}`).digest("hex");

export const applyPersistentAuthRateLimit=async(db,{company,subject,action})=>{
  const rpc=action==="status"?"auth_rate_limit_status":action==="success"?"auth_rate_limit_success":"auth_rate_limit_failure";
  try{
    const {data,error}=await db.rpc(rpc,{
      p_company_id:company,p_subject_hash:authRateLimitSubject(company,subject),
    });
    if(error)return null;
    const row=Array.isArray(data)?data[0]:data;
    return {blocked:!!row?.blocked,retryAfter:Number(row?.retry_after_seconds||0)};
  }catch{return null;}
};

export function createAppAuthRateLimiter({ db, currentCompany }) {
  // ── Freio contra força bruta ───────────────────────────────────────
  // Um PIN de 4 dígitos tem 10.000 combinações — um script testa tudo em
  // minutos se deixarmos. Aqui a memória é por instância (serverless recicla),
  // então é um freio, não um cofre. O que realmente protege é PIN de 6 dígitos.
  const tentativas = new Map();
  const LIMITE = 8;
  const JANELA = 5 * 60 * 1000;

  const bloqueado = (ip) => {
    const t = tentativas.get(ip);
    if (!t) return false;
    if (Date.now() - t.desde > JANELA) { tentativas.delete(ip); return false; }
    return t.n >= LIMITE;
  };

  const registrarFalha = (ip) => {
    const t = tentativas.get(ip);
    if (!t || Date.now() - t.desde > JANELA) tentativas.set(ip, { n: 1, desde: Date.now() });
    else t.n += 1;
  };
  const limparFalhas = subject => tentativas.delete(subject);
  const rateLimitCentral=async(subject,action)=>{
    const result=await applyPersistentAuthRateLimit(db,{company:currentCompany(),subject,action});
    return result?{blocked:result.blocked,retry:result.retryAfter}:null;
  };

  return { bloqueado, registrarFalha, limparFalhas, rateLimitCentral };
}
