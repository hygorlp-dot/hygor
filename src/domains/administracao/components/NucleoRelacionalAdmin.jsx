// ===================================================================
// NucleoRelacionalAdmin — primeiro consumidor de UI de um relatório de
// sombra do Core relacional (Fase 2, "Ordem de Execução do ARCD",
// 01/09/2026). Só leitura, exclusivo do administrador: mostra o que
// core-registry-report já calculava desde 24/08/2026 (última
// sincronização, contagem ativa e amostra de cada uma das 7 tabelas
// core_*, e os alertas de divergência), sem nenhuma tela nova de
// escrita - a fonte de verdade operacional continua sendo o blob.
// ===================================================================

import { useEffect, useState } from "react";
import { Badge, Btn, C, Ic } from "../../../LegacyApp";
import { consultarNucleoRelacionalSombra } from "../../../api";

const ROTULO_SECAO = {
  projects: "Projetos (obras)",
  employees: "Funcionários",
  employeeAssignments: "Vínculos de funcionário",
  employeeIdentifiers: "Identificadores (CPF/PIX)",
  suppliers: "Fornecedores",
  thirdPartyProfiles: "Perfis de terceiro",
  thirdPartyContracts: "Contratos de terceiro",
};
const ORDEM_SECOES = Object.keys(ROTULO_SECAO);

const idadeLegivel = ageMs => {
  if (ageMs == null || Number.isNaN(ageMs)) return "idade desconhecida";
  const horas = ageMs / 3.6e6;
  if (horas < 1) return "há menos de 1 hora";
  if (horas < 48) return `há ${Math.round(horas)}h`;
  return `há ${Math.round(horas / 24)} dia(s)`;
};

// A amostra não tem uma coluna de rótulo única entre as 7 tabelas (duas
// não têm nem `id` próprio - PK composta por employee_id+project_id ou
// employee_id+tipo). Em vez de sete renderizadores dedicados, um único
// resolvedor genérico cobre todo mundo.
const rotuloLinha = linha => {
  if (linha?.name) return linha.name;
  if (linha?.employee_id && linha?.project_id) return `${linha.employee_id} → ${linha.project_id}`;
  if (linha?.employee_id) return `${linha.employee_id} · ${linha.identifier_type || ""}`;
  if (linha?.profile_id && linha?.project_id) return `${linha.profile_id} → ${linha.project_id}`;
  return linha?.id || "(sem identificação)";
};

export default function NucleoRelacionalAdmin({ currentUser }) {
  const [estado, setEstado] = useState("carregando"); // carregando | pronto | erro
  const [relatorio, setRelatorio] = useState(null);
  const [erro, setErro] = useState("");
  const [secaoAberta, setSecaoAberta] = useState("");

  const carregar = async () => {
    setEstado("carregando"); setErro("");
    const resultado = await consultarNucleoRelacionalSombra();
    if (!resultado.ok) { setErro(resultado.error || "Não foi possível consultar a projeção cadastral."); setEstado("erro"); return; }
    setRelatorio(resultado); setEstado("pronto");
  };
  useEffect(() => { carregar(); }, []);

  if (currentUser?.role !== "admin") {
    return <div style={{ padding: 30, textAlign: "center", color: C.red }}>Acesso exclusivo da administração.</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ background: `${C.blue}08`, border: `1px solid ${C.blue}33`, borderRadius: 9, padding: "10px 12px", fontSize: 10.5, color: C.muted }}>
        Projeção relacional em modo sombra (Fase 2 da redução do monólito). Só leitura - nenhuma tela aqui grava nada; a fonte de verdade operacional continua sendo o cadastro normal (Obras, Equipe, Fornecedores). Serve para conferir se a sincronização automática (a cada deploy) está em dia.
      </div>

      {estado === "carregando" && <p style={{ padding: 20, textAlign: "center", fontSize: 11, color: C.muted }}>Consultando...</p>}

      {estado === "erro" && (
        <div style={{ background: `${C.red}0C`, border: `1px solid ${C.red}44`, borderRadius: 9, padding: 14 }}>
          <p style={{ fontSize: 11.5, color: C.red, fontWeight: 700 }}>{erro}</p>
          <Btn size="sm" v="ghost" onClick={carregar} style={{ marginTop: 8 }}><Ic n="refresh" /> Tentar de novo</Btn>
        </div>
      )}

      {estado === "pronto" && relatorio && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
            <div>
              {relatorio.hasRuns ? (
                <p style={{ fontSize: 11, color: C.text }}>
                  Última sincronização <b>{idadeLegivel(relatorio.ageMs)}</b> ({new Date(relatorio.lastRun.created_at).toLocaleString("pt-BR")}, ator <code>{relatorio.lastRun.actor_id}</code>)
                </p>
              ) : (
                <p style={{ fontSize: 11, color: C.muted }}>Nenhuma sincronização registrada ainda.</p>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {relatorio.warnings?.length
                ? <Badge color={C.red}>{relatorio.warnings.length} ALERTA(S)</Badge>
                : <Badge color={C.green}>0 DIVERGÊNCIAS</Badge>}
              <Btn size="sm" v="ghost" onClick={carregar}><Ic n="refresh" /> Atualizar</Btn>
            </div>
          </div>

          {!!relatorio.warnings?.length && (
            <div style={{ background: `${C.red}0C`, border: `1px solid ${C.red}33`, borderRadius: 9, padding: 12 }}>
              {relatorio.warnings.map((aviso, i) => (
                <p key={i} style={{ fontSize: 10.5, color: C.red, lineHeight: 1.5, marginTop: i ? 6 : 0 }}>! {aviso}</p>
              ))}
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 8 }}>
            {ORDEM_SECOES.map(secao => {
              const amostra = relatorio.sample?.[secao] || [];
              const aberta = secaoAberta === secao;
              return (
                <div key={secao} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 9, padding: 11 }}>
                  <p style={{ fontSize: 9, fontWeight: 850, color: C.muted, textTransform: "uppercase", letterSpacing: 0.3 }}>{ROTULO_SECAO[secao]}</p>
                  <p style={{ fontSize: 21, fontWeight: 900, color: C.text, marginTop: 4 }}>{relatorio.liveCounts?.[secao] ?? 0}</p>
                  <p style={{ fontSize: 9, color: C.muted, marginTop: 2 }}>linha(s) ativa(s)</p>
                  {!!amostra.length && (
                    <>
                      <button
                        onClick={() => setSecaoAberta(aberta ? "" : secao)}
                        style={{ marginTop: 8, background: "none", border: "none", padding: 0, fontSize: 9.5, color: C.blue, fontWeight: 700, cursor: "pointer" }}
                      >
                        {aberta ? "Ocultar amostra" : `Ver amostra (${amostra.length})`}
                      </button>
                      {aberta && (
                        <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 4 }}>
                          {amostra.map((linha, i) => (
                            <p key={i} style={{ fontSize: 9.5, color: C.text, lineHeight: 1.4, borderTop: i ? `1px solid ${C.line}` : "none", paddingTop: i ? 4 : 0 }}>
                              {rotuloLinha(linha)}
                            </p>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
