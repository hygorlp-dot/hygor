import {describe,expect,it} from "vitest";
import {buildInmetroUrl,filterPbqphRows,parseInmetroHtml} from "./manufacturer-compliance.js";

describe("consulta de fabricantes",()=>{
  it("localiza empresa no SiMaC por CNPJ ou nome sem acentos",()=>{
    const rows=[{psq:"Aço",nome_da_empresa:"Indústria Açominas S/A",cnpj:"12.345.678/0001-90",marca:"FORTE",classificacao:"Qualificada",validade:"31/12/2026"}];
    expect(filterPbqphRows(rows,"12345678000190")[0]).toMatchObject({company:"Indústria Açominas S/A",classification:"Qualificada"});
    expect(filterPbqphRows(rows,"acominas")).toHaveLength(1);
  });

  it("extrai registros do resultado oficial do Inmetro",()=>{
    const html=`<span id="ctl00_MainContent_DataList1_ctl00_LbTotalRegistros2" class="badge">1</span><tbody class="corpo"><tr><td><a href="https://registro.inmetro.gov.br/consulta/detalhe.aspx?NumeroRegistro=1">000001/2026</a></td><td><abbr title="Ativo">A</abbr></td><td>12.345/26</td><td>Barras e fios de a&ccedil;o</td><td>FABRICANTE SA</td><td>RECIFE - PE</td></tr></tbody>`;
    const parsed=parseInmetroHtml(html);
    expect(parsed.total).toBe(1);
    expect(parsed.results[0]).toMatchObject({registration:"000001/2026",status:"A",company:"FABRICANTE SA"});
  });

  it("monta a pesquisa de CNPJ usando os nomes reais do formulário do Inmetro",()=>{
    const url=new URL(buildInmetroUrl({query:"07.933.914/0001-54"}));
    expect(url.searchParams.get("CNPJ")).toBe("07.933.914/0001-54");
    expect(url.searchParams.get("Fornecedor")).toBe("");
    expect(url.searchParams.get("ctl00$MainContent$ControlPesquisa1$Situacao")).toBe("");
  });
});
