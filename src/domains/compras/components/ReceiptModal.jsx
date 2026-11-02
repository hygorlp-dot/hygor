import {UNCONFIRMED_COMMAND} from '../../../features/workflow/command-attempt.js';
import {HelpButton} from '../../../features/help/HelpButton.jsx';
import {useHelpTopic} from '../../../features/help/HelpContext.jsx';
import { useState, useRef } from "react";
import { Btn, Ic, Inp, Modal } from "../../../legacy/ui.jsx";
import { C } from "../../../legacy/palette.js";
import { fmt } from "../../../legacy/format.js";
import { saldoPagamentoPedido, statusPagamentoPedido } from "../calculations";
import { quantidadesQueFaltam } from "../receipt";
import { purchaseUnitOf, referenceQuantityOf } from "../unit-conversion";

// R6: o mesmo modal para "Receber" (Compras) e "Chegou" (tela da obra). Já vem
// preenchido com tudo o que falta; quem recebeu só uma parte ajusta aqui.
export function ModalRecebimento({ pedido, onClose, onReceber, nomeMat, nomeForn, notice = null, titulo = "", attempt = null }) {
  useHelpTopic("cmp","cmp_recebimentos",20);
  const [salvando,setSalvando]=useState(false);
  const lock=useRef(false),[error,setError]=useState('');
  const confirmar=async()=>{if(lock.current)return;lock.current=true;setSalvando(true);setError('');try{const result=await onReceber(pedido,qtds);if(result?.ok===false)setError(result.reason||'Recebimento não confirmado. Confira o aviso e mantenha esta ficha aberta.');}catch{setError(UNCONFIRMED_COMMAND);}finally{lock.current=false;setSalvando(false);}};
  const [qtds, setQtds] = useState(() =>
    Object.fromEntries(Object.entries(attempt?.command?.payload?.receivedQuantities||quantidadesQueFaltam(pedido)).map(([id, falta]) => [id, String(falta)]))
  );

  const set = (id, v) => setQtds(q => ({ ...q, [id]: v }));

  const linhas = pedido.itens.map(i => {
    const falta = Number(i.qtd) - Number(i.qtdRecebida || 0);
    const chegou = Number(qtds[i.id] || 0);
    return { ...i, falta, chegou, excede: chegou > falta + 1e-6 };
  });

  const quantidadeInvalida = linhas.some(l => !Number.isFinite(l.chegou) || l.chegou < 0);
  const valorTotal = linhas.reduce((s,l) => s + l.chegou * Number(l.precoUnit||0), 0);

  return (
    <Modal title={titulo||`Receber - ${pedido.numero}`} onClose={()=>!salvando&&onClose()} wide panelClass="purchase-form-panel">
      <HelpButton pageId="cmp" allowedTabs={["cmp"]}/>
      {!salvando&&attempt?.command&&<p role="status">{UNCONFIRMED_COMMAND}</p>}
      <fieldset disabled={salvando} style={{display:"flex",flexDirection:"column",gap:"var(--arcd-space-3)"}}>
        <div style={{background:"var(--arcd-surface-muted)",border:"1px solid var(--arcd-border-default)",borderRadius:6,padding:"var(--arcd-space-2) var(--arcd-space-3)"}}>
          <p style={{fontSize:"var(--arcd-type-body)",fontWeight:"var(--arcd-font-weight-semibold)",color:"var(--arcd-text-primary)"}}>{nomeForn(pedido.fornecedorId)}</p>
          <p style={{fontSize:"var(--arcd-type-label)",color:"var(--arcd-text-secondary)",marginTop:"var(--arcd-space-half)"}}>
            Informe o que <strong>realmente chegou</strong>. Pode receber parcial - o
            pedido fica em aberto até completar.
          </p>
          {/* Conferência de pagamento: informa, não bloqueia (compra a prazo é o caso normal). */}
          <p className="purchase-receipt-payment" data-pago={statusPagamentoPedido(pedido)==="pago"||undefined}
             style={{fontSize:"var(--arcd-type-label)",marginTop:"var(--arcd-space-1)",fontWeight:"var(--arcd-font-weight-semibold)",color:statusPagamentoPedido(pedido)==="pago"?"var(--arcd-success-text)":"var(--arcd-warning-text)"}}>
            {statusPagamentoPedido(pedido)==="pago"?"Pagamento: quitado.":`Pagamento: ${fmt(saldoPagamentoPedido(pedido))} em aberto. O recebimento não depende dele.`}
          </p>
        </div>

        {linhas.map(l => (
          <div key={l.id} style={{
            background: l.excede ? "color-mix(in srgb, var(--arcd-danger-text) 3%, transparent)" : "var(--arcd-surface-card)",
            border:`1px solid ${l.excede ? "var(--arcd-danger-text)" : "var(--arcd-border-default)"}`,
            borderRadius:6, padding:"var(--arcd-space-2) var(--arcd-space-3)",
          }}>
            <p className="brk" style={{fontSize:"var(--arcd-type-body)",fontWeight:"var(--arcd-font-weight-semibold)",color:"var(--arcd-text-primary)"}}>{nomeMat(l.materialId)}</p>
            <p style={{fontSize:"var(--arcd-type-label)",color:"var(--arcd-text-secondary)",marginTop:"var(--arcd-space-half)",marginBottom:"var(--arcd-space-2)"}}>
              Pedido: {l.qtd} {purchaseUnitOf(l)}
              {Number(l.qtdRecebida) > 0 && `  já recebido: ${l.qtdRecebida}`}
              {l.falta > 0 && `  falta: ${l.falta}`}
              {` · saldo após esta entrada: ${Math.max(0,l.falta-l.chegou)} ${purchaseUnitOf(l)}`}
            </p>
            <Inp label={`Chegou agora (${purchaseUnitOf(l)})`} type="number" min="0" disabled={salvando||!!attempt?.command}
                 value={qtds[l.id]} onChange={v=>set(l.id, v)}/>
            {purchaseUnitOf(l)!==String(l.unidadeRef||"").toUpperCase()&&<p style={{fontSize:"var(--arcd-type-caption)",color:"var(--arcd-text-secondary)",marginTop:"var(--arcd-space-1)"}}>{l.chegou.toLocaleString("pt-BR")} {purchaseUnitOf(l)} equivalem a {referenceQuantityOf(l,l.chegou).toLocaleString("pt-BR",{maximumFractionDigits:4})} {l.unidadeRef} no estoque.</p>}
            {l.excede && (
              <p style={{fontSize:"var(--arcd-type-label)",color:"var(--arcd-danger-text)",marginTop:"var(--arcd-space-1)",fontWeight:"var(--arcd-font-weight-semibold)"}}>
                Quantidade acima do saldo. Confira a diferença com o fornecedor; o registro pode continuar com o que realmente chegou.
              </p>
            )}
          </div>
        ))}

        <div style={{background:"color-mix(in srgb, var(--arcd-success-text) 4%, transparent)",border:"1.5px solid var(--arcd-success-text)",
                     borderRadius:6,padding:"var(--arcd-space-2) var(--arcd-space-3)"}}>
          <p style={{fontSize:"var(--arcd-type-label)",color:"var(--arcd-text-secondary)"}}>
            Vai entrar no estoque da obra:
          </p>
          <p style={{fontSize:"var(--arcd-type-card-title)",fontWeight:"var(--arcd-font-weight-semibold)",color:"var(--arcd-success-text)",marginTop:"var(--arcd-space-half)",
                     fontFamily:"var(--arcd-font-sans)"}}>{fmt(valorTotal)}</p>
          <p style={{fontSize:"var(--arcd-type-label)",color:"var(--arcd-text-secondary)",marginTop:"var(--arcd-space-1)",lineHeight:"var(--arcd-line-height-normal)"}}>
            Esta ação confirma a chegada física e atualiza o estoque.
            O pagamento é acompanhado separadamente; receber não registra uma saída financeira.
          </p>
        </div>

        <div style={{display:"flex",gap:"var(--arcd-space-2)"}}>
          <Btn v="ghost" onClick={onClose} disabled={salvando} full>Cancelar</Btn>
          <Btn onClick={confirmar} full loading={salvando&&"Confirmando…"} disabled={salvando || quantidadeInvalida || !linhas.some(l=>l.chegou>0)}>
            <Ic n="check"/> Dar entrada no estoque
          </Btn>
        </div>
      </fieldset>
      {error&&<p role="alert">{error}</p>}
      {notice}
    </Modal>
  );
}
