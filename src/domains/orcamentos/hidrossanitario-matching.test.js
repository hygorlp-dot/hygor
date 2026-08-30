import { describe, expect, it } from "vitest";
import {
  candidatoCompativel, candidatosDivergemSoPorInstalacao, categoriaDaDescricaoCandidato,
  categoriaDoItem, classificarItem, diametrosCompativeis, termoNucleoApenas, termosBuscaParaItem,
} from "./hidrossanitario-matching";

// Casos reais do teste ao vivo (29/08/2026, orçamento "I-02 OÁSIS", 94
// itens do PDF Hidrossanitário B-042): 89 dos 94 itens ficaram pendentes
// porque a busca (/api/references, QUERY_TERMS_MAX=6) só usa as 6
// primeiras palavras da consulta - mandar a descrição inteira do PDF
// gastava as 6 vagas em palavras genéricas antes de chegar no diâmetro.

describe("termosBuscaParaItem", () => {
  it("preserva o núcleo e o diâmetro, descartando palavras de sistema/cor quando o orçamento de 6 palavras aperta", () => {
    const termos = termosBuscaParaItem("Adaptador Soldável Curto com Bolsa e Rosca para Registro 25 x 3/4'', PVC Marrom, Água Fria");
    expect(termos[0].split(" ")).toContain("adaptador");
    expect(termos[0].split(" ")).toContain("25");
    expect(termos[0].split(" ").length).toBeLessThanOrEqual(6);
    // "rosca"/"registro" não cabem no primeiro termo (6 palavras já ocupadas) -
    // mas devem aparecer no segundo termo (a "cauda"), nunca descartados de vez.
    expect(termos.some(t => t.includes("rosca") && t.includes("registro"))).toBe(true);
  });

  it("cabe num só termo quando a descrição já é curta", () => {
    const termos = termosBuscaParaItem("Bacia Sanitária com Caixa Acoplada");
    expect(termos).toEqual(["bacia sanitaria caixa acoplada"]);
  });

  it("mantém o diâmetro mesmo quando a descrição tem palavras de sistema no meio", () => {
    const termos = termosBuscaParaItem("Tubo Soldável Marrom Ø25mm - Água fria");
    expect(termos[0].split(" ")).toContain("25mm");
    expect(termos[0]).not.toContain("marrom");
  });

  it("devolve lista vazia para descrição vazia", () => {
    expect(termosBuscaParaItem("")).toEqual([]);
    expect(termosBuscaParaItem(undefined)).toEqual([]);
  });
});

describe("termoNucleoApenas", () => {
  it("devolve só a primeira palavra essencial, sem diâmetro nem modificador (último recurso quando o termo normal não achou nada)", () => {
    expect(termoNucleoApenas("Adaptador Soldável Curto com Bolsa e Rosca para Registro 25 x 3/4'', PVC Marrom, Água Fria")).toBe("adaptador");
    expect(termoNucleoApenas("Suporte PVC, Branco, 132 x 89, Aquapluv Style - TIGRE")).toBe("suporte");
  });
  it("devolve vazio para descrição vazia", () => {
    expect(termoNucleoApenas("")).toBe("");
  });
});

describe("categoriaDoItem", () => {
  it("conexões de água fria e esgoto são fixas pela própria tabela", () => {
    expect(categoriaDoItem("conexoesAguaFria", { descricao: "qualquer" })).toBe("agua-fria");
    expect(categoriaDoItem("conexoesEsgoto", { descricao: "qualquer" })).toBe("esgoto");
    expect(categoriaDoItem("calhasPluviais", { descricao: "qualquer" })).toBe("pluvial");
  });

  it("tubos rígidos usam o próprio campo sistema", () => {
    expect(categoriaDoItem("tubosRigidos", { sistema: "Esgoto" })).toBe("esgoto");
    expect(categoriaDoItem("tubosRigidos", { sistema: "Água fria" })).toBe("agua-fria");
  });

  it("caixas/ralos e peças hidráulicas usam tipoSistema", () => {
    expect(categoriaDoItem("caixasRalosComplementos", { tipoSistema: "Inspeção/Pluvial" })).toBe("pluvial");
    expect(categoriaDoItem("pecasHidraulicasSanitarias", { tipoSistema: "Água Fria" })).toBe("agua-fria");
    expect(categoriaDoItem("pecasHidraulicasSanitarias", { tipoSistema: "Utilização" })).toBe("indefinido");
  });

  it("registros/tubos flexíveis sem campo de sistema caem para indefinido quando a descrição não ajuda", () => {
    expect(categoriaDoItem("registrosAcessorios", { descricao: "Bomba Submersível 1CV" })).toBe("indefinido");
    expect(categoriaDoItem("registrosAcessorios", { descricao: "Válvula de Retenção - 100mm, Esgoto Série Normal" })).toBe("esgoto");
  });
});

describe("diametrosCompativeis", () => {
  it("aceita quando os diâmetros batem", () => {
    expect(diametrosCompativeis("Tubo 25mm", "TUBO PVC DN 25MM")).toBe(true);
  });
  it("rejeita quando os diâmetros divergem", () => {
    expect(diametrosCompativeis("Tubo 25mm", "TUBO PVC DN 32MM")).toBe(false);
  });
  it("é permissivo quando falta diâmetro de um dos lados", () => {
    expect(diametrosCompativeis("Bacia Sanitária", "BACIA SANITARIA PADRAO ALTO")).toBe(true);
  });

  // Bug real encontrado no audit de 30/08/2026: a extração de diâmetro
  // confundia dimensões de calha (largura x altura do perfil) com
  // diâmetro de peça, porque extraía QUALQUER número antes de "x" -
  // provavelmente a causa raiz de todos os itens de calha pluvial terem
  // dado "Nenhum candidato" nos testes ao vivo desta sessão.
  it("não confunde dimensões de calha (132 x 89) com diâmetro de peça - não rejeita mais um candidato genérico de calha por causa disso", () => {
    const itemCalha = "Suporte PVC, Branco, 132 x 89, Aquapluv Style - TIGRE";
    const candidatoCalha = "CALHA EM PVC RIGIDO CIRCULAR DN 100MM PARA AGUAS PLUVIAIS";
    expect(diametrosCompativeis(itemCalha, candidatoCalha)).toBe(true);
  });

  it("continua extraindo o diâmetro certo de 'NN x N/N' mesmo sem sufixo mm (convenção real de adaptador/registro do PDF)", () => {
    expect(diametrosCompativeis("Registro 25 x 3/4", "REGISTRO GAVETA 25 X 3/4")).toBe(true);
    expect(diametrosCompativeis("Registro 25 x 3/4", "REGISTRO GAVETA 32 X 3/4")).toBe(false);
  });
});

describe("candidatoCompativel", () => {
  it("rejeita candidato de sistema oposto confirmado", () => {
    const item = { descricao: "Tubo 25mm", categoria: "agua-fria" };
    expect(candidatoCompativel(item, { descricao: "TUBO PVC ESGOTO DN 25MM" })).toBe(false);
  });
  it("aceita candidato do mesmo sistema e diâmetro", () => {
    const item = { descricao: "Tubo 25mm", categoria: "agua-fria" };
    expect(candidatoCompativel(item, { descricao: "TUBO PVC AGUA DN 25MM" })).toBe(true);
  });
  it("não rejeita quando o item não tem categoria conhecida (indefinido é permissivo)", () => {
    const item = { descricao: "Registro de gaveta 3/4", categoria: "indefinido" };
    expect(candidatoCompativel(item, { descricao: "REGISTRO GAVETA ESGOTO 3/4" })).toBe(true);
  });
});

// "Mínimo de IA" (audit de 30/08/2026): padrão real encontrado nos testes
// ao vivo desta sessão - candidatos que só diferem pelo local de
// instalação ou tipo de junta (informação que o PDF nunca especifica),
// caso em que a IA - quando de fato chamada - respondeu "pendente" mesmo
// assim. Detectar isso por regra evita gastar a chamada.
describe("candidatosDivergemSoPorInstalacao", () => {
  it("detecta quando os candidatos só diferem pelo local de instalação (caso real do teste ao vivo)", () => {
    const candidatos = [
      { fonte: "SINAPI", codigo: "89429", descricao: "Adaptador soldavel curto com bolsa e rosca para registro, 25 x 3/4, instalado em ramal ou sub-ramal de agua" },
      { fonte: "SINAPI", codigo: "89383", descricao: "Adaptador soldavel curto com bolsa e rosca para registro, 25 x 3/4, instalado em ramal de distribuicao de agua" },
      { fonte: "SINAPI", codigo: "94656", descricao: "Adaptador soldavel curto com bolsa e rosca para registro, 25 x 3/4, instalado em reservacao predial de agua" },
    ];
    expect(candidatosDivergemSoPorInstalacao(candidatos)).toBe(true);
  });

  it("detecta quando os candidatos só diferem pelo tipo de junta", () => {
    const candidatos = [
      { descricao: "Juncao 100x100, pvc, junta soldavel" },
      { descricao: "Juncao 100x100, pvc, junta elastica" },
    ];
    expect(candidatosDivergemSoPorInstalacao(candidatos)).toBe(true);
  });

  it("não confunde uma diferença de verdade (peça diferente) com divergência de instalação/junta", () => {
    const candidatos = [
      { descricao: "Registro de gaveta bruto, 25mm" },
      { descricao: "Registro de esfera bruto, 25mm" },
    ];
    expect(candidatosDivergemSoPorInstalacao(candidatos)).toBe(false);
  });

  it("devolve falso com menos de 2 candidatos", () => {
    expect(candidatosDivergemSoPorInstalacao([{ descricao: "x" }])).toBe(false);
    expect(candidatosDivergemSoPorInstalacao([])).toBe(false);
  });
});

describe("classificarItem", () => {
  it("marca pendente sem custo de IA quando não sobra candidato", () => {
    const r = classificarItem({ id: "x" }, []);
    expect(r).toMatchObject({ status: "pendente", origem: "regra" });
  });
  it("associa automaticamente quando sobra exatamente 1 candidato", () => {
    const candidato = { fonte: "SINAPI", codigo: "123", descricao: "X", unidade: "UN", precoUnit: 10 };
    const r = classificarItem({ id: "x" }, [candidato]);
    expect(r).toMatchObject({ status: "associado", origem: "regra", codigo: "123", confianca: 1 });
  });
  it("devolve null (ambíguo, decide a IA) quando sobra mais de 1 candidato de verdade diferente", () => {
    const r = classificarItem({ id: "x" }, [
      { codigo: "1", descricao: "Registro de gaveta bruto, 25mm" },
      { codigo: "2", descricao: "Registro de esfera bruto, 25mm" },
    ]);
    expect(r).toBeNull();
  });
  it("marca pendente sem custo de IA quando os candidatos só divergem por local de instalação", () => {
    const candidatos = [
      { fonte: "SINAPI", codigo: "89429", descricao: "Adaptador soldavel curto, 25 x 3/4, instalado em ramal ou sub-ramal de agua" },
      { fonte: "SINAPI", codigo: "89383", descricao: "Adaptador soldavel curto, 25 x 3/4, instalado em ramal de distribuicao de agua" },
    ];
    const r = classificarItem({ id: "x" }, candidatos);
    expect(r).toMatchObject({ status: "pendente", origem: "regra" });
  });
});
