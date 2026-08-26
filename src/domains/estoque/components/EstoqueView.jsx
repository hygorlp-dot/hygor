// ===================================================================
// EstoqueView — tela de Estoque de Materiais, extraída de
// src/LegacyApp.jsx em 2026-08-26 (Onda 7 do raio-X). Mesmo padrão já
// usado para Diário de Obra/Compras/Orçamento/Terceirizados/Equipamentos/RH:
// mesmo corpo, mesma lógica, verbatim. ModalMaterial e ModalComposicao
// continuam em LegacyApp.jsx (agora exportados) porque também são usados
// pela tela de Cadastros - só ModalMovimento e ModalExecutar, exclusivos
// desta tela, vieram junto.
// ===================================================================

import { useCallback, useMemo, useState } from "react";
import { useBreakpoint } from "../../../hooks/useBreakpoint";
import {
  Btn, C, Ic, Inp, Modal, ModalComposicao, ModalMaterial, PageHero, Sel, TabRow,
  fmt, fmtDate, today, uid,
} from "../../../LegacyApp";
import { OPERATIONAL_COMMAND } from "../../sync/operational-commands";
import { TIPOS_MOV, SINAL_MOV, calcSaldos, saldoDe, baixarPorComposicao } from "../calculations";
import { STOCK_COMMAND } from "../commands";

function ModalMovimento({ form, setForm, onSave, obras, materiais }) {
  const { formGrid } = useBreakpoint();
  const F = k => v => setForm(f => ({ ...f, [k]: v }));
  return (
    <Modal title="Movimento de estoque" onClose={()=>setForm(null)} wide>
      <div style={{display:"grid",gridTemplateColumns:formGrid(2),gap:11}}>
        <Sel label="Tipo *" value={form.tipo} onChange={F("tipo")}
             options={TIPOS_MOV.map(t=>({v:t.v,l:t.l}))}/>
        <Sel label="Obra *" value={form.obraId} onChange={F("obraId")}
             options={[{v:"",l:"Selecione..."}, ...obras.map(o=>({v:o.id,l:o.name}))]}/>
        <Sel label="Material *" value={form.materialId} onChange={F("materialId")}
             options={[{v:"",l:"Selecione..."}, ...materiais.map(m=>({v:m.id,l:`${m.descricao} (${m.unidade})`}))]}/>
        <Inp label="Quantidade *" type="number" value={form.qtd} onChange={F("qtd")} placeholder="0"/>
        <Inp label="Valor unitário (R$)" type="number" value={form.valorUnit} onChange={F("valorUnit")}
             placeholder="0,00"/>
        <Inp label="Data" type="date" value={form.data} onChange={F("data")}/>
        <div style={{gridColumn:"1/-1"}}>
          <Inp label="Observação" value={form.descricao} onChange={F("descricao")}
               placeholder="NF 1234, fornecedor..."/>
        </div>
        <div style={{gridColumn:"1/-1",display:"flex",gap:8}}>
          <Btn v="ghost" onClick={()=>setForm(null)} full>Cancelar</Btn>
          <Btn onClick={()=>onSave(form)} full><Ic n="check"/> Registrar</Btn>
        </div>
      </div>
    </Modal>
  );
}


// Executar serviço: mostra EXATAMENTE o que vai sair, e se falta saldo,
// antes de confirmar. Baixa automática sem prévia é como assinar em branco.
function ModalExecutar({ onClose, onRun, composicoes, obras, obraAtual, materiais, saldos, nomeObra }) {
  const { formGrid } = useBreakpoint();
  const [compId, setCompId] = useState(composicoes[0]?.id || "");
  const [obraId, setObraId] = useState(obraAtual);
  const [qtd,    setQtd]    = useState("");
  const [quando, setQuando] = useState(new Date().toISOString().slice(0,10));
  const [etapa,  setEtapa]  = useState("");

  const comp = composicoes.find(c => c.id === compId);

  const previa = useMemo(() => {
    if (!comp || !Number(qtd)) return [];
    return baixarPorComposicao(comp, qtd).map(b => {
      const m = materiais.find(x => x.id === b.materialId);
      const disp = saldoDe(saldos, obraId, b.materialId);
      return { ...b, mat: m, disp, falta: b.qtd > disp + 0.0001 };
    });
  }, [comp, qtd, obraId, materiais, saldos]);

  const temFalta = previa.some(p => p.falta);

  return (
    <Modal title="Executei um serviço" onClose={onClose} wide>
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        {composicoes.length === 0 ? (
          <p style={{fontSize:12,color:C.muted,lineHeight:1.55,padding:"10px 0"}}>
            Nenhuma composição cadastrada ainda. Vá na aba <strong>Composições</strong> e
            defina, por exemplo, quanto 1 m de alvenaria consome de tijolo, cimento e areia.
            Depois é só informar aqui o quanto executou.
          </p>
        ) : (<>
          <div style={{display:"grid",gridTemplateColumns:formGrid(2),gap:11}}>
            <Sel label="Serviço *" value={compId} onChange={setCompId}
                 options={composicoes.map(c=>({v:c.id,l:`${c.nome} (${c.unidade})`}))}/>
            <Sel label="Obra *" value={obraId} onChange={setObraId}
                 options={obras.map(o=>({v:o.id,l:o.name}))}/>
            <Inp label={`Quanto executou (${comp?.unidade || "un"}) *`} type="number"
                 value={qtd} onChange={setQtd} placeholder="0"/>
            <Inp label="Data" type="date" value={quando} onChange={setQuando}/>
          </div>
          <Inp label="Etapa / local (opcional)" value={etapa} onChange={setEtapa}
               placeholder="Pavimento térreo, fachada oeste..."/>

          {/* Prévia da baixa */}
          {previa.length > 0 && (
            <div style={{
              background: temFalta ? `${C.red}08` : `${C.green}08`,
              border:`1.5px solid ${temFalta ? C.red : C.green}`,
              borderRadius:6, padding:"11px 12px",
            }}>
              <p style={{fontSize:11.5,fontWeight:800,color: temFalta ? C.red : C.green,marginBottom:7}}>
                {temFalta ? "! Saldo insuficiente" : "Vai sair do estoque"}
              </p>
              {previa.map((p,i) => (
                <div key={i} style={{display:"flex",justifyContent:"space-between",gap:8,
                                     fontSize:11,marginTop:3,alignItems:"baseline"}}>
                  <span className="brk" style={{color:C.text,minWidth:0}}>{p.mat?.descricao || "-"}</span>
                  <span style={{whiteSpace:"nowrap",flexShrink:0,
                                color: p.falta ? C.red : C.text, fontWeight:700}}>
                    {p.qtd} {p.mat?.unidade}
                    <span style={{color:C.muted,fontWeight:400,fontSize:10}}>
                      {" "}(tem {p.disp.toFixed(2)})
                    </span>
                  </span>
                </div>
              ))}
              {temFalta && (
                <p style={{fontSize:10,color:C.muted,marginTop:7,lineHeight:1.45}}>
                  Registre a entrada do que falta antes de baixar. O sistema não deixa o
                  saldo ficar negativo - estoque negativo contamina todo relatório depois.
                </p>
              )}
            </div>
          )}

          <div style={{display:"flex",gap:8}}>
            <Btn v="ghost" onClick={onClose} full>Cancelar</Btn>
            <Btn onClick={()=>onRun(compId, obraId, qtd, quando, etapa)} full
                 disabled={temFalta || !Number(qtd)}>
              <Ic n="check"/> Baixar do estoque
            </Btn>
          </div>
        </>)}
      </div>
    </Modal>
  );
}

export default function Estoque({ data, update, showToast, currentUser, obraIdFixo="", dispatchCommand=null }) {
  const { cols, formGrid } = useBreakpoint();
  const [aba,      setAba]      = useState("saldo");   // saldo|movs|materiais|comp|abc
  const [obraSel,  setObraSel]  = useState(obraIdFixo);
  const [busca,    setBusca]    = useState("");

  const [matModal, setMatModal] = useState(null);
  const [movModal, setMovModal] = useState(null);
  const [srvModal, setSrvModal] = useState(false);     // executar serviço
  const [compModal,setCompModal]= useState(null);

  const materiais   = useMemo(() => (data.materiais||[]).filter(m => m.ativo !== false), [data.materiais]);
  const saldos      = useMemo(() => calcSaldos(data.movEstoque), [data.movEstoque]);
  const obras       = data.obras || [];
  const obraAtual   = obraIdFixo || obraSel || obras[0]?.id || "";

  // ── Reposicao automatica por estoque minimo ─────────────────────
  // O minimo deixou de ser cosmetico: tudo que esta abaixo dele em qualquer
  // obra vira solicitacao de compra pre-preenchida com um toque.
  const abaixoMin = useMemo(() => materiaisAbaixoMinimo(data),
    [data.movEstoque, data.materiais, data.obras]);
  // Onda 5 do raio-X (item 3/3, 26/08/2026): gerava as solicitações direto
  // via update(), fora do padrão de comando que o resto de Compras já usa
  // (PURCHASE_REQUEST_COMMAND.PURCHASE_REQUEST_SAVED). Agora despacha um
  // comando por obra, sequencialmente, cada um com sua própria validação
  // e numeração recalculada contra o estado mais fresco do servidor.
  const gerarReposicao = async () => {
    if (!abaixoMin.length) return;
    if (!dispatchCommand) { showToast("Gerar reposição automática exige conexão com o servidor.", "error"); return; }
    const porObra = {};
    abaixoMin.forEach(l => { (porObra[l.obraId] = porObra[l.obraId] || []).push(l); });
    const nObras = Object.keys(porObra).length;
    if (!window.confirm(`Gerar ${nObras} solicitação(ões) de reposição?\n\n${abaixoMin.length} material(is) abaixo do mínimo em ${nObras} obra(s). As quantidades já vêm com o déficit calculado — o setor de Compras recebe o alerta na hora.`)) return;
    const hoje = today();
    let geradas = 0;
    for (const [obraId, linhas] of Object.entries(porObra)) {
      const id = uid();
      const request = {
        id, obraId, solicitanteId: currentUser?.id || "", solicitanteNome: currentUser?.nome || "Estoque",
        necessidade: hoje, prioridade: "normal", status: "enviada",
        observacao: "Reposição automática: materiais abaixo do estoque mínimo.",
        analisadoEm: "", analisadoPor: "", pedidoId: "",
        itens: linhas.map(l => ({
          id: uid(), materialId: l.materialId, referenciaId: "", fonteRef: "PRÓPRIO", codigoRef: "",
          descricaoRef: maiusculoOrcamento(l.descricao), unidadeRef: maiusculoOrcamento(l.unidade),
          quantidade: l.deficit, precoRef: 0, dataBaseRef: "", ufRef: "",
          observacao: `Saldo ${l.saldo} / mínimo ${l.minimo}`,
        })),
      };
      const result = await dispatchCommand(atual => ({
        type: OPERATIONAL_COMMAND.PURCHASE_REQUEST_SAVED,
        idempotencyKey: `reposicao-${id}-${uid()}`, expectedVersion: 0,
        actorId: currentUser?.id || "", actorName: currentUser?.nome || "",
        payload: { request: { ...request, numero: `SC-${String((atual.solicitacoesCompra || []).length + 1).padStart(4, "0")}` } },
      }));
      if (result?.ok) geradas++;
      else showToast?.(result?.reason || `Não foi possível gerar a solicitação de reposição da obra selecionada.`, "error");
    }
    if (geradas) {
      await update({ ...data, changeLog: [...(data.changeLog || []), { id: uid(), date: today(), type: "reposicao_estoque",
        message: `Reposição automática: ${geradas} solicitação(ões) gerada(s) com ${abaixoMin.length} material(is) abaixo do mínimo` }] });
      showToast(`${geradas} solicitação(ões) de reposição enviada(s) ao setor de Compras.`);
    }
  };

  const matPorId = useCallback(
    (id) => materiais.find(m => m.id === id),
    [materiais]
  );

  //  Saldo da obra selecionada 
  const linhasSaldo = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return materiais
      .map(m => ({
        m,
        saldo: saldoDe(saldos, obraAtual, m.id),
        critico: saldoDe(saldos, obraAtual, m.id) < Number(m.estoqueMin || 0),
      }))
      .filter(l => l.saldo !== 0 || l.critico)   // material nunca usado não polui a lista
      .filter(l => !termo ||
        l.m.descricao.toLowerCase().includes(termo) ||
        String(l.m.codigo).toLowerCase().includes(termo))
      .sort((a, b) => (b.critico ? 1 : 0) - (a.critico ? 1 : 0) ||
                      a.m.descricao.localeCompare(b.m.descricao));
  }, [materiais, saldos, obraAtual, busca]);

  const criticos = useMemo(
    () => linhasSaldo.filter(l => l.critico).length,
    [linhasSaldo]
  );

  const valorEmObra = useMemo(
    () => linhasSaldo.reduce((s, l) => s + l.saldo * Number(l.m.precoMedio || 0), 0),
    [linhasSaldo]
  );

  const abc = useMemo(
    () => calcCurvaABC((data.movEstoque||[]).filter(x => !obraAtual || x.obraId === obraAtual), materiais),
    [data.movEstoque, materiais, obraAtual]
  );

  // Curva ABC por composição/serviço executado (consumo agrupado por servicoId).
  const [abcModo, setAbcModo] = useState("insumo");   // insumo | composicao
  const abcServicos = useMemo(
    () => calcCurvaABCServicos((data.movEstoque||[]).filter(x => !obraAtual || x.obraId === obraAtual), data.composicoes),
    [data.movEstoque, data.composicoes, obraAtual]
  );

  const movs = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return (data.movEstoque||[])
      .filter(x => !["cancelado","cancelada","estornado","estornada"].includes(String(x.status||"").toLowerCase()))
      .filter(x => !obraAtual || x.obraId === obraAtual)
      .filter(x => !termo || (matPorId(x.materialId)?.descricao || "").toLowerCase().includes(termo))
      .sort((a,b) => (b.data||"").localeCompare(a.data||""))
      .slice(0, 120);
  }, [data.movEstoque, obraAtual, busca, matPorId]);

  //  Material 
  const salvarMaterial = async (form) => {
    if (!form.descricao.trim()) { showToast("Descreva o material.", "error"); return; }
    const p = {
      id: form.id || uid(),
      codigo: form.id?form.codigo:proximoCodigoArcd(data),
      descricao: form.descricao.trim(),
      unidade: form.unidade || "un",
      categoria: form.categoria || "outros",
      estoqueMin: Number(form.estoqueMin || 0),
      precoMedio: Number(form.precoMedio || 0),
      ativo: true,
    };
    if(!dispatchCommand){const result=await update({
      ...data,
      materiais: form.id
        ? (data.materiais||[]).map(m => m.id === form.id ? p : m)
        : [...(data.materiais||[]), p],
    });if(result?.ok===false){showToast(result.reason||"O insumo não foi confirmado pelo servidor.","error");return;}}
    else {const result=await dispatchCommand(atual=>{const vigente=(atual.materiais||[]).find(m=>m.id===p.id);return {type:OPERATIONAL_COMMAND.MATERIAL_SAVED,idempotencyKey:`insumo-${p.id}-${uid()}`,expectedVersion:Number(vigente?.version||0),actorId:currentUser?.id||"",actorName:currentUser?.nome||"",payload:{material:p}};});if(!result?.ok){showToast(result?.reason||"O insumo não foi confirmado pelo servidor.","error");return;}}
    setMatModal(null);
    showToast(form.id ? "Insumo atualizado." : "Insumo cadastrado.");
  };

  //  Movimento avulso
  const salvarMov = async (form) => {
    if (!form.materialId)      { showToast("Selecione o material.", "error"); return; }
    if (!form.obraId)          { showToast("Selecione a obra.", "error"); return; }
    if (Number(form.qtd) <= 0) { showToast("A quantidade precisa ser maior que zero.", "error"); return; }
    if (!dispatchCommand)      { showToast("Registrar um movimento de estoque exige conexão com o servidor.", "error"); return; }

    // Saída não pode deixar saldo negativo - estoque negativo é sintoma de
    // lançamento errado, e uma vez negativo contamina todos os relatórios.
    // (o servidor confere de novo contra o saldo mais recente antes de aceitar.)
    const sinal = SINAL_MOV[form.tipo] ?? 0;
    if (sinal < 0) {
      const disp = saldoDe(saldos, form.obraId, form.materialId);
      if (Number(form.qtd) > disp + 0.0001) {
        showToast(`Saldo insuficiente: há ${disp.toFixed(2)} disponível.`, "error");
        return;
      }
    }

    const result = await dispatchCommand({
      type: STOCK_COMMAND.MATERIAL_MOVEMENT_RECORDED,
      idempotencyKey: `movimento-${uid()}`,
      actorId: currentUser?.id || "", actorName: currentUser?.nome || "",
      payload: { movement: {
        id: uid(), obraId: form.obraId, materialId: form.materialId, tipo: form.tipo,
        qtd: Number(form.qtd), valorUnit: Number(form.valorUnit || 0),
        data: form.data || new Date().toISOString().slice(0,10),
        descricao: form.descricao || "", etapa: form.etapa || "",
      } },
    });
    if (!result?.ok) { showToast(result?.reason || "Não foi possível registrar o movimento.", "error"); return; }
    setMovModal(null);
    showToast("Movimento registrado.");
  };

  const excluirMov = async (id) => {
    const motivo=window.prompt("Motivo do estorno do movimento de estoque:");
    if(!String(motivo||"").trim())return;
    if(!dispatchCommand){showToast("Estornar um movimento de estoque exige conexão com o servidor.","error");return;}
    const result=await dispatchCommand({
      type: STOCK_COMMAND.MATERIAL_MOVEMENT_REVERSED,
      idempotencyKey: `estorno-mov-${id}-${uid()}`,
      actorId: currentUser?.id || "", actorName: currentUser?.nome || "",
      payload: { movementId: id, reason: String(motivo).trim() },
    });
    if(!result?.ok){showToast(result?.reason||"Não foi possível estornar o movimento.","error");return;}
    showToast("Movimento estornado e preservado para auditoria. O saldo foi recalculado.");
  };

  //  Composição
  const salvarComposicao = async (form) => {
    if (!form.nome.trim()) { showToast("Dê um nome ao serviço.", "error"); return; }
    const itens = (form.itens||[]).filter(i => i.materialId && Number(i.coef) > 0)
      .map(i => ({ materialId: i.materialId, coef: Number(i.coef) }));
    if (!itens.length) { showToast("Adicione ao menos um insumo com coeficiente.", "error"); return; }
    if (!dispatchCommand) { showToast("Salvar uma composição exige conexão com o servidor.", "error"); return; }

    const id = form.id || uid();
    const result = await dispatchCommand(atual => {
      const vigente = (atual.composicoes||[]).find(c => c.id === id);
      return {
        type: STOCK_COMMAND.COMPOSITION_SAVED,
        idempotencyKey: `composicao-${id}-${uid()}`,
        expectedVersion: Number(vigente?.version || 0),
        actorId: currentUser?.id || "", actorName: currentUser?.nome || "",
        payload: { composition: {
          id, codigo: form.id ? (form.codigo || proximoCodigoArcd(data)) : proximoCodigoArcd(data),
          nome: form.nome.trim(), unidade: form.unidade || "m2", itens,
        } },
      };
    });
    if (!result?.ok) { showToast(result?.reason || "Não foi possível salvar a composição.", "error"); return; }
    setCompModal(null);
    showToast(form.id ? "Composição atualizada." : "Composição criada.");
  };

  const excluirComposicao = async (id) => {
    if (!window.confirm("Excluir esta composição?")) return;
    if(!dispatchCommand){showToast("Excluir uma composição exige conexão com o servidor.","error");return;}
    const atual=(data.composicoes||[]).find(c=>c.id===id);
    const result = await dispatchCommand({
      type: STOCK_COMMAND.COMPOSITION_DELETED,
      idempotencyKey: `composicao-exclusao-${id}-${uid()}`,
      expectedVersion: Number(atual?.version || 0),
      actorId: currentUser?.id || "", actorName: currentUser?.nome || "",
      payload: { compositionId: id },
    });
    if(!result?.ok){showToast(result?.reason||"Não foi possível excluir a composição.","error");return;}
    showToast("Composição excluída.");
  };

  //  Executar serviço → baixa automática
  const executarServico = async (compId, obraId, qtdExec, dataExec, etapa) => {
    const comp = (data.composicoes||[]).find(c => c.id === compId);
    if (!comp) { showToast("Composição não encontrada.", "error"); return; }
    if (Number(qtdExec) <= 0) { showToast("Informe a quantidade executada.", "error"); return; }
    if (!obraId) { showToast("Selecione a obra.", "error"); return; }
    if (!dispatchCommand) { showToast("Executar um serviço exige conexão com o servidor.", "error"); return; }

    const baixas = baixarPorComposicao(comp, qtdExec);

    // Confere TODOS antes de baixar QUALQUER um. Baixar metade e travar no
    // meio deixaria o estoque num estado inconsistente. (o servidor confere
    // de novo contra o saldo mais recente antes de aceitar o comando.)
    const faltando = baixas
      .map(b => ({ ...b, disp: saldoDe(saldos, obraId, b.materialId), mat: matPorId(b.materialId) }))
      .filter(b => b.qtd > b.disp + 0.0001);

    if (faltando.length) {
      const lista = faltando
        .map(f => `- ${f.mat?.descricao || "?"}: precisa ${f.qtd}, tem ${f.disp.toFixed(2)}`)
        .join("\n");
      showToast("Saldo insuficiente. Veja o detalhe.", "error");
      window.alert(`Não dá para baixar ${qtdExec} ${comp.unidade} de "${comp.nome}".\n\nFalta:\n${lista}`);
      return;
    }

    const quando = dataExec || new Date().toISOString().slice(0,10);
    // Valoracao do consumo. Sem precoMedio cadastrado o movimento sairia
    // valendo ZERO - e o servico sumiria da curva ABC como se nao tivesse
    // custado nada. Por isso caimos no ultimo preco efetivamente pago.
    const valorarMaterial = (materialId) => {
      const pm = Number(matPorId(materialId)?.precoMedio || 0);
      if (pm > 0) return pm;
      const h = historicoPreco(data.pedidos, materialId);
      return h.length ? Number(h[0].preco || 0) : 0;
    };
    const entries = baixas.map(b => ({
      id: uid(), materialId: b.materialId, qtd: b.qtd,
      valorUnit: valorarMaterial(b.materialId), data: quando,
      descricao: `${qtdExec} ${comp.unidade} de ${comp.nome}`, etapa: etapa || "",
    }));

    const result = await dispatchCommand({
      type: STOCK_COMMAND.SERVICE_EXECUTION_RECORDED,
      idempotencyKey: `execucao-${comp.id}-${uid()}`,
      actorId: currentUser?.id || "", actorName: currentUser?.nome || "",
      payload: { compositionId: comp.id, obraId, qtdExecutada: Number(qtdExec), entries },
    });
    if (!result?.ok) { showToast(result?.reason || "Não foi possível executar o serviço.", "error"); return; }
    setSrvModal(false);
    showToast(`${entries.length} insumo(s) baixado(s) automaticamente.`);
  };

  const nomeObra = (id) => obras.find(o => o.id === id)?.name || "-";

  return (
    <div className="anim" style={{display:"flex",flexDirection:"column",gap:12}}>
      <PageHero eyebrow="Materiais e insumos" title="Estoque" description="Controle físico dos materiais por obra, com alerta de reposição abaixo do mínimo."/>

      {/* Aviso de regime - o motivo de o estoque não mexer no DRE */}
      <div style={{background:`${C.blue}0A`,border:`1px solid ${C.blue}44`,borderRadius:6,padding:"9px 11px"}}>
        <p style={{fontSize:10.5,color:C.subtle,lineHeight:1.55}}>
          <strong style={{color:C.blue}}>Controle físico.</strong> O custo do material já entra no DRE
          pela Conciliação, no momento da compra. O estoque não lança nada de novo - se lançasse,
          o mesmo material contaria duas vezes.
        </p>
      </div>

      {obraIdFixo
        ? <Inp label="Obra" value={obras.find(o=>o.id===obraIdFixo)?.name||"Obra atual"} onChange={()=>{}} disabled/>
        : <Sel label="Obra" value={obraAtual} onChange={setObraSel}
            options={obras.map(o => ({ v:o.id, l:o.name }))}/>}

      {/* Reposicao automatica: o minimo deixou de ser cosmetico */}
      {abaixoMin.length>0&&(
        <div style={{background:`${C.orange}0C`,border:`1.5px solid ${C.orange}`,borderRadius:6,padding:"10px 12px"}}>
          <p style={{fontSize:11.5,fontWeight:900,color:C.orange}}>
            {abaixoMin.length} MATERIAL(IS) ABAIXO DO ESTOQUE MÍNIMO
          </p>
          <div style={{marginTop:5,maxHeight:96,overflow:"auto"}}>
            {abaixoMin.slice(0,8).map((l,ix)=>(
              <p key={ix} style={{fontSize:10,color:C.muted,marginTop:2}}>
                <b style={{color:C.text}}>{l.obraNome}</b> · {l.descricao} — saldo {l.saldo.toLocaleString("pt-BR")} de {l.minimo.toLocaleString("pt-BR")} {l.unidade}
                <b style={{color:C.orange}}> · repor {l.deficit.toLocaleString("pt-BR")}</b>
              </p>
            ))}
            {abaixoMin.length>8&&<p style={{fontSize:9.5,color:C.subtle,marginTop:3}}>e mais {abaixoMin.length-8} item(ns)...</p>}
          </div>
          <div style={{marginTop:8}}>
            <Btn size="sm" v="warning" onClick={gerarReposicao} full>
              <Ic n="cart"/> GERAR SOLICITAÇÃO DE REPOSIÇÃO
            </Btn>
          </div>
          <p style={{fontSize:9.5,color:C.subtle,marginTop:5,lineHeight:1.4}}>
            Uma solicitação por obra, com o déficit já calculado. O setor de Compras recebe o alerta imediatamente.
          </p>
        </div>
      )}

      {/* KPIs */}
      <div style={{display:"grid",gridTemplateColumns:cols(2,3,3),gap:8}}>
        {[
          ["Itens em estoque", String(linhasSaldo.filter(l=>l.saldo>0).length), C.text],
          ["Abaixo do mínimo", String(criticos), criticos ? C.red : C.green],
          ["Valor na obra",    fmt(valorEmObra), C.yellow],
        ].map(([l,v,c])=>(
          <div key={l} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:6,padding:"9px 11px"}}>
            <p style={{fontSize:9,color:C.muted,textTransform:"uppercase",fontWeight:700,letterSpacing:.5}}>{l}</p>
            <p style={{fontFamily:"'Inter Display','Inter',sans-serif",fontSize:"clamp(14px,4vw,17px)",
                       fontWeight:800,color:c,marginTop:2}}>{v}</p>
          </div>
        ))}
      </div>

      <div style={{display:"grid",gridTemplateColumns:formGrid(2),gap:8}}>
        <Btn onClick={()=>setSrvModal(true)} full><Ic n="check"/> Executei um serviço</Btn>
        <Btn v="ghost" onClick={()=>setMovModal({tipo:"entrada",obraId:obraAtual,materialId:"",qtd:"",valorUnit:"",data:new Date().toISOString().slice(0,10),descricao:"",etapa:""})} full>
          <Ic n="plus"/> Movimento avulso
        </Btn>
      </div>

      {/* Abas */}
      <TabRow equal tabs={[["saldo","Saldo"],["movs","Movimentos"],["materiais","Insumos"],["comp","Composições"],["abc","Curva ABC"]]} active={aba} onChange={setAba}/>

      <Inp value={busca} onChange={setBusca} placeholder="Buscar insumo..."/>

      {/*  SALDO  */}
      {aba === "saldo" && (
        linhasSaldo.length === 0
          ? <p style={{fontSize:12,color:C.muted,textAlign:"center",padding:20}}>
              Nenhum material com saldo nesta obra. Registre uma entrada.
            </p>
          : linhasSaldo.map(({m, saldo, critico}) => (
            <div key={m.id} style={{
              background:C.card, border:`1px solid ${critico ? C.red : C.border}`,
              borderLeft:`3px solid ${critico ? C.red : C.green}`,
              borderRadius:6, padding:"10px 12px",
            }}>
              <div className="fluid-grid" style={{display:"grid",gridTemplateColumns:"1fr auto",gap:8,alignItems:"center"}}>
                <div style={{minWidth:0}}>
                  <p className="brk" style={{fontSize:12.5,fontWeight:700,color:C.text}}>{m.descricao}</p>
                  <p style={{fontSize:10,color:C.muted,marginTop:2}}>
                    {m.codigo && `${m.codigo}  `}mín. {m.estoqueMin} {m.unidade}
                    {Number(m.precoMedio)>0 && `  ${fmt(m.precoMedio)}/${m.unidade}`}
                  </p>
                </div>
                <div style={{textAlign:"right",flexShrink:0}}>
                  <p style={{fontFamily:"'Inter Display','Inter',sans-serif",fontSize:15,fontWeight:800,
                             color: critico ? C.red : C.text, whiteSpace:"nowrap"}}>
                    {saldo.toFixed(2)} <span style={{fontSize:10,color:C.muted}}>{m.unidade}</span>
                  </p>
                  {critico && (
                    <p style={{fontSize:9,fontWeight:800,color:C.red,marginTop:1}}>! REPOR</p>
                  )}
                </div>
              </div>
            </div>
          ))
      )}

      {/*  MOVIMENTOS  */}
      {aba === "movs" && (
        movs.length === 0
          ? <p style={{fontSize:12,color:C.muted,textAlign:"center",padding:20}}>Nenhum movimento.</p>
          : movs.map(x => {
            const t = TIPOS_MOV.find(t => t.v === x.tipo) || TIPOS_MOV[0];
            const m = matPorId(x.materialId);
            return (
              <div key={x.id} style={{
                background:C.card, border:`1px solid ${C.border}`,
                borderLeft:`3px solid ${t.cor}`, borderRadius:6, padding:"9px 11px",
              }}>
                <div className="fluid-grid" style={{display:"grid",gridTemplateColumns:"1fr auto",gap:8}}>
                  <div style={{minWidth:0}}>
                    <p className="brk" style={{fontSize:12,fontWeight:700,color:C.text}}>{m?.descricao || "-"}</p>
                    <p style={{fontSize:10,color:C.muted,marginTop:2}}>
                      {t.l}  {fmtDate(x.data)}
                      {x.servicoId && "  baixa automática"}
                    </p>
                    {x.descricao && (
                      <p className="brk" style={{fontSize:10,color:C.subtle,marginTop:2}}>{x.descricao}</p>
                    )}
                  </div>
                  <div style={{textAlign:"right",flexShrink:0}}>
                    <p style={{fontSize:13,fontWeight:800,color:t.cor,whiteSpace:"nowrap"}}>
                      {t.sinal > 0 ? "+" : ""} {x.qtd} {m?.unidade}
                    </p>
                    <button onClick={()=>excluirMov(x.id)} style={{
                      background:"transparent",border:0,color:C.muted,fontSize:10,
                      cursor:"pointer",marginTop:3,textDecoration:"underline",
                    }}>excluir</button>
                  </div>
                </div>
              </div>
            );
          })
      )}

      {/*  INSUMOS  */}
      {aba === "materiais" && (<>
        <Btn v="ghost" onClick={()=>setMatModal({id:"",codigo:proximoCodigoArcd(data),descricao:"",unidade:"un",
          categoria:"estrutural",estoqueMin:"",precoMedio:""})} full>
          <Ic n="plus"/> Novo insumo
        </Btn>
        {materiais
          .filter(m => !busca.trim() || m.descricao.toLowerCase().includes(busca.toLowerCase()))
          .map(m => (
          <div key={m.id} onClick={()=>setMatModal({...m, estoqueMin:String(m.estoqueMin), precoMedio:String(m.precoMedio)})}
            style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:6,
                    padding:"9px 11px",cursor:"pointer"}}>
            <p className="brk" style={{fontSize:12.5,fontWeight:700,color:C.text}}>{m.descricao}</p>
            <p style={{fontSize:10,color:C.muted,marginTop:2}}>
              {m.codigo && `${m.codigo}  `}{m.unidade}  mín. {m.estoqueMin}
              {Number(m.precoMedio)>0 && `  ${fmt(m.precoMedio)}`}
            </p>
          </div>
        ))}
      </>)}

      {/*  COMPOSIÇÕES  */}
      {aba === "comp" && (<>
        <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:6,padding:"10px 12px"}}>
          <p style={{fontSize:11,color:C.muted,lineHeight:1.55}}>
            Cadastre <strong style={{color:C.text}}>uma vez</strong> quanto cada serviço consome por unidade.
            Depois é só informar quanto foi executado - o estoque baixa sozinho.
            <br/><br/>
            A base SINAPI que importamos traz <em>preços</em>, não os coeficientes de composição.
            Por isso estes números vêm de você.
          </p>
        </div>
        <Btn v="ghost" onClick={()=>setCompModal({id:"",codigo:proximoCodigoArcd(data),nome:"",unidade:"m2",itens:[{materialId:"",coef:""}]})} full>
          <Ic n="plus"/> Nova composição
        </Btn>
        {(data.composicoes||[]).map(c => (
          <div key={c.id} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:6,padding:"10px 12px"}}>
            <div style={{display:"flex",justifyContent:"space-between",gap:8,alignItems:"flex-start"}}>
              <div style={{minWidth:0,flex:1}}>
                <p className="brk" style={{fontSize:12.5,fontWeight:700,color:C.text}}>{c.codigo} · {c.nome}</p>
                <p style={{fontSize:10,color:C.muted,marginTop:1}}>por 1 {c.unidade}</p>
              </div>
              <div style={{display:"flex",gap:4,flexShrink:0}}>
                <Btn size="sm" v="ghost" onClick={()=>setCompModal({...c, itens: c.itens.map(i=>({...i,coef:String(i.coef)}))})}></Btn>
                <Btn size="sm" v="danger" onClick={()=>excluirComposicao(c.id)}>x</Btn>
              </div>
            </div>
            <div style={{marginTop:7,paddingTop:7,borderTop:`1px solid ${C.line}`}}>
              {c.itens.map((i,k) => {
                const m = matPorId(i.materialId);
                return (
                  <div key={k} style={{display:"flex",justifyContent:"space-between",fontSize:10.5,color:C.muted,marginTop:2}}>
                    <span className="brk">{m?.descricao || "-"}</span>
                    <span style={{fontWeight:700,color:C.text,whiteSpace:"nowrap",marginLeft:8}}>
                      {i.coef} {m?.unidade}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </>)}

      {/*  CURVA ABC  */}
      {aba === "abc" && (()=>{
        const lista = abcModo==="composicao" ? abcServicos : abc;
        return (<>
          {/* O consumo de estoque só registra INSUMO. O serviço é remontado
              agrupando os consumos pelo servicoId que eles carregam. */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
            {[["insumo","Por insumo"],["composicao","Por composição"]].map(([v,l])=>(
              <button key={v} onClick={()=>setAbcModo(v)} style={{
                padding:"8px 6px",borderRadius:6,cursor:"pointer",
                border:`2px solid ${abcModo===v?C.yellow:C.border}`,
                background:abcModo===v?`${C.yellow}12`:"transparent",
                color:abcModo===v?C.text:C.muted,
                fontFamily:"'Inter Display','Inter',sans-serif",fontWeight:800,fontSize:11.5,
              }}>{l}</button>
            ))}
          </div>

          <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:6,padding:"10px 12px"}}>
            <p style={{fontSize:11,color:C.muted,lineHeight:1.5}}>
              <strong style={{color:C.text}}>A</strong> = os poucos que valem 80% do gasto - controle rigoroso.
              <strong style={{color:C.text}}> B</strong> = 15%. <strong style={{color:C.text}}>C</strong> = os muitos que
              valem 5% - não vale a pena vigiar.
            </p>
            <p style={{fontSize:10,color:C.subtle,lineHeight:1.5,marginTop:6}}>
              {abcModo==="composicao"
                ? "Serviços executados, com o material que cada um consumiu. Executar um serviço baixa os insumos da composição - aqui eles voltam a ser somados sob o serviço que os consumiu."
                : "Insumos consumidos na obra. Um serviço não aparece aqui: ele se dissolve nos insumos que baixou. Para vê-lo inteiro, use Por composição."}
            </p>
          </div>

          {lista.length===0
            ? <p style={{fontSize:12,color:C.muted,textAlign:"center",padding:20,lineHeight:1.6}}>
                {abcModo==="composicao"
                  ? <>Nenhum serviço executado ainda.<br/>Use <strong>Executar serviço</strong> para baixar uma composição - ela passa a aparecer aqui.</>
                  : "Sem consumo registrado ainda."}
              </p>
            : lista.map(x => {
              const cor = x.classe === "A" ? C.red : x.classe === "B" ? C.orange : C.muted;
              return (
                <div key={x.id} style={{background:C.card,border:`1px solid ${C.border}`,
                                        borderLeft:`3px solid ${cor}`,borderRadius:6,padding:"9px 11px"}}>
                  <div className="fluid-grid" style={{display:"grid",gridTemplateColumns:"auto 1fr auto",gap:8,alignItems:"center"}}>
                    <span style={{width:22,height:22,borderRadius:5,background:`${cor}18`,color:cor,
                                  display:"flex",alignItems:"center",justifyContent:"center",
                                  fontWeight:900,fontSize:11,flexShrink:0}}>{x.classe}</span>
                    <div style={{minWidth:0}}>
                      <p className="brk" style={{fontSize:12,fontWeight:600,color:x.avulso?C.muted:C.text}}>{x.nome}</p>
                      {abcModo==="composicao"&&!x.avulso&&x.execucoes>0&&(
                        <p style={{fontSize:9,color:C.muted,marginTop:1}}>{x.execucoes} execução(ões)</p>
                      )}
                    </div>
                    <div style={{textAlign:"right",flexShrink:0}}>
                      <p style={{fontSize:12.5,fontWeight:800,color:C.text,whiteSpace:"nowrap"}}>{fmt(x.valor)}</p>
                      <p style={{fontSize:9,color:C.muted}}>{x.pctAcum.toFixed(0)}% acum.</p>
                    </div>
                  </div>
                </div>
              );
            })}
        </>);
      })()}

      {/*  MODAIS  */}
      {matModal   && <ModalMaterial    form={matModal}  setForm={setMatModal}  onSave={salvarMaterial}
                                 unidades={data.unidades||[]}/>}
      {movModal   && <ModalMovimento   form={movModal}  setForm={setMovModal}  onSave={salvarMov}
                                       obras={obras} materiais={materiais}/>}
      {compModal  && <ModalComposicao  form={compModal} setForm={setCompModal} onSave={salvarComposicao}
                                       materiais={materiais} unidades={data.unidades||[]}/>}
      {srvModal   && <ModalExecutar    onClose={()=>setSrvModal(false)} onRun={executarServico}
                                       composicoes={data.composicoes||[]} obras={obras}
                                       obraAtual={obraAtual} materiais={materiais} saldos={saldos}
                                       nomeObra={nomeObra}/>}
    </div>
  );
}
