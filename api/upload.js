// ===================================================================
// /api/upload - sobe foto do diario de obra para o Supabase Storage
//
// POR QUE ESTE ENDPOINT EXISTE (e nao guardamos a foto no blob)
//
// O app inteiro vive num unico JSON (company_app_data). Todo save()
// reenvia esse JSON completo. Se a foto fosse base64 dentro dele, cada
// batida de ponto arrastaria megabytes pelo 4G do celular - e em semanas
// o blob estouraria o limite e travaria tudo.
//
// A saida: a foto vai para um BUCKET do Storage. O app guarda so a URL.
// O blob continua leve; o ponto continua salvando rapido.
//
// Assim como /api/data, o navegador nunca toca no banco direto: fala com
// esta funcao, que roda no servidor e guarda a SERVICE_ROLE_KEY. E o PIN
// e conferido aqui, do mesmo jeito.
// ===================================================================

import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import { authenticateAppUser } from "../server/app-auth.js";
import {handleRhDocuments} from '../server/rh-documents.js';
import {
  canUploadToDestination,
  isAcceptedUploadMime,
  uploadDestination,
  uploadStoragePrefix,
  UPLOAD_DESTINATION,
} from "../server/upload-policy.js";

const URL     = process.env.SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET  = process.env.SUPABASE_BUCKET || "diario-obra";
const PATRIMONIO_BUCKET = process.env.SUPABASE_PATRIMONIO_BUCKET || "patrimonio-empresa";
const PATRIMONIO_MIMES = ["application/pdf","application/xml","text/xml","image/jpeg","image/png","image/webp"];

const db = createClient(URL, SERVICE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let patrimonioBucketReady = false;
const garantirBucketPatrimonio = async () => {
  if (patrimonioBucketReady) return;
  const { data: existing } = await db.storage.getBucket(PATRIMONIO_BUCKET);
  if (!existing) {
    const { error } = await db.storage.createBucket(PATRIMONIO_BUCKET, {
      public:false, fileSizeLimit:"4MB", allowedMimeTypes:PATRIMONIO_MIMES,
    });
    if (error && !/already exists|duplicate/i.test(String(error.message||""))) throw error;
  } else if (existing.public) {
    const { error } = await db.storage.updateBucket(PATRIMONIO_BUCKET, {
      public:false, fileSizeLimit:"4MB", allowedMimeTypes:PATRIMONIO_MIMES,
    });
    if (error) throw error;
  }
  patrimonioBucketReady = true;
};

// Anexos do chat interno não pertencem a uma obra (é uma conversa da empresa
// toda), por isso aceitam mais tipos de arquivo e não passam pela checagem de
// escopo por obra usada nas fotos do diário. Mantido restrito mesmo assim:
// documentos e mídia comuns de conversa, nunca executáveis.
// Aceita corpo maior (fotos ja comprimidas no cliente, ~200-800KB em base64).
export const config = { api: { bodyParser: { sizeLimit: "6mb" } } };

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Metodo nao permitido." });
  if (!URL || !SERVICE) return res.status(500).json({ error: "Storage nao configurado." });

  const { userId, pin, accessToken, dataUrl, obraId, ext, folder, action, path: requestedPath } = req.body || {};
  const destination = uploadDestination(folder);
  const paraChat = destination === UPLOAD_DESTINATION.CHAT;
  const paraPatrimonio = destination === UPLOAD_DESTINATION.PATRIMONIO;

  // 1. Autentica.
  const user = await authenticateAppUser({userId,pin,accessToken},{scope:"upload"});
  if (!user) return res.status(401).json({ error: "PIN invalido." });
  if(folder==='rh'){
    res.setHeader('Cache-Control','no-store');
    try{const result=await handleRhDocuments({db,user,body:req.body,company:process.env.COMPANY_ID||'arcd'});return res.status(result.status).json(result.body);}
    catch(error){console.error('Prontuário RH indisponível:',error?.message);return res.status(503).json({ok:false,error:'Prontuário indisponível. Tente novamente.'});}
  }
  if(paraPatrimonio&&action==="signed-url"){
    if(!canUploadToDestination(user,{folder:"patrimonio"}))return res.status(403).json({error:"Você não pode acessar documentos patrimoniais."});
    const safePath=String(requestedPath||"");
    if(!/^patrimonio\/[0-9]{4}\/[0-9a-f-]+\.[a-z0-9]+$/i.test(safePath))return res.status(400).json({error:"Documento patrimonial inválido."});
    await garantirBucketPatrimonio();
    const {data:signed,error:signedError}=await db.storage.from(PATRIMONIO_BUCKET).createSignedUrl(safePath,300);
    if(signedError||!signed?.signedUrl)return res.status(404).json({error:"Documento patrimonial não encontrado."});
    res.setHeader("Cache-Control","no-store");
    return res.status(200).json({ok:true,url:signed.signedUrl,expiraEmSegundos:300});
  }
  const requestedWork=String(obraId||"");
  if(!canUploadToDestination(user,{obraId:requestedWork,folder})){
    return res.status(403).json({error:"Você não pode enviar arquivos para outra obra."});
  }

  // 2. Valida o arquivo (data URL base64).
  if (!dataUrl || typeof dataUrl !== "string" || dataUrl.indexOf(",") < 0) {
    return res.status(400).json({ error: "Arquivo invalido." });
  }
  const virgula = dataUrl.indexOf(",");
  const mime = dataUrl.slice(5, virgula).split(";")[0];  // ex.: image/jpeg
  const tipoAceito = isAcceptedUploadMime(mime, folder);
  if (!tipoAceito) {
    return res.status(400).json({ error: paraChat ? "Tipo de arquivo não suportado no chat." : "Imagem invalida." });
  }
  const base64  = dataUrl.slice(virgula + 1);
  const buffer  = Buffer.from(base64, "base64");
  // Limite de seguranca: ~4MB por arquivo ja descomprimido.
  if (buffer.length > 4 * 1024 * 1024) {
    return res.status(413).json({ error: paraChat ? "Arquivo muito grande (máx. 4MB)." : "Foto muito grande. Comprima antes." });
  }
  const extensao = (ext || mime.split("/")[1] || "jpg").replace(/[^a-z0-9]/gi, "");

  // 3. Caminho: diario-obra/{obra}/{ano}/{uuid}.jpg  ou  diario-obra/chat/{ano}/{uuid}.ext
  const ano   = new Date().getFullYear();
  const nome  = `${crypto.randomUUID()}.${extensao}`;
  const path = `${uploadStoragePrefix({obraId:requestedWork,folder})}/${ano}/${nome}`;

  try {
    if (paraPatrimonio) await garantirBucketPatrimonio();
    const bucketAlvo = paraPatrimonio ? PATRIMONIO_BUCKET : BUCKET;
    const { error: upErr } = await db.storage
      .from(bucketAlvo)
      .upload(path, buffer, { contentType: mime, upsert: false });
    if (upErr) {
      // Bucket ainda nao existe? Devolve mensagem clara.
      if (String(upErr.message || "").toLowerCase().includes("bucket")) {
        return res.status(400).json({ error: "bucket_ausente", detalhe: upErr.message });
      }
      throw upErr;
    }
    if(paraPatrimonio){
      res.setHeader("Cache-Control","no-store");
      return res.status(200).json({ok:true,path});
    }
    const { data: pub } = db.storage.from(BUCKET).getPublicUrl(path);
    return res.status(200).json({ ok: true, url: pub.publicUrl, path });
  } catch (err) {
    console.error("Falha em /api/upload:", err);
    return res.status(500).json({ error: "Falha ao subir a foto." });
  }
}
