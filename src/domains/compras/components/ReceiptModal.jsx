import { useState } from "react";
import { Btn, C, fmt, Ic, Inp, Modal } from "../../../LegacyApp";
import { saldoPagamentoPedido, statusPagamentoPedido } from "../calculations";
import { quantidadesQueFaltam } from "../receipt";
import { purchaseUnitOf, referenceQuantityOf } from "../unit-conversion";

// R6: o mesmo modal para "Receber" (Compras) e "Chegou" (tela da obra). Já vem
// preenchido com tudo o que falta; quem recebeu só uma parte ajusta aqui.
export function ModalRecebimento({ pedido, onClose, onReceber, nomeMat, nomeForn, notice = null, titulo = "" }) {
  const [salvando,setSalvando]=useState(false);
  const confirmar=async()=>{if(salvando)return;setSalvando(true);try{await onReceber(pedido,qtds);}finally{setSalvando(false);}};
  const [qtds, setQtds] = useState(() =>
    Object.fromEntries(Object.entries(quantidadesQueFaltam(pedido)).map(([id, falta]) => [id, String(falta)]))
  );

  const set = (id, v) => setQtds(q => ({ ...q, [id]: v }));

  const linhas = pedido.itens.map(i => {
    const falta = Number(i.qtd) - Number(i.qtdRecebida || 0);
    const chegou = Number(qtds[i.id] || 0);
    return { ...i, falta, chegou, excede: chegou > falta + 1e-6 };
  });

  const temExcesso = linhas.some(l => l.excede || !Number.isFinite(l.chegou) || l.chegou < 0);
  const valorTotal = linhas.reduce((s,l) => s + l.chegou * Number(l.precoUnit||0), 0);

  return (
    <Modal title={titulo||`Receber - ${pedido.numero}`} onClose={()=>!salvando&&onClose()} wide panelClass="purchase-form-panel">
      <fieldset disabled={salvando} style={{display:"flex",flexDirection:"column",gap:12}}>
        <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:6,padding:"10px 12px"}}>
          <p style={{fontSize:"var(--arcd-type-body)",fontWeight:600,color:C.text}}>{nomeForn(pedido.fornecedorId)}</p>
          <p style={{fontSize:"var(--arcd-type-label)",color:C.muted,marginTop:2}}>
            Informe o que <strong>realmente chegou</strong>. Pode receber parcial - o
            pedido fica em aberto até completar.
          </p>
          {/* Conferência de pagamento: informa, não bloqueia (compra a prazo é o caso normal). */}
          <p className="purchase-receipt-payment" data-pago={statusPagamentoPedido(pedido)==="pago"||undefined}
             style={{fontSize:"var(--arcd-type-label)",marginTop:6,fontWeight:600,color:statusPagamentoPedido(pedido)==="pago"?C.green:C.orange}}>
            {statusPagamentoPedido(pedido)==="pago"?"Pagamento: quitado.":`Pagamento: ${fmt(saldoPagamentoPedido(pedido))} em aberto. O recebimento não depende dele.`}
          </p>
        </div>

        {linhas.map(l => (
          <div key={l.id} style={{
            background: l.excede ? `${C.red}08` : C.card,
            border:`1px solid ${l.excede ? C.red : C.border}`,
            borderRadius:6, padding:"10px 11px",
          }}>
            <p className="brk" style={{fontSize:"var(--arcd-type-body)",fontWeight:600,color:C.text}}>{nomeMat(l.materialId)}</p>
            <p style={{fontSize:"var(--arcd-type-label)",color:C.muted,marginTop:2,marginBottom:7}}>
              Pedido: {l.qtd} {purchaseUnitOf(l)}
              {Number(l.qtdRecebida) > 0 && `  já recebido: ${l.qtdRecebida}`}
              {l.falta > 0 && `  falta: ${l.falta}`}
              {` · saldo após esta entrada: ${Math.max(0,l.falta-l.chegou)} ${purchaseUnitOf(l)}`}
            </p>
            <Inp label={`Chegou agora (${purchaseUnitOf(l)})`} type="number" min="0" max={l.falta} disabled={salvando}
                 value={qtds[l.id]} onChange={v=>set(l.id, v)}/>
            {purchaseUnitOf(l)!==String(l.unidadeRef||"").toUpperCase()&&<p style={{fontSize:"var(--arcd-type-caption)",color:C.muted,marginTop:4}}>{l.chegou.toLocaleString("pt-BR")} {purchaseUnitOf(l)} equivalem a {referenceQuantityOf(l,l.chegou).toLocaleString("pt-BR",{maximumFractionDigits:4})} {l.unidadeRef} no estoque.</p>}
            {l.excede && (
              <p style={{fontSize:"var(--arcd-type-label)",color:C.red,marginTop:5,fontWeight:600}}>
                ! Só faltam {l.falta}. Receber a mais esconde erro de nota fiscal.
              </p>
            )}
          </div>
        ))}

        <div style={{background:`${C.green}0A`,border:`1.5px solid ${C.green}`,
                     borderRadius:6,padding:"10px 12px"}}>
          <p style={{fontSize:"var(--arcd-type-label)",color:C.muted}}>
            Vai entrar no estoque da obra:
          </p>
          <p style={{fontSize:"var(--arcd-type-card-title)",fontWeight:600,color:C.green,marginTop:2,
                     fontFamily:"var(--arcd-font-sans)"}}>{fmt(valorTotal)}</p>
          <p style={{fontSize:"var(--arcd-type-label)",color:C.muted,marginTop:4,lineHeight:1.45}}>
            Esta ação confirma a chegada física e atualiza o estoque.
            O pagamento é acompanhado separadamente; receber não registra uma saída financeira.
          </p>
        </div>

        <div style={{display:"flex",gap:8}}>
          <Btn v="ghost" onClick={onClose} disabled={salvando} full>Cancelar</Btn>
          <Btn onClick={confirmar} full loading={salvando&&"Confirmando…"} disabled={salvando || temExcesso || valorTotal <= 0}>
            <Ic n="check"/> Dar entrada no estoque
          </Btn>
        </div>
      </fieldset>
      {notice}
    </Modal>
  );
}
