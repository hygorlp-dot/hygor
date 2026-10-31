import {useEffect,useMemo,useState} from "react";
import {marcellReportHtml} from "../../../reports/marcell-report.js";
import {Badge,Btn,C,Ic,Inp,Modal,PageHero,Sel,uid} from "../../../LegacyApp";
import {extrairNotaPatrimonioIA,obterDocumentoPatrimonio,subirDocumentoPatrimonio} from "../../../api";
import {fornecedorPorDocumento,lerXmlNfe} from "../../compras/nfe-xml";
import {loadPatrimonyPhotos} from "../report-photos.js";
import {OPERATIONAL_COMMAND} from "../../sync/operational-commands";
import {useBreakpoint} from "../../../hooks/useBreakpoint";
import {isAppleHeic,isPatrimonyAssetPhotoMime,patrimonyDocumentMime,PATRIMONY_DOCUMENT_MAX_BYTES,PATRIMONY_DOCUMENT_MAX_MB,withDataUrlMime} from "../document-policy";
import {buildPatrimonyReportHtml} from "../report.js";

const CATEGORIAS=["Informática","Telefonia","Ferramentas","Máquinas","Móveis","Eletroeletrônicos","Veículos","Segurança","Outros"];
const STATUS=[{v:"ativo",l:"Ativo"},{v:"em_uso",l:"Em uso"},{v:"manutencao",l:"Manutenção"},{v:"extraviado",l:"Extraviado"},{v:"baixado",l:"Baixado"}];
const LOCAIS=[{v:"empresa",l:"Sede / empresa"},{v:"almoxarifado",l:"Almoxarifado"},{v:"obra",l:"Obra (somente localização)"},{v:"funcionario",l:"Com funcionário"},{v:"outro",l:"Outro"}];
const card={background:C.card,border:"1px solid "+C.border,borderRadius:8,padding:14};
const money=v=>Number(v||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const digits=v=>String(v||"").replace(/\D/g,"");
const key=prefix=>(prefix+"-"+(globalThis.crypto?.randomUUID?.()||Date.now()+"-"+Math.random().toString(36).slice(2))).replace(/[^a-zA-Z0-9_-]/g,"").slice(0,160);
const dataUrl=file=>new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result||""));r.onerror=()=>reject(new Error("Não foi possível ler o arquivo."));r.readAsDataURL(file);});
const durable=descricao=>{
  const t=String(descricao||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toUpperCase();
  if(/CIMENTO|ARGAMASSA|AREIA|BRITA|TIJOLO|BLOCO|TUBO|CABO|FIO|TINTA|MASSA|PARAFUSO|PREGO|COMBUSTIVEL|DIESEL|GASOLINA/.test(t))return false;
  return /CELULAR|SMARTPHONE|NOTEBOOK|COMPUTADOR|MONITOR|TABLET|IMPRESSORA|ROTEADOR|CAMERA|FURADEIRA|PARAFUSADEIRA|MARTELETE|SERRA|LIXADEIRA|ESMERILHADEIRA|BETONEIRA|COMPRESSOR|GERADOR|BOMBA|MAQUINA|EQUIPAMENTO|FERRAMENTA|CADEIRA|MESA|ARMARIO|AR CONDICIONADO|GELADEIRA|MICROONDAS|VEICULO|CARRO|MOTO/.test(t);
};
const vazio=()=>({id:uid(),assetTag:"",name:"",category:"Outros",description:"",manufacturer:"",model:"",serialNumber:"",imei:"",plate:"",
  acquisitionValue:0,acquisitionDate:new Date().toISOString().slice(0,10),status:"ativo",
  location:{type:"empresa",label:"Sede",referenceId:""},custodian:{type:"",id:"",name:""},
  invoice:{number:"",series:"",accessKey:"",issueDate:"",supplierName:"",supplierDocument:"",supplierId:"",totalValue:0,itemNumber:0,unitIndex:1,sourceQuantity:1,itemDescription:"",itemValue:0,source:"manual",confidence:0,document:{}},
  photo:{name:"",url:"",path:"",mime:"",size:0},notes:"",version:0});

function AssetForm({asset,setAsset,onSave,onClose,busy,showToast}){
  const F=k=>v=>setAsset(s=>({...s,[k]:v}));
  const selectPhoto=async f=>{
    if(!f)return;
    if(!isPatrimonyAssetPhotoMime(f.type)){showToast("Use JPG, PNG ou WEBP para a foto do patrimônio.","error");return;}
    if(Number(f.size||0)>PATRIMONY_DOCUMENT_MAX_BYTES){showToast(`A foto ultrapassa ${PATRIMONY_DOCUMENT_MAX_MB} MB. Comprima a imagem antes de anexar.`,"error");return;}
    try{
      const preview=await dataUrl(f);
      const ext=String(f.name||"").split(".").pop()?.toLowerCase()||String(f.type||"image/jpeg").split("/")[1]||"jpg";
      setAsset(current=>({...current,_photoUpload:{dataUrl:preview,ext,name:f.name||"foto",mime:f.type||"",size:Number(f.size||0)},_photoPreview:preview}));
    }catch(error){showToast(error?.message||"Não foi possível preparar a foto.","error");}
  };
  return <Modal title={asset.version?"Editar patrimônio":"Novo patrimônio"} onClose={onClose}><div style={{display:"grid",gap:9}}>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(170px,1fr))",gap:8}}><Inp label="Código patrimonial" value={asset.assetTag||""} onChange={F("assetTag")} placeholder="Gerado ao salvar: PAT-000001"/><Sel label="Categoria" value={asset.category||"Outros"} onChange={F("category")} options={CATEGORIAS.map(v=>({v,l:v}))}/></div>
    <Inp label="Bem *" value={asset.name||""} onChange={F("name")} placeholder="Ex.: Notebook Dell Latitude"/>
    <Inp label="Descrição" value={asset.description||""} onChange={F("description")}/>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(170px,1fr))",gap:8}}><Inp label="Fabricante" value={asset.manufacturer||""} onChange={F("manufacturer")}/><Inp label="Modelo" value={asset.model||""} onChange={F("model")}/></div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:8}}><Inp label="Nº de série" value={asset.serialNumber||""} onChange={F("serialNumber")}/><Inp label="IMEI" value={asset.imei||""} onChange={F("imei")}/><Inp label="Placa" value={asset.plate||""} onChange={F("plate")}/></div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(170px,1fr))",gap:8}}><Inp label="Valor de aquisição" type="number" value={asset.acquisitionValue||0} onChange={F("acquisitionValue")}/><Inp label="Data de aquisição" type="date" value={asset.acquisitionDate||""} onChange={F("acquisitionDate")}/></div>
    {!asset.version&&<>
      <Sel label="Localização inicial" value={asset.location?.type||"empresa"} onChange={v=>setAsset(s=>({...s,location:{...(s.location||{}),type:v}}))} options={LOCAIS}/>
      <Inp label="Local inicial" value={asset.location?.label||""} onChange={v=>setAsset(s=>({...s,location:{...(s.location||{}),label:v}}))} placeholder="Sede, almoxarifado ou local atual"/>
      <Inp label="Responsável inicial pelo bem" value={asset.custodian?.name||""} onChange={v=>setAsset(s=>({...s,custodian:{...(s.custodian||{}),name:v,type:v?"external":""}}))}/>
    </>}
    {!!asset.version&&<div style={card}><b>Controle operacional</b><p style={{fontSize:"var(--arcd-type-label)",color:C.muted,marginTop:4}}>Situação: {STATUS.find(s=>s.v===asset.status)?.l||asset.status} · Local: {asset.location?.label||"Sede"}. Use as ações "Mover" e "Status" na lista para manter o histórico auditável.</p></div>}
    <div style={card}>
      <b>Foto do bem</b>
      <p style={{fontSize:"var(--arcd-type-label)",color:C.muted,marginTop:4}}>Tire uma foto ou escolha da galeria. JPG, PNG ou WEBP, até {PATRIMONY_DOCUMENT_MAX_MB} MB.</p>
      {asset._photoPreview&&<img src={asset._photoPreview} alt={"Prévia de "+(asset.name||"patrimônio")} style={{width:120,height:90,objectFit:"cover",borderRadius:7,border:"1px solid "+C.border,marginTop:8}}/>}
      {!asset._photoPreview&&asset.photo?.path&&<button type="button" onClick={async()=>{const tab=window.open("about:blank","_blank");const r=await obterDocumentoPatrimonio(asset.photo.path);if(r.ok&&r.url&&tab){tab.location.href=r.url;}else{tab?.close();showToast(r.error||"Não foi possível abrir a foto.","error");}}} style={{display:"block",border:0,background:"transparent",padding:"6px 0 0",color:C.blue,textAlign:"left",cursor:"pointer"}}>Abrir foto atual</button>}
      <input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>selectPhoto(e.target.files?.[0]||null)} style={{marginTop:8}}/>
      {asset._photoUpload&&<p style={{fontSize:"var(--arcd-type-caption)",color:C.green,marginTop:4}}>Nova foto pronta para salvar.</p>}
    </div>
    <div style={card}><b>Nota fiscal</b><p style={{fontSize:"var(--arcd-type-label)",color:C.muted,marginTop:4}}>{asset.invoice?.number?"NF "+asset.invoice.number+" · "+(asset.invoice.supplierName||"Fornecedor"):"Sem nota vinculada"}</p>{asset.invoice?.document?.path&&<button type="button" onClick={async()=>{const tab=window.open("about:blank","_blank");const r=await obterDocumentoPatrimonio(asset.invoice.document.path);if(r.ok&&r.url&&tab){tab.location.href=r.url;}else{tab?.close();}}} style={{border:0,background:"transparent",padding:0,color:C.blue,textAlign:"left",cursor:"pointer"}}>Abrir documento fiscal</button>}</div>
    <Inp label="Observações" value={asset.notes||""} onChange={F("notes")}/>
    <div style={{display:"flex",justifyContent:"flex-end",gap:8}}><Btn v="ghost" onClick={onClose}>Cancelar</Btn><Btn onClick={onSave} disabled={busy||!String(asset.name||"").trim()}>{busy?"Salvando...":"Salvar"}</Btn></div>
  </div></Modal>;
}

function ImportInvoice({data,dispatchCommand,showToast,onClose}){
  const [file,setFile]=useState(null),[raw,setRaw]=useState(""),[proposal,setProposal]=useState(null),[busy,setBusy]=useState(false);
  const fornecedor=proposal?fornecedorPorDocumento(data.fornecedores,proposal.invoice?.documentoFornecedor):null;
  const prepare=async f=>{
    setFile(f);setProposal(null);if(!f)return;setBusy(true);
    try{
      const ext=String(f.name||"").split(".").pop()?.toLowerCase();
      if(Number(f.size||0)>PATRIMONY_DOCUMENT_MAX_BYTES)throw new Error(`Documento fiscal acima de ${PATRIMONY_DOCUMENT_MAX_MB} MB. Comprima o arquivo antes de importar.`);
      if(isAppleHeic(f.name,f.type))throw new Error("Foto HEIC do iPhone não é aceita. Envie o PDF da nota ou tire a foto em JPG (Ajustes > Câmera > Formatos > Mais compatível).");
      // PDF vindo do WhatsApp/e-mail costuma chegar sem tipo: a extensão decide.
      const mime=patrimonyDocumentMime(f.name,f.type);
      if(!mime)throw new Error("Formato não reconhecido. Envie XML, PDF, JPG, PNG ou WEBP da nota fiscal.");
      const encoded=withDataUrlMime(await dataUrl(f),mime==="text/xml"?"application/xml":mime);
      setRaw(encoded);
      if(ext==="xml"||["application/xml","text/xml"].includes(mime)){
        const n=lerXmlNfe(await f.text());if(n.erro)throw new Error(n.erro);
        setProposal({source:"xml",invoice:n,items:(n.itens||[]).map(i=>({...i,quantidade:Number(i.qtd||1),valorUnitario:Number(i.precoUnit||0),categoria:"Outros",marca:"",modelo:"",numeroSerie:"",imei:"",patrimonial:durable(i.descricao),confianca:1,justificativa:"Extraído diretamente do XML."}))});
      }else{
        const r=await extrairNotaPatrimonioIA({dataUrl:encoded,fileName:f.name});if(!r.ok)throw new Error(r.error||"A IA não conseguiu ler a nota.");
        setProposal({source:"ai",invoice:r.invoice,items:r.items||[]});
      }
    }catch(e){showToast(e.message||"Falha ao ler a nota.","error");}finally{setBusy(false);}
  };
  const patch=(i,p)=>setProposal(s=>({...s,items:s.items.map((x,j)=>j===i?{...x,...p}:x)}));
  const save=async()=>{
    const selected=(proposal?.items||[]).filter(i=>i.patrimonial);if(!selected.length){showToast("Selecione ao menos um item.","error");return;}setBusy(true);
    try{
      const ext=String(file.name||"").split(".").pop()?.toLowerCase()||"pdf";
      const up=await subirDocumentoPatrimonio({dataUrl:raw,ext});if(!up.ok)throw new Error(up.error||"Não foi possível arquivar a nota.");
      const doc={name:file.name,url:"",path:up.path||"",mime:patrimonyDocumentMime(file.name,file.type)||file.type||"",size:file.size||0};
      const assets=[];
      for(const item of selected){
        const qty=Math.max(1,Math.trunc(Number(item.quantidade)||1));
        if(qty>200)throw new Error("Um item da nota possui mais de 200 unidades patrimoniais. Divida o cadastro em lotes para confirmar a individualização.");
        const valorUnitario=Number(item.valorUnitario||0)>0
          ?Number(item.valorUnitario)
          :(Number(item.valorTotal||0)>0?Number(item.valorTotal)/qty:0);
        for(let unit=1;unit<=qty;unit++){
          const a=vazio();a.id=uid();a.name=item.descricao||"Bem patrimonial";a.category=item.categoria||"Outros";a.manufacturer=item.marca||"";a.model=item.modelo||"";
          a.serialNumber=unit===1?(item.numeroSerie||""):"";a.imei=unit===1?(item.imei||""):"";a.acquisitionValue=valorUnitario;a.acquisitionDate=proposal.invoice?.emissao||a.acquisitionDate;
          a.invoice={number:proposal.invoice?.numero||"",series:proposal.invoice?.serie||"",accessKey:digits(proposal.invoice?.chave),issueDate:proposal.invoice?.emissao||"",supplierName:proposal.invoice?.fornecedorNome||"",supplierDocument:digits(proposal.invoice?.documentoFornecedor),supplierId:fornecedor?.id||"",totalValue:Number(proposal.invoice?.valorBruto||0),itemNumber:Number(item.nItem||0),unitIndex:unit,sourceQuantity:Number(item.quantidade||1),itemDescription:item.descricao||"",itemValue:valorUnitario,source:proposal.source,confidence:Number(item.confianca||0),document:doc};
          assets.push(a);
        }
      }
      if(assets.length>500)throw new Error("A nota gerou mais de 500 bens patrimoniais. Divida a importação em lotes menores.");
      const operationKey=key("asset-import");
      const r=await dispatchCommand({type:OPERATIONAL_COMMAND.ASSETS_IMPORTED,idempotencyKey:operationKey,payload:{assets,invoiceAccessKey:digits(proposal.invoice?.chave)}});
      if(!r.ok)throw new Error(r.reason||"Falha ao cadastrar os bens da nota.");
      showToast(String(assets.length)+" bem(ns) incluído(s) no patrimônio da empresa.");onClose();
    }catch(e){showToast(e.message||"Falha ao gravar patrimônio.","error");}finally{setBusy(false);}
  };
  return <Modal title="Importar NF para patrimônio" onClose={onClose}><div style={{display:"grid",gap:10}}>
    <div style={{...card,borderStyle:"dashed"}}><b>XML, PDF ou foto da nota fiscal</b><p style={{fontSize:"var(--arcd-type-label)",color:C.muted,marginTop:4}}>XML é lido diretamente. PDF/foto usa IA e exige revisão antes de salvar. Máx. {PATRIMONY_DOCUMENT_MAX_MB} MB por arquivo.</p><input type="file" accept=".xml,application/xml,text/xml,application/pdf,image/jpeg,image/png,image/webp" onChange={e=>prepare(e.target.files?.[0]||null)} style={{marginTop:10}}/></div>
    {busy&&!proposal&&<div style={card}>Lendo documento...</div>}
    {proposal&&<><div style={card}><b>{"NF "+(proposal.invoice?.numero||"—")}</b><p style={{fontSize:"var(--arcd-type-label)",color:C.muted}}>{(proposal.invoice?.fornecedorNome||"Fornecedor não identificado")+" · "+money(proposal.invoice?.valorBruto)}{fornecedor?" · fornecedor já cadastrado":""}</p>{proposal.source==="ai"&&<p style={{fontSize:"var(--arcd-type-caption)",color:C.orange}}>Leitura por IA: revise antes de gravar.</p>}</div>
    <div style={{display:"grid",gap:7,maxHeight:"44vh",overflowY:"auto"}}>{(proposal.items||[]).map((i,index)=><div key={index} style={{...card,borderColor:i.patrimonial?C.green:C.border}}>
      <label style={{display:"flex",gap:8}}><input type="checkbox" checked={!!i.patrimonial} onChange={e=>patch(index,{patrimonial:e.target.checked})}/><span><b>{i.descricao||"Item"}</b><small style={{display:"block",color:C.muted}}>{String(i.quantidade||1)+" un. · "+money(i.valorUnitario||i.valorTotal)}</small></span></label>
      {i.patrimonial&&<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(170px,1fr))",gap:6,marginTop:8}}><Sel label="Categoria" value={i.categoria||"Outros"} onChange={v=>patch(index,{categoria:v})} options={CATEGORIAS.map(v=>({v,l:v}))}/><Inp label="Qtd. patrimonial" type="number" value={i.quantidade||1} onChange={v=>patch(index,{quantidade:v})}/><Inp label="Marca" value={i.marca||""} onChange={v=>patch(index,{marca:v})}/><Inp label="Modelo" value={i.modelo||""} onChange={v=>patch(index,{modelo:v})}/><Inp label="Série" value={i.numeroSerie||""} onChange={v=>patch(index,{numeroSerie:v})}/><Inp label="IMEI" value={i.imei||""} onChange={v=>patch(index,{imei:v})}/></div>}
    </div>)}</div><div style={{display:"flex",justifyContent:"flex-end",gap:8}}><Btn v="ghost" onClick={onClose}>Cancelar</Btn><Btn onClick={save} disabled={busy}>{busy?"Salvando...":"Cadastrar selecionados"}</Btn></div></>}
  </div></Modal>;
}

export default function PatrimonioEmpresaView({data,showToast,dispatchCommand}){
  const {isMobile}=useBreakpoint();
  const [search,setSearch]=useState(""),[status,setStatus]=useState("ativos"),[editor,setEditor]=useState(null),[importing,setImporting]=useState(false),[busy,setBusy]=useState(false);
  const [move,setMove]=useState(null),[statusEdit,setStatusEdit]=useState(null),[history,setHistory]=useState(null);
  const [menuAberto,setMenuAberto]=useState("");
  // Ao abrir o menu "Mais ações", o foco vai para o primeiro item (só na abertura).
  useEffect(()=>{if(!menuAberto)return;const menu=[...document.querySelectorAll("[data-menu-de]")].find(el=>el.dataset.menuDe===String(menuAberto));menu?.querySelector("[role=menuitem]")?.focus();},[menuAberto]);
  const assets=Array.isArray(data?.companyAssets)?data.companyAssets:[];
  const filtered=useMemo(()=>assets.filter(a=>(status==="todos"||status==="ativos"&&a.active!==false||a.status===status)&&(!search.trim()||[a.assetTag,a.name,a.category,a.serialNumber,a.imei,a.invoice?.number,a.invoice?.supplierName].some(v=>String(v||"").toLowerCase().includes(search.toLowerCase())))),[assets,search,status]);
  const active=assets.filter(a=>a.active!==false),total=active.reduce((s,a)=>s+Number(a.acquisitionValue||0),0),docs=active.filter(a=>a.invoice?.document?.path||a.invoice?.number).length;
  const save=async()=>{setBusy(true);try{
    const {_photoUpload,_photoPreview,...assetBase}=editor||{};
    let assetToSave=assetBase;
    if(_photoUpload){
      const up=await subirDocumentoPatrimonio({dataUrl:_photoUpload.dataUrl,ext:_photoUpload.ext});
      if(!up.ok)throw new Error(up.error||"Não foi possível arquivar a foto do patrimônio.");
      assetToSave={...assetBase,photo:{name:_photoUpload.name,url:"",path:up.path||"",mime:_photoUpload.mime,size:_photoUpload.size}};
    }
    const r=await dispatchCommand({type:OPERATIONAL_COMMAND.ASSET_SAVED,idempotencyKey:key("asset-save"),expectedVersion:Number(editor?.version||0),payload:{asset:assetToSave}});
    if(!r.ok)throw new Error(r.reason||"Falha ao salvar.");
    showToast(editor.version?"Patrimônio atualizado.":"Patrimônio cadastrado.");setEditor(null);
  }catch(e){showToast(e.message,"error");}finally{setBusy(false);}};
  const saveMove=async()=>{setBusy(true);try{const r=await dispatchCommand({type:OPERATIONAL_COMMAND.ASSET_MOVED,idempotencyKey:key("asset-move"),expectedVersion:Number(move?.version||0),payload:{assetId:move.id,location:move.location,custodian:move.custodian,reason:move.reason||""}});if(!r.ok)throw new Error(r.reason||"Falha ao movimentar patrimônio.");showToast("Movimentação patrimonial registrada.");setMove(null);}catch(e){showToast(e.message||"Falha ao movimentar.","error");}finally{setBusy(false);}};
  const saveStatus=async()=>{setBusy(true);try{const r=await dispatchCommand({type:OPERATIONAL_COMMAND.ASSET_STATUS_CHANGED,idempotencyKey:key("asset-status"),expectedVersion:Number(statusEdit?.version||0),payload:{assetId:statusEdit.id,status:statusEdit.nextStatus,reason:statusEdit.reason||""}});if(!r.ok)throw new Error(r.reason||"Falha ao alterar situação.");showToast("Situação patrimonial atualizada.");setStatusEdit(null);}catch(e){showToast(e.message||"Falha ao alterar situação.","error");}finally{setBusy(false);}};
  const gerarRelatorio=async()=>{
    if(!filtered.length){showToast("Nenhum patrimônio no recorte atual para gerar o relatório.","error");return;}
    const statusLabel=status==="todos"?"Todos os bens":status==="ativos"?"Bens ativos":(STATUS.find(item=>item.v===status)?.l||status);
    const filtro="Recorte: "+statusLabel+(search.trim()?' · Busca: "'+search.trim()+'"':"");
    // A janela abre antes das buscas para não ser barrada como pop-up.
    const w=window.open("","_blank");
    if(!w){showToast("Permita pop-ups para gerar o relatório de patrimônio.","error");return;}
    w.opener=null;
    w.document.write("<p style=\"font-family:sans-serif;padding:24px\">Preparando relatório e fotos…</p>");
    const photos=await loadPatrimonyPhotos(filtered,obterDocumentoPatrimonio);
    const html=buildPatrimonyReportHtml({
      assets:filtered,
      companyName:data?.config?.companyName||"MARCELL",
      filterLabel:filtro,
      photos,
    });
    w.document.open();
    w.document.write(marcellReportHtml(html));
    w.document.close();
  };
  return <div className="anim patrimony-workspace" style={{display:"flex",flexDirection:"column",gap:12}}>
    <PageHero eyebrow="Administração" title="Patrimônio da empresa" description="Bens corporativos da empresa, com nota fiscal, identificação física, localização atual e histórico." stats={[{label:"Bens ativos",value:String(active.length),color:C.green},{label:"Valor de aquisição",value:money(total)},{label:"Com nota/documento",value:String(docs)+"/"+String(active.length),color:docs===active.length?C.green:C.orange}]} actions={<div style={{display:"flex",gap:8,flexWrap:"wrap"}}><Btn v="ghost" onClick={gerarRelatorio}><Ic n="fileText"/> Relatório</Btn><Btn v="ghost" onClick={()=>setImporting(true)}><Ic n="receipt"/> Importar NF</Btn><Btn onClick={()=>setEditor(vazio())}><Ic n="plus"/> Novo bem</Btn></div>}/>
    <div className="patrimony-filters"><div><Inp label="Buscar" value={search} onChange={setSearch} placeholder="Código, bem, série, IMEI, NF ou fornecedor"/></div><div><Sel label="Situação" value={status} onChange={setStatus} options={[{v:"ativos",l:"Ativos"},{v:"todos",l:"Todos"}].concat(STATUS)}/></div></div>
    {/* Padrão MARCELL: tabela alinhada; uma ação direta (Editar) e as demais no menu "Mais ações". */}
    <section className="patrimonio-lista" aria-label="Bens patrimoniais">
      <p className="patrimonio-lista__nota">O bem pertence à empresa. Uma obra pode aparecer apenas como localização temporária.</p>
      {!filtered.length?<p className="patrimonio-lista__vazio">Nenhum patrimônio encontrado.</p>:<>
        {!isMobile&&<div className="patrimonio-lista__cabecalho" aria-hidden="true"><span>Bem</span><span>Situação</span><span>Local e nota fiscal</span><span className="patrimonio-lista__num">Valor de aquisição</span><span/></div>}
        {filtered.map(a=>{const aberto=menuAberto===a.id;const fechar=()=>setMenuAberto("");return <div key={a.id} className="patrimonio-lista__linha" data-mobile={isMobile||undefined}>
          <div className="patrimonio-lista__bem"><span className="patrimonio-lista__nome">{a.name}</span><span className="patrimonio-lista__meta">{a.assetTag||"Sem código"}{a.serialNumber?", série "+a.serialNumber:""}{a.imei?", IMEI "+a.imei:""}</span></div>
          <div><Badge color={a.status==="baixado"?C.muted:a.status==="extraviado"?C.red:a.status==="manutencao"?C.orange:C.green}>{STATUS.find(s=>s.v===a.status)?.l||a.status}</Badge></div>
          <div className="patrimonio-lista__local"><span>{a.location?.label||"Sede"}</span><span className="patrimonio-lista__meta">{a.invoice?.number?"NF "+a.invoice.number:"Sem NF"}</span></div>
          <div className="patrimonio-lista__num"><span className="patrimony-value-label">Valor de aquisição</span>{money(a.acquisitionValue)}</div>
          <div className="patrimonio-lista__acoes" onKeyDown={e=>{if(e.key==="Escape"&&aberto){fechar();e.currentTarget.querySelector("[aria-haspopup]")?.focus();}}} onBlur={e=>{if(aberto&&!e.currentTarget.contains(e.relatedTarget))fechar();}}>
            <Btn size="sm" v="ghost" onClick={()=>setEditor(JSON.parse(JSON.stringify(a)))}>Editar</Btn>
            <div className="patrimonio-lista__menu">
              <Btn size="sm" v="ghost" ariaLabel={"Mais ações de "+a.name} aria-expanded={aberto} aria-haspopup="menu" onClick={()=>setMenuAberto(aberto?"":a.id)}><Ic n="more"/></Btn>
              {aberto&&<div role="menu" className="patrimonio-lista__popover" data-menu-de={a.id}>
                {a.photo?.path&&<button type="button" role="menuitem" onClick={async()=>{fechar();const tab=window.open("about:blank","_blank");const r=await obterDocumentoPatrimonio(a.photo.path);if(r.ok&&r.url&&tab){tab.location.href=r.url;}else{tab?.close();showToast(r.error||"Não foi possível abrir a foto.","error");}}}>Foto</button>}
                <button type="button" role="menuitem" onClick={()=>{fechar();setHistory(a);}}>Histórico</button>
                {a.active!==false&&<button type="button" role="menuitem" onClick={()=>{fechar();setMove({...JSON.parse(JSON.stringify(a)),reason:""});}}>Mover…</button>}
                {a.active!==false&&<button type="button" role="menuitem" onClick={()=>{fechar();setStatusEdit({...a,nextStatus:a.status,reason:""});}}>Alterar status…</button>}
              </div>}
            </div>
          </div>
        </div>;})}
      </>}
    </section>
    {editor&&<AssetForm asset={editor} setAsset={setEditor} onSave={save} onClose={()=>setEditor(null)} busy={busy} showToast={showToast}/>}
    {importing&&<ImportInvoice data={data} dispatchCommand={dispatchCommand} showToast={showToast} onClose={()=>setImporting(false)}/>}
    {move&&<Modal title="Movimentar patrimônio" onClose={()=>setMove(null)}><div style={{display:"grid",gap:9}}>
      <b>{move.name}</b>
      <Sel label="Tipo de localização" value={move.location?.type||"empresa"} onChange={v=>setMove(s=>({...s,location:{...(s.location||{}),type:v}}))} options={LOCAIS}/>
      <Inp label="Local atual" value={move.location?.label||""} onChange={v=>setMove(s=>({...s,location:{...(s.location||{}),label:v}}))} placeholder="Ex.: Sede, almoxarifado, H2 04"/>
      <Inp label="Responsável pelo bem" value={move.custodian?.name||""} onChange={v=>setMove(s=>({...s,custodian:{...(s.custodian||{}),name:v,type:v?"external":""}}))}/>
      <Inp label="Motivo / observação" value={move.reason||""} onChange={v=>setMove(s=>({...s,reason:v}))}/>
      <div style={{display:"flex",justifyContent:"flex-end",gap:8}}><Btn v="ghost" onClick={()=>setMove(null)}>Cancelar</Btn><Btn onClick={saveMove} disabled={busy}>{busy?"Salvando...":"Registrar movimentação"}</Btn></div>
    </div></Modal>}
    {statusEdit&&<Modal title="Alterar situação patrimonial" onClose={()=>setStatusEdit(null)}><div style={{display:"grid",gap:9}}>
      <b>{statusEdit.name}</b>
      <Sel label="Nova situação" value={statusEdit.nextStatus||"ativo"} onChange={v=>setStatusEdit(s=>({...s,nextStatus:v}))} options={STATUS}/>
      <Inp label="Motivo" value={statusEdit.reason||""} onChange={v=>setStatusEdit(s=>({...s,reason:v}))} placeholder="Obrigatório para baixa ou extravio"/>
      <div style={{display:"flex",justifyContent:"flex-end",gap:8}}><Btn v="ghost" onClick={()=>setStatusEdit(null)}>Cancelar</Btn><Btn onClick={saveStatus} disabled={busy}>{busy?"Salvando...":"Confirmar"}</Btn></div>
    </div></Modal>}
    {history&&<Modal title={"Histórico · "+history.name} onClose={()=>setHistory(null)}><div style={{display:"grid",gap:8,maxHeight:"60vh",overflowY:"auto"}}>
      {!(history.operationalHistory||[]).length?<p style={{color:C.muted}}>Sem eventos registrados.</p>:[...(history.operationalHistory||[])].reverse().map(event=><div key={event.id} style={card}><b style={{fontSize:"var(--arcd-type-body)"}}>{event.type}</b><p style={{fontSize:"var(--arcd-type-label)",color:C.muted,marginTop:3}}>{event.at?new Date(event.at).toLocaleString("pt-BR"):""}{event.actorName?" · "+event.actorName:""}</p>{event.after?.reason&&<p style={{fontSize:"var(--arcd-type-label)",marginTop:4}}>{event.after.reason}</p>}</div>)}
    </div></Modal>}
  </div>;
}
