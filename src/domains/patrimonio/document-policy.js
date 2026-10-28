export const PATRIMONY_DOCUMENT_MAX_BYTES=3*1024*1024;
export const PATRIMONY_DOCUMENT_MAX_MB=3;

export const PATRIMONY_DOCUMENT_MIME_TYPES=Object.freeze([
  "application/pdf",
  "application/xml",
  "text/xml",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export const isPatrimonyDocumentMime=mime=>
  PATRIMONY_DOCUMENT_MIME_TYPES.includes(String(mime||"").toLowerCase());

export const base64DecodedSize=value=>{
  const encoded=String(value||"").replace(/\s/g,"");
  if(!encoded)return 0;
  const padding=encoded.endsWith("==")?2:encoded.endsWith("=")?1:0;
  return Math.max(0,Math.floor(encoded.length*3/4)-padding);
};
