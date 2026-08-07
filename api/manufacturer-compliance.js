import { searchManufacturerCompliance } from "../server/manufacturer-compliance.js";

export default async function handler(req,res){
  if(req.method!=="GET")return res.status(405).json({error:"Método não permitido."});
  const query=String(req.query?.q||"").trim();
  if(query.length<3)return res.status(400).json({error:"Informe ao menos 3 caracteres ou um CNPJ."});
  if(query.length>100)return res.status(400).json({error:"A consulta deve ter no máximo 100 caracteres."});
  try{
    const result=await searchManufacturerCompliance(query);
    res.setHeader("Cache-Control","public, s-maxage=300, stale-while-revalidate=900");
    return res.status(200).json({ok:true,...result});
  }catch(error){
    console.error("Falha na consulta de conformidade:",error?.name||error);
    return res.status(502).json({error:"Não foi possível consultar as fontes oficiais agora. Tente novamente."});
  }
}
