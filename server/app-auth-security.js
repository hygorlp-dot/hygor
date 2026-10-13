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

// limit/windowSeconds: opcionais, só valem na falha (p_limit/p_window_seconds
// da RPC). Ausentes = padrão da migration (8 falhas em 5 min), como sempre foi.
export const applyPersistentAuthRateLimit=async(db,{company,subject,action,limit,windowSeconds})=>{
  const rpc=action==="status"?"auth_rate_limit_status":action==="success"?"auth_rate_limit_success":"auth_rate_limit_failure";
  const extra=rpc==="auth_rate_limit_failure"?{
    ...(Number.isInteger(limit)&&limit>0?{p_limit:limit}:{}),
    ...(Number.isInteger(windowSeconds)&&windowSeconds>0?{p_window_seconds:windowSeconds}:{}),
  }:{};
  try{
    const {data,error}=await db.rpc(rpc,{
      p_company_id:company,p_subject_hash:authRateLimitSubject(company,subject),...extra,
    });
    if(error)return null;
    const row=Array.isArray(data)?data[0]:data;
    return {blocked:!!row?.blocked,retryAfter:Number(row?.retry_after_seconds||0)};
  }catch{return null;}
};
