// @ts-check
import { useCallback, useEffect, useRef, useState } from "react";
import { adoptServerVersion, loadDataWithMeta, saveDataDetailed } from "../../api.js";
import { UI_TEXT } from "../../design-system/copy.js";
import { createSaveQueue, SAVE_QUEUE_STATE } from "../../domains/sync/save-queue.js";
import { snapshotJournal, recoveryTab, snapshotChanges } from "../../domains/sync/snapshot-journal.js";
import { reconcileOptimisticSnapshot } from "../../domains/sync/optimistic-merge.js";
import { isServerRejection, rejectedSections } from "../../domains/sync/rejected-save.js";

/** @typedef {import("../../domains/sync/snapshot-journal.js").Snapshot} Snapshot */
/** @typedef {import("../../domains/sync/snapshot-journal.js").RecoveryUser} RecoveryUser */
/** @typedef {import("../../domains/sync/snapshot-journal.js").JournalReceipt} JournalReceipt */
/** @typedef {import("../../domains/sync/snapshot-journal.js").JournalContext} JournalContext */
/** @typedef {import("../../domains/sync/snapshot-journal.js").ProtectedEdit} ProtectedEdit */
/** @typedef {{data:Snapshot, updatedAt?:string|null}} ServerSnapshot */
/** @typedef {import("../../domains/sync/save-queue.js").SaveQueueState} SaveQueueState */
/** @typedef {ReturnType<typeof createSaveQueue<Snapshot, JournalContext, JournalReceipt>>} WorkspaceQueue */
/** @typedef {{reason?:string, currentData?:Snapshot, currentUpdatedAt?:string|null, rejectedPayload?:Snapshot}} SaveConflict */
/** @typedef {{motivo:string|Error, secoes:string[], em:Date}} RejectedEdit */
/**
 * @typedef {Snapshot & {
 *   __aguardarFila?:true, __adotarServidor?:true, __adotarServidorPatch?:true,
 *   data?:Snapshot, sections?:Snapshot, updatedAt?:string|null
 * }} WorkspaceUpdate
 */
/**
 * @typedef {{initialData:Snapshot, data:Snapshot, setData:(data:Snapshot)=>void,
 *   currentUser:RecoveryUser, showToast:(message:string, type?:string)=>void,
 *   normalizeData:(data?:Snapshot|null)=>Snapshot, defaultData:()=>Snapshot,
 *   hasPendingAttendance:()=>boolean}} WorkspaceSavingOptions
 */

/** @param {WorkspaceSavingOptions} options */
export function useWorkspaceSaving({initialData,data,setData,currentUser,showToast,normalizeData,defaultData,hasPendingAttendance}) {
  const leavingSessionRef=useRef(false);
  const recoveryUserRef=useRef(currentUser);recoveryUserRef.current=currentUser;
  const [recoveryOpen,setRecoveryOpen]=useState(false);
  const [recoveryAvailable,setRecoveryAvailable]=useState(false);
  const [recoveryInitialization,setRecoveryInitialization]=useState(/** @type {{userId:string|null,ready:boolean}} */ ({userId:null,ready:false}));
  const [recoveryRevision,setRecoveryRevision]=useState(0);
  const recoveryReady=recoveryInitialization.userId===currentUser?.id&&recoveryInitialization.ready;
  const setRecoveryReady=useCallback((/** @type {boolean} */ ready)=>setRecoveryInitialization(previous=>previous.userId===currentUser?.id&&previous.ready===ready?previous:{userId:currentUser?.id,ready}),[currentUser?.id]);
  useEffect(()=>{if(currentUser)leavingSessionRef.current=false;},[currentUser?.id]);
  const [conflito,setConflito]=useState(/** @type {SaveConflict|null} */ (null));
  // Momento da ultima sincronizacao bem-sucedida com o servidor.
  const [ultimaSync,  setUltimaSync]  = useState(()=>new Date());
  const [estadoSalvar,setEstadoSalvar] = useState(/** @type {SaveQueueState} */ (SAVE_QUEUE_STATE.IDLE));
  // Última gravação recusada pelo servidor (desfeita na tela): fica visível até
  // o usuário dispensar, para ninguém achar que salvou o que não salvou.
  const [edicaoRecusada,setEdicaoRecusada] = useState(/** @type {RejectedEdit|null} */ (null));
  const resolvingSaveRef=useRef(false);
  const deferredEditKeysRef=useRef(new Map(/** @type {[string,string][]} */ ([])));
  const memoryEditsRef=useRef(new Map(/** @type {[string,ProtectedEdit][]} */ ([])));
  const protectingEditsRef=useRef(0);
  const [memoryEditCount,setMemoryEditCount]=useState(0);
  const recoveryReadyRef=useRef(recoveryReady);recoveryReadyRef.current=recoveryReady;
  // Última versão que veio do servidor - o ponto de partida das minhas edições.
  // Serve de "base" para o merge de conflito saber o que EU mudei.
  const baseServidorRef = useRef(initialData);
  // Espelho do estado atual, para a auditoria comparar antes/depois sem que o
  // `update` precise depender de `data` (o que o recriaria a cada tecla).
  const dataAtualRef = useRef(initialData);
  useEffect(() => { dataAtualRef.current = data; }, [data]);
  // Estado mais recente aplicado, atualizado SINCRONAMENTE dentro do `update`.
  // Serve para reconciliar salvamentos em sequencia rapida: se dois cadastros
  // sao salvos antes do React re-renderizar, o segundo poderia partir de um
  // `data` velho (do closure) e apagar o primeiro. Comparando com este ref
  // reaplicamos so as secoes que o chamador realmente mudou.
  const ultimoDataRef = useRef(initialData);
  const replaceLocalSnapshot = useCallback((/** @type {Snapshot} */ snapshot) => {
    ultimoDataRef.current = snapshot;
    dataAtualRef.current = snapshot;
    setData(snapshot);
  }, [setData]);

  // FILA DE SALVAMENTO SERIALIZADA
  // Antes, cada update() disparava um save de rede imediato. Toques rapidos no
  // ponto criavam varios saves simultaneos com o MESMO expectedUpdatedAt - o
  // servidor aceitava o primeiro e devolvia 409 para os demais: o app
  // conflitava consigo mesmo e "nao salvava". Agora existe no maximo 1 save em
  // voo; estados novos apenas substituem o proximo a enviar (coalescencia).
  // Como o estado local ja acumula tudo, salvar so o mais recente nao perde nada.
  const saveQueueRef=useRef(/** @type {WorkspaceQueue|null} */ (null));
  if(!saveQueueRef.current){
    saveQueueRef.current=createSaveQueue({
      capture:()=>({user:recoveryUserRef.current,tab:recoveryTab(),base:baseServidorRef.current}),
      protect:(intended,context)=>snapshotJournal.protect({.../** @type {JournalContext} */ (context),intended}),
      release:receipt=>snapshotJournal.release(receipt),
      onStorageError:()=>showToast("Confirmação recebida, mas a recuperação local não foi limpa. Consulte a versão atual antes de reenviar.","error"),
      save:(alvo,tentativa)=>saveDataDetailed(alvo,baseServidorRef.current,tentativa),
      onState:setEstadoSalvar,
      onSuccess:({result, target})=>{
        const confirmado=normalizeData(result.merged&&result.data?result.data:target);
        baseServidorRef.current=confirmado;
        if(result.merged){
          // Uma resposta mesclada confirma `target`, mas pode chegar depois de
          // outro clique já ter produzido um snapshot local mais novo. Reaplica
          // essa intenção pendente sobre a nova base para a tela não "voltar"
          // e esconder uma edição que a fila ainda vai enviar.
          const localMaisNovo=ultimoDataRef.current||dataAtualRef.current||target;
          const rebaseado=normalizeData(reconcileOptimisticSnapshot({
            latest:confirmado,rendered:target,intended:localMaisNovo,
          }));
          replaceLocalSnapshot(rebaseado);
          showToast("Alterações simultâneas foram combinadas automaticamente.");
        }
        setUltimaSync(new Date());
      },
      onConflict:()=>showToast("Alterações não salvas. Confira o aviso na página.","error"),
      onRetry:({result,delay})=>showToast(`${result?.reason||"Não foi possível conectar ao servidor."} Nova tentativa em ${Math.round(delay/1000)}s.`,"error"),
      onFailed:({result,offline,pending})=>{
        if(isServerRejection({result,offline})&&baseServidorRef.current){
          // O servidor recusou (permissão/regra): desfaz a edição otimista,
          // voltando ao último estado confirmado. Roda depois que a fila
          // devolve {ok:false} a quem chamou update(), para não confirmar
          // como salvo o que foi recusado.
          const confirmado=baseServidorRef.current;
          const secoes=rejectedSections(confirmado,pending);
          setTimeout(()=>{
            saveQueueRef.current?.discard({keepJournal:true});
            replaceLocalSnapshot(confirmado);
            setEdicaoRecusada({motivo:result?.reason||/** @type {string|Error|undefined} */ (result?.error)||"O servidor recusou a alteração.",secoes,em:new Date()});
          },0);
          showToast(`Alteração não salva e desfeita: ${result?.reason||"recusada pelo servidor"}`,"error");
          return;
        }
        showToast("Alterações não salvas. Confira o aviso na página.","error");
      },
    });
  }
  // Os eventos de edição só estão disponíveis enquanto o workspace está montado.
  const activeQueue = () => /** @type {WorkspaceQueue} */ (saveQueueRef.current);
  // Zera a ref (não só destrói) para que uma remontagem real - ou a
  // montagem dupla do StrictMode em desenvolvimento - recrie a fila em vez
  // de reaproveitar a instância já destruída (`if(!saveQueueRef.current)`
  // acima nunca seria verdadeiro de outra forma, e todo update() passaria a
  // falhar silenciosamente com {ok:false,destroyed:true} para sempre).
  useEffect(()=>()=>{saveQueueRef.current?.destroy?.();saveQueueRef.current=null;},[]);

  useEffect(()=>{
    const retomar=()=>{
      if(saveQueueRef.current?.getState()!==SAVE_QUEUE_STATE.OFFLINE)return;
      showToast("Conexão restaurada. Retomando alterações pendentes.");
      saveQueueRef.current.resume();
    };
    window.addEventListener("online",retomar);
    return()=>window.removeEventListener("online",retomar);
  },[showToast]);

  useEffect(()=>{
    const protegerSaida=(/** @type {BeforeUnloadEvent} */ event)=>{
      if(!saveQueueRef.current?.hasPending()&&!protectingEditsRef.current&&!memoryEditsRef.current.size&&!hasPendingAttendance()&&(recoveryReadyRef.current||!document.querySelector('.arcd-modal-panel input:not([readonly]):not(:disabled),.arcd-modal-panel textarea:not([readonly]):not(:disabled)')))return;
      event.preventDefault();
      event.returnValue="";
    };
    window.addEventListener("beforeunload",protegerSaida);
    return()=>window.removeEventListener("beforeunload",protegerSaida);
  },[]);

  const update = useCallback(async (/** @type {WorkspaceUpdate|((current:Snapshot)=>WorkspaceUpdate)} */ next) => {
    if(leavingSessionRef.current||currentUser?.id!==recoveryUserRef.current?.id)return {ok:false,reason:"A conta da edição mudou. Entre com a conta original para conferir."};
    // Aceita atualização funcional. O resolvedor recebe sempre o espelho mais
    // recente, mesmo que o React ainda não tenha renderizado o clique anterior.
    // Isso elimina a dependência de closures antigos nos fluxos migrados.
    let rendered=data||dataAtualRef.current||defaultData();
    if(typeof next==="function"){
      rendered=dataAtualRef.current||rendered;
      next=next(rendered);
    }
    if(next&&next.__aguardarFila){
      return saveQueueRef.current?.waitForIdle()||{ok:true,state:SAVE_QUEUE_STATE.IDLE};
    }
    // ADOTAR ESTADO DO SERVIDOR (sem re-salvar)
    // Operacoes cirurgicas como arquivar/restaurar quinzena acontecem no
    // servidor e ja voltam com o dataset novo + carimbo. Aqui apenas
    // adotamos essa versao como base - re-salvar seria redundante e
    // reabriria a janela de conflito.
    if (next && next.__adotarServidor) {
      const norm = normalizeData(next.data);
      adoptServerVersion(next.updatedAt);
      baseServidorRef.current = norm;
      replaceLocalSnapshot(norm);
      setUltimaSync(new Date());
      return;
    }
    // Respostas de comandos granulares trazem somente as seções confirmadas.
    // Mesclá-las diretamente evita baixar e normalizar todo o cadastro após
    // cada PIX, sem alterar a fotografia autoritativa das demais seções.
    if (next && next.__adotarServidorPatch) {
      const sections=next.sections&&typeof next.sections==="object"?next.sections:{};
      const atual={...(dataAtualRef.current||defaultData()),...sections};
      const base={...(baseServidorRef.current||dataAtualRef.current||defaultData()),...sections};
      adoptServerVersion(next.updatedAt);
      baseServidorRef.current=base;
      replaceLocalSnapshot(atual);
      setUltimaSync(new Date());
      return;
    }

    if(!recoveryReady){setRecoveryOpen(true);return {ok:false,reason:"Confira o armazenamento antes de enviar a edição."};}
    const queueState=saveQueueRef.current?.getState();
    if((recoveryAvailable&&!saveQueueRef.current?.hasPending())||queueState===SAVE_QUEUE_STATE.FAILED||queueState===SAVE_QUEUE_STATE.CONFLICT||queueState===SAVE_QUEUE_STATE.OFFLINE){
      const editorId=document.activeElement?.closest('[data-recovery-editor]')?.getAttribute('data-recovery-editor')||'workspace';
      const changes=snapshotChanges(rendered,next);
      const identity=JSON.stringify([currentUser.id,editorId,Object.entries(changes).map(([key,c])=>[key,c.delta?[...c.delta.changed.map(r=>String(r.id)),...c.delta.removed.map(String)].sort():null])]);
      let id=deferredEditKeysRef.current.get(identity);if(!id){id=crypto.randomUUID();deferredEditKeysRef.current.set(identity,id);}
      const entry={user:currentUser,tab:`${recoveryTab()}:edit:${id}`,base:rendered,intended:normalizeData(next)};
      memoryEditsRef.current.set(id,entry);setMemoryEditCount(memoryEditsRef.current.size);protectingEditsRef.current++;
      try{
        await snapshotJournal.protect(entry);
        if(memoryEditsRef.current.get(id)===entry)memoryEditsRef.current.delete(id);
        setRecoveryOpen(true);return {ok:false,deferred:true,reason:"Preenchimento protegido separadamente. Conclua as revisões em Resolver salvamento."};
      }catch{setRecoveryOpen(true);return {ok:false,reason:"A nova edição está apenas na memória. Proteja ou descarte antes de continuar."};}
      finally{protectingEditsRef.current--;setMemoryEditCount(memoryEditsRef.current.size);}
    }
    // RECONCILIAÇÃO CONTRA O ESTADO MAIS RECENTE
    // `rendered` é exatamente a fotografia usada pelo handler do clique.
    // `ultimoDataRef` pode já conter outro cadastro ainda não renderizado.
    // A mescla de três vias aplica só a intenção do clique e conserva tanto
    // alterações de outros módulos quanto dois cadastros rápidos na mesma lista.
    let base=next;
    try{
      base=reconcileOptimisticSnapshot({
        latest:ultimoDataRef.current||rendered,
        rendered,
        intended:next,
      });
    }catch(e){console.error("optimistic-reconcile",e);base=next;}

    // O histórico auditável é criado exclusivamente no servidor, na mesma
    // transação da mutação. O cliente nunca fabrica nem substitui auditoria.
    const normalized = normalizeData(base);
    replaceLocalSnapshot(normalized);

    // Enfileira: se ja ha um save em voo, este estado apenas substitui o
    // proximo a enviar. Nunca ha dois saves simultaneos - fim dos 409 do
    // proprio dispositivo contra si mesmo.
    return activeQueue().enqueue(normalized);
  }, [data,defaultData,normalizeData,replaceLocalSnapshot,showToast,recoveryAvailable,recoveryReady,currentUser?.id]);

  //  Conflito de gravação
  // Tudo vive num único JSON, então DUAS pessoas mexendo em módulos
  // DIFERENTES colidem: quem salvar depois é recusado. Antes isso virava um
  // alert() e o trabalho evaporava - imagine perder o ponto de 40 pessoas
  // porque o financeiro conciliou uma transação 30 segundos antes.
  //
  // Agora seguramos o que você tentou salvar e oferecemos reaplicar sobre a
  // versão nova do servidor.
  useEffect(() => {
    const aoConflitar = (/** @type {Event} */ e) => setConflito(/** @type {CustomEvent<SaveConflict>} */ (e).detail || null);
    window.addEventListener("arcd:data-conflict", aoConflitar);
    return () => window.removeEventListener("arcd:data-conflict", aoConflitar);
  }, []);

  /** @param {ServerSnapshot} current @param {JournalReceipt} row */
  const concluirRecuperacao=async(current,row)=>{
    if(resolvingSaveRef.current||protectingEditsRef.current||memoryEditsRef.current.size||activeQueue().hasPending())return {ok:false,reason:'Há outro preenchimento ou envio pendente. A edição continua protegida; conclua essa revisão primeiro.'};
    resolvingSaveRef.current=true;
    try{
      await snapshotJournal.release(row);
      const norm=normalizeData(current.data);adoptServerVersion(current.updatedAt);baseServidorRef.current=norm;replaceLocalSnapshot(norm);setUltimaSync(new Date());setRecoveryRevision(v=>v+1);
      return {ok:true};
    }finally{resolvingSaveRef.current=false;}
  };
  /** @param {Snapshot} merged @param {ServerSnapshot} current @param {JournalReceipt} row */
  const aplicarRecuperacao=async(merged,current,row)=>{
    if(resolvingSaveRef.current||protectingEditsRef.current||memoryEditsRef.current.size)return {ok:false,reason:"Proteja os preenchimentos da memória antes de confirmar."};
    resolvingSaveRef.current=true;
    try{
      snapshotJournal.adopt(row);
      activeQueue().discard({keepJournal:true});
      adoptServerVersion(current.updatedAt);baseServidorRef.current=normalizeData(current.data);
      const norm=normalizeData(merged);replaceLocalSnapshot(norm);setConflito(null);
      const result=await activeQueue().enqueue(norm);
      if(result.ok){setRecoveryRevision(v=>v+1);await snapshotJournal.release(row).catch(()=>showToast("Registro confirmado. Confira a recuperação local antes de reenviar.","error"));}
      return result;
    }finally{resolvingSaveRef.current=false;}
  };
  const protegerPreenchimentos=async()=>{
    protectingEditsRef.current++;
    try{
      for(const [id,entry] of [...memoryEditsRef.current]){await snapshotJournal.protect(entry);if(memoryEditsRef.current.get(id)===entry)memoryEditsRef.current.delete(id);}
      return {ok:true};
    }catch{return {ok:false,reason:"Não foi possível proteger todos os preenchimentos. Mantenha esta aba aberta."};}
    finally{protectingEditsRef.current--;setMemoryEditCount(memoryEditsRef.current.size);}
  };
  const descartarEdicaoDaMemoria=()=>{
    if(!window.confirm("Descartar a edição que ainda não foi protegida? O preenchimento desta tentativa será perdido."))return;
    memoryEditsRef.current.clear();setMemoryEditCount(0);
    activeQueue().discard({keepJournal:true});
    replaceLocalSnapshot(normalizeData(baseServidorRef.current));
    setRecoveryRevision(v=>v+1);setRecoveryOpen(false);setConflito(null);
  };
  const abrirRecuperacao=()=>setRecoveryOpen(true);
  /** @param {JournalReceipt} [target] */
  const descartarMinhaVersao=async target=>{
    if(resolvingSaveRef.current)return;
    const state=activeQueue().getState();
    if(state===SAVE_QUEUE_STATE.SAVING||state===SAVE_QUEUE_STATE.RETRY_SCHEDULED)return;
    if((recoveryAvailable||activeQueue().hasPending())&&!window.confirm("Descartar as edições pendentes e consultar o servidor?"))return;
    const protectedEdit=Boolean(recoveryAvailable||activeQueue().hasPending());
    const refreshFailure=()=>UI_TEXT.feedback.refreshFailure({offline:navigator.onLine===false,protectedEdit});
    resolvingSaveRef.current=true;
    try{
      const fresco=await loadDataWithMeta();
      if(!fresco?.data){showToast(refreshFailure(),"error");return;}
      const saved=target?.owner===currentUser.id?target:await snapshotJournal.readLatest(currentUser.id,recoveryTab());
      if(saved)await snapshotJournal.release(saved);
      activeQueue().discard({keepJournal:true});setConflito(null);
      adoptServerVersion(fresco.updatedAt);const norm=normalizeData(fresco.data);
      baseServidorRef.current=norm;replaceLocalSnapshot(norm);
      setRecoveryRevision(v=>v+1);setRecoveryOpen(false);
    }catch{showToast(refreshFailure(),"error");}
    finally{resolvingSaveRef.current=false;}
  };

  // O painel de TV permanece aberto por horas. Ele atualiza a fotografia da
  // empresa sem toast e sem disparar um novo save, mantendo a tela pública
  // silenciosa enquanto recebe as alterações feitas pelos operadores.
  const atualizarPainelTV = useCallback(async () => {
    if (saveQueueRef.current?.hasPending()) return;
    const fresco=await loadDataWithMeta();
    if(!fresco?.data)return;
    adoptServerVersion(fresco.updatedAt);
    const norm=normalizeData(fresco.data);
    baseServidorRef.current=norm;replaceLocalSnapshot(norm);setUltimaSync(new Date());
  }, [normalizeData,replaceLocalSnapshot]);

  const isProtectingEdits = () => protectingEditsRef.current > 0;
  const hasMemoryEdits = () => memoryEditsRef.current.size > 0;
  const resetSaveSession = () => {
    saveQueueRef.current?.destroy();
    saveQueueRef.current = null;
    setEstadoSalvar(SAVE_QUEUE_STATE.IDLE);
    setConflito(null);
    setRecoveryReady(false);
    setRecoveryAvailable(false);
    setRecoveryOpen(false);
  };

  return {
    leavingSessionRef,recoveryUserRef,recoveryAvailable,conflito,
    ultimaSync,setUltimaSync,estadoSalvar,setEstadoSalvar,edicaoRecusada,setEdicaoRecusada,
    baseServidorRef,dataAtualRef,ultimoDataRef,saveQueueRef,update,
    isProtectingEdits,hasMemoryEdits,resetSaveSession,
    abrirRecuperacao,descartarMinhaVersao,atualizarPainelTV,
    recoveryContext:{
      visible:recoveryAvailable&&!recoveryOpen&&estadoSalvar!==SAVE_QUEUE_STATE.SAVING&&estadoSalvar!==SAVE_QUEUE_STATE.RETRY_SCHEDULED,
      open:abrirRecuperacao,
      revision:recoveryRevision,
      automaticSaveReady:recoveryReady&&!recoveryAvailable&&!recoveryOpen&&!memoryEditCount&&estadoSalvar===SAVE_QUEUE_STATE.IDLE,
    },
    recoveryProps:{
      memoryCount:memoryEditCount,onProtectMemory:protegerPreenchimentos,onDiscardMemory:descartarEdicaoDaMemoria,
      onRecovered:()=>setRecoveryRevision(v=>v+1),normalize:normalizeData,queue:saveQueueRef.current,
      state:estadoSalvar,user:currentUser,open:recoveryOpen,onOpen:abrirRecuperacao,onClose:()=>setRecoveryOpen(false),
      onApply:aplicarRecuperacao,onComplete:concluirRecuperacao,onAvailable:setRecoveryAvailable,onReady:setRecoveryReady,
      revision:recoveryRevision,onDiscard:descartarMinhaVersao,
    },
  };
}
