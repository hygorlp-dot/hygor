const IMAGE_ROOT="/assets/equipment";

export const EQUIPMENT_IMAGE_OPTIONS=Object.freeze([
  {v:"auto",l:"Automática pelo nome"},
  {v:"betoneira",l:"Betoneira"},
  {v:"compactador",l:"Compactador de solo"},
  {v:"gerador",l:"Gerador"},
  {v:"martelete",l:"Martelete / rompedor"},
  {v:"andaime",l:"Andaime"},
  {v:"serra",l:"Serra / cortadora"},
  {v:"bomba",l:"Bomba"},
  {v:"escavadeira",l:"Escavadeira"},
]);

const IMAGE_FILES=Object.freeze({
  betoneira:`${IMAGE_ROOT}/betoneira.webp`,
  compactador:`${IMAGE_ROOT}/compactador.webp`,
  gerador:`${IMAGE_ROOT}/gerador.webp`,
  martelete:`${IMAGE_ROOT}/martelete.webp`,
  andaime:`${IMAGE_ROOT}/andaime.webp`,
  serra:`${IMAGE_ROOT}/serra.webp`,
  bomba:`${IMAGE_ROOT}/bomba.webp`,
  escavadeira:`${IMAGE_ROOT}/escavadeira.webp`,
});

const normalizar=value=>String(value||"")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g,"")
  .toUpperCase();

export const inferEquipmentImageType=equipment=>{
  const text=normalizar([
    equipment?.nome,
    equipment?.categoria,
    equipment?.sinapiDescricao,
  ].filter(Boolean).join(" "));
  if(/BETONEIRA|MISTURADOR/.test(text))return "betoneira";
  if(/COMPACTADOR|PLACA VIBRATORIA|SAPO/.test(text))return "compactador";
  if(/GERADOR|GRUPO GERADOR/.test(text))return "gerador";
  if(/MARTELETE|ROMPEDOR|DEMOLIDOR/.test(text))return "martelete";
  if(/ANDAIME|TORRE TUBULAR/.test(text))return "andaime";
  if(/SERRA|CORTADORA|POLICORTE|ESMERILHADEIRA/.test(text))return "serra";
  if(/MOTOBOMBA|BOMBA D.AGUA|BOMBA DE AGUA|BOMBA CENTRIFUGA/.test(text))return "bomba";
  if(/ESCAVADEIRA|RETROESCAVADEIRA|MINI ESCAVADEIRA|TRATOR|PA CARREGADEIRA/.test(text))return "escavadeira";
  return "";
};

export const equipmentImageFor=equipment=>{
  const candidate=String(equipment?.imagemUrl||"").trim();
  const original=/^https:\/\//i.test(candidate)||/^\/(?!\/)/.test(candidate)?candidate:"";
  if(original)return {
    src:original,
    source:"original",
    type:"original",
    label:"Foto original",
    approximate:false,
  };
  const manual=String(equipment?.imagemTipo||"auto");
  const inferred=inferEquipmentImageType(equipment);
  const type=manual!=="auto"&&IMAGE_FILES[manual]?manual:inferred;
  if(!type)return {
    src:"",
    source:"missing",
    type:"",
    label:"Imagem a definir",
    approximate:false,
  };
  return {
    src:IMAGE_FILES[type],
    source:"ai",
    type,
    label:manual==="auto"?"Imagem IA automática":"Imagem IA selecionada",
    approximate:manual==="auto"&&!!inferred,
  };
};
