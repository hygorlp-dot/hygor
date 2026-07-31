export const SUPPLIER_CATEGORIES = Object.freeze([
  { v: "casa_construcao", l: "Casa de construção" }, { v: "cimento", l: "Cimento e argamassas" },
  { v: "areia_brita", l: "Areia, brita e aterro" }, { v: "concreto", l: "Concreto usinado" },
  { v: "aco", l: "Aço e vergalhões" }, { v: "metais", l: "Metais" }, { v: "madeira", l: "Madeira" },
  { v: "porcelanato", l: "Porcelanato e cerâmica" }, { v: "pedras", l: "Pedras, mármore e granito" },
  { v: "eletrico", l: "Material elétrico" }, { v: "hidraulico", l: "Material hidráulico" },
  { v: "louca_metal", l: "Louças e metais sanitários" }, { v: "tintas", l: "Tintas e vernizes" },
  { v: "gesso", l: "Gesso e drywall" }, { v: "esquadrias", l: "Esquadrias e vidros" }, { v: "cobertura", l: "Telhas e cobertura" },
  { v: "impermeabilizante", l: "Impermeabilizantes" }, { v: "ferragens", l: "Ferragens e fixação" },
  { v: "ferramentas", l: "Ferramentas" }, { v: "epi", l: "EPI e segurança" },
  { v: "locacao", l: "Locação de equipamentos" }, { v: "outros", l: "Outros" },
]);

export const supplierCategoryLabel = value => SUPPLIER_CATEGORIES.find(category => category.v === value)?.l || value;
