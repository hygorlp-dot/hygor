import {describe,expect,it} from "vitest";
import {readFileSync} from "node:fs";

const source=readFileSync(`${process.cwd()}/src/LegacyApp.jsx`,"utf8");
// DiarioObra foi extraído para seu próprio arquivo na Onda 7 do raio-X
// (26/08/2026) - este teste passou a ler o componente lá em vez de
// LegacyApp.jsx, mas o invariante que ele protege é o mesmo de sempre.
const diary=readFileSync(`${process.cwd()}/src/domains/obras/components/DiarioObraView.jsx`,"utf8");
const normalization=source.slice(source.indexOf("rdos: Array.isArray"),source.indexOf("//  CONFERENCIA TECNICA",source.indexOf("rdos: Array.isArray")));

describe("experiência operacional do Diário de Obra",()=>{
  it("mostra estados locais, salvando, salvo e erro recuperável",()=>{
    expect(diary).toContain('"Alterações locais"');
    expect(diary).toContain('"Sincronizando"');
    expect(diary).toContain('"Falha ao salvar"');
    expect(diary).toContain("Tentar novamente");
  });
  it("não inventa clima em um relatório novo ou normalizado",()=>{
    expect(diary).toContain('clima: { manha: "", tarde: "", noite: "" }');
    expect(normalization).toContain('manha: r.clima?.manha || ""');
    expect(diary).toContain('Não informado');
    expect(diary).toContain('Aplicar a todos');
  });
  it("oferece etapas navegáveis e requisitos explícitos",()=>{
    expect(diary).toContain('className="rdo-stepper"');
    expect(diary).toContain('aria-label="Etapas obrigatórias do Diário de Obra"');
    expect(diary).toContain('document.getElementById(`rdo-etapa-${id}`)');
  });
  it("trata concluído como consulta e reabertura como ação administrativa",()=>{
    expect(diary).toContain("fieldReportIsReadOnly(rdo)");
    expect(diary).toContain('currentUser?.role==="admin"');
    expect(diary).toContain("FIELD_REPORT_REOPENED");
    expect(diary).toContain("Reabrir como administrador");
    expect(diary).toContain('actorRole:currentUser?.role||""');
  });
  it("sincroniza o rascunho antes de trocar obra ou data",()=>{
    expect(diary).toContain("const trocarContextoRdo=async");
    expect(diary).toContain('trocarContextoRdo("obra",valor)');
    expect(diary).toContain('trocarContextoRdo("data",valor)');
    expect(diary).toContain("A troca foi bloqueada porque há alterações que ainda não foram salvas.");
    expect(diary).toContain("filaSalvamentoRdoRef.current");
  });
  it("gera documento com status, execução, pessoas, equipamentos, revisão e auditoria",()=>{
    for(const label of ["Serviços executados","Efetivo e presenças","Terceirizados","Equipamentos","Revisão técnica","Histórico auditável","Rascunho / não concluído","Cancelado"]){expect(diary).toContain(label);}
  });
  it("usa estados explícitos e ações em lote para o efetivo",()=>{
    expect(diary).toContain("Marcar todos presentes");
    expect(diary).toContain('aria-pressed={st===value}');
    expect(diary).toContain("Meio período");
  });
  it("nomeia cancelamento sem prometer exclusão destrutiva",()=>{
    expect(diary).toContain("Cancelar RDO");
    expect(diary).not.toContain('> Excluir</Btn>');
  });
  it("duplica apenas conteúdo e remove aprovação, auditoria e cancelamento anteriores",()=>{
    expect(diary).toContain("operationalHistory:ignoredHistory");
    expect(diary).toContain('revisaoEngenheiro:{aprovado:false');
    expect(diary).toContain("Conteúdo copiado para um novo rascunho sem aprovação ou auditoria anterior.");
  });
  it("impede serviço sem avanço ou justificativa",()=>{
    expect(diary).toContain("Informe avanço maior que 0% ou descreva o serviço realizado sem avanço físico.");
    expect(diary).toContain('role="alert"');
  });
});
