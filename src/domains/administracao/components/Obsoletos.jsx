// @ts-check
import { useState } from "react";
import { PageHeader } from "../../../design-system/patterns/PageHeader.jsx";
import { useBreakpoint } from "../../../hooks/useBreakpoint.js";
import { fmt, fmtDate, uid } from "../../../legacy/format.js";
import { C } from "../../../legacy/palette.js";
import { Badge, Btn, Ic } from "../../../legacy/ui.jsx";
import { sessionContext } from "../../../lib/session-context.js";
import { OPERATIONAL_COMMAND } from "../../sync/operational-commands.js";

/** @typedef {import("./archived-records-contract").ArchivedRecordsProps} ArchivedRecordsProps */

/** @param {ArchivedRecordsProps} props */
export function Obsoletos({ data, update, showToast, onTab, dispatchCommand }) {
  const { cols } = useBreakpoint();
  const [visao, setVisao] = useState(/** @type {"obras" | "equipe"} */ ("obras"));   // obras | equipe

  const obrasInativas = (data.obras || []).filter(o => o.status === "done" || o.status === "paused");
  const equipeInativa = (data.employees || []).filter(e => e.active === false);

  // Reativar: obra volta a ativa; funcionario volta a active.
  /** @param {string} id */
  const reativarObra = (id) => {
    update({ ...data, obras: (data.obras || []).map(o => o.id === id ? { ...o, status: "active" } : o) });
    showToast?.("Obra reativada");
  };
  /** @param {string} id */
  const reativarEmp = async id => {
    const employee=(data.employees||[]).find(item=>item.id===id);
    const result=await dispatchCommand(atual=>{
      const vigente=(atual.employees||[]).find(item=>item.id===id);
      return {
        type:OPERATIONAL_COMMAND.EMPLOYEE_SAVED,
        idempotencyKey:`funcionario-reativar-${id}-${uid()}`,
        expectedVersion:Number(employee?.version||0),
        payload:{employee:{...vigente,active:true,endDate:"",terminationReason:"",status:"ativo"}},
      };
    });
    if(!result?.ok){showToast?.(result?.reason||"O funcionário não foi reativado.","error");return;}
    showToast?.("Funcionário reativado");
  };

  const STATUS_OBRA = {
    done:   { l: "Concluida", c: C.green },
    paused: { l: "Pausada",   c: C.orange },
  };

  return (
    <div className="anim" style={{ display: "flex", flexDirection: "column", gap: "var(--arcd-space-3)" }}>
      <PageHeader className="workspace-header" title="Telas antigas" description="Obras inativas e funcionários desligados para consulta e reativação."/>
      <div style={{ display: "flex", gap: "var(--arcd-space-1)" }}>
        {/** @type {const} */ ([["obras", `Obras (${obrasInativas.length})`], ["equipe", `Equipe (${equipeInativa.length})`]]).map(([id, lbl]) => (
          <button key={id} onClick={() => setVisao(id)} style={{
            padding: "var(--arcd-space-2) var(--arcd-space-3)", borderRadius: "var(--arcd-radius-control)", cursor: "pointer",
            border: `1.5px solid ${visao === id ? C.yellow : C.border}`,
            background: visao === id ? `${C.yellow}18` : "transparent",
            color: visao === id ? C.yellowD : "var(--arcd-text-secondary)", fontSize: "var(--arcd-type-control)", fontWeight:600,
          }}>{lbl}</button>
        ))}
      </div>

      <p style={{ fontSize:"var(--arcd-type-label)", color: "var(--arcd-text-secondary)", lineHeight: 1.5, padding: "0 var(--arcd-space-half)" }}>
        Aqui ficam obras concluídas ou pausadas e funcionários desligados. Nada foi
        apagado - ponto, DRE e contratos seguem preservados para consulta.
      </p>

      {/* OBRAS INATIVAS */}
      {visao === "obras" && (
        obrasInativas.length === 0
          ? <VazioObs texto="Nenhuma obra concluida ou pausada." />
          : (
            <div style={{ display: "grid", gridTemplateColumns: cols(1, 1, 2), gap: "var(--arcd-space-2)" }}>
              {obrasInativas.map(o => {
                const st = o.status === "paused" ? STATUS_OBRA.paused : STATUS_OBRA.done;
                return (
                  <div key={o.id} style={{ background: "var(--arcd-surface-card)", border: `var(--arcd-border-width) solid var(--arcd-border-default)`,
                       borderRadius: "var(--arcd-box-radius)", padding: "var(--arcd-space-3) var(--arcd-space-3)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: "var(--arcd-space-2)", alignItems: "flex-start" }}>
                      <div style={{ minWidth: 0 }}>
                        <p className="brk" style={{ fontSize: "var(--arcd-type-body)", fontWeight:600, color: "var(--arcd-text-primary)",
                                   fontFamily: "var(--arcd-font-sans)" }}>{o.name}</p>
                        {o.address && <p style={{ fontSize:"var(--arcd-type-label)", color: "var(--arcd-text-secondary)", marginTop: "var(--arcd-space-half)" }}>{o.address}</p>}
                      </div>
                      <Badge color={st.c}>{st.l}</Badge>
                    </div>
                    <div style={{ display: "flex", gap: "var(--arcd-space-2)", marginTop: "var(--arcd-space-2)", flexWrap: "wrap" }}>
                      {o.contractValue != null && o.contractValue > 0 && (
                        <span style={{ fontSize:"var(--arcd-type-label)", color: "var(--arcd-text-secondary)" }}>Contrato {fmt(o.contractValue)}</span>
                      )}
                      {o.engineer && <span style={{ fontSize:"var(--arcd-type-label)", color: "var(--arcd-text-secondary)" }}>{o.engineer}</span>}
                    </div>
                    <div style={{ display: "flex", gap: "var(--arcd-space-1)", marginTop: "var(--arcd-space-3)" }}>
                      <Btn v="ghost" size="sm" onClick={() => { onTab?.("obras"); }}>Ver dados</Btn>
                      <Btn v="ghost" size="sm" onClick={() => reativarObra(o.id)}>Reativar</Btn>
                    </div>
                  </div>
                );
              })}
            </div>
          )
      )}

      {/* EQUIPE INATIVA */}
      {visao === "equipe" && (
        equipeInativa.length === 0
          ? <VazioObs texto="Nenhum funcionário desligado." />
          : (
            <div style={{ background: "var(--arcd-surface-card)", border: `var(--arcd-border-width) solid var(--arcd-border-default)`, borderRadius: "var(--arcd-box-radius)", overflow: "hidden" }}>
              {equipeInativa.map(e => (
                <div key={e.id} style={{ padding: "var(--arcd-space-3) var(--arcd-space-3)", borderBottom: `var(--arcd-border-width) solid var(--arcd-border-subtle)`,
                     display: "flex", justifyContent: "space-between", alignItems: "center", gap: "var(--arcd-space-2)" }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <p className="brk" style={{ fontSize: "var(--arcd-type-body)", fontWeight:600, color: "var(--arcd-text-primary)" }}>{e.name}</p>
                    <div style={{ display: "flex", gap: "var(--arcd-space-2)", marginTop: "var(--arcd-space-half)", flexWrap: "wrap" }}>
                      {e.role && <span style={{ fontSize:"var(--arcd-type-label)", color: "var(--arcd-text-secondary)" }}>{e.role}</span>}
                      {e.endDate && <span style={{ fontSize:"var(--arcd-type-label)", color: "var(--arcd-text-secondary)" }}>Saída {fmtDate(e.endDate)}</span>}
                      {e.terminationReason && <span style={{ fontSize:"var(--arcd-type-label)", color: C.red }}>{e.terminationReason}</span>}
                    </div>
                  </div>
                  <div style={{display:"flex",gap:"var(--arcd-space-1)",alignItems:"center",flexShrink:0}}>
                    <Btn v="ghost" size="sm" onClick={()=>{
                      sessionContext.setItem("arcd_editar_funcionario",e.id);
                      onTab?.("equipe");
                    }}><Ic n="edit"/> Editar</Btn>
                    <Btn v="ghost" size="sm" onClick={() => reativarEmp(e.id)}>Readmitir</Btn>
                  </div>
                </div>
              ))}
            </div>
          )
      )}
    </div>
  );
}

/** @param {{texto: string}} props */
export function VazioObs({ texto }) {
  return (
    <div style={{ padding: "var(--arcd-space-6)", textAlign: "center", background: "var(--arcd-surface-card)",
                  border: `var(--arcd-border-width) solid var(--arcd-border-default)`, borderRadius: "var(--arcd-box-radius)" }}>
      <p style={{ fontSize: "var(--arcd-type-body)", color: "var(--arcd-text-secondary)" }}>{texto}</p>
    </div>
  );
}
