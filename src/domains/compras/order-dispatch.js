// Envio do pedido ao fornecedor (C2.5): texto para WhatsApp/e-mail e o
// documento imprimível (salvo como PDF pelo navegador). Tudo puro, para a
// tela e os testes usarem a mesma montagem.

export const CANAIS_ENVIO_PEDIDO=Object.freeze(["whatsapp","email","impresso"]);
export const CANAIS_ACEITE_PEDIDO=Object.freeze(["whatsapp","email","telefone","presencial","documento","link"]);

const brl=value=>Number(value||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const qtd=value=>Number(value||0).toLocaleString("pt-BR",{maximumFractionDigits:4});
const dataBr=value=>/^\d{4}-\d{2}-\d{2}$/.test(String(value||""))
  ?String(value).split("-").reverse().join("/"):String(value||"");
const escapeHtml=value=>String(value??"").replace(/[&<>"']/g,char=>({
  "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;",
}[char]));

// itens: [{descricao,qtd,unidade,precoUnit}]
export const totalItensPedido=itens=>(itens||[])
  .reduce((sum,item)=>sum+Number(item.qtd||0)*Number(item.precoUnit||0),0);

export const mensagemPedidoFornecedor=({empresa,numero,fornecedorNome,obraNome,itens,previsao,observacao,linkAceite,condicoes=[]})=>{
  const saudacao=fornecedorNome?`Olá, ${String(fornecedorNome).split(" ")[0]}! Tudo bem?`:"Olá! Tudo bem?";
  const linhas=(itens||[]).map(item=>
    `- ${item.descricao}: ${qtd(item.qtd)}${item.unidade?` ${item.unidade}`:""} × ${brl(item.precoUnit)} = ${brl(Number(item.qtd||0)*Number(item.precoUnit||0))}`,
  ).join("\n");
  const obra=obraNome?`\nObra: ${obraNome}`:"";
  const entrega=previsao?`\nEntrega prevista: ${dataBr(previsao)}`:"";
  const obs=observacao?`\n\nObservação: ${observacao}`:"";
  const assinatura=empresa?`\n\nObrigado!\n${empresa}`:"\n\nObrigado!";
  return `${saudacao}\n\nSegue o pedido de compra ${numero}.${obra}${entrega}\n\n${linhas}\n\nTotal: ${brl(totalItensPedido(itens))}${condicoes.length?`\n\n${condicoes.join("\n")}`:""}${obs}`
    +(linkAceite
      ?`\n\nPara confirmar o pedido e o prazo de entrega, acesse: ${linkAceite}${assinatura}`
      :`\n\nPor favor, confirme o aceite do pedido (nome de quem confirma e prazo de entrega) respondendo esta mensagem.${assinatura}`);
};

export const assuntoEmailPedido=({empresa,numero,obraNome})=>
  `Pedido de compra ${numero}${obraNome?` · ${obraNome}`:""}${empresa?` · ${empresa}`:""}`;

export const linkEmailPedido=(email,assunto,corpo)=>
  `mailto:${encodeURIComponent(String(email||"").trim())}?subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(corpo)}`;

// Documento A4 simples, aberto numa janela para imprimir ou salvar em PDF.
export const documentoPedidoHtml=({empresa,numero,data,fornecedorNome,fornecedorCnpj,obraNome,itens,previsao,observacao,condicoes=[]})=>{
  const linhas=(itens||[]).map((item,index)=>`<tr><td>${index+1}</td><td>${escapeHtml(item.descricao)}</td>`
    +`<td class="n">${escapeHtml(qtd(item.qtd))} ${escapeHtml(item.unidade||"")}</td>`
    +`<td class="n">${escapeHtml(brl(item.precoUnit))}</td>`
    +`<td class="n">${escapeHtml(brl(Number(item.qtd||0)*Number(item.precoUnit||0)))}</td></tr>`).join("");
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Pedido ${escapeHtml(numero)}</title>`
    +`<style>body{font-family:Arial,sans-serif;color:#111;margin:32px;font-size:12px}h1{font-size:18px;margin:0 0 4px}`
    +`table{width:100%;border-collapse:collapse;margin-top:16px}th,td{border:1px solid #bbb;padding:6px;text-align:left}`
    +`th{background:#f2f2f2}.n{text-align:right;white-space:nowrap}.meta p{margin:2px 0}.total{font-weight:bold}`
    +`.assinatura{margin-top:48px;display:flex;gap:48px}.assinatura div{flex:1;border-top:1px solid #111;padding-top:4px}</style>`
    +`</head><body><h1>Pedido de compra ${escapeHtml(numero)}</h1><div class="meta">`
    +`<p><b>${escapeHtml(empresa||"")}</b></p><p>Data: ${escapeHtml(dataBr(data))}</p>`
    +`<p>Fornecedor: ${escapeHtml(fornecedorNome||"")}${fornecedorCnpj?` · CNPJ ${escapeHtml(fornecedorCnpj)}`:""}</p>`
    +(obraNome?`<p>Obra: ${escapeHtml(obraNome)}</p>`:"")
    +(previsao?`<p>Entrega prevista: ${escapeHtml(dataBr(previsao))}</p>`:"")
    +`</div><table><thead><tr><th>#</th><th>Item</th><th class="n">Quantidade</th><th class="n">Preço unit.</th><th class="n">Total</th></tr></thead>`
    +`<tbody>${linhas}</tbody><tfoot><tr><td colspan="4" class="n total">Total do pedido</td><td class="n total">${escapeHtml(brl(totalItensPedido(itens)))}</td></tr></tfoot></table>`
    +(condicoes.length?`<section><h2>Faturamento e entrega</h2>${condicoes.map(c=>`<p style="white-space:pre-wrap">${escapeHtml(c)}</p>`).join("")}</section>`:"")
    +(observacao?`<p style="margin-top:12px">Observação: ${escapeHtml(observacao)}</p>`:"")
    +`<div class="assinatura"><div>Comprador</div><div>Aceite do fornecedor (nome e data)</div></div>`
    +`</body></html>`;
};
