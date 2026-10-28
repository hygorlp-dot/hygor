// Importa para a grade de presença o que o app de ponto (REP-P) registrou no
// período. Só propõe: o RH marca o que aceita e só então grava, pelo mesmo
// comando em lote da grade (attendance-batch-upsert). Ver ponte-grade.js.
import { useMemo, useState } from "react";
import { Btn, C, Modal, fmtDateFull } from "../../../LegacyApp";
import { chamarPontoEletronico } from "../../../api";
import { divergenciaComGrade, proporGradeDoREP } from "../ponte-grade";

const ROTULO = { P:"Presente", M:"Meio dia" };
const inicioDoDia = dia => new Date(`${dia}T00:00:00-03:00`).toISOString();
const fimDoDia = dia => new Date(`${dia}T23:59:59-03:00`).toISOString();

export function ImportarDoREP({ data, employees, days, getRecord, canEdit, obraName, dispatchAttendanceCommand, newOperationId, showToast }) {
  const [aberto, setAberto] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [propostas, setPropostas] = useState([]);
  const [marcadas, setMarcadas] = useState(() => new Set());
  const nomes = useMemo(() => new Map((employees || []).map(e => [String(e.id), e.name])), [employees]);

  const carregar = async () => {
    if (!days.length) return;
    setAberto(true); setCarregando(true);
    try {
      const de = inicioDoDia(days[0]), ate = fimDoDia(days.at(-1));
      const [m, a] = await Promise.all([
        chamarPontoEletronico("ponto-marcacoes", { de, ate }),
        chamarPontoEletronico("ponto-apropriacoes", { de:days[0], ate:days.at(-1) }),
      ]);
      if (m?.ok === false || a?.ok === false) throw new Error(m?.error || a?.error || "O servidor do ponto não respondeu.");
      const jornada = Object.fromEntries((data.employees || []).map(e => [String(e.id), Number(e.workdayHours || data.config?.payrollWorkdayHours || 8)]));
      const lista = proporGradeDoREP({ marcacoes:m?.marcacoes || [], apropriacoes:a?.apropriacoes || [], jornadaHorasPorFuncionario:jornada })
        .filter(p => nomes.has(p.employeeId) && days.includes(p.date))
        .map(p => ({ ...p, comparacao:divergenciaComGrade(p, getRecord(p.employeeId, p.date)), bloqueado:!!p.obraId && !canEdit(p.obraId, p.date) }))
        .filter(p => p.comparacao !== "igual");
      setPropostas(lista);
      // Pré-marca só o que é novo e gravável; divergência exige escolha.
      setMarcadas(new Set(lista.filter(p => p.status && p.comparacao === "novo" && !p.bloqueado).map(p => `${p.employeeId}__${p.date}`)));
    } catch (error) {
      showToast(error?.message || "Não foi possível ler o app de ponto.", "error");
      setAberto(false);
    } finally { setCarregando(false); }
  };

  const alternar = chave => setMarcadas(atual => {
    const next = new Set(atual);
    if (next.has(chave)) next.delete(chave); else next.add(chave);
    return next;
  });

  const gravar = async () => {
    const escolhidas = propostas.filter(p => marcadas.has(`${p.employeeId}__${p.date}`));
    if (!escolhidas.length) return;
    setSalvando(true);
    const patches = escolhidas.map(p => {
      const anterior = getRecord(p.employeeId, p.date) || {};
      return {
        employeeId:p.employeeId, date:p.date, selectedObraId:p.obraId,
        record:{
          ...anterior, status:p.status, obraId:p.obraId, ot:p.ot,
          entrada:p.entrada, intervaloSaida:p.intervaloSaida, intervaloRetorno:p.intervaloRetorno, saida:p.saida,
          workedMinutes:p.workedMinutes,
          note:[anterior.note, "Importado do app de ponto"].filter(Boolean).join(" · "),
        },
      };
    });
    const result = await dispatchAttendanceCommand({ action:"attendance-batch-upsert", operationId:newOperationId(), patches });
    setSalvando(false);
    if (!result?.ok) { showToast(result?.reason || "A importação não foi gravada.", "error"); return; }
    showToast(`${patches.length} dia(s) importado(s) do app de ponto.`);
    setAberto(false);
  };

  return <>
    <Btn v="ghost" onClick={carregar} disabled={carregando}>{carregando ? "Lendo o app de ponto…" : "Importar do app de ponto"}</Btn>
    {aberto && <Modal title="Importar do app de ponto" onClose={() => setAberto(false)} wide>
      <div className="payroll-review">
        {carregando ? <p>Lendo as batidas do período…</p> : propostas.length === 0
          ? <p>Nada novo: a grade já confere com o app de ponto neste período.</p>
          : <>
            <p>Confira cada dia. Nada é gravado sem marcação. Dias que mudam o que já está na grade vêm desmarcados.</p>
            <div className="payroll-review__list">
              {propostas.map(p => {
                const chave = `${p.employeeId}__${p.date}`;
                const atual = getRecord(p.employeeId, p.date);
                return <label key={chave} className="payroll-review__item" style={{ display:"flex", gap:10, alignItems:"flex-start", opacity:p.bloqueado || !p.status ? .6 : 1 }}>
                  <input type="checkbox" checked={marcadas.has(chave)} disabled={p.bloqueado || !p.status} onChange={() => alternar(chave)} aria-label={`Importar ${nomes.get(p.employeeId)} em ${p.date}`}/>
                  <span>
                    <strong>{nomes.get(p.employeeId)} · {fmtDateFull(p.date)}</strong>
                    <p>{p.status ? ROTULO[p.status] : "Sem situação"} · {obraName(p.obraId)} · {p.entrada || "—"} a {p.saida || "—"}{p.ot ? ` · ${p.ot}h extra` : ""} · {p.origem === "apropriacao" ? "apropriação confirmada" : "pelas batidas"}</p>
                    {p.comparacao === "diferente" && <p data-tone="warning">Hoje na grade: {atual?.status || "—"} em {obraName(atual?.obraId)}</p>}
                    {p.bloqueado && <p data-tone="danger">Ponto desta obra/dia está bloqueado.</p>}
                    {p.avisos.map(aviso => <p key={aviso} data-tone="warning" style={{ color:C.orange }}>{aviso}</p>)}
                  </span>
                </label>;
              })}
            </div>
            <div className="payroll-review__actions">
              <Btn v="primary" disabled={salvando || !marcadas.size} onClick={gravar}>{salvando ? "Gravando…" : `Gravar ${marcadas.size} dia(s) na grade`}</Btn>
              <Btn v="ghost" onClick={() => setAberto(false)}>Cancelar</Btn>
            </div>
          </>}
      </div>
    </Modal>}
  </>;
}
