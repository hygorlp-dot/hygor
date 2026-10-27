import {describe,expect,it} from "vitest";
import {readFileSync} from "node:fs";
import {ROLE_TABS} from "./domains/administracao/abas-acesso.js";
import {ERP_MODULES} from "./navigation/erp-navigation.js";
import {DOMAIN_FIELDS,DOMAIN_ROW,rowForOperationalCommand} from "../server/domain-row-routing.js";
import {PATRIMONY_COMMAND} from "./domains/patrimonio/commands.js";
import {canUploadToDestination,isAcceptedUploadMime,uploadStoragePrefix} from "../server/upload-policy.js";

describe("Patrimônio da empresa — integração",()=>{
  it("fica em Administração e não em Obras/Equipamentos",()=>{
    const admin=ERP_MODULES.find(m=>m.id==="admin_grp");
    const obras=ERP_MODULES.find(m=>m.id==="eng_grp");
    const equipamentos=ERP_MODULES.find(m=>m.id==="equip_grp");
    expect(admin.tabs).toContain("patrimonio");
    expect(obras.tabs).not.toContain("patrimonio");
    expect(equipamentos.tabs).not.toContain("patrimonio");
  });

  it("admin, compras e financeiro têm acesso; engenharia não ganha acesso por padrão",()=>{
    expect(ROLE_TABS.admin).toContain("patrimonio");
    expect(ROLE_TABS.compras).toContain("patrimonio");
    expect(ROLE_TABS.financeiro).toContain("patrimonio");
    expect(ROLE_TABS.engenheiro).not.toContain("patrimonio");
    expect(ROLE_TABS.rh).not.toContain("patrimonio");
  });

  it("grava companyAssets numa linha corporativa própria",()=>{
    expect(rowForOperationalCommand(PATRIMONY_COMMAND.ASSET_SAVED)).toBe(DOMAIN_ROW.PATRIMONIO);
    expect(DOMAIN_FIELDS[DOMAIN_ROW.PATRIMONIO]).toContain("companyAssets");
  });

  it("NF patrimonial aceita XML/PDF/foto só para perfis corporativos",()=>{
    expect(isAcceptedUploadMime("application/pdf","patrimonio")).toBe(true);
    expect(isAcceptedUploadMime("application/xml","patrimonio")).toBe(true);
    expect(isAcceptedUploadMime("image/jpeg","patrimonio")).toBe(true);
    expect(isAcceptedUploadMime("application/x-msdownload","patrimonio")).toBe(false);
    expect(canUploadToDestination({role:"admin",obraId:"obra-x"},{folder:"patrimonio"})).toBe(true);
    expect(canUploadToDestination({role:"financeiro",obraId:""},{folder:"patrimonio"})).toBe(true);
    expect(canUploadToDestination({role:"financeiro",obraId:"obra-x"},{folder:"patrimonio"})).toBe(false);
    expect(canUploadToDestination({role:"engenheiro",obraId:""},{folder:"patrimonio"})).toBe(false);
    expect(uploadStoragePrefix({folder:"patrimonio"})).toBe("patrimonio");
  });

  it("a tela usa XML determinístico e IA apenas para PDF/foto, sempre com confirmação",()=>{
    const view=readFileSync("src/domains/patrimonio/components/PatrimonioEmpresaView.jsx","utf8");
    expect(view).toMatch(/lerXmlNfe/);
    expect(view).toMatch(/extrairNotaPatrimonioIA/);
    expect(view).toMatch(/Cadastrar selecionados/);
    expect(view).toMatch(/Leitura por IA: revise antes de gravar/);
    expect(view).not.toMatch(/document\.url\} target="_blank"/);
  });

  it("a rota de IA tem ação estruturada específica para patrimônio",()=>{
    const ai=readFileSync("api/ai-agent.js","utf8");
    expect(ai).toMatch(/asset-invoice-extract/);
    expect(ai).toMatch(/responseMimeType:"application\/json"/);
    expect(ai).toMatch(/patrimonial/);
    expect(ai).toMatch(/nunca invente/i);
  });

  it("o LegacyApp carrega a aba em chunk lazy",()=>{
    const legacy=readFileSync("src/LegacyApp.jsx","utf8");
    expect(legacy).toMatch(/PatrimonioEmpresa = lazy/);
    expect(legacy).toMatch(/tab === "patrimonio"/);
  });
});
