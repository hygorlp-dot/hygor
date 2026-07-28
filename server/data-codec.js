import { gzipSync, gunzipSync } from "zlib";

const MARKER = "arcd-gzip-base64-v1";
const MIN_BYTES = 64 * 1024;

export const isEncodedAppData = value => value?.__arcdEncoding === MARKER && typeof value?.data === "string";

export const decodeAppData = value => {
  let parsed=value;
  if(typeof parsed==="string"){try{parsed=JSON.parse(parsed);}catch{return {};}}
  if(!isEncodedAppData(parsed))return parsed||{};
  try{return JSON.parse(gunzipSync(Buffer.from(parsed.data,"base64")).toString("utf8"));}
  catch(error){console.error("Falha ao descompactar dados do ArcD:",error);throw new Error("Não foi possível abrir os dados compactados da empresa.");}
};

export const encodeAppData = value => {
  if(isEncodedAppData(value))return value;
  const json=JSON.stringify(value||{});
  if(Buffer.byteLength(json,"utf8")<MIN_BYTES)return value||{};
  return {__arcdEncoding:MARKER,data:gzipSync(json,{level:6}).toString("base64")};
};

export const compactProfiles = payload => ({
  usuarios:(payload?.usuarios||[]).map(u=>({
    id:u.id,
    nome:u.nome,
    role:u.role,
    email:u.email||"",
    authUserId:u.authUserId||"",
    pin:u.pin||"",
    obraId:u.obraId||"",
    active:u.active!==false,
  })),
  atualizadoEm:new Date().toISOString(),
});
