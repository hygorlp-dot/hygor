// Importação do XML da NF-e (C3.1). Leitura pura (sem DOMParser), para a tela
// e os testes usarem o mesmo código. A chave de acesso só vai para o campo da
// nota: nada aqui escreve em log.
import { totalPedido } from "./calculations.js";

const LIMITE_XML=2*1024*1024;
const EPS=0.005;

const decodificar=texto=>String(texto||"")
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,"$1")
  .replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,"\"").replace(/&apos;/g,"'").replace(/&amp;/g,"&")
  .trim();
// Primeiro conteúdo da tag (aceita prefixo de namespace, ex.: <nfe:xProd>).
const tag=(xml,nome)=>{
  const m=String(xml||"").match(new RegExp(`<(?:\\w+:)?${nome}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:\\w+:)?${nome}>`));
  return m?decodificar(m[1]):"";
};
const blocos=(xml,nome)=>[...String(xml||"").matchAll(new RegExp(`<(?:\\w+:)?${nome}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:\\w+:)?${nome}>`,"g"))].map(m=>m[1]);
const numero=valor=>{const n=Number(String(valor||"").replace(",","."));return Number.isFinite(n)?n:0;};
export const somenteDigitos=valor=>String(valor||"").replace(/\D/g,"");

// Lê o XML da NF-e (nfeProc ou NFe). Devolve {erro} quando não é uma NF-e.
export const lerXmlNfe=texto=>{
  const xml=String(texto||"");
  if(!xml||xml.length>LIMITE_XML)return {erro:"Arquivo XML vazio ou grande demais."};
  const infNFe=blocos(xml,"infNFe")[0];
  if(!infNFe)return {erro:"O arquivo não é o XML de uma NF-e."};
  const idChave=somenteDigitos((xml.match(/<(?:\w+:)?infNFe[^>]*\bId="NFe(\d{44})"/)||[])[1]);
  const chave=somenteDigitos(tag(xml,"chNFe"))||idChave;
  const ide=blocos(infNFe,"ide")[0]||"";
  const emit=blocos(infNFe,"emit")[0]||"";
  const total=blocos(infNFe,"ICMSTot")[0]||"";
  const itens=blocos(infNFe,"det").map((det,index)=>{
    const prod=blocos(det,"prod")[0]||"";
    const qtd=numero(tag(prod,"qCom"));
    const valorTotal=numero(tag(prod,"vProd"));
    return {
      nItem:index+1,codigo:tag(prod,"cProd"),descricao:tag(prod,"xProd"),ncm:tag(prod,"NCM"),
      unidade:tag(prod,"uCom").toUpperCase(),qtd,
      precoUnit:numero(tag(prod,"vUnCom"))||(qtd?valorTotal/qtd:0),valorTotal,
    };
  });
  const vencimentos=blocos(infNFe,"dup").map(dup=>tag(dup,"dVenc")).filter(Boolean).sort();
  return {
    tipo:"nfe",
    numero:tag(ide,"nNF"),serie:tag(ide,"serie"),
    chave:chave.length===44?chave:"",
    emissao:String(tag(ide,"dhEmi")||tag(ide,"dEmi")).slice(0,10),
    vencimento:vencimentos[0]||"",
    fornecedorNome:tag(emit,"xNome"),
    documentoFornecedor:somenteDigitos(tag(emit,"CNPJ")||tag(emit,"CPF")),
    valorBruto:numero(tag(total,"vNF")),
    valorProdutos:numero(tag(total,"vProd")),
    itens,
  };
};

export const fornecedorPorDocumento=(fornecedores,documento)=>{
  const alvo=somenteDigitos(documento);
  if(!alvo)return null;
  return (fornecedores||[]).find(f=>somenteDigitos(f.cnpj||f.documento||f.cpf)===alvo)||null;
};

const palavras=texto=>new Set(String(texto||"").normalize("NFD").replace(/[̀-ͯ]/g,"")
  .toUpperCase().split(/[^A-Z0-9]+/).filter(p=>p.length>=2));
const semelhanca=(a,b)=>{
  const x=palavras(a),y=palavras(b);
  if(!x.size||!y.size)return 0;
  let comum=0;x.forEach(p=>{if(y.has(p))comum+=1;});
  return comum/Math.min(x.size,y.size);
};

// Liga cada item do XML a um item do pedido: descrição parecida pesa mais,
// quantidade e preço iguais desempatam. Abaixo do mínimo fica sem vínculo.
export const casarItensNota=(itensXml,pedido,materiais=[])=>{
  const porMaterial=new Map((materiais||[]).map(m=>[String(m.id),m]));
  const livres=new Set((pedido?.itens||[]).map(item=>String(item.id)));
  return (itensXml||[]).map(xmlItem=>{
    let melhor=null;
    for(const item of pedido?.itens||[]){
      if(!livres.has(String(item.id)))continue;
      const descricao=porMaterial.get(String(item.materialId))?.descricao||item.descricaoRef||"";
      let pontos=semelhanca(xmlItem.descricao,descricao);
      if(Math.abs(Number(item.qtd||0)-xmlItem.qtd)<EPS)pontos+=0.2;
      if(Math.abs(Number(item.precoUnit||0)-xmlItem.precoUnit)<EPS)pontos+=0.2;
      if(!melhor||pontos>melhor.pontos)melhor={item,pontos,descricao};
    }
    if(!melhor||melhor.pontos<0.5)return {xmlItem,pedidoItemId:"",descricaoPedido:"",divergencias:["Sem item correspondente no pedido: vincule manualmente."]};
    livres.delete(String(melhor.item.id));
    return {xmlItem,pedidoItemId:String(melhor.item.id),descricaoPedido:melhor.descricao,
      divergencias:divergenciasDoItem(xmlItem,melhor.item)};
  });
};

export const divergenciasDoItem=(xmlItem,itemPedido)=>{
  const lista=[];
  const qtdPedido=Number(itemPedido?.qtd||0),precoPedido=Number(itemPedido?.precoUnit||0);
  if(xmlItem.qtd>qtdPedido+EPS)lista.push(`Quantidade da nota (${xmlItem.qtd.toLocaleString("pt-BR")}) acima do pedido (${qtdPedido.toLocaleString("pt-BR")}).`);
  if(xmlItem.precoUnit>precoPedido+EPS)lista.push(`Preço da nota (R$ ${xmlItem.precoUnit.toFixed(2)}) acima do pedido (R$ ${precoPedido.toFixed(2)}).`);
  return lista;
};

// Pedidos candidatos para a nota: do mesmo fornecedor e obra (se informada),
// vivos, ordenados pelo valor mais próximo e pelos itens que batem.
export const sugerirPedidosParaNota=(data,{fornecedorId,obraId,valorBruto,itens=[]})=>{
  if(!fornecedorId)return [];
  return (data?.pedidos||[])
    .filter(p=>String(p.fornecedorId)===String(fornecedorId)&&!["cancelado","rascunho"].includes(p.status)
      &&(!obraId||String(p.obraId)===String(obraId)))
    .map(pedido=>{
      const casados=casarItensNota(itens,pedido,data?.materiais).filter(c=>c.pedidoItemId).length;
      const total=totalPedido(pedido);
      const diferenca=Math.abs(total-Number(valorBruto||0));
      return {pedido,casados,diferenca,total};
    })
    .sort((a,b)=>b.casados-a.casados||a.diferenca-b.diferenca);
};

// Validação dos itens gravados na nota (servidor): cada vínculo aponta para
// item do pedido da nota e nenhum item do pedido é usado duas vezes.
export const validarItensNota=(itensNota,pedido)=>{
  if(itensNota==null)return "";
  if(!Array.isArray(itensNota)||itensNota.length>500)return "Os itens da nota são inválidos.";
  const doPedido=new Set((pedido?.itens||[]).map(item=>String(item.id)));
  const usados=new Set();
  for(const item of itensNota){
    if(!(Number(item?.qtd)>=0)||!(Number(item?.precoUnit)>=0))return "Quantidade e preço dos itens da nota precisam ser válidos.";
    const vinculo=String(item?.pedidoItemId||"");
    if(!vinculo)continue;
    if(!pedido||!doPedido.has(vinculo))return "Um item da nota está ligado a item de outro pedido.";
    if(usados.has(vinculo))return "Dois itens da nota estão ligados ao mesmo item do pedido.";
    usados.add(vinculo);
  }
  return "";
};
