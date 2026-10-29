// Busca as fotos privadas do patrimônio e devolve miniaturas embutidas
// (data URL) para o PDF. Falha de uma foto não impede o relatório.
const thumbnail=async blob=>{
  const bitmap=await createImageBitmap(blob);
  const scale=Math.min(1,320/Math.max(bitmap.width,bitmap.height));
  const canvas=document.createElement("canvas");
  canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
  canvas.getContext("2d").drawImage(bitmap,0,0,canvas.width,canvas.height);
  bitmap.close?.();
  return canvas.toDataURL("image/jpeg",0.8);
};
export async function loadPatrimonyPhotos(assets,getSignedUrl,concurrency=4){
  const queue=(assets||[]).filter(asset=>asset?.id&&asset?.photo?.path);
  const photos={};
  const worker=async()=>{
    while(queue.length){
      const asset=queue.shift();
      try{
        const signed=await getSignedUrl(asset.photo.path);
        if(!signed?.ok||!signed.url)continue;
        const response=await fetch(signed.url);
        if(!response.ok)continue;
        photos[asset.id]=await thumbnail(await response.blob());
      }catch{/* foto indisponível: o relatório mostra o aviso */}
    }
  };
  await Promise.all(Array.from({length:Math.min(concurrency,queue.length)},worker));
  return photos;
}
