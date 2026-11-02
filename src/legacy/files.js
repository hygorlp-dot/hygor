// Declarações extraídas literalmente da entrada legada; não importar LegacyApp aqui.


// Planilhas são um recurso pesado e opcional. O pacote só entra na memória
// quando o usuário realmente importa ou exporta um arquivo.
export let XLSX = null;

export const carregarXLSX = async () => {
  if (!XLSX) XLSX = await import("../lib/spreadsheet");
  return XLSX;
};


// O importador oficial é grande e só entra no bundle quando o operador escolhe
// um XLSX. O worker continua emitindo progresso e protegendo a tela de travas.
export const lerSinapiEmSegundoPlano = async (...args) => {
  const { readSinapiInWorker } = await import("../domains/orcamentos/sinapi-import");
  return readSinapiInWorker(...args);
};

export const arquivoComoDataUrl=file=>new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error("Não foi possível ler o arquivo."));reader.readAsDataURL(file);});




// ==============================================================
//  DIARIO DE OBRA (RDO) - conforme boa pratica
//  - Clima manha/tarde/noite
//  - Efetivo (mao de obra) + presencas do ponto sem trocar de aba
//  - Servicos executados: cada um atualiza o progresso da tarefa
//    do planejamento (alimenta a medicao de evolucao)
//  - Ocorrencias e fotos (Storage - guarda so a URL)
// ==============================================================

// Normaliza fotos de câmera antes do envio. Mantém o enquadramento completo
// (importante para a evidência), respeita a orientação EXIF quando o navegador
// oferece createImageBitmap e limita o payload para funcionar em redes móveis.
export const comprimirImagem = async file => {
  if(!file)throw new Error("Nenhuma foto foi selecionada.");
  if(file.size>24*1024*1024)throw new Error("A foto é maior que 24 MB. Reduza a resolução e tente novamente.");
  const tipo=String(file.type||"").toLowerCase();
  if(tipo&&!tipo.startsWith("image/"))throw new Error("Selecione um arquivo de imagem.");
  let imagem=null,objectUrl="";
  try{
    if(typeof createImageBitmap==="function"){
      try{imagem=await createImageBitmap(file,{imageOrientation:"from-image"});}catch{/* fallback para Image */}
    }
    if(!imagem){
      objectUrl=URL.createObjectURL(file);
      imagem=await new Promise((resolve,reject)=>{
        const img=new Image();
        img.onload=()=>resolve(img);
        img.onerror=()=>reject(new Error("Formato de foto não suportado. Use a câmera ou selecione JPG/PNG."));
        img.src=objectUrl;
      });
    }
    const largura=Number(imagem.width||imagem.naturalWidth||0),altura=Number(imagem.height||imagem.naturalHeight||0);
    if(!largura||!altura)throw new Error("Não foi possível ler as dimensões da foto.");
    const MAX=1600,escala=Math.min(1,MAX/Math.max(largura,altura));
    const canvas=document.createElement("canvas");
    canvas.width=Math.max(1,Math.round(largura*escala));
    canvas.height=Math.max(1,Math.round(altura*escala));
    const ctx=canvas.getContext("2d");
    if(!ctx)throw new Error("O navegador não conseguiu preparar a foto.");
    ctx.drawImage(imagem,0,0,canvas.width,canvas.height);
    return canvas.toDataURL("image/jpeg",0.78);
  }finally{
    if(objectUrl)URL.revokeObjectURL(objectUrl);
    if(imagem&&typeof imagem.close==="function")imagem.close();
  }
};
