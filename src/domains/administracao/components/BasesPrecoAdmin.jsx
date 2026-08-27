// ===================================================================
// BasesPrecoAdmin — cadastro/gestão das bases de preço SINAPI e ORSE,
// exclusivo do administrador. Antes vivia dentro da tela de Orçamento
// (OrcamentoView.jsx, painel "Bases oficiais e vínculos"), acessível a
// qualquer usuário mesmo que os controles de upload já fossem escondidos
// atrás de `ehAdmin` - o pedido foi tirar essa responsabilidade da tela
// operacional por completo. O operador continua podendo pesquisar e
// vincular uma base já cadastrada aqui, direto do orçamento; só o
// cadastro/importação/exclusão migrou para cá.
//
// SINAPI: motor já existente (lerSinapiEmSegundoPlano, Web Worker) lê o
// XLSX oficial e envia em lotes para /api/references.
// ORSE: motor novo (orse-import.js/orse-parser.js) lê os 5 TXT
// relacionais entregues pelo CEHOP e envia pelo mesmo pipeline - ver
// docs/BLUEPRINT_CONCORRENCIA_TRAVA.md.
// ===================================================================

import { useEffect, useMemo, useState } from "react";
import {
  Badge, Btn, C, Ic, Inp, Sel, SINAPI_UFS, lerSinapiEmSegundoPlano,
} from "../../../LegacyApp";
import {
  enviarLoteComponentesReferencia, enviarLoteInsumosReferencia, enviarLoteReferencia,
  finalizarBaseReferencia, iniciarBaseReferencia, listarBasesReferencia, removerBaseReferencia,
} from "../../../api";
import { referenceBaseKey as chaveBaseReferencia } from "../../orcamentos/reference-bases";
import { classificarArquivoOrse } from "../../orcamentos/orse-parser";

// O motor do ORSE (com o Web Worker) só entra no bundle quando o
// administrador realmente importa um arquivo - mesma técnica de
// lerSinapiEmSegundoPlano (LegacyApp.jsx): manter esse import fora do
// topo do arquivo é o que faz o bundler reconhecer o worker do ORSE como
// um chunk publicável separado, em vez de embuti-lo (sem nenhum arquivo
// de worker de verdade) dentro do bundle da Central do Administrador.
const lerOrseEmSegundoPlano = async (...args) => {
  const { readOrseInWorker } = await import("../../orcamentos/orse-import");
  return readOrseInWorker(...args);
};

const ROTULO_SLOT_ORSE = {
  insumo: "TB_INSUMO", insumoPreco: "TB_INSUMO_PRECO", servico: "TB_SERVICO",
  servicoPreco: "TB_SERVICO_PRECO", composicao: "TB_COMPOSICAO",
};
const SLOTS_ORSE = Object.keys(ROTULO_SLOT_ORSE);
const LOTE = 350;

// Envia {itens, insumos, componentes} em lotes de LOTE, reportando
// progresso 0-100 via onProgresso - mesma lógica que importarSinapiSupabase
// já usava dentro do orçamento, agora sem nenhum vínculo com um orc
// específico (o admin só cadastra a base; vincular é ação do operador).
async function enviarExtracaoEmLotes(baseId, extraida, onProgresso) {
  const totalLinhas = extraida.itens.length + extraida.insumos.length + extraida.componentes.length;
  let enviados = 0;
  const marcar = incremento => {
    enviados += incremento;
    onProgresso(Math.min(98, Math.round((enviados / Math.max(1, totalLinhas)) * 100)));
  };
  for (let i = 0; i < extraida.itens.length; i += LOTE) {
    const envio = await enviarLoteReferencia(baseId, extraida.itens.slice(i, i + LOTE));
    if (!envio.ok) throw new Error(envio.error || `Falha no lote de composições ${Math.floor(i / LOTE) + 1}.`);
    marcar(Math.min(LOTE, extraida.itens.length - i));
  }
  for (let i = 0; i < extraida.insumos.length; i += LOTE) {
    const envio = await enviarLoteInsumosReferencia(baseId, extraida.insumos.slice(i, i + LOTE));
    if (!envio.ok) throw new Error(envio.error || `Falha no lote de insumos ${Math.floor(i / LOTE) + 1}.`);
    marcar(Math.min(LOTE, extraida.insumos.length - i));
  }
  for (let i = 0; i < extraida.componentes.length; i += LOTE) {
    const envio = await enviarLoteComponentesReferencia(baseId, extraida.componentes.slice(i, i + LOTE));
    if (!envio.ok) throw new Error(envio.error || `Falha no lote analítico ${Math.floor(i / LOTE) + 1}.`);
    marcar(Math.min(LOTE, extraida.componentes.length - i));
  }
}

export default function BasesPrecoAdmin({ currentUser, data, update }) {
  const [bases, setBases] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [toast, setToast] = useState(null);

  const [sinapiUf, setSinapiUf] = useState("PE");
  const [sinapiDesonerado, setSinapiDesonerado] = useState(true);
  const [importandoSinapi, setImportandoSinapi] = useState(false);
  const [progressoSinapi, setProgressoSinapi] = useState(0);
  const [etapaSinapi, setEtapaSinapi] = useState("");

  const [arquivosOrse, setArquivosOrse] = useState({});
  const [importandoOrse, setImportandoOrse] = useState(false);
  const [progressoOrse, setProgressoOrse] = useState(0);
  const [etapaOrse, setEtapaOrse] = useState("");

  const mostrarToast = (msg, type = "success") => { setToast({ msg, type }); window.setTimeout(() => setToast(null), 4000); };

  const carregarBases = async () => {
    setCarregando(true);
    const resultado = await listarBasesReferencia();
    if (resultado.ok) setBases(resultado.bases || []);
    setCarregando(false);
  };
  useEffect(() => { carregarBases(); }, []);

  const duplicadas = useMemo(() => {
    const contagem = new Map();
    bases.forEach(base => contagem.set(chaveBaseReferencia(base), (contagem.get(chaveBaseReferencia(base)) || 0) + 1));
    return bases.filter(base => contagem.get(chaveBaseReferencia(base)) > 1).length;
  }, [bases]);

  if (currentUser?.role !== "admin") {
    return <div style={{ padding: 30, textAlign: "center", color: C.red }}>Acesso exclusivo da administração.</div>;
  }

  const importarSinapi = async file => {
    if (!file) return;
    setImportandoSinapi(true); setProgressoSinapi(1); setEtapaSinapi("Preparando a leitura do XLSX oficial...");
    let baseCriada = null;
    let baseReutilizada = false;
    try {
      const extraida = await lerSinapiEmSegundoPlano(file, sinapiUf, (mensagem, progresso) => {
        setEtapaSinapi(mensagem);
        if (Number.isFinite(progresso?.overallPercent)) {
          setProgressoSinapi(Math.max(1, Math.min(45, 1 + Math.round(progresso.overallPercent * 0.44))));
        }
      });
      if (!extraida.itens.length || !extraida.dataBase) throw new Error("Não encontrei as abas oficiais CSD/CCD, a competência ou a coluna da UF selecionada.");
      if (!extraida.insumos.length || !extraida.componentes.length) {
        throw new Error(`Este arquivo não contém a base analítica completa (${extraida.insumos.length} insumos e ${extraida.componentes.length} relações). Envie o XLSX oficial SINAPI com as abas ICD/ISD e Analítico.`);
      }
      setProgressoSinapi(46); setEtapaSinapi("Criando a referência segura no servidor...");
      let inicio = await iniciarBaseReferencia({ fonte: "SINAPI", dataBase: extraida.dataBase, uf: sinapiUf, desonerado: sinapiDesonerado, arquivo: file.name });
      if (!inicio.ok && inicio.duplicate && inicio.base?.id) {
        const confirmar = window.confirm(`Já existe SINAPI ${extraida.dataBase} · ${sinapiUf} · ${sinapiDesonerado ? "desonerada" : "não desonerada"}. Deseja reparar essa mesma base com o analítico do arquivo oficial? Os vínculos dos orçamentos serão preservados.`);
        if (!confirmar) { setImportandoSinapi(false); return; }
        inicio = await iniciarBaseReferencia({ fonte: "SINAPI", dataBase: extraida.dataBase, uf: sinapiUf, desonerado: sinapiDesonerado, arquivo: file.name, reimportar: true });
        baseReutilizada = !!inicio.ok;
      }
      if (!inicio.ok || !inicio.base?.id) throw new Error(inicio.error || "Não foi possível iniciar a base no Supabase.");
      baseCriada = inicio.base;
      setProgressoSinapi(48); setEtapaSinapi("Enviando composições, insumos e analítico em lotes...");
      await enviarExtracaoEmLotes(baseCriada.id, extraida, percentual => setProgressoSinapi(48 + Math.round(percentual * 0.5)));
      setEtapaSinapi("Validando e concluindo a base no Supabase...");
      const fim = await finalizarBaseReferencia(baseCriada.id);
      if (!fim.ok || !fim.base) throw new Error(fim.error || "Não foi possível finalizar a base.");
      setProgressoSinapi(100); setEtapaSinapi("Base concluída.");
      await carregarBases();
      const n = valor => valor.toLocaleString("pt-BR");
      mostrarToast(`Base SINAPI ${extraida.dataBase} / ${sinapiUf}: ${n(extraida.itens.length)} composições, ${n(extraida.insumos.length)} insumos e ${n(extraida.componentes.length)} linhas de analítico${baseReutilizada ? " reparados" : ""}.`);
    } catch (error) {
      if (baseCriada?.id && !baseReutilizada) await removerBaseReferencia(baseCriada.id).catch(() => null);
      mostrarToast(error?.message || "Falha ao enviar a base SINAPI.", "error");
    } finally {
      setImportandoSinapi(false);
      window.setTimeout(() => { setProgressoSinapi(0); setEtapaSinapi(""); }, 900);
    }
  };

  const selecionarArquivosOrse = fileList => {
    const proximos = { ...arquivosOrse };
    const ignorados = [];
    Array.from(fileList || []).forEach(file => {
      const slot = classificarArquivoOrse(file.name);
      if (!slot) { ignorados.push(file.name); return; }
      proximos[slot] = file;
    });
    setArquivosOrse(proximos);
    if (ignorados.length) mostrarToast(`Arquivo(s) não reconhecido(s), ignorado(s): ${ignorados.join(", ")}.`, "warn");
  };

  const importarOrse = async () => {
    const faltando = SLOTS_ORSE.filter(slot => !arquivosOrse[slot]);
    if (faltando.length) { mostrarToast(`Faltam arquivos: ${faltando.map(slot => ROTULO_SLOT_ORSE[slot]).join(", ")}.`, "error"); return; }
    setImportandoOrse(true); setProgressoOrse(1); setEtapaOrse("Lendo os arquivos do ORSE...");
    let baseCriada = null;
    try {
      const extraida = await lerOrseEmSegundoPlano(arquivosOrse, (mensagem, progresso) => {
        setEtapaOrse(mensagem);
        if (Number.isFinite(progresso)) setProgressoOrse(Math.max(1, Math.min(45, progresso)));
      });
      if (!extraida.itens.length || !extraida.dataBase) throw new Error("Não encontrei composições com preço ou a competência (ano/mês) nos arquivos enviados.");
      setProgressoOrse(46); setEtapaOrse("Criando a referência segura no servidor...");
      const inicio = await iniciarBaseReferencia({ fonte: "ORSE", dataBase: extraida.dataBase, arquivo: SLOTS_ORSE.map(slot => arquivosOrse[slot].name).join(" + ") });
      if (!inicio.ok || !inicio.base?.id) throw new Error(inicio.error || "Não foi possível iniciar a base ORSE no Supabase.");
      baseCriada = inicio.base;
      setProgressoOrse(48); setEtapaOrse("Enviando composições, insumos e analítico em lotes...");
      await enviarExtracaoEmLotes(baseCriada.id, extraida, percentual => setProgressoOrse(48 + Math.round(percentual * 0.5)));
      setEtapaOrse("Validando e concluindo a base no Supabase...");
      const fim = await finalizarBaseReferencia(baseCriada.id);
      if (!fim.ok || !fim.base) throw new Error(fim.error || "Não foi possível finalizar a base.");
      setProgressoOrse(100); setEtapaOrse("Base concluída.");
      await carregarBases();
      setArquivosOrse({});
      const n = valor => valor.toLocaleString("pt-BR");
      mostrarToast(`Base ORSE ${extraida.dataBase}: ${n(extraida.itens.length)} composições, ${n(extraida.insumos.length)} insumos e ${n(extraida.componentes.length)} linhas de analítico.`);
    } catch (error) {
      if (baseCriada?.id) await removerBaseReferencia(baseCriada.id).catch(() => null);
      mostrarToast(error?.message || "Falha ao enviar a base ORSE.", "error");
    } finally {
      setImportandoOrse(false);
      window.setTimeout(() => { setProgressoOrse(0); setEtapaOrse(""); }, 900);
    }
  };

  // Espelha o antigo excluirBasePersistida (OrcamentoView.jsx): antes de
  // excluir, procura uma base equivalente (mesma fonte/data-base/UF/
  // onerado) para substituir automaticamente em todo orçamento que ainda
  // aponta para a base excluída - sem isso, um orçamento vinculado ficaria
  // órfão silenciosamente, sem preço nenhum pelos códigos dessa base.
  const recalcularFonteOrc = (ids, listaBases) => {
    const fontes = new Set(listaBases.filter(item => ids.includes(item.id)).map(item => item.fonte));
    return fontes.has("SINAPI") && fontes.has("ORSE") ? "MISTO" : fontes.has("ORSE") ? "ORSE" : "SINAPI";
  };

  const excluirBase = async base => {
    const orcamentosVinculados = (data.orcamentos || []).filter(item => (item.referencias || []).includes(base.id)).length;
    const equivalentes = bases.filter(item => item.id !== base.id && chaveBaseReferencia(item) === chaveBaseReferencia(base) && item.status === "ready")
      .sort((a, b) => Number(b.total || 0) - Number(a.total || 0) || String(b.criadoEm || "").localeCompare(String(a.criadoEm || "")));
    const substituta = equivalentes[0] || null;
    const avisoVinculo = orcamentosVinculados
      ? substituta ? ` Ela será substituída pela cópia equivalente em ${orcamentosVinculados} orçamento(s).` : ` Ela será desvinculada de ${orcamentosVinculados} orçamento(s), que ficarão sem essa fonte de preço.`
      : "";
    if (!window.confirm(`Excluir definitivamente a base ${base.fonte} ${base.dataBase}${base.uf ? ` · ${base.uf}` : ""}?${avisoVinculo}`)) return;

    const resultado = await removerBaseReferencia(base.id);
    if (!resultado.ok) { mostrarToast(resultado.error || "Falha ao excluir a base.", "error"); return; }

    const restantes = bases.filter(item => item.id !== base.id);
    const orcamentos = (data.orcamentos || []).map(item => {
      if (!(item.referencias || []).includes(base.id)) return item;
      let referencias = (item.referencias || []).filter(id => id !== base.id);
      if (substituta && !referencias.includes(substituta.id)) referencias = [...referencias, substituta.id];
      return { ...item, referencias, fonte: recalcularFonteOrc(referencias, restantes) };
    });
    update({ ...data, orcamentos });
    setBases(restantes);
    mostrarToast(`Base removida.${avisoVinculo}`);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {toast && <div style={{ background: toast.type === "error" ? `${C.red}12` : toast.type === "warn" ? `${C.orange}12` : `${C.green}12`, border: `1px solid ${toast.type === "error" ? C.red : toast.type === "warn" ? C.orange : C.green}44`, borderRadius: 7, padding: "9px 11px", fontSize: 11.5, color: C.text }}>{toast.msg}</div>}

      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 14 }}>
        <p style={{ fontSize: 13, fontWeight: 800, color: C.text }}>Bases de preço - SINAPI e ORSE</p>
        <p style={{ fontSize: 10.5, color: C.muted, marginTop: 3, lineHeight: 1.5 }}>
          Cadastro exclusivo do administrador. Depois de cadastrada, qualquer operador pode vincular a base ao orçamento e escolher UF / onerado ou desonerado por lá - nenhum arquivo é enviado de dentro do orçamento.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 10 }}>
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 14 }}>
          <p style={{ fontSize: 12, fontWeight: 800, color: C.blue, marginBottom: 8 }}>SINAPI · planilha oficial (XLSX)</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <Sel label="UF dos preços" value={sinapiUf} onChange={setSinapiUf} options={SINAPI_UFS.map(uf => ({ v: uf, l: uf }))} />
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
              <input type="checkbox" checked={sinapiDesonerado} onChange={e => setSinapiDesonerado(e.target.checked)} />
              <span style={{ fontSize: 11, color: C.text }}>Desonerada (desmarque para não desonerada)</span>
            </label>
            <label style={{ display: "block" }}>
              <input type="file" accept=".xlsx" disabled={importandoSinapi} onChange={e => { const file = e.target.files?.[0]; e.target.value = ""; importarSinapi(file); }} style={{ display: "none" }} />
              <span style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 6, background: C.blue, color: "#fff", padding: "8px 10px", borderRadius: 7, cursor: importandoSinapi ? "wait" : "pointer", fontSize: 10.5, fontWeight: 800, textTransform: "uppercase" }}>
                <Ic n="download" s={13} /> {importandoSinapi ? "Enviando..." : "Enviar XLSX oficial"}
              </span>
            </label>
            {progressoSinapi > 0 && <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9.5, color: C.muted, marginBottom: 3, gap: 10 }}><span>{etapaSinapi || "Preparando..."}</span><strong>{progressoSinapi}%</strong></div>
              <div style={{ height: 7, background: C.surface, borderRadius: 99, overflow: "hidden" }}><div style={{ height: "100%", width: `${progressoSinapi}%`, background: C.blue, transition: "width .2s" }} /></div>
            </div>}
          </div>
        </div>

        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 14 }}>
          <p style={{ fontSize: 12, fontWeight: 800, color: C.purple, marginBottom: 8 }}>ORSE · tabelas oficiais (TXT, CEHOP)</p>
          <p style={{ fontSize: 10, color: C.muted, marginBottom: 8, lineHeight: 1.5 }}>
            Selecione de uma vez os 5 arquivos: TB_INSUMO, TB_INSUMO_PRECO, TB_SERVICO, TB_SERVICO_PRECO e TB_COMPOSICAO (os de detalhamento de equipamento não são usados). O app reconhece cada um pelo nome.
          </p>
          <label style={{ display: "block", marginBottom: 8 }}>
            <input type="file" accept=".txt" multiple disabled={importandoOrse} onChange={e => { selecionarArquivosOrse(e.target.files); e.target.value = ""; }} style={{ display: "none" }} />
            <span style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 6, border: `1.5px solid ${C.purple}`, color: C.purple, padding: "8px 10px", borderRadius: 7, cursor: importandoOrse ? "wait" : "pointer", fontSize: 10.5, fontWeight: 800, textTransform: "uppercase" }}>
              <Ic n="file" s={13} /> Selecionar arquivos TXT
            </span>
          </label>
          <div style={{ display: "flex", flexDirection: "column", gap: 3, marginBottom: 8 }}>
            {SLOTS_ORSE.map(slot => (
              <p key={slot} style={{ fontSize: 9.5, color: arquivosOrse[slot] ? C.green : C.muted, display: "flex", alignItems: "center", gap: 5 }}>
                <Ic n={arquivosOrse[slot] ? "check" : "x"} s={10} color={arquivosOrse[slot] ? C.green : C.muted} />
                {ROTULO_SLOT_ORSE[slot]}{arquivosOrse[slot] ? ` · ${arquivosOrse[slot].name}` : " · pendente"}
              </p>
            ))}
          </div>
          <Btn size="sm" v="success" full disabled={importandoOrse || SLOTS_ORSE.some(slot => !arquivosOrse[slot])} onClick={importarOrse}>
            {importandoOrse ? "Enviando..." : "Enviar tabelas do ORSE"}
          </Btn>
          {progressoOrse > 0 && <div style={{ marginTop: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9.5, color: C.muted, marginBottom: 3, gap: 10 }}><span>{etapaOrse || "Preparando..."}</span><strong>{progressoOrse}%</strong></div>
            <div style={{ height: 7, background: C.surface, borderRadius: 99, overflow: "hidden" }}><div style={{ height: "100%", width: `${progressoOrse}%`, background: C.purple, transition: "width .2s" }} /></div>
          </div>}
        </div>
      </div>

      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 14 }}>
        <p style={{ fontSize: 12, fontWeight: 800, color: C.text, marginBottom: 8 }}>
          Bases cadastradas · {bases.length} registro(s){duplicadas ? ` · ${duplicadas} repetição(ões)` : ""}
        </p>
        {carregando ? <p style={{ fontSize: 11, color: C.muted }}>Carregando...</p>
          : bases.length === 0 ? <p style={{ fontSize: 11, color: C.muted }}>Nenhuma base cadastrada ainda.</p>
          : <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {bases.map(base => {
              const repetida = bases.filter(item => chaveBaseReferencia(item) === chaveBaseReferencia(base)).length > 1;
              const legado = base.fonte === "ORSE" && base.modo === "official";
              return (
                <div key={base.id} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 8, alignItems: "center", padding: "8px 10px", border: `1px solid ${repetida ? C.orange : C.border}`, borderRadius: 6, background: C.surface }}>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: 10.5, fontWeight: 850, color: base.fonte === "ORSE" ? C.purple : C.blue }}>
                      {base.fonte} · {base.dataBase}{base.uf ? ` · ${base.uf}` : ""}{base.fonte === "SINAPI" ? ` · ${base.desonerado === false ? "NÃO DESONERADA" : "DESONERADA"}` : ""}
                      {" "}{repetida && <Badge color={C.orange}>REPETIDA</Badge>}{legado && <Badge color={C.orange}>PESQUISA AO VIVO (REIMPORTE)</Badge>}
                    </p>
                    <p style={{ fontSize: 8.5, color: C.muted, marginTop: 2 }}>
                      {base.status === "ready" ? `${Number(base.total || 0).toLocaleString("pt-BR")} itens` : "Processamento incompleto"} · cadastrada em {base.criadoEm ? new Date(base.criadoEm).toLocaleString("pt-BR") : "data não informada"}
                    </p>
                  </div>
                  <Btn size="sm" v="danger" onClick={() => excluirBase(base)}><Ic n="trash" /> Excluir</Btn>
                </div>
              );
            })}
          </div>}
      </div>
    </div>
  );
}
