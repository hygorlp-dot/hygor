import crypto from "crypto";

const derive=(secret,company)=>crypto.createHash("sha256")
  .update(`${secret}:${company}:arcd-gemini-config`).digest();

export const encryptAiSecret=(plainText,{secret,company,keyVersion})=>{
  if(!secret)throw new Error("Chave de criptografia da IA não configurada.");
  const iv=crypto.randomBytes(12);
  const cipher=crypto.createCipheriv("aes-256-gcm",derive(secret,company),iv);
  const encrypted=Buffer.concat([cipher.update(plainText,"utf8"),cipher.final()]);
  return {
    encryptedKey:encrypted.toString("base64"),iv:iv.toString("base64"),
    tag:cipher.getAuthTag().toString("base64"),keyVersion,
  };
};

const decryptWith=(value,secret,company)=>{
  const decipher=crypto.createDecipheriv(
    "aes-256-gcm",derive(secret,company),Buffer.from(value.iv,"base64"),
  );
  decipher.setAuthTag(Buffer.from(value.tag,"base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(value.encryptedKey,"base64")),decipher.final(),
  ]).toString("utf8");
};

export const decryptAiSecret=(value,{primarySecret,legacySecret,company})=>{
  const candidates=value?.keyVersion==="ai-v1"
    ? [{secret:primarySecret,source:"ai-v1"}]
    : [
        {secret:legacySecret,source:"legacy-service-role"},
        {secret:primarySecret,source:"ai-v1"},
      ];
  let lastError;
  for(const candidate of candidates){
    if(!candidate.secret)continue;
    try{return {plainText:decryptWith(value,candidate.secret,company),source:candidate.source};}
    catch(error){lastError=error;}
  }
  throw lastError||new Error("Nenhuma chave disponível para abrir a configuração da IA.");
};
