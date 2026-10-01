// Aba "Ponto eletrônico (app)" - registros do app Android "Ponto de Obra"
// (REP-P, Portaria 671/2021). EM TESTE: estas marcações ficam em tabelas
// próprias e NÃO alimentam a Gestão do ponto nem a folha. Obras, funcionários
// e usuários vêm da base única do ARCD.
import { useCallback, useEffect, useMemo, useState } from "react";
import { chamarPontoEletronico } from "../../../api";
import { Badge, Btn, C, Ic, Inp, Modal, PageHero, Sel } from "../../../LegacyApp";
import { funcionariosDaObra } from "../funcionarios.js";
import { ROTULO_SITUACAO, dataLocal, horaLocal, intervaloDoDia, resumoDoDia, situacaoAparelho } from "../painel.js";

const ATUALIZAR_A_CADA_MS = 20_000;
const corDoTom = { ok: C.green, atencao: C.orange, critico: C.red, neutro: C.muted };
const corSituacao = { em_jornada: C.blue, fechada: C.green, sem_batida: C.muted };
const card = { background: C.card, border: `1px solid ${C.border}`, borderRadius: 4, padding: 14 };
const tituloCard = { fontSize: 13, fontWeight: 600, color: C.text, margin: "0 0 10px", display: "flex", alignItems: "center", gap: 8 };

export default function PontoEletronicoView({ data, showToast, currentUser }) {
  const obras = useMemo(() => (data?.obras || []).filter(o => o?.id && o?.name), [data?.obras]);
  // Abre na obra com mais funcionários ativos (a primeira da lista pode ser
  // uma obra de apoio sem equipe, como "BASE DE DADOS").
  const [obraId, setObraId] = useState(() => [...obras]
    .map(o => ({ id: o.id, n: funcionariosDaObra(data?.employees, o.id).length }))
    .sort((a, b) => b.n - a.n)[0]?.id || "");
  const [dia, setDia] = useState(() => dataLocal(new Date().toISOString()));
  const [dispositivos, setDispositivos] = useState([]);
  const [marcacoes, setMarcacoes] = useState([]);
  const [biometrias, setBiometrias] = useState([]);
  const [responsaveis, setResponsaveis] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const [pareamento, setPareamento] = useState(null);   // {nome} | {codigo, expiraEm, nome}
  const [pinModal, setPinModal] = useState(null);       // {userId, pin, obras}
  const [detalhe, setDetalhe] = useState(null);         // {marcacao, fotoUrl, carregandoFoto}
  const podeGerir = ["admin", "rh", "engenheiro"].includes(currentUser?.role);

  const funcionarios = useMemo(() => funcionariosDaObra(data?.employees, obraId), [data?.employees, obraId]);
  const nomeFuncionario = useMemo(() => new Map((data?.employees || []).map(e => [String(e.id), e.name])), [data?.employees]);
  const nomeUsuario = useMemo(() => new Map((data?.usuarios || []).map(u => [String(u.id), u.nome || u.email])), [data?.usuarios]);
  const nomeObra = useMemo(() => new Map(obras.map(o => [String(o.id), o.name])), [obras]);

  const carregar = useCallback(async ({ silencioso = false } = {}) => {
    if (!obraId) return;
    if (!silencioso) setCarregando(true);
    const { de, ate } = intervaloDoDia(dia);
    const [rDisp, rMarc, rBio, rResp] = await Promise.all([
      chamarPontoEletronico("ponto-dispositivos", { obraId }),
      chamarPontoEletronico("ponto-marcacoes", { obraId, de, ate }),
      chamarPontoEletronico("ponto-biometria-status", {}),
      podeGerir ? chamarPontoEletronico("ponto-responsaveis", {}) : Promise.resolve({ ok: true, responsaveis: [] }),
    ]);
    const falha = [rDisp, rMarc, rBio, rResp].find(r => !r.ok);
    setErro(falha ? (falha.error || "Não foi possível carregar o ponto eletrônico.") : "");
    if (rDisp.ok) setDispositivos(rDisp.dispositivos || []);
    if (rMarc.ok) setMarcacoes(rMarc.marcacoes || []);
    if (rBio.ok) setBiometrias(rBio.biometrias || []);
    if (rResp.ok) setResponsaveis(rResp.responsaveis || []);
    if (!silencioso) setCarregando(false);
  }, [obraId, dia, podeGerir]);

  useEffect(() => { carregar(); }, [carregar]);
  useEffect(() => {
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") carregar({ silencioso: true }); }, ATUALIZAR_A_CADA_MS);
    return () => window.clearInterval(timer);
  }, [carregar]);

  const resumo = useMemo(() => resumoDoDia(marcacoes, funcionarios), [marcacoes, funcionarios]);
  const acessosTerceiros = useMemo(() => marcacoes.filter(m => m.tipoRegistro === "acesso_terceiro"), [marcacoes]);
  const bioPorFuncionario = useMemo(() => new Map(biometrias.map(b => [b.employeeId, b])), [biometrias]);
  const semBiometria = funcionarios.filter(f => !bioPorFuncionario.has(f.id)).length;
  const online = dispositivos.filter(d => situacaoAparelho(d).tom === "ok").length;

  const gerarCodigo = async () => {
    const r = await chamarPontoEletronico("ponto-codigo-pareamento", { obraId, nome: pareamento?.nome || "Aparelho da obra" });
    if (!r.ok) { showToast?.(r.error || "Não foi possível gerar o código.", "error"); return; }
    setPareamento({ codigo: r.codigo, expiraEm: r.expiraEm, nome: r.nome });
  };
  const desativar = async d => {
    if (!window.confirm(`Desativar "${d.nome}"? O aparelho para de registrar e precisará ser pareado de novo. As marcações já feitas continuam guardadas.`)) return;
    const r = await chamarPontoEletronico("ponto-dispositivo-revogar", { dispositivoId: d.id });
    if (!r.ok) { showToast?.(r.error || "Não foi possível desativar.", "error"); return; }
    showToast?.("Aparelho desativado."); carregar();
  };
  const salvarPin = async () => {
    const r = await chamarPontoEletronico("ponto-responsavel-pin", { userId: pinModal.userId, pin: pinModal.pin, obras: pinModal.obras });
    if (!r.ok) { showToast?.(r.error || "Não foi possível salvar o PIN.", "error"); return; }
    showToast?.("PIN do app salvo. Ele chega aos aparelhos na próxima sincronização."); setPinModal(null); carregar();
  };
  const excluirBiometria = async f => {
    if (!window.confirm(`Excluir a biometria facial de ${f.nome}? Ele precisará ser cadastrado de novo no aparelho para bater ponto pelo rosto. As batidas já feitas continuam guardadas.`)) return;
    const r = await chamarPontoEletronico("ponto-biometria-excluir", { employeeId: f.id });
    if (!r.ok) { showToast?.(r.error || "Não foi possível excluir.", "error"); return; }
    showToast?.("Biometria excluída."); carregar();
  };
  const abrirDetalhe = async m => {
    setDetalhe({ marcacao: m, fotoUrl: "", carregandoFoto: m.temFoto });
    if (!m.temFoto) return;
    const r = await chamarPontoEletronico("ponto-foto-url", { marcacaoId: m.id });
    setDetalhe(atual => atual?.marcacao.id === m.id ? { ...atual, fotoUrl: r.ok ? r.url : "", carregandoFoto: false, erroFoto: r.ok ? "" : r.error } : atual);
  };

  if (!obras.length) {
    return <div style={card}><p style={{ color: C.muted, fontSize: 13 }}>Cadastre uma obra no ARCD para parear o primeiro aparelho de ponto.</p></div>;
  }

  return (
    <div className="anim" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <PageHero
        eyebrow="Recursos humanos"
        title="Ponto eletrônico (app de obra)"
        description="Batidas do app Ponto de Obra por reconhecimento facial. Em teste: estes registros são separados da Gestão do ponto e da folha."
        stats={[
          { label: "Aparelhos online", value: `${online} de ${dispositivos.filter(d => d.status === "ativo").length}`, color: online ? C.green : C.orange },
          { label: "Batidas no dia", value: String(marcacoes.filter(m => m.tipoRegistro === "ponto").length) },
          { label: "Em jornada agora", value: String(resumo.filter(l => l.situacao === "em_jornada").length), color: C.blue },
          { label: "Sem biometria", value: String(semBiometria), color: semBiometria ? C.orange : C.green },
        ]}
        actions={podeGerir && <Btn onClick={() => setPareamento({ nome: "" })}><Ic n="plus" /> Parear aparelho</Btn>}
      />

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div style={{ minWidth: 240 }}><Sel label="Obra" value={obraId} onChange={setObraId} options={obras.map(o => ({ v: o.id, l: o.name }))} /></div>
        <div style={{ width: 170 }}><Inp label="Dia" type="date" value={dia} onChange={v => v && setDia(v)} /></div>
        <Btn v="ghost" onClick={() => carregar()} loading={carregando}><Ic n="refresh" /> Atualizar</Btn>
      </div>

      {erro && <div role="alert" style={{ ...card, borderColor: C.red, color: C.red, fontSize: 13 }}>{erro}</div>}

      <section style={card} aria-labelledby="pe-aparelhos">
        <h3 id="pe-aparelhos" style={tituloCard}><Ic n="smartphone" /> Aparelhos da obra</h3>
        {!dispositivos.length
          ? <p style={{ color: C.muted, fontSize: 12.5 }}>Nenhum aparelho pareado nesta obra. {podeGerir ? "Use \"Parear aparelho\" e digite o código no celular da obra." : ""}</p>
          : <div style={{ display: "grid", gap: 8 }}>
            {dispositivos.map(d => {
              const s = situacaoAparelho(d);
              return <div key={d.id} style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", padding: "8px 0", borderTop: `1px solid ${C.line}` }}>
                <div style={{ flex: 1, minWidth: 180 }}>
                  <p style={{ fontSize: 13, fontWeight: 600 }}>{d.nome}</p>
                  <p style={{ fontSize: 11.5, color: C.muted }}>App {d.appVersao || "-"} · último NSR {d.ultimoNsr}{d.ultimoGps ? <> · <a href={`https://maps.google.com/?q=${d.ultimoGps.lat},${d.ultimoGps.lng}`} target="_blank" rel="noreferrer">localização</a></> : null}</p>
                </div>
                <Badge color={corDoTom[s.tom]}>{s.rotulo}</Badge>
                {podeGerir && d.status === "ativo" && <Btn size="sm" v="ghost" onClick={() => desativar(d)}>Desativar</Btn>}
              </div>;
            })}
          </div>}
      </section>

      <section style={card} aria-labelledby="pe-batidas">
        <h3 id="pe-batidas" style={tituloCard}><Ic n="clock" /> Batidas de {dia.split("-").reverse().join("/")}</h3>
        {!resumo.length
          ? <p style={{ color: C.muted, fontSize: 12.5 }}>Nenhum funcionário ativo nesta obra no cadastro do ARCD.</p>
          : <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
              <thead><tr style={{ textAlign: "left", color: C.muted, fontSize: 11 }}>
                <th style={{ padding: "6px 8px" }}>Funcionário</th><th style={{ padding: "6px 8px" }}>Situação</th><th style={{ padding: "6px 8px" }}>Batidas (horário da obra)</th>
              </tr></thead>
              <tbody>{resumo.map(l => <tr key={l.employeeId} style={{ borderTop: `1px solid ${C.line}` }}>
                <td style={{ padding: "7px 8px" }}><span style={{ fontWeight: 600 }}>{l.nome}</span>{l.funcao && <span style={{ color: C.muted }}> · {l.funcao}</span>}</td>
                <td style={{ padding: "7px 8px" }}><Badge color={corSituacao[l.situacao]}>{ROTULO_SITUACAO[l.situacao]}</Badge></td>
                <td style={{ padding: "7px 8px" }}>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {l.batidas.map(b => {
                      const atencao = !b.horaConfiavel || b.relogioAlterado || b.metodo === "encarregado";
                      return <button key={b.id} type="button" onClick={() => abrirDetalhe(b)} title="Ver detalhes da batida"
                        style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 12, padding: "3px 8px", borderRadius: 4, cursor: "pointer",
                          border: `1px solid ${atencao ? C.orange : C.border}`, background: atencao ? `${C.orange}14` : C.surface, color: C.text }}>
                        {horaLocal(b.marcadoEm).slice(0, 5)}{atencao ? " !" : ""}
                      </button>;
                    })}
                  </div>
                </td>
              </tr>)}</tbody>
            </table>
            <p style={{ fontSize: 11, color: C.muted, marginTop: 8 }}>"!" = identificada pelo encarregado, hora não confirmada pelo servidor ou relógio do celular alterado. A batida vale do mesmo jeito; o sinal é para conferência.</p>
          </div>}
        {!!acessosTerceiros.length && <p style={{ fontSize: 12, color: C.muted, marginTop: 10 }}>
          Acessos de terceirizados: {acessosTerceiros.map(a => `${horaLocal(a.marcadoEm).slice(0, 5)} ${(data?.terceirizados || []).find(t => String(t.id) === String(a.terceiroId))?.name || "terceirizado"}`).join(" · ")}
        </p>}
      </section>

      <section style={card} aria-labelledby="pe-bio">
        <h3 id="pe-bio" style={tituloCard}><Ic n="user" /> Biometria facial</h3>
        <p style={{ fontSize: 12, color: C.muted, marginBottom: 8 }}>O cadastro do rosto é feito no aparelho da obra por um responsável com PIN, com o consentimento do funcionário (LGPD).</p>
        <div style={{ display: "grid", gap: 4 }}>
          {funcionarios.map(f => {
            const b = bioPorFuncionario.get(f.id);
            return <div key={f.id} style={{ display: "flex", gap: 10, alignItems: "center", padding: "5px 0", borderTop: `1px solid ${C.line}`, fontSize: 12.5 }}>
              <span style={{ flex: 1 }}>{f.nome}</span>
              {b ? <span style={{ color: C.muted }}>cadastrada em {new Date(b.cadastradaEm).toLocaleDateString("pt-BR")} por {nomeUsuario.get(String(b.cadastradoPor)) || "responsável"}</span> : <Badge color={C.orange}>Pendente</Badge>}
              {b && podeGerir && <Btn size="sm" v="ghost" onClick={() => excluirBiometria(f)}>Excluir</Btn>}
            </div>;
          })}
        </div>
      </section>

      {podeGerir && <section style={card} aria-labelledby="pe-resp">
        <h3 id="pe-resp" style={tituloCard}><Ic n="lock" /> Responsáveis com PIN do app</h3>
        <p style={{ fontSize: 12, color: C.muted, marginBottom: 8 }}>Quem pode cadastrar rostos e identificar um funcionário quando o reconhecimento falhar. O PIN do app é separado do PIN do ARCD.</p>
        {responsaveis.map(r => <div key={r.userId} style={{ display: "flex", gap: 10, alignItems: "center", padding: "5px 0", borderTop: `1px solid ${C.line}`, fontSize: 12.5 }}>
          <span style={{ flex: 1 }}>{r.nome}</span>
          <span style={{ color: C.muted }}>{r.obras?.length ? r.obras.map(id => nomeObra.get(String(id)) || id).join(", ") : "todas as obras"}</span>
          <Btn size="sm" v="ghost" onClick={() => setPinModal({ userId: r.userId, pin: "", obras: r.obras || [] })}>Trocar PIN</Btn>
        </div>)}
        <Btn size="sm" v="ghost" onClick={() => setPinModal({ userId: "", pin: "", obras: [obraId] })} style={{ marginTop: 8 }}><Ic n="plus" /> Definir PIN de um responsável</Btn>
      </section>}

      {pareamento && <Modal title="Parear aparelho da obra" onClose={() => setPareamento(null)}>
        {!pareamento.codigo ? <div style={{ display: "grid", gap: 10 }}>
          <p style={{ fontSize: 12.5, color: C.muted }}>Obra: <b style={{ color: C.text }}>{nomeObra.get(String(obraId))}</b>. O código vale 30 minutos e pode ser usado uma única vez.</p>
          <Inp label="Nome do aparelho" value={pareamento.nome} placeholder="Ex.: Portaria principal" onChange={v => setPareamento({ nome: v })} />
          <Btn onClick={gerarCodigo}>Gerar código</Btn>
        </div> : <div style={{ display: "grid", gap: 10, textAlign: "center" }}>
          <p style={{ fontSize: 12.5, color: C.muted }}>No celular da obra, abra o app Ponto de Obra e digite:</p>
          <p style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 34, letterSpacing: 6, fontWeight: 500 }}>{pareamento.codigo.replace(/(\d{4})(\d{4})/, "$1 $2")}</p>
          <p style={{ fontSize: 12, color: C.muted }}>Válido até {new Date(pareamento.expiraEm).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}. Depois de pareado, o aparelho aparece na lista em alguns segundos.</p>
          <Btn v="ghost" onClick={() => { setPareamento(null); carregar(); }}>Concluir</Btn>
        </div>}
      </Modal>}

      {pinModal && <Modal title="PIN do app de ponto" onClose={() => setPinModal(null)}>
        <div style={{ display: "grid", gap: 10 }}>
          <Sel label="Responsável" value={pinModal.userId} onChange={v => setPinModal(p => ({ ...p, userId: v }))}
            options={[{ v: "", l: "Selecione" }, ...(data?.usuarios || []).filter(u => u.active !== false).map(u => ({ v: String(u.id), l: u.nome || u.email }))]} />
          <Inp label="PIN do app (4 a 8 números)" type="password" value={pinModal.pin} onChange={v => setPinModal(p => ({ ...p, pin: String(v).replace(/\D/g, "").slice(0, 8) }))} />
          <fieldset style={{ border: `1px solid ${C.border}`, borderRadius: 4, padding: 10 }}>
            <legend style={{ fontSize: 11.5, color: C.muted, padding: "0 4px" }}>Obras em que pode atuar (nenhuma marcada = todas)</legend>
            {obras.map(o => <label key={o.id} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12.5, padding: "3px 0" }}>
              <input type="checkbox" checked={pinModal.obras.includes(o.id)} onChange={e => setPinModal(p => ({ ...p, obras: e.target.checked ? [...p.obras, o.id] : p.obras.filter(x => x !== o.id) }))} />{o.name}
            </label>)}
          </fieldset>
          <Btn onClick={salvarPin} disabled={!pinModal.userId || pinModal.pin.length < 4}>Salvar PIN</Btn>
        </div>
      </Modal>}

      {detalhe && <Modal title={`Batida de ${nomeFuncionario.get(String(detalhe.marcacao.employeeId)) || "funcionário"}`} onClose={() => setDetalhe(null)}>
        <div style={{ display: "grid", gap: 8, fontSize: 12.5 }}>
          {detalhe.carregandoFoto ? <p style={{ color: C.muted }}>Carregando foto...</p>
            : detalhe.fotoUrl ? <img src={detalhe.fotoUrl} alt="Foto registrada na batida" style={{ width: "100%", maxWidth: 320, borderRadius: 4, justifySelf: "center" }} />
              : <p style={{ color: C.muted }}>{detalhe.erroFoto || "Sem foto nesta batida."}</p>}
          <p><b>Horário:</b> {dataLocal(detalhe.marcacao.marcadoEm).split("-").reverse().join("/")} {horaLocal(detalhe.marcacao.marcadoEm)} (horário da obra)</p>
          <p><b>Identificação:</b> {detalhe.marcacao.metodo === "facial" ? `reconhecimento facial${detalhe.marcacao.confianca != null ? ` (${Math.round(detalhe.marcacao.confianca * 100)}%)` : ""}` : `pelo encarregado ${nomeUsuario.get(String(detalhe.marcacao.encarregadoId)) || ""}`}</p>
          <p><b>Hora:</b> {detalhe.marcacao.horaConfiavel ? "confirmada pela hora do servidor" : "do relógio do celular (aparelho sem sincronizar desde que ligou)"}{detalhe.marcacao.relogioAlterado ? " · o relógio do celular estava alterado (a batida usou a hora do servidor)" : ""}</p>
          <p><b>NSR:</b> {detalhe.marcacao.nsr} · <b>Aparelho:</b> {dispositivos.find(d => d.id === detalhe.marcacao.dispositivoId)?.nome || "-"}</p>
          {detalhe.marcacao.gps && <p><b>Local:</b> <a href={`https://maps.google.com/?q=${detalhe.marcacao.gps.lat},${detalhe.marcacao.gps.lng}`} target="_blank" rel="noreferrer">ver no mapa</a> (precisão {Math.round(detalhe.marcacao.gps.precisao || 0)} m)</p>}
        </div>
      </Modal>}
    </div>
  );
}
