// Declarações extraídas literalmente da entrada legada; não importar LegacyApp aqui.
import { C, C_ARCD_SETOR } from "../../legacy/palette.js";
import { fmt, today, uid, maiusculoOrcamento } from "../../legacy/format.js";
import { arquivoComoDataUrl } from "../../legacy/files.js";
import { Modal, Ic, Btn, Badge, Sel, Inp } from "../../legacy/ui.jsx";
import { totalPedido } from "../../domains/compras/calculations";
import { mapaDaCotacao } from "../../domains/compras/quote-map";
import { useBreakpoint } from "../../hooks/useBreakpoint";
import { useMemo } from "react";
import { useState } from "react";
import { useEffect } from "react";
import { verificarStatusIA } from "../../api";
import { chamarIA } from "../../api";
import { enviarArquivoOneDrive } from "../../api";
import { OPERATIONAL_COMMAND } from "../../domains/sync/operational-commands";


export const jsonDaRespostaIA=texto=>{const bruto=String(texto||"").trim();const cercado=bruto.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]||bruto;const inicio=cercado.indexOf("{");const fim=cercado.lastIndexOf("}");if(inicio<0||fim<=inicio)throw new Error("A IA não devolveu uma sugestão estruturada.");return JSON.parse(cercado.slice(inicio,fim+1));};

export const C_MODO_IA={...C,purple:C.yellowD,blue:C.yellowD};

export const normalizarIdentificacaoObra=valor=>String(valor||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();

export const identificarObraPeloNomeArquivo=(nomeArquivo,obras=[])=>{
  const arquivo=normalizarIdentificacaoObra(String(nomeArquivo||"").replace(/\.[^.]+$/, ""));
  const compacto=arquivo.replace(/\s/g,"");
  if(!arquivo)return null;
  const avaliadas=obras.map(obra=>{
    const nome=normalizarIdentificacaoObra(obra.name),nomeCompacto=nome.replace(/\s/g,"");
    const tokens=nome.split(" ").filter(t=>t.length>=2);
    const cliente=normalizarIdentificacaoObra(obra.cliente||obra.client),clienteCompacto=cliente.replace(/\s/g,"");
    let confianca=0,evidencia="";
    if(nomeCompacto.length>=3&&compacto.includes(nomeCompacto)){confianca=100;evidencia=`O título contém “${obra.name}”.`;}
    else if(tokens.length&&tokens.every(t=>arquivo.includes(t))){confianca=90;evidencia=`Os identificadores de “${obra.name}” aparecem no título.`;}
    else if(tokens.length>=2){const proporcao=tokens.filter(t=>arquivo.includes(t)).length/tokens.length;if(proporcao>=.66){confianca=76;evidencia=`A maior parte do nome “${obra.name}” aparece no título.`;}}
    if(confianca<70&&clienteCompacto.length>=5&&compacto.includes(clienteCompacto)){confianca=68;evidencia=`O título contém o cliente “${obra.cliente||obra.client}”, mas a obra precisa ser confirmada.`;}
    return{obraId:obra.id,obraNome:obra.name,confianca,evidencia,fonte:"nome do arquivo"};
  }).sort((a,b)=>b.confianca-a.confianca);
  const melhor=avaliadas[0],segunda=avaliadas[1];
  return melhor?.confianca>=75&&(!segunda||melhor.confianca-segunda.confianca>=12)?melhor:null;
};


export const destinosDocumentoIA=(data,modulo)=>{
  if(modulo==="compras"){
    const fornecedores=new Map((data.fornecedores||[]).map(f=>[f.id,f.nome]));
    const materiais=new Map((data.materiais||[]).map(m=>[m.id,m.descricao]));
    const pedidos=(data.pedidos||[]).filter(p=>p.status!=="cancelado").map(p=>({id:`pedido-${p.id}`,entidade:"pedido",entidadeId:p.id,obraId:p.obraId||"",data:p.data||"",valor:totalPedido(p),pasta:`Pedidos/${p.numero||p.data||"Sem número"}`,label:`Pedido ${p.numero||"sem número"} · ${fornecedores.get(p.fornecedorId)||"Fornecedor"} · ${fmt(totalPedido(p))}`}));
    const cotacoes=(data.cotacoes||[]).flatMap(c=>{const totais=mapaDaCotacao(c).totaisPorProposta;return (c.propostas||[]).map(p=>({id:`cotacao-${c.id}-${p.id}`,entidade:"cotacao",entidadeId:c.id,propostaId:p.id,obraId:c.obraId||"",data:c.data||"",valor:Number(totais[p.id]||0),pasta:`Cotações/${c.data||today()}/${fornecedores.get(p.fornecedorId)||"Fornecedor"}`,label:`Cotação · ${materiais.get(c.materialId)||"Material"} · ${fornecedores.get(p.fornecedorId)||"Fornecedor"} · ${fmt(Number(totais[p.id]||0))}`}));});
    return[...cotacoes,...pedidos].sort((a,b)=>String(b.data||"").localeCompare(String(a.data||"")));
  }
  const medicoes=(data.medicoes||[]).map(m=>({id:`med-${m.id}`,entidade:"movimento",obraId:m.obraId||"",data:m.dataPagamento||m.dataVencimento||m.competencia||"",valor:Number(m.valorPrevisto||0),pasta:`Medições/${String(m.competencia||m.dataVencimento||today()).slice(0,7)}`,label:`Medição · ${m.descricao||m.numeroParcela||"obra"} · ${fmt(Number(m.valorPrevisto||0))}`}));
  const recebimentos=(data.payments||[]).map(p=>({id:`pay-${p.id}`,entidade:"movimento",obraId:p.obraId||"",data:p.date||"",valor:Number(p.amount||0),pasta:`Comprovantes/${String(p.date||today()).slice(0,7)}`,label:`Recebimento · ${p.description||"entrada"} · ${fmt(Number(p.amount||0))}`}));
  const notas=(data.notasFiscais||[]).map(n=>({id:`nf-${n.id}`,entidade:"nota",entidadeId:n.id,obraId:n.obraId||"",data:n.emissao||n.criadoEm||"",valor:Number(n.valorLiquido||n.valorBruto||0),pasta:`Notas fiscais/${String(n.emissao||today()).slice(0,7)}`,label:`${String(n.tipo||"NF").toUpperCase()} ${n.numero||"sem número"} · ${n.fornecedorNome||"Fornecedor"} · ${fmt(Number(n.valorLiquido||n.valorBruto||0))}`}));
  const despesas=(data.outrasDesp||[]).map(d=>({id:`desp-${d.id}`,entidade:"movimento",obraId:d.obraId||"",data:d.competencia||"",valor:Number(d.valor||0),pasta:`Despesas/${String(d.competencia||today()).slice(0,7)}`,label:`Despesa da obra · ${d.descricao||d.categoria||"lançamento"} · ${fmt(Number(d.valor||0))}`}));
  const administrativas=(data.despesasEmpresa||[]).map(d=>({id:`adm-${d.id}`,entidade:"movimento",obraId:"",data:d.competencia||"",valor:Number(d.valor||0),pasta:`Administrativo/${String(d.competencia||today()).slice(0,7)}`,label:`Administrativo · ${d.descricao||d.categoria||"lançamento"} · ${fmt(Number(d.valor||0))}`}));
  const banco=(data.transacoes||[]).map(t=>({id:`bank-${Number(t.valor)>=0?"in":"out"}-${t.id}`,entidade:"movimento",obraId:(t.rateios||[]).find(r=>r.obraId)?.obraId||"",data:t.data||"",valor:Math.abs(Number(t.valor||0)),pasta:`Conciliação bancária/${String(t.data||today()).slice(0,7)}`,label:`Banco · ${t.descricao||"movimentação"} · ${fmt(Math.abs(Number(t.valor||0)))}`}));
  return[...notas,...medicoes,...recebimentos,...despesas,...administrativas,...banco].sort((a,b)=>String(b.data||"").localeCompare(String(a.data||"")));
};


export const sugerirDestinoDocumento=(destinos,sugestao,obraId)=>{
  const valor=Number(sugestao?.valorLiquido||sugestao?.valorBruto||0);const texto=normalizarIdentificacaoObra([sugestao?.numero,sugestao?.fornecedorNome,sugestao?.descricao].join(" "));
  const avaliados=destinos.filter(d=>!obraId||!d.obraId||d.obraId===obraId).map(d=>{let pontos=0;if(obraId&&d.obraId===obraId)pontos+=2;if(valor&&Math.abs(Number(d.valor||0)-valor)<=Math.max(.02,valor*.005))pontos+=4;const alvo=normalizarIdentificacaoObra(d.label);const tokens=texto.split(" ").filter(t=>t.length>=3);if(tokens.some(t=>alvo.includes(t)))pontos+=2;return{d,pontos};}).sort((a,b)=>b.pontos-a.pontos);
  const melhor=avaliados[0],segundo=avaliados[1];return melhor?.pontos>=5&&(!segundo||melhor.pontos-segundo.pontos>=2)?melhor.d:null;
};


export function ModoIADocumento({modulo,data,update,showToast,currentUser,onClose,obraIdInicial="",C=C_MODO_IA,dispatchCommand=null}){
  const {formGrid}=useBreakpoint();
  const obras=(data.obras||[]).filter(o=>!currentUser?.obraId||o.id===currentUser.obraId);
  const destinos=useMemo(()=>destinosDocumentoIA(data,modulo).filter(d=>!currentUser?.obraId||!d.obraId||d.obraId===currentUser.obraId),[data,modulo,currentUser?.obraId]);
  const formInicial=()=>({obraId:obraIdInicial||currentUser?.obraId||"",tipoDocumento:"outro",numero:"",emissao:today(),vencimento:"",fornecedorNome:"",documentoFornecedor:"",descricao:"",categoria:"",valorBruto:"",valorLiquido:"",subfolder:`${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,"0")}`,origemPagamento:"empresa",legendaDocumento:"",destinoId:""});
  const [arquivo,setArquivo]=useState(null);const [dataUrl,setDataUrl]=useState("");const [analisando,setAnalisando]=useState(false);const [salvando,setSalvando]=useState(false);const [sugestao,setSugestao]=useState(null);const [obraMatch,setObraMatch]=useState(null);
  const [lote,setLote]=useState([]);const [ativoId,setAtivoId]=useState("");
  const [statusIA,setStatusIA]=useState("verificando");
  const [form,setForm]=useState(formInicial);
  const F=k=>v=>setForm(f=>({...f,[k]:v}));
  useEffect(()=>{let ativo=true;verificarStatusIA().then(r=>{if(ativo)setStatusIA(r.ok&&r.configured?"disponivel":"indisponivel");}).catch(()=>{if(ativo)setStatusIA("indisponivel");});return()=>{ativo=false;};},[]);
  const carregarItem=item=>{if(!item)return;setAtivoId(item.id);setArquivo(item.arquivo);setDataUrl(item.dataUrl);setSugestao(item.sugestao||null);setObraMatch(item.obraMatch||null);setForm(item.form||formInicial());};
  const selecionarArquivo=async e=>{const files=Array.from(e.target.files||[]).slice(0,10);e.target.value="";if(!files.length)return;const validos=files.filter(file=>/^(application\/pdf|image\/(jpeg|png|webp))$/i.test(file.type)&&file.size<=5.5*1024*1024);if(validos.length!==files.length)showToast(`${files.length-validos.length} arquivo(s) ignorado(s). Use PDF, JPG, PNG ou WEBP com até 5,5 MB.`,"error");if(!validos.length)return;const itens=await Promise.all(validos.map(async file=>{const match=identificarObraPeloNomeArquivo(file.name,obras);return{id:uid(),arquivo:file,dataUrl:await arquivoComoDataUrl(file),form:{...formInicial(),legendaDocumento:String(file.name||"").replace(/\.[^.]+$/,"")||"Documento analisado por IA",...(match&&!obraIdInicial&&!currentUser?.obraId?{obraId:match.obraId}:{})},sugestao:null,obraMatch:match,status:"pendente",erro:""};}));setLote(itens);carregarItem(itens[0]);showToast(`${itens.length} documento(s) adicionado(s). Cada arquivo terá uma análise independente.`);void executarLote(itens);};
  const analisar=async()=>{if(!arquivo||!dataUrl){showToast("Selecione um documento para analisar.","error");return;}setAnalisando(true);try{
    const contexto={modulo,arquivoNome:arquivo.name,obraSugeridaPeloTitulo:obraMatch,obras:obras.map(o=>({id:o.id,nome:o.name,cliente:o.cliente||o.client||"",endereco:o.address||""})),fornecedores:(data.fornecedores||[]).map(f=>({nome:f.nome,cnpj:f.cnpj})).slice(0,200),destinosExistentes:destinos.slice(0,250).map(d=>({id:d.id,obraId:d.obraId,data:d.data,valor:d.valor,descricao:d.label}))};
    const prompt=`Leia integralmente este documento financeiro/comercial. Pode ser NF-e, NFS-e, cotação de fornecedor, boleto, recibo, comprovante, conta de energia, água, internet ou outro documento. Identifique a obra comparando PRIMEIRO o nome original do arquivo (${arquivo.name}) e depois o texto do documento com a lista de obras do contexto. Compare número, fornecedor, obra, data, descrição e valor com destinosExistentes. Só preencha destinoId quando houver correspondência forte; ele deve ser exatamente um ID da lista. Se não houver, deixe vazio para o operador criar um lançamento. Retorne SOMENTE JSON válido, sem markdown, neste formato: {"obraId":"","obraNome":"","obraConfianca":0,"obraEvidencia":"trecho do nome do arquivo ou documento que justificou a associação","destinoId":"","tipoDocumento":"nfe|nfse|cotacao|boleto|recibo|energia|agua|internet|frete|outro","numero":"","emissao":"YYYY-MM-DD ou vazio","vencimento":"YYYY-MM-DD ou vazio","fornecedorNome":"","documentoFornecedor":"CNPJ/CPF ou vazio","descricao":"descrição objetiva do lançamento","categoria":"categoria contábil/compra sugerida","valorBruto":0,"valorLiquido":0,"confianca":0,"resumo":"","alertas":[""],"itens":[{"descricao":"","quantidade":1,"unidade":"UN","valorUnitario":0}]}. Não invente valores ilegíveis; use vazio ou zero e gere alerta. As confianças vão de 0 a 100.`;
    const body={modulo,prompt,contexto};if(arquivo.type==="application/pdf")body.documentos=[{dataUrl,nome:arquivo.name}];else body.imagens=[{dataUrl,legenda:arquivo.name}];
    const json=await chamarIA(body);if(!json.ok)throw new Error(json.error||"A IA não conseguiu analisar o documento.");const s=jsonDaRespostaIA(json.reply||json.answer);
    const obraIA=obras.find(o=>o.id===s.obraId);const confiancaObraIA=Math.max(0,Math.min(100,Number(s.obraConfianca||0)));const fixa=obraIdInicial||currentUser?.obraId;const matchFinal=fixa?{obraId:fixa,obraNome:obras.find(o=>o.id===fixa)?.name||"",confianca:100,evidencia:"Obra definida pelo contexto de acesso.",fonte:"contexto"}:obraMatch||(obraIA&&confiancaObraIA>=60?{obraId:obraIA.id,obraNome:obraIA.name,confianca:confiancaObraIA,evidencia:s.obraEvidencia||"Associação sugerida pela leitura do documento.",fonte:"IA"}:null);
    const destinoSugerido=(Number(s.confianca||0)>=75?destinos.find(d=>d.id===s.destinoId):null)||sugerirDestinoDocumento(destinos,s,matchFinal?.obraId||form.obraId);
    const novoForm={...form,obraId:matchFinal?.obraId||destinoSugerido?.obraId||form.obraId,tipoDocumento:["nfe","nfse","boleto","recibo","energia","agua","internet","frete","outro"].includes(s.tipoDocumento)?s.tipoDocumento:"outro",numero:s.numero||form.numero,emissao:s.emissao||form.emissao,vencimento:s.vencimento||"",fornecedorNome:s.fornecedorNome||"",documentoFornecedor:s.documentoFornecedor||"",descricao:s.descricao||s.itens?.[0]?.descricao||"",categoria:s.categoria||"",valorBruto:String(Number(s.valorBruto||0)||""),valorLiquido:String(Number(s.valorLiquido||s.valorBruto||0)||""),destinoId:destinoSugerido?.id||"",legendaDocumento:form.legendaDocumento||s.descricao||s.tipoDocumento||"Documento analisado por IA"};setObraMatch(matchFinal);setSugestao(s);setForm(novoForm);setLote(lista=>lista.map(item=>item.id===ativoId?{...item,sugestao:s,obraMatch:matchFinal,form:novoForm,status:"revisar",erro:""}:item));
    showToast(matchFinal?`Leitura concluída. Obra sugerida por ${matchFinal.fonte}; revise antes de aceitar.`:"Leitura concluída. Confirme manualmente a obra antes de aceitar.",matchFinal?undefined:"warn");
  }catch(err){setLote(lista=>lista.map(item=>item.id===ativoId?{...item,status:"erro",erro:err.message||"Falha na leitura"}:item));showToast(err.message||"Falha na leitura por IA.","error");}finally{setAnalisando(false);}};
  const analisarDocumentoDoLote=async(item,indice,total)=>{
    const a=item.arquivo,u=item.dataUrl,matchTitulo=item.obraMatch,formItem=item.form||formInicial();
    const contexto={modulo,arquivoNome:a.name,documentoNoLote:indice,totalNoLote:total,regraDoLote:"Analise exclusivamente este arquivo e não reutilize dados de outros documentos.",obraSugeridaPeloTitulo:matchTitulo,obras:obras.map(o=>({id:o.id,nome:o.name,cliente:o.cliente||o.client||"",endereco:o.address||""})),fornecedores:(data.fornecedores||[]).map(f=>({nome:f.nome,cnpj:f.cnpj})).slice(0,200),destinosExistentes:destinos.slice(0,250).map(d=>({id:d.id,obraId:d.obraId,data:d.data,valor:d.valor,descricao:d.label}))};
    const prompt=`Analise SOMENTE o arquivo “${a.name}”. Esta é a análise ${indice} de ${total}, mas ela deve ser totalmente independente: não combine fornecedor, CNPJ/CPF, número, valores, datas, itens ou obra com qualquer outro arquivo do lote. Leia integralmente o documento. Ele pode ser NF-e, NFS-e, cotação, boleto, recibo, comprovante ou conta de consumo. Identifique a obra comparando primeiro o nome original do arquivo e depois o conteúdo com a lista de obras. Só preencha destinoId se houver correspondência forte e ele existir no contexto. Retorne SOMENTE JSON válido, sem markdown: {"obraId":"","obraNome":"","obraConfianca":0,"obraEvidencia":"","destinoId":"","tipoDocumento":"nfe|nfse|cotacao|boleto|recibo|energia|agua|internet|frete|outro","numero":"","emissao":"YYYY-MM-DD ou vazio","vencimento":"YYYY-MM-DD ou vazio","fornecedorNome":"","documentoFornecedor":"","descricao":"","categoria":"","valorBruto":0,"valorLiquido":0,"confianca":0,"resumo":"","alertas":[""],"itens":[{"descricao":"","quantidade":1,"unidade":"UN","valorUnitario":0}]}. Não invente conteúdo ilegível; use vazio ou zero e gere alerta.`;
    const body={modulo,prompt,contexto};if(a.type==="application/pdf")body.documentos=[{dataUrl:u,nome:a.name}];else body.imagens=[{dataUrl:u,legenda:a.name}];
    const json=await chamarIA(body);if(!json.ok)throw new Error(json.error||"A IA não conseguiu analisar o documento.");const leitura=jsonDaRespostaIA(json.reply||json.answer);const s={...leitura,resumo:total>1?`Documento ${indice} de ${total} · ${leitura.resumo||"Análise individual concluída."}`:leitura.resumo};
    const obraIA=obras.find(o=>o.id===s.obraId);const confiancaObraIA=Math.max(0,Math.min(100,Number(s.obraConfianca||0)));const fixa=obraIdInicial||currentUser?.obraId;const matchFinal=fixa?{obraId:fixa,obraNome:obras.find(o=>o.id===fixa)?.name||"",confianca:100,evidencia:"Obra definida pelo contexto de acesso.",fonte:"contexto"}:matchTitulo||(obraIA&&confiancaObraIA>=60?{obraId:obraIA.id,obraNome:obraIA.name,confianca:confiancaObraIA,evidencia:s.obraEvidencia||"Associação sugerida pela leitura do documento.",fonte:"IA"}:null);
    const destinoSugerido=(Number(s.confianca||0)>=75?destinos.find(d=>d.id===s.destinoId):null)||sugerirDestinoDocumento(destinos,s,matchFinal?.obraId||formItem.obraId);
    const novoForm={...formItem,obraId:matchFinal?.obraId||destinoSugerido?.obraId||formItem.obraId,tipoDocumento:["nfe","nfse","boleto","recibo","energia","agua","internet","frete","outro"].includes(s.tipoDocumento)?s.tipoDocumento:"outro",numero:s.numero||formItem.numero,emissao:s.emissao||formItem.emissao,vencimento:s.vencimento||"",fornecedorNome:s.fornecedorNome||"",documentoFornecedor:s.documentoFornecedor||"",descricao:s.descricao||s.itens?.[0]?.descricao||"",categoria:s.categoria||"",valorBruto:String(Number(s.valorBruto||0)||""),valorLiquido:String(Number(s.valorLiquido||s.valorBruto||0)||""),destinoId:destinoSugerido?.id||"",legendaDocumento:formItem.legendaDocumento||s.descricao||s.tipoDocumento||"Documento analisado por IA"};
    return{...item,sugestao:s,obraMatch:matchFinal,form:novoForm,status:"revisar",erro:""};
  };
  const executarLote=async itens=>{const origem=(itens||lote).map(item=>item.id===ativoId?{...item,form,sugestao,obraMatch}:item);if(!origem.length||statusIA!=="disponivel"){showToast("Confirme a conexão da IA antes de enviar o lote.","error");return;}setAnalisando(true);setLote(origem);const resultados=[];let concluidos=0,falhas=0;for(let i=0;i<origem.length;i++){const atual={...origem[i],status:"analisando",erro:""};setLote(lista=>lista.map(item=>item.id===atual.id?atual:item));try{const pronto=await analisarDocumentoDoLote(atual,i+1,origem.length);resultados.push(pronto);concluidos++;setLote(lista=>lista.map(item=>item.id===pronto.id?pronto:item));}catch(err){const falho={...atual,status:"erro",erro:err.message||"Falha na análise"};resultados.push(falho);falhas++;setLote(lista=>lista.map(item=>item.id===falho.id?falho:item));}}const primeiro=resultados.find(item=>item.status==="revisar")||resultados[0];if(primeiro)carregarItem(primeiro);setAnalisando(false);showToast(`${concluidos} documento(s) analisado(s) separadamente${falhas?` · ${falhas} com falha`:""}.`,falhas?"warn":undefined);};
  const concluirDocumentoAtivo=()=>{const restantes=lote.filter(item=>item.id!==ativoId);setLote(restantes);if(restantes.length)carregarItem(restantes[0]);else onClose?.();};
  const aceitar=async()=>{
    const destino=destinos.find(d=>d.id===form.destinoId);
    if(!arquivo||!dataUrl||!String(form.legendaDocumento||"").trim()||(!destino&&(!form.obraId||Number(form.valorBruto)<=0))){showToast("Confirme destino, obra, legenda e valor antes de aceitar.","error");return;}
    if(!window.confirm(destino?`Vincular o documento a “${destino.label}”?`:`Criar o lançamento sugerido de ${fmt(Number(form.valorBruto))}?`))return;
    setSalvando(true);
    try{
      const obraUploadId=destino?.obraId||form.obraId;const obra=obras.find(o=>o.id===obraUploadId)||(data.obras||[]).find(o=>o.id===obraUploadId);
      const competencia=String(form.emissao||today()).slice(0,7);const pastaNova=modulo==="compras"?`Pedidos IA/${competencia}`:["nfe","nfse","frete"].includes(form.tipoDocumento)?`Notas fiscais/${competencia}`:["recibo","boleto"].includes(form.tipoDocumento)?`Comprovantes/${competencia}`:["energia","agua","internet"].includes(form.tipoDocumento)?`Contas de consumo/${competencia}`:`Documentos analisados/${competencia}`;
      const resp=await enviarArquivoOneDrive({dataUrl,obraName:obra?.name||"Administrativo",driveId:obra?.oneDriveDriveId,folderId:obra?.oneDriveFolderId,folders:obra?.oneDriveFolders,category:modulo==="compras"?"compras":"financeiro",subfolder:destino?.pasta||pastaNova,date:form.emissao||today(),fileName:arquivo.name});
      if(!resp.ok&&!resp.url)throw new Error(resp.error||"Falha ao salvar no OneDrive.");
      const agora=new Date().toISOString();const doc={id:resp.item?.id||uid(),nome:resp.item?.name||arquivo.name,legenda:String(form.legendaDocumento).trim(),url:resp.item?.webUrl||resp.url,path:resp.path||"",tipo:arquivo.type,tamanho:arquivo.size||0,enviadoEm:agora,enviadoPorId:currentUser?.id||"",enviadoPor:currentUser?.nome||""};
      const obrasAtualizadas=(data.obras||[]).map(o=>o.id===obraUploadId?{...o,oneDriveDriveId:resp.workspace?.driveId||o.oneDriveDriveId,oneDriveFolderId:resp.workspace?.folderId||o.oneDriveFolderId,oneDriveFolders:resp.workspace?.folders||o.oneDriveFolders,oneDriveUrl:resp.workspace?.webUrl||o.oneDriveUrl}:o);
      const analiseIA={...sugestao,confianca:Number(sugestao?.confianca||0),revisadoPorId:currentUser?.id||"",revisadoPor:currentUser?.nome||"",revisadoEm:agora};
      if(destino){
        if(modulo==="financeiro"){
          let commandData=data;
          if(destino.entidade==="nota"){
            if(!dispatchCommand)throw new Error("Comando fiscal indisponível.");
            const result=await dispatchCommand(atual=>{
              const nota=(atual.notasFiscais||[]).find(n=>n.id===destino.entidadeId);
              return {
                type:OPERATIONAL_COMMAND.INVOICE_SAVED,
                idempotencyKey:`invoice-document-${destino.entidadeId}-${doc.id}-${uid()}`,
                expectedVersion:Number(nota?.version||0),
                actorId:currentUser?.id||"",actorName:currentUser?.nome||"",
                payload:{invoice:{
                  ...nota,documentos:[...(nota?.documentos||[]),doc],
                }},
              };
            });
            if(!result?.ok)throw new Error(result?.reason||"O servidor não confirmou o vínculo à nota.");
            commandData=result.data;
          }
          const registros=commandData.documentosMovimentacoes||[];
          const registro=registros.find(r=>r.movimentoId===destino.id);
          const documentosMovimentacoes=registro
            ?registros.map(r=>r.movimentoId===destino.id
              ?{...r,documentos:[...(r.documentos||[]),doc]}:r)
            :[...registros,{id:uid(),movimentoId:destino.id,
              obraId:destino.obraId||"",tipo:destino.label.split(" · ")[0],
              documentos:[doc]}];
          update({...commandData,obras:(commandData.obras||[]).map(o=>
            o.id===obraUploadId?obrasAtualizadas.find(item=>item.id===o.id)||o:o),
            documentosMovimentacoes});
        }else if(destino.entidade==="cotacao"){
          update({...data,obras:obrasAtualizadas,cotacoes:(data.cotacoes||[]).map(c=>c.id===destino.entidadeId?{...c,propostas:(c.propostas||[]).map(p=>p.id===destino.propostaId?{...p,documentos:[...(p.documentos||[]),doc]}:p)}:c)});
        }else{
          if(!dispatchCommand)throw new Error("Comando de compras indisponível.");
          const result=await dispatchCommand(atual=>{
            const pedido=(atual.pedidos||[]).find(item=>item.id===destino.entidadeId);
            return {
              type:OPERATIONAL_COMMAND.PURCHASE_ORDER_DOCUMENT_ATTACHED,
              idempotencyKey:`purchase-order-document-${destino.entidadeId}-${doc.id}-${uid()}`,
              expectedVersion:Number(pedido?.version||0),
              actorId:currentUser?.id||"",actorName:currentUser?.nome||"",
              payload:{orderId:destino.entidadeId,document:doc},
            };
          });
          if(!result?.ok)throw new Error(result?.reason||"O servidor não confirmou o vínculo ao pedido.");
          update({...result.data,obras:(result.data.obras||[]).map(o=>
            o.id===obraUploadId?obrasAtualizadas.find(item=>item.id===o.id)||o:o)});
        }
        showToast("Documento analisado, salvo no diretório correto e vinculado ao item selecionado.");concluirDocumentoAtivo();return;
      }
      if(modulo==="financeiro"){
        const notaId=uid();const numero=String(form.numero||`DOC-${Date.now()}`).trim();const nota={id:notaId,tipo:["nfe","nfse","frete"].includes(form.tipoDocumento)?form.tipoDocumento:"outro",numero,serie:"",chave:"",emissao:form.emissao||today(),vencimento:form.vencimento||"",fornecedorId:"",fornecedorNome:form.fornecedorNome||"Não identificado",documentoFornecedor:form.documentoFornecedor||"",obraId:form.obraId,pedidoId:"",valorBruto:Number(form.valorBruto),valorLiquido:Number(form.valorLiquido||form.valorBruto),retencoes:{iss:0,inss:0,irrf:0,pis:0,cofins:0,csll:0,outros:0},rateios:[{id:uid(),obraId:form.obraId,etapaId:"",percentual:100,valor:Number(form.valorBruto)}],documentos:[doc],status:"recebida",divergencias:sugestao?.alertas||[],analiseIA,descricao:form.descricao,categoria:form.categoria,pastaDrive:pastaNova,criadoPorId:currentUser?.id||"",criadoPor:currentUser?.nome||"",criadoEm:agora,atualizadoEm:agora};
        if(!dispatchCommand)throw new Error("Comando fiscal indisponível.");
        const result=await dispatchCommand(()=>({
          type:OPERATIONAL_COMMAND.INVOICE_SAVED,
          idempotencyKey:`invoice-ai-create-${notaId}-${uid()}`,
          expectedVersion:0,
          actorId:currentUser?.id||"",actorName:currentUser?.nome||"",
          payload:{invoice:nota},
        }));
        if(!result?.ok)throw new Error(result?.reason||"O servidor não confirmou a nota.");
        const documentosMovimentacoes=[...(result.data.documentosMovimentacoes||[]),{
          id:uid(),movimentoId:`nf-${notaId}`,obraId:form.obraId,
          tipo:"Nota fiscal",documentos:[doc]}];
        update({...result.data,obras:(result.data.obras||[]).map(o=>
          o.id===obraUploadId?obrasAtualizadas.find(item=>item.id===o.id)||o:o),
          documentosMovimentacoes});
      }else{
        if(!dispatchCommand)throw new Error("Comando de compras indisponível.");
        const norm=v=>String(v||"").replace(/\D/g,"");
        let fornecedor=(data.fornecedores||[]).find(f=>
          (norm(form.documentoFornecedor)&&norm(f.cnpj)===norm(form.documentoFornecedor))
          ||String(f.nome||"").toLowerCase()===String(form.fornecedorNome||"").toLowerCase());
        const novoFornecedor=!fornecedor?{
          id:uid(),nome:form.fornecedorNome||"Fornecedor a confirmar",
          cnpj:form.documentoFornecedor||"",categorias:[],ativo:true,
        }:null;
        fornecedor=fornecedor||novoFornecedor;
        const material={id:uid(),codigo:`IA-${String((data.materiais||[]).length+1).padStart(4,"0")}`,descricao:maiusculoOrcamento(form.descricao||form.categoria||"ITEM LIDO POR IA"),unidade:"UN",categoria:"outros",estoqueMin:0,precoMedio:Number(form.valorBruto),fonteRef:"IA",ativo:true};
        const pedido={id:uid(),numero:`PC-IA-${String((data.pedidos||[]).length+1).padStart(4,"0")}`,obraId:form.obraId,fornecedorId:fornecedor.id,data:form.emissao||today(),previsao:form.vencimento||"",status:"rascunho",referenciaId:"",solicitacaoId:"",itens:[{id:uid(),materialId:material.id,qtd:1,precoUnit:Number(form.valorBruto),qtdRecebida:0,orcItemId:"",orcNivel1Id:"",referenciaId:"",fonteRef:"IA",codigoRef:material.codigo,descricaoRef:material.descricao,unidadeRef:"UN",precoRef:Number(form.valorBruto),dataBaseRef:"",ufRef:""}],cotacaoId:"",transacaoId:"",origemPagamento:form.origemPagamento,pagamentos:[],documentos:[doc],analiseIA,criadoPorId:currentUser?.id||"",criadoPor:currentUser?.nome||"",criadoEm:agora,obs:`Documento ${form.numero||arquivo.name} · ${form.categoria||"classificação a revisar"}`};
        const result=await dispatchCommand(()=>({
          type:OPERATIONAL_COMMAND.PURCHASE_ORDER_SAVED,
          idempotencyKey:`purchase-order-ai-${pedido.id}-${uid()}`,
          expectedVersion:0,actorId:currentUser?.id||"",actorName:currentUser?.nome||"",
          payload:{order:pedido,newSupplier:novoFornecedor,newMaterials:[material]},
        }));
        if(!result?.ok)throw new Error(result?.reason||"O servidor não confirmou o novo pedido.");
        update({...result.data,obras:(result.data.obras||[]).map(o=>
          o.id===obraUploadId?obrasAtualizadas.find(item=>item.id===o.id)||o:o)});
      }
      showToast(modulo==="financeiro"?"Documento salvo, vinculado à nova nota e enviado para conferência fiscal.":"Documento salvo e vinculado ao novo pedido em rascunho.");concluirDocumentoAtivo();
    }catch(err){showToast(err.message||"Não foi possível concluir o lançamento.","error");}finally{setSalvando(false);}
  };
  if(!arquivo)return <Modal title={`Modo IA · ${modulo==="compras"?"Compras":"Financeiro"}`} onClose={onClose} wide><div style={{display:"flex",flexDirection:"column",gap:12}}><div style={{padding:14,border:`1px solid ${C.yellow}55`,borderRadius:12,background:`linear-gradient(135deg,${C.yellow}12,${C.surface})`}}><p style={{fontSize:"var(--arcd-type-caption)",fontWeight:600,letterSpacing:1.1,textTransform:"uppercase",color:C.yellowD}}>Verificação documental em lote</p><h3 style={{fontSize:"var(--arcd-type-card-title)",color:C.text,marginTop:4}}>Uma análise independente para cada arquivo</h3><p style={{fontSize:"var(--arcd-type-label)",color:C.muted,lineHeight:1.55,marginTop:5}}>Selecione até 10 imagens ou PDFs. O Gemini processará um documento por chamada para não misturar obra, fornecedor, datas, itens ou valores. Depois, cada sugestão deverá ser revisada e aceita separadamente.</p></div><label style={{minHeight:150,padding:22,border:`2px dashed ${statusIA==="disponivel"?C.yellow:C.border}`,borderRadius:12,textAlign:"center",cursor:statusIA==="disponivel"?"pointer":"wait",background:C.card,display:"grid",placeItems:"center"}}><div><span style={{width:44,height:44,borderRadius:12,display:"grid",placeItems:"center",margin:"0 auto 9px",background:C.text,color:C.yellow}}><Ic n="fileText" s={21}/></span><b style={{fontSize:"var(--arcd-type-body)",color:C.text}}>{statusIA==="disponivel"?"Selecionar imagens e documentos":"Verificando conexão com a IA..."}</b><p style={{fontSize:"var(--arcd-type-caption)",color:C.muted,marginTop:4}}>PDF, JPG, PNG ou WEBP · até 10 arquivos · 5,5 MB por arquivo</p></div><input type="file" multiple accept=".pdf,image/jpeg,image/png,image/webp" disabled={statusIA!=="disponivel"} onChange={selecionarArquivo} style={{display:"none"}}/></label>{statusIA==="indisponivel"&&<div style={{padding:"9px 11px",border:`1px solid ${C.red}55`,borderRadius:8,background:`${C.red}09`,fontSize:"var(--arcd-type-label)",color:C.red}}>A IA não está disponível. Solicite ao administrador que valide a integração Gemini.</div>}<Btn v="ghost" onClick={onClose} full>Cancelar</Btn></div></Modal>;
  const confianca=Math.max(0,Math.min(100,Number(sugestao?.confianca||0)));
  return <Modal title={`Modo IA · ${modulo==="compras"?"Compras":"Financeiro"}`} onClose={onClose} wide><div style={{display:"flex",flexDirection:"column",gap:11}}><div style={{background:`linear-gradient(135deg,${C.purple}12,${C.blue}09)`,border:`1px solid ${C.purple}44`,borderRadius:10,padding:12,display:"flex",gap:10,alignItems:"center"}}><span style={{width:38,height:38,borderRadius:10,display:"grid",placeItems:"center",background:C.purple,color:"#fff"}}><Ic n="brain" s={19}/></span><div style={{flex:1}}><b style={{fontSize:"var(--arcd-type-body)",color:C.purple}}>Leitura assistida e auditável</b><p style={{fontSize:"var(--arcd-type-caption)",color:C.muted,marginTop:2}}>A IA sugere o lançamento e procura o item correspondente. Você confirma o vínculo e o diretório antes de salvar.</p></div><Badge color={statusIA==="disponivel"?C.green:statusIA==="verificando"?C.orange:C.red}>{statusIA==="disponivel"?"IA CONECTADA":statusIA==="verificando"?"VERIFICANDO":"IA INDISPONÍVEL"}</Badge></div>{statusIA==="indisponivel"&&<div style={{padding:"9px 11px",border:`1px solid ${C.red}55`,borderRadius:8,background:`${C.red}09`,fontSize:"var(--arcd-type-label)",color:C.red}}>O serviço de IA não está configurado na produção. Solicite ao administrador a ativação da integração.</div>}<label style={{padding:15,border:`2px dashed ${arquivo?C.green:C.blue}66`,borderRadius:10,textAlign:"center",cursor:"pointer",background:arquivo?`${C.green}08`:C.card}}><b style={{fontSize:"var(--arcd-type-label)",color:arquivo?C.green:C.blue}}>{arquivo?arquivo.name:"Selecionar PDF ou imagem"}</b><p style={{fontSize:"var(--arcd-type-caption)",color:C.muted,marginTop:3}}>PDF, JPG, PNG ou WEBP · máximo 5,5 MB</p><input type="file" accept=".pdf,image/jpeg,image/png,image/webp" onChange={selecionarArquivo} style={{display:"none"}}/></label>{obraMatch&&<div style={{padding:"9px 11px",border:`1px solid ${C.green}55`,borderRadius:8,background:`${C.green}08`,fontSize:"var(--arcd-type-caption)",color:C.subtle}}><b style={{color:C.green}}>Obra reconhecida: {obraMatch.obraNome}</b> · {obraMatch.fonte} ({Math.round(obraMatch.confianca)}%)<p style={{marginTop:2,color:C.muted}}>{obraMatch.evidencia}</p></div>}<Btn onClick={analisar} disabled={!arquivo||analisando||statusIA!=="disponivel"} full><Ic n="ia"/> {analisando?"Lendo documento...":statusIA==="verificando"?"Verificando serviço...":"Analisar e sugerir lançamento"}</Btn>{sugestao&&<><div style={{display:"grid",gridTemplateColumns:"1fr auto",gap:10,alignItems:"center",padding:"9px 10px",border:`1px solid ${C.border}`,borderRadius:8}}><div><b style={{fontSize:"var(--arcd-type-label)"}}>Confiança da leitura</b><div style={{height:5,background:C.surface,borderRadius:99,marginTop:5,overflow:"hidden"}}><div style={{height:"100%",width:`${confianca}%`,background:confianca>=80?C.green:confianca>=55?C.yellow:C.red}}/></div></div><b style={{fontSize:"var(--arcd-type-card-title)",color:confianca>=80?C.green:confianca>=55?C.yellowD:C.red}}>{confianca}%</b></div>{sugestao.resumo&&<p style={{fontSize:"var(--arcd-type-label)",color:C.subtle,lineHeight:1.5,padding:"8px 10px",background:C.surface,borderRadius:7}}>{sugestao.resumo}</p>}{sugestao.alertas?.map((a,i)=><p key={i} style={{fontSize:"var(--arcd-type-caption)",color:C.red}}>⚠ {a}</p>)}<div style={{padding:"10px 11px",border:`1px solid ${form.destinoId?C.green:C.border}`,background:form.destinoId?`${C.green}08`:C.surface,borderRadius:9}}><Sel label={modulo==="compras"?"Vincular a pedido ou cotação":"Vincular à movimentação financeira"} value={form.destinoId} onChange={v=>{const destino=destinos.find(d=>d.id===v);setForm(f=>({...f,destinoId:v,obraId:destino?.obraId||f.obraId,subfolder:destino?.pasta||f.subfolder}));}} options={[{v:"",l:modulo==="compras"?"Criar novo pedido em rascunho":"Criar nova nota/lançamento"},...destinos.filter(d=>!form.obraId||!d.obraId||d.obraId===form.obraId).slice(0,250).map(d=>({v:d.id,l:d.label}))]}/><p style={{fontSize:"var(--arcd-type-caption)",color:C.muted,marginTop:5}}>{form.destinoId?"O arquivo será acrescentado ao item selecionado sem criar um lançamento duplicado.":"Nenhum item compatível selecionado: será criado um novo registro após sua confirmação."}</p></div><div style={{display:"grid",gridTemplateColumns:formGrid(3),gap:8}}><Sel label="Obra *" value={form.obraId} onChange={v=>{setForm(f=>({...f,obraId:v,destinoId:""}));const o=obras.find(x=>x.id===v);setObraMatch(o?{obraId:o.id,obraNome:o.name,confianca:100,evidencia:"Obra confirmada pelo operador.",fonte:"seleção manual"}:null);}} options={[{v:"",l:"Confirme a obra"},...obras.map(o=>({v:o.id,l:o.name}))]}/><Sel label="Tipo de documento" value={form.tipoDocumento} onChange={F("tipoDocumento")} options={[{v:"nfe",l:"NF-e"},{v:"nfse",l:"NFS-e"},{v:"boleto",l:"Boleto"},{v:"recibo",l:"Recibo / comprovante"},{v:"energia",l:"Conta de energia"},{v:"agua",l:"Conta de água"},{v:"internet",l:"Internet/telefone"},{v:"frete",l:"Frete/CT-e"},{v:"outro",l:"Outro"}]}/><Inp label="Número / referência" value={form.numero} onChange={F("numero")}/><Inp label="Emissão" type="date" value={form.emissao} onChange={F("emissao")}/><Inp label="Vencimento" type="date" value={form.vencimento} onChange={F("vencimento")}/><Inp label="CNPJ / CPF" value={form.documentoFornecedor} onChange={F("documentoFornecedor")}/><Inp label="Fornecedor" value={form.fornecedorNome} onChange={F("fornecedorNome")}/><Inp label="Categoria sugerida" value={form.categoria} onChange={F("categoria")}/><Inp label="Valor bruto *" type="number" value={form.valorBruto} onChange={F("valorBruto")}/><Inp label="Valor líquido" type="number" value={form.valorLiquido} onChange={F("valorLiquido")}/>{modulo==="compras"&&<Sel label="Origem do pagamento" value={form.origemPagamento} onChange={F("origemPagamento")} options={[{v:"caixa",l:"Caixa da empresa/obra"},{v:"cliente_direto",l:"Cliente paga direto"}]}/>}<Inp label="Legenda do documento *" value={form.legendaDocumento} onChange={F("legendaDocumento")} placeholder="Ex.: NF 123, cotação revisada, comprovante PIX"/></div><Inp label="Descrição do lançamento" value={form.descricao} onChange={F("descricao")}/><div style={{padding:"8px 10px",border:`1px solid ${C.border}`,borderRadius:8,background:C.surface,fontSize:"var(--arcd-type-caption)",color:C.muted}}>Diretório sugerido: <b style={{color:C.text}}>{modulo==="compras"?"09 - Compras e Suprimentos":"08 - Financeiro e Fiscal"} / {destinos.find(d=>d.id===form.destinoId)?.pasta||form.subfolder}</b></div><div style={{display:"flex",gap:8}}><Btn v="ghost" onClick={onClose} full>Cancelar</Btn><Btn v="success" onClick={aceitar} disabled={salvando||!String(form.legendaDocumento||"").trim()} full><Ic n="check"/> {salvando?"Salvando no Drive...":form.destinoId?"Vincular documento":"Aceitar e criar lançamento"}</Btn></div></>}</div></Modal>;
}


export function LinksDocumentosAuditaveis({documentos=[],onSelecionar,subindo=false,C=C_ARCD_SETOR}){
  return <div style={{display:"flex",flexDirection:"column",alignItems:"flex-start",gap:4,minWidth:118}}>
    {documentos.map(doc=><a key={doc.id||doc.url} href={doc.url} target="_blank" rel="noreferrer" title={doc.nome||doc.legenda} style={{maxWidth:180,color:C.blue,fontSize:"var(--arcd-type-caption)",fontWeight:600,textDecoration:"underline",textUnderlineOffset:2,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{doc.legenda||doc.nome||"Visualizar documento"} ↗</a>)}
    <label style={{color:C.blue,fontSize:"var(--arcd-type-label)",fontWeight:600,textDecoration:"underline",textUnderlineOffset:2,cursor:subindo?"wait":"pointer",whiteSpace:"nowrap"}}>
      {subindo?"Enviando...":documentos.length?"+ Anexar outro":"+ Anexar documento"}
      <input type="file" accept=".pdf,.xml,.doc,.docx,.xls,.xlsx,.csv,.txt,image/*" disabled={subindo} onChange={onSelecionar} style={{display:"none"}}/>
    </label>
  </div>;
}


export function ModalLegendaDocumento({anexo,setAnexo,onClose,onSalvar,salvando=false,titulo="Anexar documento",C=C_ARCD_SETOR}){
  if(!anexo)return null;
  return <Modal title={titulo} onClose={onClose}><div style={{display:"flex",flexDirection:"column",gap:11}}>
    <div style={{padding:"9px 11px",border:`1px solid ${C.border}`,borderRadius:8,background:C.surface}}><p style={{fontSize:"var(--arcd-type-caption)",fontWeight:600,color:C.muted,textTransform:"uppercase"}}>Arquivo selecionado</p><p style={{fontSize:"var(--arcd-type-label)",fontWeight:600,color:C.text,marginTop:3,overflowWrap:"anywhere"}}>{anexo.file?.name}</p></div>
    <Inp label="Legenda do documento *" value={anexo.legenda||""} onChange={v=>setAnexo(a=>({...a,legenda:v}))} placeholder="Ex.: Cotação atualizada, comprovante de pagamento..."/>
    <p style={{fontSize:"var(--arcd-type-caption)",color:C.muted,lineHeight:1.45}}>A legenda será exibida como link. Você poderá anexar outros documentos ao mesmo registro.</p>
    <div style={{display:"flex",gap:8}}><Btn v="ghost" onClick={onClose} disabled={salvando} full>Cancelar</Btn><Btn onClick={onSalvar} disabled={salvando||!String(anexo.legenda||"").trim()} full><Ic n="upload"/> {salvando?"Salvando no Drive...":"Anexar documento"}</Btn></div>
  </div></Modal>;
}
