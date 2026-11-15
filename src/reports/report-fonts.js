// These are the same official bytes used by the ERP stylesheet. Reusing the
// public files avoids shipping a second base64 copy in the initial JavaScript.
// The finished report still embeds both fonts and can be saved independently.
const files={regularFont:'NimbusSans-Regular.woff2',boldFont:'NimbusSans-Bold.woff2'};
const cacheName='marcell-report-fonts-urw-20200910';
const failure='Não foi possível carregar as fontes do relatório. Confira a conexão e tente carregar novamente.';
let fonts,pending;

async function readFont(name){
 const url=`${import.meta.env.BASE_URL}fonts/marcell/${name}`;
 let cache;
 try{cache=await globalThis.caches?.open(cacheName);}catch{/* Private browsing can deny persistent caching. */}
 let response;
 try{response=await cache?.match(url);}catch{/* Continue with the same-origin HTTP cache. */}
 if(!response){
  response=await fetch(url,{cache:'force-cache',credentials:'same-origin'});
  if(!response.ok)throw Error(failure);
  // Cache only a successful, structurally valid WOFF2 response.
 }
 const bytes=new Uint8Array(await response.arrayBuffer());
 if(bytes.length<48||String.fromCharCode(...bytes.subarray(0,4))!=='wOF2'
  ||new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength).getUint32(8)!==bytes.length)throw Error(failure);
 if(cache){try{await cache.put(url,new Response(bytes,{headers:{'Content-Type':'font/woff2'}}));}catch{/* Memory preparation remains usable if storage is full. */}}
 let binary='';
 for(let offset=0;offset<bytes.length;offset+=8192)binary+=String.fromCharCode(...bytes.subarray(offset,offset+8192));
 return 'data:font/woff2;base64,'+btoa(binary);
}

export function loadReportFonts(){
 if(fonts)return Promise.resolve(fonts);
 if(!pending)pending=Promise.all(Object.entries(files).map(async([key,name])=>[key,await readFont(name)]))
  .then(entries=>(fonts=Object.freeze(Object.fromEntries(entries))))
  .catch(()=>{pending=undefined;throw Error(failure);});
 return pending;
}

export function readReportFonts({optional=false}={}){
 if(!fonts&&!optional)throw Error('Aguarde o carregamento das fontes antes de gerar o relatório.');
 return fonts;
}
