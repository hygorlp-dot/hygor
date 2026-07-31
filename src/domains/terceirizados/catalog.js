export const THIRD_PARTY_SPECIALTIES = Object.freeze([
  { v: "pedreiro", l: "Pedreiro / alvenaria", emoji: "", color: "#c98a3e" },
  { v: "eletricista", l: "Eletricista", emoji: "", color: "#f6d833" },
  { v: "encanador", l: "Encanador", emoji: "", color: "#54a0ff" },
  { v: "serralheiro", l: "Serralheiro", emoji: "", color: "#ff9f1c" },
  { v: "armador", l: "Armador", emoji: "", color: "#b779ff" },
  { v: "carpinteiro", l: "Carpinteiro / formas", emoji: "", color: "#a0703c" },
  { v: "pintor", l: "Pintor", emoji: "", color: "#4fc3a1" },
  { v: "gesseiro", l: "Gesseiro / forro", emoji: "", color: "#9aa7b5" },
  { v: "azulejista", l: "Azulejista / revestimento", emoji: "", color: "#5aa9d6" },
  { v: "marmorista", l: "Marmorista", emoji: "", color: "#7d8b99" },
  { v: "vidraceiro", l: "Vidraceiro", emoji: "", color: "#63c7d8" },
  { v: "marceneiro", l: "Marceneiro", emoji: "", color: "#8d6e4f" },
  { v: "impermeabilizador", l: "Impermeabilizador", emoji: "", color: "#3f7f8c" },
  { v: "telhadista", l: "Telhadista / cobertura", emoji: "", color: "#d1603d" },
  { v: "climatizacao", l: "Climatização", emoji: "", color: "#6fb6e8" },
  { v: "terraplenagem", l: "Terraplenagem", emoji: "", color: "#96793f" },
  { v: "paisagismo", l: "Paisagismo", emoji: "", color: "#5da05d" },
  { v: "limpeza", l: "Limpeza / pós-obra", emoji: "", color: "#8fb2c9" },
  { v: "outros", l: "Outros", emoji: "", color: "#8f8661" },
]);

const DEFAULT_SPECIALTY = Object.freeze({ l: "Outros", emoji: "", color: "#8f8661" });

export const thirdPartySpecialty = value => (
  THIRD_PARTY_SPECIALTIES.find(specialty => specialty.v === value) || DEFAULT_SPECIALTY
);

export const THIRD_PARTY_DOCUMENT_TYPES = Object.freeze([
  { v: "CND", l: "CND Federal (Receita/PGFN)" },
  { v: "FGTS", l: "CRF - FGTS (Caixa)" },
  { v: "CNDT", l: "CNDT - Débitos Trabalhistas" },
  { v: "ESTAD", l: "CND Estadual" },
  { v: "MUNIC", l: "CND Municipal" },
  { v: "ART", l: "ART / RRT" },
  { v: "APOLICE", l: "Apólice / Seguro" },
  { v: "OUTRO", l: "Outro" },
]);

export const thirdPartyDocumentType = value => (
  THIRD_PARTY_DOCUMENT_TYPES.find(document => document.v === value)
  || { l: value || "Documento" }
);

export const THIRD_PARTY_SUGGESTED_STAGES = Object.freeze({
  eletricista: ["Rasgo de parede", "Eletrodutos e caixas", "Enfiação", "Quadros e disjuntores", "Tomadas e interruptores", "Luminárias", "Testes e energização"],
  encanador: ["Rasgo de parede", "Tubulação de água fria", "Tubulação de esgoto", "Tubulação de águas pluviais", "Louças e metais", "Teste de estanqueidade"],
  serralheiro: ["Medição em obra", "Fabricação", "Transporte e içamento", "Instalação", "Acabamento e pintura"],
  armador: ["Corte e dobra", "Armação de fundação", "Armação de pilares", "Armação de vigas", "Armação de lajes"],
  pedreiro: ["Marcação", "Alvenaria de vedação", "Vergas e contravergas", "Contrapiso", "Chapisco", "Emboço", "Reboco"],
  carpinteiro: ["Montagem de formas", "Escoramento", "Concretagem (apoio)", "Desforma", "Limpeza e reaproveitamento"],
  pintor: ["Preparação da base", "Massa corrida", "Lixamento", "Selador", "1ª demão", "2ª demão", "Retoques"],
  gesseiro: ["Marcação do forro", "Estrutura metálica", "Fechamento em placas", "Tratamento de juntas", "Sancas e detalhes", "Acabamento"],
  azulejista: ["Preparação e regularização", "Paginação", "Assentamento", "Rejuntamento", "Limpeza final"],
  marmorista: ["Medição em obra", "Corte e polimento", "Transporte", "Instalação", "Rejunte e acabamento"],
  vidraceiro: ["Medição em obra", "Fabricação", "Transporte", "Instalação", "Vedação e acabamento"],
  marceneiro: ["Medição em obra", "Projeto e aprovação", "Fabricação", "Montagem", "Ajustes e ferragens"],
  impermeabilizador: ["Preparação da base", "Regularização", "Aplicação da manta/membrana", "Teste de estanqueidade", "Proteção mecânica"],
  telhadista: ["Estrutura de apoio", "Montagem do madeiramento", "Colocação das telhas", "Rufos e calhas", "Vedação e arremates"],
  climatizacao: ["Projeto e marcação", "Infraestrutura (dutos/tubulação)", "Instalação das unidades", "Carga de gás", "Testes e balanceamento"],
  terraplenagem: ["Limpeza do terreno", "Corte", "Aterro", "Compactação", "Nivelamento final"],
  paisagismo: ["Preparo do solo", "Plantio", "Irrigação", "Acabamento", "Manutenção inicial"],
  limpeza: ["Retirada de entulho", "Limpeza grossa", "Limpeza fina", "Polimento de pisos", "Vistoria final"],
  outros: ["Mobilização", "Execução", "Conclusão e limpeza"],
});
