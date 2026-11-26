// @ts-check
import { useEffect, useMemo, useRef, useState } from "react";
import { contar } from "../design-system/copy.js";
import { C } from "../legacy/palette.js";
import { Ic } from "../legacy/ui.jsx";
import { searchGlobalIndex } from "./global-search.js";

/** @typedef {import("./global-search.js").SearchEntry} SearchEntry */
/** @typedef {{
 *   indice: SearchEntry[],
 *   allowedTabs: string[],
 *   onIr: (tabId: string, obraId: string) => void,
 *   onFechar: () => void,
 * }} GlobalSearchProps
 */

/** @type {Partial<Record<string, string>>} */
const coresPorTipo = {
  Obra: C.blue, Funcionário: C.green, Terceirizado: C.purple, Equipamento: C.orange,
  Lead: C.green, Cliente: C.blue, Proposta: C.yellowD, Contrato: C.purple,
  Pedido: C.orange, Orçamento: C.yellowD, Parceiro: C.blue, Tela: C.muted,
};

// Busca global estilo command palette (Ctrl/Cmd+K). Filtra o índice por texto,
// agrupa por tipo, navega por teclado (setas + Enter) ou clique.
/** @param {GlobalSearchProps} props */
export function BuscaGlobal({ indice, allowedTabs, onIr, onFechar }) {
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const inputRef = useRef(/** @type {HTMLInputElement | null} */ (null));
  useEffect(() => { inputRef.current?.focus(); }, []);

  const termo = q.trim().toLowerCase();
  const resultados = useMemo(() => searchGlobalIndex(indice, termo, allowedTabs), [indice, termo, allowedTabs]);

  useEffect(() => { setSel(0); }, [termo]);

  /** @param {SearchEntry | undefined} r */
  const escolher = (r) => r && onIr(r.tabId, r.obraId);
  /** @param {import("react").KeyboardEvent<HTMLInputElement>} e */
  const onKey = (e) => {
    if (e.key==="ArrowDown") { e.preventDefault(); setSel(s => Math.min(s+1, resultados.length-1)); }
    if (e.key==="ArrowUp")   { e.preventDefault(); setSel(s => Math.max(s-1, 0)); }
    if (e.key==="Enter")     { e.preventDefault(); escolher(resultados[sel]); }
  };

  return (
    <div onClick={onFechar} style={{
      position:"fixed", inset:0, zIndex:9999, background:"color-mix(in srgb, var(--arcd-surface-inverse) 45%, transparent)",
      display:"flex", alignItems:"flex-start", justifyContent:"center", padding:"12vh 16px 16px" }}>
      <div onClick={e=>e.stopPropagation()} style={{
        width:"100%", maxWidth:560, background:"var(--arcd-surface-card)", border:`var(--arcd-border-width) solid var(--arcd-border-default)`,
        borderRadius:"var(--arcd-box-radius)", boxShadow:"var(--arcd-shadow-hairline)", overflow:"hidden" }}>
        <div style={{ display:"flex", alignItems:"center", gap:"var(--arcd-space-2)", padding:"var(--arcd-space-3) var(--arcd-space-3)", borderBottom:`var(--arcd-border-width) solid var(--arcd-border-subtle)` }}>
          <Ic n="funnel" s={16} color={C.muted}/>
          <input ref={inputRef} value={q} onChange={e=>setQ(e.target.value)} onKeyDown={onKey}
            placeholder="Buscar obra, lead, pedido, funcionário, tela..."
            style={{ flex:1, border:0, outline:"none", background:"transparent", fontSize:"var(--arcd-type-control)", color:"var(--arcd-text-primary)" }}/>
          <span style={{ fontSize:"var(--arcd-type-label)", fontWeight:600, color:"var(--arcd-text-secondary)", border:`var(--arcd-border-width) solid var(--arcd-border-default)`, borderRadius:"var(--arcd-radius-control)", padding:"var(--arcd-space-half) var(--arcd-space-1)" }}>ESC</span>
        </div>
        <div style={{ maxHeight:"48vh", overflowY:"auto" }}>
          {!termo && <p style={{ padding:"var(--arcd-space-4) var(--arcd-space-4)", fontSize:"var(--arcd-type-body)", color:"var(--arcd-text-secondary)", textAlign:"center" }}>Digite para buscar em todo o sistema.</p>}
          {termo && resultados.length===0 && <p style={{ padding:"var(--arcd-space-4) var(--arcd-space-4)", fontSize:"var(--arcd-type-body)", color:"var(--arcd-text-secondary)", textAlign:"center" }}>Nada encontrado para "{q}".</p>}
          {resultados.map((r,i) => {
            const corTipo = coresPorTipo[r.tipo] || C.muted;
            return (
              <button key={i} onClick={()=>escolher(r)} onMouseEnter={()=>setSel(i)} style={{
                display:"flex", alignItems:"center", gap:"var(--arcd-space-2)", width:"100%", textAlign:"left",
                background: i===sel ? `${C.yellow}12` : "transparent", border:0,
                borderLeft:`var(--arcd-border-width) solid ${i===sel ? C.yellow : "transparent"}`,
                padding:"var(--arcd-space-2) var(--arcd-space-3)", cursor:"pointer" }}>
                <span style={{ fontSize:"var(--arcd-type-caption)", fontWeight:600, color:corTipo, background:`${corTipo}14`, padding:"var(--arcd-space-half) var(--arcd-space-2)", borderRadius:"var(--arcd-radius-pill)", flexShrink:0, textTransform:"uppercase", minWidth:78, textAlign:"center" }}>{r.tipo}</span>
                <span style={{ minWidth:0, flex:1 }}>
                  <span style={{ fontSize:"var(--arcd-type-body)", fontWeight:600, color:"var(--arcd-text-primary)", display:"block", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{r.rotulo}</span>
                  {r.sub && <span style={{ fontSize:"var(--arcd-type-label)", color:"var(--arcd-text-secondary)", display:"block", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{r.sub}</span>}
                </span>
              </button>
            );
          })}
        </div>
        <div style={{ display:"flex", justifyContent:"space-between", padding:"var(--arcd-space-2) var(--arcd-space-3)", borderTop:`var(--arcd-border-width) solid var(--arcd-border-subtle)`, fontSize:"var(--arcd-type-caption)", color:"var(--arcd-text-secondary)" }}>
          <span>↑↓ navegar · Enter abrir</span>
          <span>{contar(resultados.length,"resultado","resultados")}</span>
        </div>
      </div>
    </div>
  );
}
