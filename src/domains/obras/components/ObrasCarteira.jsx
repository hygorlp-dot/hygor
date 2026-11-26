// @ts-check
import { useCallback, useEffect, useMemo, useState } from "react";
import { conectarOneDrive, criarEstruturaOneDrive, sincronizarEstruturasOneDrive, statusOneDrive } from "../../../api.js";
import { useCompanyAssetUrl } from "../../../components/CompanyAsset.jsx";
import { Button as StandardButton } from "../../../components/ui/button.jsx";
import { Input as StandardInput } from "../../../components/ui/input.jsx";
import { contar } from "../../../design-system/copy.js";
import { RecordListPagination } from "../../../design-system/data/RecordListPagination.jsx";
import { useRecordPage } from "../../../design-system/data/useRecordPage.js";
import { ChoiceControl } from "../../../design-system/primitives/ChoiceControl.jsx";
import { RecordAction } from "../../../design-system/primitives/RecordAction.jsx";
import { SelectControl } from "../../../design-system/primitives/Select.jsx";
import { useWorkspaceState } from "../../../features/workflow/workspace-session.jsx";
import { useBreakpoint } from "../../../hooks/useBreakpoint.js";
import { fmt, fmtCompact, fmtDate, today, uid } from "../../../legacy/format.js";
import { C, FONT_DISPLAY, KB } from "../../../legacy/palette.js";
import { Badge, Btn, Ic, Inp, Modal, PageHero, Sel } from "../../../legacy/ui.jsx";
import { sessionContext } from "../../../lib/session-context.js";
import { formatBrazilianDocument as maskDoc, digitsOnly as soDigitos } from "../../data/brazilian-documents.js";
import { workExpenseCategories as categoriasDesp } from "../../dre/work-expense-categories.js";
import { CONTRACT_LABELS as contractLabels, DIA_VENC_1_PADRAO, DIA_VENC_2_PADRAO } from "../../licenciamento/legacy-checklists.js";
import { OPERATIONAL_COMMAND } from "../../sync/operational-commands.js";
import { prazoObra } from "../legacy-deadline.js";
import { projectAlertAction, validateProjectForm } from "../project-validation.js";

/** @type {Record<string,string|undefined>} */
const CONTRACT_LABELS = contractLabels;

/** @param {{reference?: string, onOpen: () => void, children: import('react').ReactNode}} props */
function CapaObra({ reference, onOpen, children }) {
  const { url } = useCompanyAssetUrl(reference);
  return <RecordAction data-has-image={!!url} className="works-card-cover" onClick={onOpen}
    style={{ "--work-cover-image": url ? `url(${JSON.stringify(url)})` : undefined }}>
    {!url && <span aria-hidden="true" style={{position:"absolute",right:-24,top:-46,width:180,height:180,borderRadius:"var(--arcd-radius-pill)",border:"var(--arcd-border-width) solid color-mix(in srgb, var(--arcd-action-primary) 33%, transparent)",boxShadow:"none"}}/>}
    {children}
  </RecordAction>;
}

// Paleta oferecida ao criar/editar uma fase
const CORES_FASE = [
  "#D4AF37", "#0D47A1", "#1E6B31", "#B71C1C", "#4A148C",
  "#C2185B", "#BF360C", "#00796B", "#6B6459", "#3D3530",
];

const CONTRACT_TYPES = [
  { v: "fixed_labor",       l: "Somente MO - entrada + parcelas fixas"                },
  { v: "admin_only",        l: "Somente Administração - % sobre todos os custos"      },
  { v: "fixed_labor_admin", l: "Misto - MO fixo + % sobre materiais e terceirizados"  },
];

// Frequência de cobrança
// Os dias de vencimento NAO sao mais fixos no codigo: cada obra guarda
// diaVenc1 / diaVenc2 (padrao 15 e 30) e o operador ajusta ao lancar a obra.
const FREQ_OPTS = [
  { v:"mensal",    l:"Mensal - 1 parcela por mês"       },
  { v:"quinzenal", l:"Quinzenal - 2 parcelas por mês"   },
];

// Opcoes de dia para os selects (1..31). "30" em fevereiro vira 28/29 -
// ver clampDiaNoMes abaixo.
const DIA_OPTS = Array.from({length:31}, (_,i) => ({ v:String(i+1), l:`Dia ${i+1}` }));

//
// Obras
//

const clienteContratualVazio = () => ({id:"",leadId:"",nome:"",tipoPessoa:"PF",documento:"",rg:"",orgaoExpedidor:"",dataNascimento:"",nacionalidade:"Brasileira",estadoCivil:"",regimeBens:"",profissao:"",conjugeNome:"",conjugeCpf:"",telefone:"",whatsapp:"",email:"",cep:"",endereco:"",numero:"",complemento:"",bairro:"",cidade:"",uf:"PE",razaoSocial:"",nomeFantasia:"",inscricaoEstadual:"",inscricaoMunicipal:"",representanteNome:"",representanteCpf:"",representanteRg:"",representanteOrgaoExpedidor:"",representanteCargo:"",representanteNacionalidade:"Brasileira",representanteEstadoCivil:"",representanteProfissao:"",observacoes:""});

/** @typedef {ReturnType<typeof clienteContratualVazio> & {createdAt?:string, updatedAt?:string}} ContractClient */
/** @typedef {number|string} FormNumber */
/**
 * @typedef {{id:string, name:string, status:string, contractType:string, version?:number,
 *   clienteId?:string, cliente?:string, address?:string, condominioId?:string, condominioNome?:string,
 *   quadra?:string, lote?:string, engineer?:string, engineerId?:string, startDate?:string,
 *   faseId?:string, areaM2?:FormNumber, capaUrl?:string, oneDriveUrl?:string,
 *   oneDriveDriveId?:string, oneDriveFolderId?:string, oneDriveFolders?:Record<string, unknown>,
 *   oneDriveStructureVersion?:number, oneDriveStructureSyncedAt?:string,
 *   contractValue?:FormNumber, adminPercentage?:FormNumber, billingType?:string, parcelaMensal?:FormNumber,
 *   contractStart?:string, contractEnd?:string, totalParcelas?:FormNumber,
 *   billingFrequency?:string, diaVenc1?:FormNumber, diaVenc2?:FormNumber,
 *   entrada?:FormNumber, entradaDate?:string, hasCaixa?:boolean,
 *   adminBaseMateriais?:boolean, adminBaseMaoDeObra?:boolean, adminBaseTerceirizados?:boolean,
 *   adminBaseEquipamentos?:boolean, adminBaseEngenhariaCampo?:boolean, adminFieldEngineeringCategoryId?:string
 * }} WorkRecord
 */
/** @typedef {{id:string,nome:string,cor:string,ordem:number}} WorkPhase */
/** @typedef {{id:string,nome:string,role:string,active?:boolean}} WorkUser */
/** @typedef {{obra?:string,lastObra?:string,active?:boolean}} WorkEmployee */
/** @typedef {{obras:WorkRecord[],employees:WorkEmployee[],usuarios?:WorkUser[], fases?:WorkPhase[], fasesVersion?:FormNumber,
 *   comercial?:{clientes?:ContractClient[]} & Record<string, unknown>,
 *   condominios?:{id:string,nome:string,cidade?:string,uf?:string,ativo?:boolean}[],config?:{oneDriveRootUrl?:string} & Record<string,unknown>
 * } & Record<string, unknown>} PortfolioData */
/**
 * @typedef {{idempotencyKey:string,expectedVersion:number} & (
 *   {type:typeof OPERATIONAL_COMMAND.PROJECT_SAVED,payload:{project:Partial<WorkRecord>}} |
 *   {type:typeof OPERATIONAL_COMMAND.PROJECT_DELETED,payload:{projectId:string}} |
 *   {type:typeof OPERATIONAL_COMMAND.PROJECT_PHASES_SAVED,payload:{phases:WorkPhase[]}}
 * )} PortfolioCommand
 */
/** @typedef {{ok:boolean,reason?:string}} SaveResult */
/** @typedef {{
 *   data:PortfolioData, currentUser?:WorkUser, onAbrirObra?:(id:string)=>void,
 *   showToast:(message:string,type?:string)=>void,
 *   update:(next:PortfolioData|((current:PortfolioData)=>PortfolioData))=>Promise<SaveResult|undefined>,
 *   dispatchCommand:(command:PortfolioCommand|((current:PortfolioData)=>PortfolioCommand))=>Promise<SaveResult>
 * }} PortfolioProps */
/** @typedef {{id:string,ok:boolean, workspace?:{driveId?:string,folderId?:string,folders?:Record<string,unknown>,webUrl?:string}, migracao?:{conflitos?:number,movidos?:number}}} FolderResult */
/** @typedef {WorkRecord & {_fase?:WorkPhase,_equipe:WorkEmployee[],_diasPrazo:number|null,_alertas:string[],_planejamento:boolean,_execucao:boolean,_completude:number}} WorkSummary */

/** @param {{form:ContractClient,setForm:import("react").Dispatch<import("react").SetStateAction<ContractClient|null>>,onClose:()=>void,onSave:()=>void,formGrid:(count:number)=>string}} props */
function ClienteContratualModal({form,setForm,onClose,onSave,formGrid}){
  const F=(/** @type {keyof ContractClient} */ k)=>(/** @type {string} */ v)=>setForm(f=>({.../** @type {ContractClient} */ (f),[k]:v}));
  const civis=["Solteiro(a)","Casado(a)","União estável","Divorciado(a)","Separado(a)","Viúvo(a)"];
  return <Modal title={form.id?"Editar cliente":"Novo cliente contratual"} onClose={onClose} wide><div style={{display:"flex",flexDirection:"column",gap:"var(--arcd-space-3)"}}>
    <div style={{display:"grid",gridTemplateColumns:formGrid(3),gap:"var(--arcd-space-2)"}}><Sel label="Tipo de pessoa *" value={form.tipoPessoa} onChange={v=>setForm(f=>({.../** @type {ContractClient} */ (f),tipoPessoa:v,documento:""}))} options={[{v:"PF",l:"Pessoa física"},{v:"PJ",l:"Pessoa jurídica"}]}/><Inp label={form.tipoPessoa==="PJ"?"Nome para identificação *":"Nome completo *"} value={form.nome} onChange={F("nome")}/><Inp label={`${form.tipoPessoa==="PJ"?"CNPJ":"CPF"} *`} value={maskDoc(form.documento,form.tipoPessoa)} onChange={v=>F("documento")(soDigitos(v))}/></div>
    {form.tipoPessoa==="PF"?<><p style={{fontSize:"var(--arcd-type-label)",fontWeight:"var(--arcd-font-weight-semibold)",color:"var(--arcd-action-primary)",textTransform:"uppercase"}}>Qualificação pessoal</p><div style={{display:"grid",gridTemplateColumns:formGrid(3),gap:"var(--arcd-space-2)"}}><Inp label="RG / identidade *" value={form.rg} onChange={F("rg")}/><Inp label="Órgão expedidor / UF *" value={form.orgaoExpedidor} onChange={F("orgaoExpedidor")}/><Inp label="Data de nascimento" type="date" value={form.dataNascimento} onChange={F("dataNascimento")}/><Inp label="Nacionalidade *" value={form.nacionalidade} onChange={F("nacionalidade")}/><Sel label="Estado civil *" value={form.estadoCivil} onChange={F("estadoCivil")} options={[{v:"",l:"Selecione"},...civis.map(v=>({v,l:v}))]}/><Inp label="Regime de bens" value={form.regimeBens} onChange={F("regimeBens")}/><Inp label="Profissão *" value={form.profissao} onChange={F("profissao")}/></div>{["Casado(a)","União estável"].includes(form.estadoCivil)&&<div style={{display:"grid",gridTemplateColumns:formGrid(2),gap:"var(--arcd-space-2)"}}><Inp label="Nome do cônjuge/companheiro" value={form.conjugeNome} onChange={F("conjugeNome")}/><Inp label="CPF do cônjuge/companheiro" value={maskDoc(form.conjugeCpf,"PF")} onChange={v=>F("conjugeCpf")(soDigitos(v))}/></div>}</>:<><p style={{fontSize:"var(--arcd-type-label)",fontWeight:"var(--arcd-font-weight-semibold)",color:"var(--arcd-action-primary)",textTransform:"uppercase"}}>Empresa e representante legal</p><div style={{display:"grid",gridTemplateColumns:formGrid(3),gap:"var(--arcd-space-2)"}}><Inp label="Razão social *" value={form.razaoSocial} onChange={F("razaoSocial")}/><Inp label="Nome fantasia" value={form.nomeFantasia} onChange={F("nomeFantasia")}/><Inp label="Inscrição estadual" value={form.inscricaoEstadual} onChange={F("inscricaoEstadual")}/><Inp label="Inscrição municipal" value={form.inscricaoMunicipal} onChange={F("inscricaoMunicipal")}/><Inp label="Representante legal *" value={form.representanteNome} onChange={F("representanteNome")}/><Inp label="CPF do representante *" value={maskDoc(form.representanteCpf,"PF")} onChange={v=>F("representanteCpf")(soDigitos(v))}/><Inp label="RG / órgão expedidor" value={`${form.representanteRg}${form.representanteOrgaoExpedidor?` · ${form.representanteOrgaoExpedidor}`:""}`} onChange={F("representanteRg")}/><Inp label="Cargo / poderes *" value={form.representanteCargo} onChange={F("representanteCargo")}/><Inp label="Nacionalidade" value={form.representanteNacionalidade} onChange={F("representanteNacionalidade")}/><Sel label="Estado civil" value={form.representanteEstadoCivil} onChange={F("representanteEstadoCivil")} options={[{v:"",l:"Selecione"},...civis.map(v=>({v,l:v}))]}/><Inp label="Profissão" value={form.representanteProfissao} onChange={F("representanteProfissao")}/></div></>}
    <p style={{fontSize:"var(--arcd-type-label)",fontWeight:"var(--arcd-font-weight-semibold)",color:"var(--arcd-action-primary)",textTransform:"uppercase"}}>Contato e domicílio contratual</p><div style={{display:"grid",gridTemplateColumns:formGrid(3),gap:"var(--arcd-space-2)"}}><Inp label="Telefone *" value={form.telefone} onChange={F("telefone")}/><Inp label="WhatsApp" value={form.whatsapp} onChange={F("whatsapp")}/><Inp label="E-mail *" type="email" value={form.email} onChange={F("email")}/><Inp label="CEP *" value={form.cep} onChange={F("cep")}/><Inp label="Logradouro *" value={form.endereco} onChange={F("endereco")}/><Inp label="Número *" value={form.numero} onChange={F("numero")}/><Inp label="Complemento" value={form.complemento} onChange={F("complemento")}/><Inp label="Bairro *" value={form.bairro} onChange={F("bairro")}/><Inp label="Cidade *" value={form.cidade} onChange={F("cidade")}/><Inp label="UF *" value={form.uf} onChange={v=>F("uf")(v.toUpperCase().slice(0,2))}/></div><Inp label="Observações contratuais" value={form.observacoes} onChange={F("observacoes")} multiline/>
    <div style={{display:"flex",gap:"var(--arcd-space-2)"}}><Btn v="ghost" onClick={onClose} full>Cancelar</Btn><Btn onClick={onSave} full><Ic n="check"/> Salvar cliente</Btn></div>
  </div></Modal>;
}

/** @param {PortfolioProps} props */
export default function ObrasCarteira({ data, update, showToast, onAbrirObra, currentUser, dispatchCommand }) {
  const { formGrid, cols, isDesktop } = useBreakpoint();
  /** @type {WorkRecord} */
  const empty = { id: "", name: "", clienteId:"", cliente: "", address: "", condominioId:"", condominioNome:"", quadra:"", lote:"", engineer: "", engineerId: "", startDate: "", faseId: "", status: "active", areaM2: "", oneDriveUrl: "", contractType: "fixed_labor", contractValue: "", adminPercentage: "", billingType: "mensal_fixo", parcelaMensal: "", contractStart: "", contractEnd: "", totalParcelas: "", billingFrequency: "mensal", diaVenc1: String(DIA_VENC_1_PADRAO), diaVenc2: String(DIA_VENC_2_PADRAO), entrada: "", entradaDate: "", hasCaixa: false };
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(empty);
  const [clienteModal,setClienteModal]=useState(/** @type {ContractClient|null} */ (null));
  const [search, setSearch] = useWorkspaceState("obras","search","");
  const [oneDriveStatus, setOneDriveStatus] = useState("checking");
  const [sincronizandoPastas,setSincronizandoPastas]=useState(false);
  const [erroPastas,setErroPastas]=useState("");
  const [savingProject,setSavingProject]=useState(false);
  const [projectErrors,setProjectErrors]=useState(/** @type {Record<string,string>} */ ({}));
  const [reviewingProject,setReviewingProject]=useState(false);
  const [undoMove,setUndoMove]=useState(/** @type {{obraId:string,obraName:string,from:string,to:string}|null} */ (null));
  const [expandedAlerts,setExpandedAlerts]=useState(new Set(/** @type {string[]} */ ([])));
  const ehAdmin=currentUser?.role==="admin";
  const engenheiros=(data.usuarios||[]).filter(u=>u.active!==false&&u.role==="engenheiro");
  const clientes=data.comercial?.clientes||[];
  const condominios=(data.condominios||[]).filter(x=>x.ativo!==false);
  useEffect(()=>{
    const id=sessionContext.getItem("arcd_editar_obra");if(!id)return;
    sessionContext.removeItem("arcd_editar_obra");const obra=(data.obras||[]).find(o=>o.id===id);if(!obra)return;
    setForm({...obra,areaM2:String(obra.areaM2||""),diaVenc1:String(obra.diaVenc1||DIA_VENC_1_PADRAO),diaVenc2:String(obra.diaVenc2||DIA_VENC_2_PADRAO)});setModal(true);
  },[data.obras]);
  const salvarClienteDaObra=async()=>{
    const f=clienteModal;if(!f?.nome?.trim()||!f.documento||!f.telefone||!f.email||!f.endereco||!f.numero||!f.cidade||!f.uf){showToast("Preencha nome, documento, contato e endereço contratual.","error");return;}
    const cliente={...clienteContratualVazio(),...f,id:f.id||uid(),nome:f.nome.trim(),createdAt:f.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()};
    const lista=f.id?clientes.map(c=>c.id===f.id?cliente:c):[...clientes,cliente];
    const result=await update({...data,comercial:{...(data.comercial||{}),clientes:lista}});
    if(!result?.ok){
      showToast("O servidor não confirmou o cliente. Os dados continuam abertos para uma nova tentativa.","error");
      return;
    }
    setForm(x=>({...x,clienteId:cliente.id,cliente:cliente.tipoPessoa==="PJ"?(cliente.razaoSocial||cliente.nome):cliente.nome}));
    setClienteModal(null);showToast("Cliente cadastrado e vinculado à obra.");
  };
  useEffect(()=>{
    if(!ehAdmin){setOneDriveStatus("restricted");return;}
    statusOneDrive().then(r=>setOneDriveStatus(r.ok?"connected":"disconnected"));
  },[ehAdmin]);
  const sincronizarPastas=useCallback(async()=>{
    if(!ehAdmin||oneDriveStatus!=="connected"||sincronizandoPastas)return;
    const candidatas=(data.obras||[]).filter(o=>o.name);
    if(!candidatas.length){showToast("Nenhuma obra disponível para preparar pastas.");return;}
    setSincronizandoPastas(true);setErroPastas("");
    try{
      const resp=await sincronizarEstruturasOneDrive(candidatas.map(o=>({id:o.id,name:o.name,driveId:o.oneDriveDriveId||"",folderId:o.oneDriveFolderId||""})));
      /** @type {FolderResult[]} */
      const resultados=Array.isArray(resp.resultados)?resp.resultados:[];
      if(!resultados.length)throw new Error(resp.error||"O OneDrive não retornou a estrutura das obras.");
      const porId=new Map(resultados.map(r=>[r.id,r]));
      const agora=new Date().toISOString();
      const aplicarPastas=(/** @type {WorkRecord} */ o)=>{
        const r=porId.get(o.id);if(!r?.ok||!r.workspace)return o;
        const completa=Number(r.migracao?.conflitos||0)===0;
        return {...o,oneDriveDriveId:r.workspace.driveId||o.oneDriveDriveId,oneDriveFolderId:r.workspace.folderId||o.oneDriveFolderId,oneDriveFolders:r.workspace.folders||o.oneDriveFolders,oneDriveUrl:r.workspace.webUrl||o.oneDriveUrl,oneDriveStructureVersion:completa?2:1,oneDriveStructureSyncedAt:agora};
      };
      if(resultados.some(r=>r.ok&&r.workspace)){
        const saved=await update(current=>({...current,obras:(current.obras||[]).map(aplicarPastas)}));
        if(!saved?.ok)throw new Error("As pastas foram processadas no OneDrive. Confira o salvamento para registrar os vínculos na central.");
      }
      const preparadas=resultados.filter(r=>r.ok).length;
      const movidos=resultados.reduce((s,r)=>s+Number(r.migracao?.movidos||0),0);
      const conflitos=resultados.reduce((s,r)=>s+Number(r.migracao?.conflitos||0),0);
      const falhas=resultados.length-preparadas;
      if(falhas||conflitos)showToast(`${contar(preparadas,"obra preparada","obras preparadas")}. ${movidos} item(ns) de licenciamento migrado(s). ${contar(falhas+conflitos,"pendência","pendências")} exigem nova tentativa.`,"error");
      else showToast(`${contar(preparadas,"obra preparada","obras preparadas")} no OneDrive${movidos?` e ${movidos} item(ns) de licenciamento migrado(s)`:""}.`);
    }catch(e){setErroPastas(/** @type {Error} */ (e).message||"Não foi possível preparar as pastas das obras.");}
    finally{setSincronizandoPastas(false);}
  },[data,ehAdmin,oneDriveStatus,showToast,sincronizandoPastas,update]);

  //  Kanban
  const [vista,      setVista]      = useState("lista");   // "lista" | "quadro"
  const [faseModal,  setFaseModal]  = useState(/** @type {{modo:"nova",fase:null}|{modo:"editar",fase:WorkPhase}|null} */ (null));
  const [faseNome,   setFaseNome]   = useState("");
  const [faseCor,    setFaseCor]    = useState(CORES_FASE[0]);
  const [arrastando, setArrastando] = useState(/** @type {string|null} */ (null)); // id da obra em arraste
  const [sobreFase,  setSobreFase]  = useState(/** @type {string|null} */ (null)); // id da coluna sob o cursor
  const [menuCard,   setMenuCard]   = useState(/** @type {string|null} */ (null)); // id da obra com menu aberto
  const [categoria,  setCategoria]  = useWorkspaceState("obras","category","todas");

  const fases = useMemo(
    () => [...(data.fases || [])].sort((a, b) => a.ordem - b.ordem),
    [data.fases]
  );

  // Obras agrupadas por fase. Quem não tem fase (ou aponta pra uma fase
  // apagada) cai na primeira coluna - nenhuma obra some do quadro.
  const porFase = useMemo(() => {
    const idsValidos = new Set(fases.map(f => f.id));
    const primeira = fases[0]?.id || "";
    /** @type {Record<string,WorkRecord[]>} */
    const mapa = {};
    fases.forEach(f => { mapa[f.id] = []; });
    (data.obras || []).forEach(o => {
      const alvo = idsValidos.has(/** @type {string} */ (o.faseId)) ? /** @type {string} */ (o.faseId) : primeira;
      if (mapa[alvo]) mapa[alvo].push(o);
    });
    // Ordena cada coluna pela data de finalizacao prevista (contractEnd).
    // Obras sem data prevista vao para o fim da coluna.
    Object.keys(mapa).forEach(k => {
      mapa[k].sort((a, b) => {
        const fa = a.contractEnd || "9999-12-31";
        const fb = b.contractEnd || "9999-12-31";
        return fa.localeCompare(fb);
      });
    });
    return mapa;
  }, [data.obras, fases]);

  // Total efetivamente renderizado no quadro. Se divergir de data.obras.length,
  // alguma obra ficou de fora - e o resumo acusa em vermelho.
  const somaQuadro = useMemo(
    () => Object.values(porFase).reduce((s, arr) => s + arr.length, 0),
    [porFase]
  );

  /** @param {string} obraId @param {string} faseId */
  const moverObra = async (obraId, faseId) => {
    const obra = (data.obras || []).find(o => o.id === obraId);
    if (!obra || obra.faseId === faseId) return;
    const fase = fases.find(f => f.id === faseId);
    const anterior=obra.faseId||"";
    const result=await dispatchCommand(atual=>{const vigente=(atual.obras||[]).find(o=>o.id===obraId);return {type:OPERATIONAL_COMMAND.PROJECT_SAVED,idempotencyKey:`obra-mover-${obraId}-${uid()}`,expectedVersion:Number(vigente?.version||0),payload:{project:{...vigente,faseId}}};});
    if(!result?.ok){showToast(result?.reason||"Não foi possível mover a obra.","error");return;}
    setUndoMove({obraId,obraName:obra.name,from:anterior,to:faseId});
    setMenuCard(null);
    showToast(`"${obra.name}" movida para ${fase?.nome || "-"}.`);
  };

  const desfazerMovimento=async()=>{
    if(!undoMove)return;
    const movimento=undoMove;setUndoMove(null);
    const result=await dispatchCommand(atual=>{const vigente=(atual.obras||[]).find(o=>o.id===movimento.obraId);return {type:OPERATIONAL_COMMAND.PROJECT_SAVED,idempotencyKey:`obra-desfazer-${movimento.obraId}-${uid()}`,expectedVersion:Number(vigente?.version||0),payload:{project:{...vigente,faseId:movimento.from}}};});
    if(!result?.ok){showToast(result?.reason||"Não foi possível desfazer o movimento.","error");return;}
    showToast(`Movimento de "${movimento.obraName}" desfeito.`);
  };

  /** @param {WorkPhase[]} next */
  const salvarFases=async next=>{
    const result=await dispatchCommand({type:OPERATIONAL_COMMAND.PROJECT_PHASES_SAVED,idempotencyKey:`fases-obras-${uid()}`,expectedVersion:Number(data.fasesVersion||0),payload:{phases:next}});
    if(!result?.ok){showToast(result?.reason||"Não foi possível salvar as fases.","error");return false;}
    return true;
  };

  //  Fases: criar / renomear / excluir / reordenar
  const abrirNovaFase = () => {
    setFaseModal({ modo: "nova", fase: null });
    setFaseNome("");
    setFaseCor(CORES_FASE[fases.length % CORES_FASE.length]);
  };
  /** @param {WorkPhase} fase */
  const abrirEditarFase = (fase) => {
    setFaseModal({ modo: "editar", fase });
    setFaseNome(fase.nome);
    setFaseCor(fase.cor);
  };

  const salvarFase = async () => {
    if (!faseNome.trim()) { showToast("Informe o nome da fase.", "error"); return; }
    if (!faseModal) return;
    const { modo, fase } = faseModal;
    if (modo === "editar") {
      if(!await salvarFases(fases.map(f =>f.id === fase.id ? { ...f, nome: faseNome.trim(), cor: faseCor } : f)))return;
      showToast("Fase atualizada.");
    } else {
      const ordem = fases.length ? Math.max(...fases.map(f => f.ordem)) + 1 : 0;
      if(!await salvarFases([...fases,{ id: uid(), nome: faseNome.trim(), cor: faseCor, ordem }]))return;
      showToast("Fase criada.");
    }
    setFaseModal(null); setFaseNome("");
  };

  /** @param {WorkPhase} fase */
  const excluirFase = async (fase) => {
    if (fases.length <= 1) { showToast("O quadro precisa de ao menos uma fase.", "error"); return; }
    const dentro = (porFase[fase.id] || []).length;
    const destino = /** @type {WorkPhase} */ (fases.find(f => f.id !== fase.id));
    const aviso = dentro
      ? `Excluir "${fase.nome}"?\n\nAs ${contar(dentro,"obra","obras")} desta coluna vão para "${destino.nome}". Nenhuma obra é apagada.`
      : `Excluir a fase "${fase.nome}"?`;
    if (!window.confirm(aviso)) return;
    if(!await salvarFases(fases.filter(f => f.id !== fase.id)))return;
    showToast("Fase removida.");
  };

  /** @param {string} faseId @param {number} dir */
  const moverFase = async (faseId, dir) => {
    const i = fases.findIndex(f => f.id === faseId);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= fases.length) return;
    const nova = [...fases];
    [nova[i], nova[j]] = [nova[j], nova[i]];
    if(await salvarFases(nova.map((f, k) => ({ ...f, ordem: k }))))showToast("Ordem das fases atualizada.");
  };


  /** @template {keyof WorkRecord} Key @param {Key} key */
  const setField = key => (/** @type {WorkRecord[Key]} */ value) => {setForm(f => ({ ...f, [key]: value }));setProjectErrors(errors=>{if(!errors[key])return errors;const next={...errors};delete next[key];return next;});setReviewingProject(false);};

  const abrirEditorObra=(obra=empty)=>{setForm(obra.id?{...obra,areaM2:String(obra.areaM2||""),diaVenc1:String(obra.diaVenc1||DIA_VENC_1_PADRAO),diaVenc2:String(obra.diaVenc2||DIA_VENC_2_PADRAO)}:{...empty});setProjectErrors({});setReviewingProject(false);setModal(true);};

  /** @param {string} [url] */
  const abrirOneDrive = (url) => {
    if(!ehAdmin){showToast("Apenas administradores podem acessar os diretórios do OneDrive.","error");return;}
    try {
      const destino = new URL(String(url || "").trim());
      if (destino.protocol !== "https:") throw new Error("protocolo");
      window.open(destino.toString(), "_blank", "noopener,noreferrer");
    } catch (_) {
      showToast("Link do OneDrive inválido. Use um endereço iniciado por https://", "error");
    }
  };

  const save = async () => {
    const areaM2 = Number(form.areaM2 || 0);
    const errors=validateProjectForm(form);

    if (ehAdmin && form.oneDriveUrl) {
      try {
        const link = new URL(form.oneDriveUrl.trim());
        if (link.protocol !== "https:") throw new Error("protocolo");
      } catch (_) {
        errors.oneDriveUrl="Informe um link válido do OneDrive iniciado por https://";
      }
    }
    if(Object.keys(errors).length){setProjectErrors(errors);setReviewingProject(false);showToast(`Revise ${contar(Object.keys(errors).length,"campo destacado","campos destacados")}.`,"error");return;}
    if(!reviewingProject){setReviewingProject(true);return;}
    if(savingProject)return;
    setSavingProject(true);
    try{
      let payload = {
      ...form,
      id: form.id || uid(),
      cliente: clientes.find(c=>c.id===form.clienteId)?.nome || form.cliente || "",
      condominioNome: condominios.find(c=>c.id===form.condominioId)?.nome || "",
      quadra: String(form.quadra||"").trim(),
      lote: String(form.lote||"").trim(),
      engineerId: engenheiros.some(u=>u.id===form.engineerId) ? form.engineerId : "",
      engineer: engenheiros.find(u=>u.id===form.engineerId)?.nome || "",
      areaM2,
      oneDriveUrl: String(form.oneDriveUrl || "").trim(),
      contractValue: Number(form.contractValue || 0),
      adminPercentage: Number(form.adminPercentage || 0),
      parcelaMensal:     Number(form.parcelaMensal     || 0),
      contractStart:     form.contractStart     || "",
      contractEnd:       form.contractEnd       || "",
      totalParcelas:     Number(form.totalParcelas     || 0),
      billingFrequency:  form.billingFrequency  || "mensal",
      diaVenc1:          Number(form.diaVenc1 || DIA_VENC_1_PADRAO),
      diaVenc2:          Number(form.diaVenc2 || DIA_VENC_2_PADRAO),
      entrada:           Number(form.entrada    || 0),
      entradaDate:       form.entradaDate       || "",
      hasCaixa:          !!form.hasCaixa,
      // Obra nova sem fase escolhida entra na primeira coluna do quadro
      faseId:            form.faseId || fases[0]?.id || "",
    };

    // No primeiro cadastro, cria a pasta da obra e a estrutura padrao. Se a
    // conta ainda nao estiver conectada, preserva o cadastro e mostra o passo
    // necessario, sem voltar a usar o Supabase Storage.
    // Nunca bloqueia a edição de uma obra antiga tentando criar estrutura no
    // OneDrive. Essa integração só pertence ao primeiro cadastro; antes, toda
    // edição sem folderId aguardava uma chamada externa e fazia o modal parecer
    // travado mesmo quando o usuário alterava apenas um campo simples.
    if (ehAdmin && !form.id && !payload.oneDriveFolderId && oneDriveStatus === "connected") {
      const ws = await criarEstruturaOneDrive(payload.name);
      if (ws.ok) payload = {...payload,oneDriveDriveId:ws.driveId,oneDriveFolderId:ws.folderId,oneDriveFolders:ws.folders||{},oneDriveUrl:ws.webUrl||payload.oneDriveUrl,oneDriveStructureVersion:2,oneDriveStructureSyncedAt:new Date().toISOString()};
      else showToast(`A obra será salva sem pasta no OneDrive: ${ws.error||"falha na conexão"}`, "error");
    }

      if(!dispatchCommand){
        showToast("O comando transacional de obras não está disponível.","error");
        return;
      }
      const result=await dispatchCommand(atual=>{
        const vigente=(atual.obras||[]).find(o=>o.id===payload.id);
        return {
          type:OPERATIONAL_COMMAND.PROJECT_SAVED,
          idempotencyKey:`obra-salvar-${payload.id}-${uid()}`,
          expectedVersion:Number(vigente?.version||0),
          payload:{project:payload},
        };
      });
      if(!result.ok){
        showToast(result.reason||"Não foi possível salvar a obra.","error");
        return;
      }
      setModal(false);setReviewingProject(false);
      showToast(form.id ? "Obra atualizada." : "Obra cadastrada.");
    }catch(error){
      showToast((/** @type {Error|null|undefined} */ (error))?.message||"A obra não pôde ser salva. Seus dados continuam no formulário para uma nova tentativa.","error");
    }finally{
      setSavingProject(false);
    }
  };

  /** @param {string} id */
  const remove = async id => {
    if (!ehAdmin) {
      showToast("Somente o administrador pode excluir uma obra.", "error");
      return;
    }
    if (data.employees.some(e => e.obra === id || e.lastObra === id)) {
      showToast("Não é possível apagar obra com histórico de funcionários.", "error");
      return;
    }
    const obra=(data.obras||[]).find(item=>item.id===id);
    if (!window.confirm(`Remover definitivamente “${obra?.name||"esta obra"}”?\n\nA exclusão só será concluída se não existir histórico operacional ou financeiro vinculado.`)) return;
    if(!dispatchCommand){
      showToast("O comando transacional de obras não está disponível.","error");
      return;
    }
    const result=await dispatchCommand(atual=>{
      const vigente=(atual.obras||[]).find(o=>o.id===id);
      return {
        type:OPERATIONAL_COMMAND.PROJECT_DELETED,
        idempotencyKey:`obra-excluir-${id}-${uid()}`,
        expectedVersion:Number(vigente?.version||0),
        payload:{projectId:id},
      };
    });
    if(!result.ok){
      showToast(result.reason||"Não foi possível excluir a obra.","error");
      return;
    }
    showToast("Obra removida.");
  };

  /** @type {Record<string,{l:string,c:string}>} */
  const statusMap = {
    active: { l: "Ativa", c: C.green },
    paused: { l: "Pausada", c: C.yellow },
    done: { l: "Concluída", c: C.muted },
  };
  const obrasComando = useMemo(() => (data.obras || []).map(o => {
    const fase = fases.find(f => f.id === o.faseId);
    const equipe = (data.employees || []).filter(e => e.active !== false && e.obra === o.id);
    const nomeFase = String(fase?.nome || "").toLocaleLowerCase("pt-BR");
    const emPlanejamento = o.status !== "done" && /estudo|or[cç]amento|projeto|licen|prefeitura|planejamento|anteprojeto/.test(nomeFase);
    const emExecucao = o.status === "active" && !emPlanejamento;
    let diasPrazo = null;
    if (o.contractEnd) {
      const fim = new Date(`${o.contractEnd}T12:00:00`);
      const agora = new Date(`${today()}T12:00:00`);
      if (!Number.isNaN(fim.getTime())) diasPrazo = Math.ceil((fim.getTime() - agora.getTime()) / 86400000);
    }
    const alertas = [];
    if (o.status !== "done" && !o.engineerId && !o.engineer) alertas.push("Sem engenheiro responsável");
    if (o.status !== "done" && !o.clienteId && !o.cliente) alertas.push("Cliente não vinculado");
    if (o.status !== "done" && !o.address) alertas.push("Endereço incompleto");
    if (o.status === "paused") alertas.push("Obra pausada");
    if (o.status !== "done" && diasPrazo !== null && diasPrazo < 0) alertas.push(`Prazo vencido há ${Math.abs(diasPrazo)} dias`);
    const dadosChave = [o.name, o.clienteId || o.cliente, o.address, o.engineerId || o.engineer, o.contractStart || o.startDate, o.contractEnd, Number(o.contractValue) > 0];
    const completude = Math.round((dadosChave.filter(Boolean).length / dadosChave.length) * 100);
    return { ...o, _fase:fase, _equipe:equipe, _diasPrazo:diasPrazo, _alertas:alertas, _planejamento:emPlanejamento, _execucao:emExecucao, _completude:completude };
  }), [data.obras, data.employees, fases]);
  const totalCarteira = obrasComando.filter(o => o.status !== "done").reduce((s,o) => s + Number(o.contractValue || 0), 0);
  const contagensObras = {
    todas: obrasComando.length,
    atencao: obrasComando.filter(o => o._alertas.length).length,
    planejamento: obrasComando.filter(o => o._planejamento).length,
    execucao: obrasComando.filter(o => o._execucao).length,
    prazo: obrasComando.filter(o => o.status !== "done" && o._diasPrazo !== null && o._diasPrazo <= 30).length,
    concluidas: obrasComando.filter(o => o.status === "done").length,
  };
  /** @type {[keyof typeof contagensObras,string][]} */
  const categoriasObras = [
    ["todas","Todas"], ["atencao","Cadastro com pendência"], ["planejamento","Planejamento"],
    ["execucao","Em execução"], ["prazo","Prazo próximo"], ["concluidas","Concluídas"],
  ];
  /** @param {WorkSummary} o */
  const correspondeCategoria = o => categoria === "todas"
    || (categoria === "atencao" && o._alertas.length > 0)
    || (categoria === "planejamento" && o._planejamento)
    || (categoria === "execucao" && o._execucao)
    || (categoria === "prazo" && o.status !== "done" && o._diasPrazo !== null && o._diasPrazo <= 30)
    || (categoria === "concluidas" && o.status === "done");
  const termoBusca=search.toLocaleLowerCase("pt-BR");
  const list = obrasComando.filter(o => correspondeCategoria(o) && [o.name,o.cliente,o.address,o.engineer,o._fase?.nome].some(v=>String(v||"").toLocaleLowerCase("pt-BR").includes(termoBusca)));
  const worksPage=useRecordPage('obras',list,JSON.stringify([categoria,search]));
  const resumoOperacional = contagensObras.atencao
    // Aqui é cadastro (dados faltando), não a situação de custo e prazo do Dashboard: nome próprio para não parecer contradição.
    ? `${contagensObras.atencao} ${contagensObras.atencao === 1 ? "obra com cadastro" : "obras com cadastro"} a completar`
    : "Cadastros das obras completos";

  const buscaObras = (
    <label className="works-search" style={{display:"flex",alignItems:"center",gap:"var(--arcd-space-2)"}}>
      <Ic n="search" s={16} color={C.muted}/>
      <span className="sr-only">Buscar obras</span><StandardInput aria-label={isDesktop?"Buscar obras":undefined} value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar por obra, cliente, endereço, responsável ou fase..." style={{flex:1,minWidth:0}}/>
      {(!isDesktop||search.trim())&&<span role={isDesktop?"status":undefined} style={{fontSize:"var(--arcd-type-label)",color:"var(--arcd-text-secondary)",whiteSpace:"nowrap"}}>{contar(list.length,"resultado","resultados")}</span>}
    </label>
  );

  return (
    <div className="anim works-hub" style={{ display: "flex", flexDirection: "column", gap: "var(--arcd-space-3)" }}>
      <PageHero
        title="Central de obras"
        description="Encontre a obra certa, entenda o que exige atenção e siga para a próxima ação."
        statsDisclosure={!isDesktop}
        alert={{tone:contagensObras.atencao?"warning":"success",text:resumoOperacional}}
        stats={[
          {label:"Obras ativas",value:obrasComando.filter(o=>o.status==="active").length,detail:"Em operação"},
          {label:"Cadastro com pendência",value:contagensObras.atencao,detail:"Dados da obra a completar",color:contagensObras.atencao?C.orange:undefined},
          {label:"Prazo ≤ 30 dias",value:contagensObras.prazo,detail:"Janela crítica",color:contagensObras.prazo?C.orange:undefined},
          {label:"Carteira ativa",value:fmt(totalCarteira),detail:"Valor contratado"},
        ]}
        actions={<>
          {ehAdmin&&<details className="works-files"><summary>Arquivos e pastas</summary><div>
          {ehAdmin&&<Btn v="ghost" onClick={()=>abrirOneDrive(data.config?.oneDriveRootUrl)}><Ic n="folder" s={14}/> Arquivos gerais</Btn>}
          {ehAdmin&&oneDriveStatus==="connected"&&<Btn v="ghost" disabled={sincronizandoPastas} onClick={sincronizarPastas}><Ic n="folder" s={14}/> {sincronizandoPastas?"Preparando pastas...":"Preparar pastas"}</Btn>}
          {ehAdmin&&oneDriveStatus!=="connected"&&<Btn v="ghost" onClick={conectarOneDrive}>Conectar OneDrive</Btn>}
          </div></details>}
          {ehAdmin&&<Btn onClick={()=>abrirEditorObra()}><Ic n="plus" s={14}/> Nova obra</Btn>}
        </>}
      />

      {erroPastas&&<div className="works-sync-error" role="alert"><Ic n="alert" s={14}/><p><strong>Pastas do OneDrive não preparadas.</strong> {erroPastas}</p><Btn v="secondary" size="sm" disabled={sincronizandoPastas} onClick={sincronizarPastas}>Tentar de novo</Btn><Btn v="ghost" size="sm" ariaLabel="Dispensar aviso" title="Dispensar aviso" onClick={()=>setErroPastas("")}><Ic n="x" s={14}/></Btn></div>}
      <section className="works-filter-bar" aria-label={isDesktop?"Filtros de Obras":undefined} style={{background:"var(--arcd-surface-card)",border:"var(--arcd-border-width) solid var(--arcd-border-default)",borderRadius:"var(--arcd-box-radius)",padding:"var(--arcd-space-2)",boxShadow:"none"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:"var(--arcd-space-2)",flexWrap:"wrap"}}>
          <label className="works-category-select">Situação das obras<SelectControl value={categoria} onChange={event=>setCategoria(event.target.value)}>{categoriasObras.map(([v,l])=><option key={v} value={v}>{l} · {contagensObras[v]}</option>)}</SelectControl></label>
          <div className="works-category-tabs" style={{display:"flex",gap:"var(--arcd-space-1)",overflowX:"auto",paddingBottom:"var(--arcd-space-0)",maxWidth:"100%"}}>
            {categoriasObras.map(([v,l])=><StandardButton variant="ghost" type="button" aria-pressed={categoria===v} data-active={categoria===v} key={v} onClick={()=>setCategoria(v)}>{l} <span className="works-category-count">{contagensObras[v]}</span></StandardButton>)}
          </div>
          <div className="works-view-toggle">
            {[["lista","Painel"],["quadro","Fluxo"]].map(([v,l])=><StandardButton variant="secondary" type="button" aria-pressed={vista===v} data-active={vista===v} key={v} onClick={()=>setVista(v)}>{l}</StandardButton>)}
          </div>
        </div>
        {isDesktop&&vista==="lista"&&buscaObras}
      </section>

      {undoMove&&<div className="works-undo" role="status"><div><strong>Obra movida</strong><span>“{undoMove.obraName}” mudou de fase e a alteração foi registrada.</span></div><Btn v="ghost" onClick={desfazerMovimento}>Desfazer</Btn></div>}

      {/*  QUADRO (KANBAN)  */}
      {vista === "quadro" && (<>

        {/* Conferência: a soma das colunas TEM que bater com o total de obras.
            O contador dentro de cada coluna é só daquela coluna - sem este
            resumo, não dá pra saber se alguma obra sumiu ou só está fora da
            tela, numa coluna que exige rolar. */}
        <div style={{
          background:"var(--arcd-surface-muted)", border:"var(--arcd-border-width) solid var(--arcd-border-default)", borderRadius:"var(--arcd-radius-control)",
          padding:"var(--arcd-space-2) var(--arcd-space-3)", display:"flex", justifyContent:"space-between",
          alignItems:"center", gap:"var(--arcd-space-2)", flexWrap:"wrap",
        }}>
          <div>
            <p style={{fontSize:"var(--arcd-type-body)",fontWeight:"var(--arcd-font-weight-semibold)",color:"var(--arcd-text-primary)",
                       fontFamily:"var(--arcd-font-sans)"}}>
              {(data.obras||[]).length} obra{(data.obras||[]).length===1?"":"s"} no quadro
            </p>
            <p style={{fontSize:"var(--arcd-type-label)",color:"var(--arcd-text-secondary)",marginTop:"var(--arcd-space-half)"}}>
              {fases.filter(f => (porFase[f.id]||[]).length > 0)
                    .map(f => `${(porFase[f.id]||[]).length} em ${f.nome}`)
                    .join(" · ") || "nenhuma posicionada"}
            </p>
          </div>
          {somaQuadro !== (data.obras||[]).length && (
            <span style={{fontSize:"var(--arcd-type-label)",fontWeight:"var(--arcd-font-weight-semibold)",color:"var(--arcd-danger-text)",
                          background:"color-mix(in srgb, var(--arcd-danger-text) 7%, transparent)",padding:"var(--arcd-space-1) var(--arcd-space-2)",borderRadius:"var(--arcd-radius-control)"}}>
              ! {somaQuadro} exibidas de {(data.obras||[]).length}
            </span>
          )}
        </div>

        <div style={{...KB.scroll, margin:"var(--arcd-space-0) calc(var(--arcd-space-3) * -1)", padding:"var(--arcd-space-0) var(--arcd-space-3) var(--arcd-space-2)"}}>
          {fases.map((fase, fi) => {
            const obrasDaFase = porFase[fase.id] || [];
            const alvo = sobreFase === fase.id;
            return (
              <div key={fase.id}
                onDragOver={e => { e.preventDefault(); setSobreFase(fase.id); }}
                onDragLeave={() => setSobreFase(s => s===fase.id ? null : s)}
                onDrop={e => {
                  e.preventDefault();
                  if (arrastando) moverObra(arrastando, fase.id);
                  setArrastando(null); setSobreFase(null);
                }}
                style={KB.coluna(fase.cor, alvo)}>

                {/* Cabeçalho da coluna */}
                <div style={{padding:"var(--arcd-space-2)", borderTop:`3px solid ${fase.cor}`, borderTopLeftRadius:"var(--arcd-box-radius)", borderTopRightRadius:"var(--arcd-box-radius)", borderBottom:"var(--arcd-border-width) solid var(--arcd-border-default)", position:"sticky", top:0, zIndex:1, background:"inherit"}}>
                  <div style={{display:"flex",alignItems:"center",gap:"var(--arcd-space-1)"}}>
                    <span style={{width:9,height:9,borderRadius:"var(--arcd-radius-control)",background:fase.cor,flexShrink:0}}/>
                    <p style={{
                      flex:1, minWidth:0, fontSize:"var(--arcd-type-label)", fontWeight:"var(--arcd-font-weight-semibold)",
                      textTransform:"uppercase", letterSpacing:"var(--arcd-letter-spacing-body)", color:"var(--arcd-text-primary)",
                      overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
                    }}>{fase.nome}</p>
                    {ehAdmin&&<div style={{display:"flex",gap:"var(--arcd-space-0)",flexShrink:0}}>
                      <Btn v="ghost" size="sm" iconOnly onClick={()=>moverFase(fase.id,-1)} disabled={fi===0} title="Mover coluna p/ esquerda" ariaLabel="Mover coluna para a esquerda">
                        <Ic n="chevL" s={11}/>
                      </Btn>
                      <Btn v="ghost" size="sm" iconOnly onClick={()=>moverFase(fase.id,+1)} disabled={fi===fases.length-1} title="Mover coluna p/ direita" ariaLabel="Mover coluna para a direita">
                        <Ic n="chevR" s={11}/>
                      </Btn>
                      <Btn v="ghost" size="sm" iconOnly onClick={()=>abrirEditarFase(fase)} title="Renomear / cor" ariaLabel="Renomear fase">
                        <Ic n="edit" s={11}/>
                      </Btn>
                      <Btn v="ghost" size="sm" iconOnly onClick={()=>excluirFase(fase)} title="Excluir fase" ariaLabel="Excluir fase">
                        <Ic n="x" s={11}/>
                      </Btn>
                    </div>}
                  </div>
                  <p style={{fontSize:"var(--arcd-type-label)",color:"var(--arcd-text-secondary)",marginTop:"var(--arcd-space-half)"}}>
                    {obrasDaFase.length} obra{obrasDaFase.length===1?"":"s"}
                  </p>
                </div>

                {/* Cards */}
                <div style={KB.colBody}>
                  {obrasDaFase.map(o => {
                    const st    = statusMap[o.status] || statusMap.active;
                    const count = data.employees.filter(e => e.active!==false && e.obra===o.id).length;
                    const menu  = menuCard === o.id;
                    return (
                      <div key={o.id}
                        draggable={ehAdmin}
                        onDragStart={() => setArrastando(o.id)}
                        onDragEnd={() => { setArrastando(null); setSobreFase(null); }}
                        style={{
                          ...KB.card(null),
                          border:"var(--arcd-border-width) solid var(--arcd-border-default)",
                          opacity: arrastando===o.id ? .4 : 1,
                          position:"relative",
                        }}>
                        <div style={{display:"flex",justifyContent:"space-between",gap:"var(--arcd-space-1)",alignItems:"flex-start"}}>
                          <p style={{
                            flex:1, minWidth:0,
                            fontFamily:"var(--arcd-font-sans)",
                            fontSize:"var(--arcd-type-body)", fontWeight:"var(--arcd-font-weight-semibold)", color:"var(--arcd-text-primary)", lineHeight:"var(--arcd-line-height-normal)",
                          }}>{o.name}</p>
                          {ehAdmin&&<Btn v="ghost" size="sm" iconOnly onClick={()=>setMenuCard(menu ? null : o.id)} title="Mover ou editar obra" ariaLabel="Mover ou editar obra" style={{flexShrink:0}}>⋮</Btn>}
                        </div>

                        {o.cliente && (
                          <p style={{fontSize:"var(--arcd-type-label)",color:"var(--arcd-text-muted)",fontWeight:"var(--arcd-font-weight-semibold)",marginTop:"var(--arcd-space-half)"}}>{o.cliente}</p>
                        )}
                        {o.engineer && (
                          <p style={{fontSize:"var(--arcd-type-label)",color:"var(--arcd-text-secondary)",marginTop:"var(--arcd-space-half)"}}>Eng. {o.engineer}</p>
                        )}

                        <div style={{display:"flex",alignItems:"center",gap:"var(--arcd-space-1)",marginTop:"var(--arcd-space-1)",flexWrap:"wrap"}}>
                          <Badge color={st.c}>{st.l}</Badge>
                          <span style={{fontSize:"var(--arcd-type-caption)",color:"var(--arcd-text-secondary)",background:"var(--arcd-surface-muted)",borderRadius:"var(--arcd-radius-control)",padding:"var(--arcd-space-0) var(--arcd-space-1)"}}>
                            {CONTRACT_LABELS[o.contractType]||o.contractType}
                          </span>
                          {Number(o.areaM2)>0 && (
                            <span style={{fontSize:"var(--arcd-type-caption)",color:"var(--arcd-text-secondary)"}}>{o.areaM2} m2</span>
                          )}
                          {count>0 && (
                            <span style={{fontSize:"var(--arcd-type-caption)",color:"var(--arcd-text-secondary)"}}>{count} func.</span>
                          )}
                        </div>

                        {Number(o.contractValue)>0 && (
                          <p style={{fontSize:"var(--arcd-type-body)",fontWeight:"var(--arcd-font-weight-semibold)",color:"var(--arcd-action-primary)",marginTop:"var(--arcd-space-1)"}}>
                            {fmt(o.contractValue)}
                          </p>
                        )}

                        {/* Datas: inicio e finalizacao prevista, com prazo restante */}
                        {(o.contractStart || o.contractEnd) && (() => {
                          const prz = prazoObra(o);
                          return (
                            <div style={{marginTop:"var(--arcd-space-1)",display:"flex",flexDirection:"column",gap:"var(--arcd-space-half)"}}>
                              <div style={{display:"flex",alignItems:"center",gap:"var(--arcd-space-1)",fontSize:"var(--arcd-type-caption)",color:"var(--arcd-text-secondary)"}}>
                                <Ic n="calendar" s={11} color={C.muted}/>
                                <span>
                                  {o.contractStart ? fmtDate(o.contractStart) : "?"}
                                  {" a "}
                                  {o.contractEnd ? fmtDate(o.contractEnd) : "?"}
                                </span>
                              </div>
                              {prz && (
                                <span style={{fontSize:"var(--arcd-type-caption)",fontWeight:"var(--arcd-font-weight-semibold)",color:prz.cor}}>{prz.rotulo}</span>
                              )}
                            </div>
                          );
                        })()}

                        {/* Menu "Mover para" - é o caminho que funciona no celular,
                            onde arrastar (HTML5 drag) simplesmente não existe. */}
                        {menu && (
                          <div style={{
                            position:"absolute", top:28, right:8, zIndex:20,
                            background:"var(--arcd-surface-page)", border:"1.5px solid var(--arcd-border-default)",
                            borderRadius:"var(--arcd-radius-control)", boxShadow:`0 6px 20px ${C.shadow}`,
                            minWidth:180, padding:"var(--arcd-space-1)",
                          }}>
                            <p style={{fontSize:"var(--arcd-type-caption)",fontWeight:"var(--arcd-font-weight-semibold)",color:"var(--arcd-text-secondary)",textTransform:"uppercase",
                                       letterSpacing:"var(--arcd-letter-spacing-body)",padding:"var(--arcd-space-1) var(--arcd-space-2)"}}>Mover para</p>
                            {fases.filter(f=>f.id!==fase.id).map(f=>(
                              <StandardButton variant="secondary" key={f.id} onClick={()=>moverObra(o.id, f.id)} className="w-full justify-start text-left">
                                <span style={{width:7,height:7,borderRadius:"var(--arcd-radius-control)",background:f.cor,flexShrink:0}}/>
                                {f.nome}
                              </StandardButton>
                            ))}
                            <div style={{height:1,background:"var(--arcd-border-default)",margin:"var(--arcd-space-1) var(--arcd-space-0)"}}/>
                            {ehAdmin&&<StandardButton variant="secondary" onClick={()=>{abrirEditorObra(o);setMenuCard(null);}}
                              className="w-full justify-start text-left">
                               Editar obra
                            </StandardButton>}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {obrasDaFase.length === 0 && (
                    <p style={{fontSize:"var(--arcd-type-label)",color:"var(--arcd-text-secondary)",textAlign:"center",padding:"var(--arcd-space-3) var(--arcd-space-1)"}}>
                      Mova uma obra para esta fase
                    </p>
                  )}
                </div>
              </div>
            );
          })}

          {/* Nova coluna */}
          {ehAdmin&&<div style={{flex:"0 0 168px",minWidth:168}}>
            <StandardButton variant="secondary" className="works-new-phase" onClick={abrirNovaFase} style={{width:"100%"}}>+ Nova fase</StandardButton>
          </div>}
        </div>
      </>)}

      {/*  LISTA  */}
      {vista === "lista" && <>
      {!isDesktop&&buscaObras}

      <RecordListPagination pagination={worksPage} label="obras"/>
      <div className="works-grid" style={{display:"grid",gridTemplateColumns:cols(1,2,3),gap:"var(--arcd-space-3)"}}>
        {worksPage.rows.map(o => {
          const st = statusMap[o.status] || statusMap.active;
          const codigo = String(Math.max(0,(data.obras||[]).findIndex(x=>x.id===o.id))+1).padStart(4,"0");
          const prazo = prazoObra(o);
          const risco = o._alertas.length > 0;
          return <article data-risk={risco} key={o.id} className="lift-card works-card" style={{background:"var(--arcd-surface-card)",border:`var(--arcd-border-width) solid ${risco?"color-mix(in srgb, var(--arcd-danger-text) 40%, transparent)":"var(--arcd-border-default)"}`,borderRadius:"var(--arcd-box-radius)",overflow:"hidden",boxShadow:"var(--arcd-shadow-lg)",display:"flex",flexDirection:"column",minWidth:0}}>
            <CapaObra reference={o.capaUrl} onOpen={()=>onAbrirObra?.(o.id)}>
              <div style={{position:"absolute",inset:0,padding:"var(--arcd-space-3)",display:"flex",flexDirection:"column",justifyContent:"space-between"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:"var(--arcd-space-2)"}}>
                  <span style={{fontSize:"var(--arcd-type-caption)",fontWeight:"var(--arcd-font-weight-semibold)",letterSpacing:"var(--arcd-letter-spacing-body)",color:"var(--arcd-action-primary-subtle)"}}>MARCELL · #{codigo}</span>
                  <span style={{fontSize:"var(--arcd-type-caption)",fontWeight:"var(--arcd-font-weight-semibold)",textTransform:"uppercase",letterSpacing:"var(--arcd-letter-spacing-body)",color:st.c,background:"color-mix(in srgb, var(--arcd-text-inverse) 94%, transparent)",borderRadius:"var(--arcd-radius-pill)",padding:"var(--arcd-space-1) var(--arcd-space-2)"}}>{st.l}</span>
                </div>
                <div style={{position:"relative"}}>
                  <p style={{fontSize:"var(--arcd-type-caption)",fontWeight:"var(--arcd-font-weight-semibold)",textTransform:"uppercase",letterSpacing:"var(--arcd-letter-spacing-body)",color:"var(--arcd-text-inverse)",marginBottom:"var(--arcd-space-half)"}}>{o._fase?.nome||"Fase não definida"}</p>
                  <h3 className="brk" style={{fontFamily:FONT_DISPLAY,fontSize:"var(--arcd-type-section-title)",fontWeight:"var(--arcd-font-weight-semibold)",lineHeight:"var(--arcd-line-height-normal)",color:"var(--arcd-text-inverse)",paddingRight:"var(--arcd-space-3)"}}>{o.name}</h3>
                </div>
              </div>
            </CapaObra>
            <div className="works-card-body" style={{padding:"var(--arcd-space-3)",display:"flex",flexDirection:"column",gap:"var(--arcd-space-3)",flex:1}}>
              <div className="works-card-identity" style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:"var(--arcd-space-2)"}}>
                <div style={{minWidth:0}}><p style={{fontSize:"var(--arcd-type-caption)",fontWeight:"var(--arcd-font-weight-semibold)",textTransform:"uppercase",letterSpacing:"var(--arcd-letter-spacing-body)",color:"var(--arcd-text-secondary)"}}>Cliente</p><p style={{fontSize:"var(--arcd-type-label)",fontWeight:"var(--arcd-font-weight-semibold)",color:o.cliente?"var(--arcd-text-primary)":"var(--arcd-text-secondary)",marginTop:"var(--arcd-space-half)",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{o.cliente||"Não vinculado"}</p></div>
                <div title={o.engineer||"Sem responsável"} style={{width:34,height:34,flexShrink:0,borderRadius:"var(--arcd-radius-pill)",display:"grid",placeItems:"center",background:o.engineer?"var(--arcd-text-primary)":"var(--arcd-surface-muted)",border:`var(--arcd-border-width) solid ${o.engineer?"var(--arcd-text-primary)":"var(--arcd-border-default)"}`,color:o.engineer?"var(--arcd-text-inverse)":"var(--arcd-text-secondary)",fontSize:"var(--arcd-type-caption)",fontWeight:"var(--arcd-font-weight-semibold)"}}>{(o.engineer||"?").split(" ").slice(0,2).map(n=>n[0]).join("")}</div>
              </div>

              <div className="works-card-metrics" style={{display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:"var(--arcd-space-1)"}}>
                {[["Contrato",Number(o.contractValue)>0?fmt(o.contractValue):"—"],["Área",Number(o.areaM2)>0?`${Number(o.areaM2).toLocaleString("pt-BR")} m²`:"—"],["Equipe",`${o._equipe.length}`]].map(([l,v])=><div key={l} style={{background:"var(--arcd-surface-muted)",border:"var(--arcd-border-width) solid var(--arcd-surface-muted)",borderRadius:"var(--arcd-box-radius)",padding:"var(--arcd-space-2) var(--arcd-space-2) var(--arcd-space-1)",minWidth:0}}><p style={{fontSize:"var(--arcd-type-caption)",fontWeight:"var(--arcd-font-weight-semibold)",textTransform:"uppercase",letterSpacing:"var(--arcd-letter-spacing-body)",color:"var(--arcd-text-secondary)"}}>{l}</p><p style={{fontSize:"var(--arcd-type-label)",fontWeight:"var(--arcd-font-weight-semibold)",color:"var(--arcd-text-primary)",marginTop:"var(--arcd-space-half)",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{v}</p></div>)}
              </div>

              <div className="works-card-health">
                <div style={{display:"flex",justifyContent:"space-between",fontSize:"var(--arcd-type-caption)",fontWeight:"var(--arcd-font-weight-semibold)",color:"var(--arcd-text-secondary)",marginBottom:"var(--arcd-space-1)"}}><span>Dados essenciais preenchidos</span><span>{o._completude}%</span></div>
                <div style={{height:4,borderRadius:"var(--arcd-radius-pill)",background:"var(--arcd-surface-muted)",overflow:"hidden"}}><i style={{display:"block",height:"100%",width:`${o._completude}%`,borderRadius:"var(--arcd-radius-pill)",background:o._completude>=80?"var(--arcd-success-text)":o._completude>=55?"var(--arcd-action-primary)":"var(--arcd-danger-text)"}}/></div>
              </div>

              {risco?<div className="works-alerts"><StandardButton variant="secondary" type="button" aria-expanded={expandedAlerts.has(o.id)} onClick={()=>setExpandedAlerts(current=>{const next=new Set(current);next.has(o.id)?next.delete(o.id):next.add(o.id);return next;})}><Ic n="alert" s={14}/><span><strong>{contar(o._alertas.length,"pendência","pendências")}</strong><small>{expandedAlerts.has(o.id)?"Ocultar ações":"Ver como corrigir"}</small></span><Ic n="chevron" s={12}/></StandardButton>{expandedAlerts.has(o.id)&&<div className="works-alerts__list">{o._alertas.map(alert=>{const action=projectAlertAction(alert);return <div key={alert}><span>{alert}</span><StandardButton variant="secondary" type="button" onClick={()=>ehAdmin?abrirEditorObra(o):onAbrirObra?.(o.id)}>{ehAdmin?action.label:"Abrir obra"}</StandardButton></div>;})}</div>}</div>:<div className="works-regular"><Ic n="check" s={14}/><span>Cadastro operacional regular</span></div>}

              <div className="works-card-deadline" style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:"var(--arcd-space-2)",minHeight:18}}>
                <span style={{fontSize:"var(--arcd-type-caption)",fontWeight:"var(--arcd-font-weight-semibold)",color:prazo?.cor||"var(--arcd-text-secondary)"}}>{prazo?.rotulo||"Prazo não definido"}</span>
                <span style={{fontSize:"var(--arcd-type-caption)",color:"var(--arcd-text-secondary)",whiteSpace:"nowrap"}}>Eng. {o.engineer?.split(" ")[0]||"não definido"}</span>
              </div>

              <div className="works-card-open" style={{display:"grid",gridTemplateColumns:ehAdmin&&o.oneDriveUrl?"1fr auto":"1fr",gap:"var(--arcd-space-1)",marginTop:"auto"}}>
                {/* Botão cheio só no cartão que tem pendência; nos demais, secundário. Assim a tela tem um destaque, não três. */}<Btn v={risco?"dark":"secondary"} full onClick={()=>onAbrirObra?.(o.id)}>Abrir obra <span>→</span></Btn>
                {ehAdmin&&o.oneDriveUrl&&<Btn v="ghost" iconOnly onClick={()=>abrirOneDrive(o.oneDriveUrl)} title="Abrir arquivos" ariaLabel="Abrir arquivos"><Ic n="folder" s={14}/></Btn>}
              </div>
              <div className="works-card-footer" style={{display:"flex",justifyContent:"space-between",alignItems:"center",paddingTop:"var(--arcd-space-2)",borderTop:"var(--arcd-border-width) solid var(--arcd-border-default)"}}>
                <span style={{fontSize:"var(--arcd-type-caption)",color:"var(--arcd-text-secondary)"}}>{CONTRACT_LABELS[o.contractType]||"Contrato"}</span>
                {ehAdmin&&<div style={{display:"flex",gap:"var(--arcd-space-half)"}}><Btn v="ghost" size="sm" iconOnly onClick={()=>abrirEditorObra(o)} title="Editar obra" ariaLabel="Editar obra"><Ic n="edit" s={12}/></Btn><details className="record-more"><summary aria-label="Mais ações da obra" title="Mais ações">⋯</summary><div role="menu"><Btn v="danger" size="sm" onClick={()=>remove(o.id)} title="Excluir obra" ariaLabel="Excluir obra"><Ic n="trash" s={12}/> Excluir obra</Btn></div></details></div>}
              </div>
            </div>
          </article>;
        })}
        {!list.length&&<div style={{gridColumn:"1/-1",textAlign:"center",padding:"var(--arcd-space-10)",background:"var(--arcd-surface-card)",border:"var(--arcd-border-width) dashed var(--arcd-border-default)",borderRadius:"var(--arcd-box-radius)"}}><div style={{width:46,height:46,borderRadius:"var(--arcd-radius-pill)",display:"grid",placeItems:"center",margin:"var(--arcd-space-0) auto",background:"var(--arcd-surface-muted)",color:"var(--arcd-text-secondary)"}}><Ic n="building" s={22}/></div><p style={{fontSize:"var(--arcd-type-body)",fontWeight:"var(--arcd-font-weight-semibold)",color:"var(--arcd-text-primary)",marginTop:"var(--arcd-space-2)"}}>Nenhuma obra nesta categoria</p><p style={{fontSize:"var(--arcd-type-label)",color:"var(--arcd-text-secondary)",marginTop:"var(--arcd-space-half)"}}>Altere o filtro ou a busca para ampliar os resultados.</p></div>}
      </div>

      {/* A grade acima é a única representação da visão Painel. As duas
          implementações antigas (tabela desktop e cartões móveis) foram
          removidas para que semântica, permissões e estados não divirjam. */}
      {false&&isDesktop&&<div hidden aria-hidden="true">
        <div style={{display:"grid",gridTemplateColumns:"74px minmax(220px,1.5fr) minmax(160px,1fr) 110px 145px 125px minmax(150px,.8fr) 72px",gap:"var(--arcd-space-2)",padding:"var(--arcd-space-2) var(--arcd-space-3)",background:"var(--arcd-surface-overlay)",borderBottom:"var(--arcd-border-width) solid var(--arcd-border-default)",fontSize:"var(--arcd-type-caption)",fontWeight:"var(--arcd-font-weight-semibold)",color:"var(--arcd-text-secondary)",textTransform:"uppercase",letterSpacing:"var(--arcd-letter-spacing-body)"}}><span>Código</span><span>Obra</span><span>Cliente</span><span>Status</span><span>Fase</span><span>Início</span><span>Responsável</span><span style={{textAlign:"right"}}>Ações</span></div>
        {list.map((o,index)=>{const st=statusMap[o.status]||statusMap.active;const fase=fases.find(f=>f.id===o.faseId);const equipe=(data.employees||[]).filter(e=>e.active!==false&&e.obra===o.id);const codigo=String(index+1).padStart(4,"0");return <div key={o.id} className="lift-card" onClick={()=>onAbrirObra?.(o.id)} style={{display:"grid",gridTemplateColumns:"74px minmax(220px,1.5fr) minmax(160px,1fr) 110px 145px 125px minmax(150px,.8fr) 72px",gap:"var(--arcd-space-2)",alignItems:"center",padding:"var(--arcd-space-3)",borderBottom:index<list.length-1?"var(--arcd-border-width) solid var(--arcd-border-default)":"none",cursor:"pointer",background:"var(--arcd-surface-card)"}}>
          <span style={{fontSize:"var(--arcd-type-label)",fontWeight:"var(--arcd-font-weight-semibold)",color:"var(--arcd-action-primary)"}}>#{codigo}</span>
          <div style={{display:"flex",alignItems:"center",gap:"var(--arcd-space-2)",minWidth:0}}><div style={{width:38,height:38,borderRadius:"var(--arcd-box-radius)",flexShrink:0,display:"grid",placeItems:"center",overflow:"hidden",background:o.capaUrl?`url("${o.capaUrl}") center/cover`:"linear-gradient(145deg,var(--arcd-text-primary),var(--arcd-action-primary))",color:"var(--arcd-text-inverse)",fontWeight:"var(--arcd-font-weight-semibold)"}}>{!o.capaUrl&&(o.name||"O").charAt(0)}</div><div style={{minWidth:0}}><p style={{fontSize:"var(--arcd-type-body)",fontWeight:"var(--arcd-font-weight-semibold)",color:"var(--arcd-text-primary)",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{o.name}</p><p style={{fontSize:"var(--arcd-type-caption)",color:"var(--arcd-text-secondary)",marginTop:"var(--arcd-space-half)",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{o.address||`${Number(o.areaM2||0).toLocaleString("pt-BR")} m²`}</p></div></div>
          <span style={{fontSize:"var(--arcd-type-label)",color:o.cliente?"var(--arcd-text-primary)":"var(--arcd-text-secondary)",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{o.cliente||"Não informado"}</span>
          <span><Badge color={st.c}>{st.l}</Badge></span>
          <span style={{display:"inline-flex",alignItems:"center",gap:"var(--arcd-space-1)",fontSize:"var(--arcd-type-label)",fontWeight:"var(--arcd-font-weight-semibold)",color:fase?.cor||"var(--arcd-text-secondary)"}}><i style={{width:7,height:7,borderRadius:"var(--arcd-radius-pill)",background:fase?.cor||"var(--arcd-border-default)"}}/>{fase?.nome||"Sem fase"}</span>
          <span style={{fontSize:"var(--arcd-type-label)",color:"var(--arcd-text-secondary)"}}>{fmtDate(o.contractStart||o.startDate)||"—"}</span>
          <div style={{display:"flex",alignItems:"center",gap:"var(--arcd-space-2)",minWidth:0}}><span style={{width:28,height:28,borderRadius:"var(--arcd-radius-pill)",display:"grid",placeItems:"center",background:"color-mix(in srgb, var(--arcd-action-primary) 8%, transparent)",border:"var(--arcd-border-width) solid color-mix(in srgb, var(--arcd-action-primary) 20%, transparent)",color:"var(--arcd-action-primary)",fontSize:"var(--arcd-type-caption)",fontWeight:"var(--arcd-font-weight-semibold)"}}>{(o.engineer||"?").split(" ").slice(0,2).map(n=>n[0]).join("")}</span><span style={{fontSize:"var(--arcd-type-label)",color:"var(--arcd-text-primary)",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{o.engineer||"Não definido"}{equipe.length>0&&<small style={{display:"block",color:"var(--arcd-text-secondary)",fontSize:"var(--arcd-type-caption)"}}>{equipe.length} na equipe</small>}</span></div>
          <div onClick={e=>e.stopPropagation()} style={{display:"flex",justifyContent:"flex-end",gap:"var(--arcd-space-half)"}}><Btn v="ghost" size="sm" iconOnly onClick={()=>{setForm({...o,areaM2:String(o.areaM2||""),diaVenc1:String(o.diaVenc1||DIA_VENC_1_PADRAO),diaVenc2:String(o.diaVenc2||DIA_VENC_2_PADRAO)});setModal(true);}} title="Editar obra" ariaLabel="Editar obra"><Ic n="edit" s={13}/></Btn>{ehAdmin&&<Btn v="danger" size="sm" iconOnly onClick={()=>remove(o.id)} title="Excluir obra" ariaLabel="Excluir obra"><Ic n="trash" s={13}/></Btn>}</div>
        </div>;})}
        {!list.length&&<div style={{textAlign:"center",padding:"var(--arcd-space-8)",color:"var(--arcd-text-secondary)",fontSize:"var(--arcd-type-body)"}}>Nenhuma obra encontrada.</div>}
      </div>}

      {false&&!isDesktop&&<div hidden aria-hidden="true">
      {list.map(o => {
        const count = data.employees.filter(e => e.active !== false && e.obra === o.id).length;
        const st = statusMap[o.status] || statusMap.active;
        const area = Number(o.areaM2 || 0);
        const fase = fases.find(f=>f.id===o.faseId);
        const prazo = prazoObra(o);
        return (
          <div key={o.id} className="lift-card" style={{background:"var(--arcd-surface-card)",border:"var(--arcd-border-width) solid var(--arcd-border-default)",borderRadius:"var(--arcd-box-radius)",overflow:"hidden",boxShadow:C.shCard,display:"flex",flexDirection:"column",minWidth:0}}>
            <StandardButton variant="secondary" onClick={()=>onAbrirObra?.(o.id)} className="works-card-cover">
              {!o.capaUrl&&<span style={{position:"absolute",right:16,top:5,fontFamily:"var(--arcd-font-sans)",fontSize:"var(--arcd-type-page-title)",fontWeight:"var(--arcd-font-weight-semibold)",color:"color-mix(in srgb, var(--arcd-text-inverse) 8%, transparent)",lineHeight:"var(--arcd-line-height-normal)"}}>{(o.name||"O").charAt(0)}</span>}
              <div style={{position:"absolute",inset:0,padding:"var(--arcd-space-3)",display:"flex",flexDirection:"column",justifyContent:"space-between"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:"var(--arcd-space-1)"}}><span style={{fontSize:"var(--arcd-type-caption)",fontWeight:"var(--arcd-font-weight-semibold)",letterSpacing:"var(--arcd-letter-spacing-body)",textTransform:"uppercase",background:"color-mix(in srgb, var(--arcd-text-inverse) 92%, transparent)",color:st.c,borderRadius:"var(--arcd-radius-pill)",padding:"var(--arcd-space-1) var(--arcd-space-2)"}}>{st.l}</span>{fase&&<span style={{fontSize:"var(--arcd-type-caption)",fontWeight:"var(--arcd-font-weight-semibold)",color:"color-mix(in srgb, var(--arcd-text-inverse) 85%, transparent)"}}>{fase.nome}</span>}</div>
                <div><h3 className="brk" style={{fontFamily:FONT_DISPLAY,fontSize:"var(--arcd-type-section-title)",fontWeight:"var(--arcd-font-weight-semibold)",lineHeight:"var(--arcd-line-height-normal)",color:"var(--arcd-text-inverse)"}}>{o.name}</h3>{o.cliente&&<p style={{fontSize:"var(--arcd-type-label)",color:"color-mix(in srgb, var(--arcd-text-inverse) 82%, transparent)",marginTop:"var(--arcd-space-half)"}}>{o.cliente}</p>}</div>
              </div>
            </StandardButton>
            <div style={{padding:"var(--arcd-space-3)",display:"flex",flexDirection:"column",gap:"var(--arcd-space-2)",flex:1}}>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"var(--arcd-space-2)"}}>{[["Contrato",Number(o.contractValue)>0?fmtCompact(o.contractValue):"-"],["Área",area>0?`${area.toLocaleString("pt-BR")} m²`:"-"],["Equipe",`${count}`]].map(([l,v])=><div key={l} style={{background:"var(--arcd-surface-muted)",borderRadius:"var(--arcd-radius-control)",padding:"var(--arcd-space-2) var(--arcd-space-1)"}}><p style={{fontSize:"var(--arcd-type-caption)",fontWeight:"var(--arcd-font-weight-semibold)",color:"var(--arcd-text-secondary)",textTransform:"uppercase",letterSpacing:"var(--arcd-letter-spacing-body)"}}>{l}</p><p style={{fontSize:"var(--arcd-type-label)",fontWeight:"var(--arcd-font-weight-semibold)",color:"var(--arcd-text-primary)",marginTop:"var(--arcd-space-half)",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{v}</p></div>)}</div>
              <div style={{minHeight:37}}>{o.address&&<p className="brk" style={{fontSize:"var(--arcd-type-label)",color:"var(--arcd-text-muted)",lineHeight:"var(--arcd-line-height-normal)"}}>{o.address}</p>}{o.engineer&&<p style={{fontSize:"var(--arcd-type-label)",color:"var(--arcd-text-secondary)",marginTop:"var(--arcd-space-half)"}}>Responsável · <b style={{color:"var(--arcd-text-primary)"}}>{o.engineer}</b></p>}{prazo&&<p style={{fontSize:"var(--arcd-type-caption)",fontWeight:"var(--arcd-font-weight-semibold)",color:prazo.cor,marginTop:"var(--arcd-space-half)"}}>{prazo.rotulo}</p>}</div>
              <div style={{display:"grid",gridTemplateColumns:ehAdmin&&o.oneDriveUrl?"1fr 1fr":"1fr",gap:"var(--arcd-space-1)",marginTop:"auto"}}><Btn size="sm" onClick={()=>onAbrirObra?.(o.id)}>Abrir painel →</Btn>{ehAdmin&&o.oneDriveUrl&&<Btn size="sm" v="ghost" onClick={()=>abrirOneDrive(o.oneDriveUrl)}><Ic n="folder"/> Arquivos</Btn>}</div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",borderTop:"var(--arcd-border-width) solid var(--arcd-border-default)",paddingTop:"var(--arcd-space-2)"}}><span style={{fontSize:"var(--arcd-type-caption)",color:"var(--arcd-text-secondary)"}}>{CONTRACT_LABELS[o.contractType]||"Contrato"}</span><div style={{display:"flex",gap:"var(--arcd-space-half)"}}><Btn v="ghost" size="sm" iconOnly onClick={()=>{setForm({...o,areaM2:String(o.areaM2||""),diaVenc1:String(o.diaVenc1||DIA_VENC_1_PADRAO),diaVenc2:String(o.diaVenc2||DIA_VENC_2_PADRAO)});setModal(true);}} title="Editar obra" ariaLabel="Editar obra"><Ic n="edit" s={14}/></Btn>{ehAdmin&&<Btn v="danger" size="sm" iconOnly onClick={()=>remove(o.id)} title="Excluir obra" ariaLabel="Excluir obra"><Ic n="trash" s={14}/></Btn>}</div></div>
            </div>
          </div>
        );
      })}
      {!list.length&&<div style={{gridColumn:"1/-1",textAlign:"center",padding:"var(--arcd-space-8)",border:"var(--arcd-border-width) dashed var(--arcd-border-default)",borderRadius:"var(--arcd-box-radius)"}}><Ic n="building" s={25} color={C.muted}/><p style={{fontSize:"var(--arcd-type-body)",color:"var(--arcd-text-secondary)",marginTop:"var(--arcd-space-2)"}}>Nenhuma obra encontrada.</p></div>}
      </div>}
      </>}

      {/* Modal: nova fase / editar fase */}
      {faseModal && (
        <Modal title={faseModal.modo==="editar" ? "Editar fase" : "Nova fase"}
               onClose={()=>{setFaseModal(null);setFaseNome("");}}>
          <div style={{display:"flex",flexDirection:"column",gap:"var(--arcd-space-3)"}}>
            <Inp label="Nome da fase *" value={faseNome} onChange={setFaseNome}
              placeholder="Ex.: Análise da Prefeitura"/>

            <div>
              <p style={{fontSize:"var(--arcd-type-label)",fontWeight:"var(--arcd-font-weight-semibold)",color:"var(--arcd-text-primary)",marginBottom:"var(--arcd-space-1)"}}>Cor</p>
              <div style={{display:"flex",gap:"var(--arcd-space-2)",flexWrap:"wrap"}}>
                {CORES_FASE.map(c=>(
                  <StandardButton variant="secondary" type="button" key={c} aria-label={`Usar cor ${c}`} aria-pressed={faseCor===c} title={`Cor ${c}`} onClick={()=>setFaseCor(c)} size="icon"/>
                ))}
              </div>
            </div>

            {/* Prévia da coluna */}
            <div style={{background:"var(--arcd-surface-muted)",border:"1.5px solid var(--arcd-border-default)",borderRadius:"var(--arcd-radius-control)",padding:"var(--arcd-space-2) var(--arcd-space-3)"}}>
              <div style={{display:"flex",alignItems:"center",gap:"var(--arcd-space-1)"}}>
                <span style={{width:9,height:9,borderRadius:"var(--arcd-radius-control)",background:faseCor}}/>
                <p style={{fontSize:"var(--arcd-type-label)",fontWeight:"var(--arcd-font-weight-semibold)",textTransform:"uppercase",letterSpacing:"var(--arcd-letter-spacing-body)",color:"var(--arcd-text-primary)"}}>
                  {faseNome || "Nome da fase"}
                </p>
              </div>
            </div>

            <div style={{display:"flex",gap:"var(--arcd-space-2)"}}>
              <Btn v="ghost" onClick={()=>{setFaseModal(null);setFaseNome("");}} full>Cancelar</Btn>
              <Btn onClick={salvarFase} full><Ic n="check"/> Salvar</Btn>
            </div>
          </div>
        </Modal>
      )}

      {modal && (
        <Modal title={form.id ? "Editar obra" : "Nova obra"} onClose={() => setModal(false)} wide footer={<>
          <Btn v="ghost" onClick={() => setModal(false)}>Cancelar</Btn>
          <Btn onClick={save} loading={savingProject}><Ic n="check" /> {reviewingProject?"Confirmar e salvar":"Revisar cadastro"}</Btn>
        </>}>
          {/* Grid de verdade: 1 coluna no celular, 2 no resto. Os separadores de
              seção usam gridColumn:"1/-1", que só funciona em container grid -
              dentro do flex antigo eram CSS morto. */}
          <div style={{ display: "grid", gridTemplateColumns: formGrid(2), gap: "var(--arcd-space-3)" }}>
            <Inp label="Nome *" value={form.name} onChange={setField("name")} error={projectErrors.name}/>
            <Inp label="Área (m²)" type="number" min="0" value={form.areaM2} onChange={setField("areaM2")} placeholder="Ex.: 250" error={projectErrors.areaM2}/>
            <Inp label="Endereço" value={form.address} onChange={setField("address")} />
            <Sel label="Condomínio / loteamento" value={form.condominioId||""} onChange={setField("condominioId")}
              options={[{v:"",l:"Fora de condomínio / não informado"},...condominios.map(c=>({v:c.id,l:`${c.nome}${c.cidade?` · ${c.cidade}/${c.uf}`:""}`}))]}/>
            {form.condominioId&&<><Inp label="Quadra" value={form.quadra||""} onChange={setField("quadra")} placeholder="Ex.: Q-12"/><Inp label="Lote" value={form.lote||""} onChange={setField("lote")} placeholder="Ex.: 08"/></>}
            <Sel label="Engenheiro de campo responsável" value={form.engineerId||""} onChange={setField("engineerId")}
              options={[{v:"",l:engenheiros.length?"Selecione o engenheiro...":"Cadastre um engenheiro em Ajustes > Usuários"},...engenheiros.map(u=>({v:u.id,l:u.nome}))]}/>
            <div style={{display:"grid",gridTemplateColumns:"minmax(0,1fr) auto",gap:"var(--arcd-space-1)",alignItems:"end"}}><Sel label="Cliente contratante" value={form.clienteId||""} onChange={v=>{const c=clientes.find(x=>x.id===v);setForm(f=>({...f,clienteId:v,cliente:c?.nome||""}));}} options={[{v:"",l:"Selecione um cliente"},...clientes.map(c=>({v:c.id,l:c.tipoPessoa==="PJ"?(c.razaoSocial||c.nome):c.nome}))]}/><Btn v="info" onClick={()=>setClienteModal(clienteContratualVazio())}><Ic n="plus"/> Cliente</Btn></div>
            <Inp label="Data de início" type="date" value={form.startDate} onChange={setField("startDate")} />
            {ehAdmin&&<div style={{gridColumn:"1/-1"}}>
              <Inp label="Pasta da obra no OneDrive" value={form.oneDriveUrl} onChange={setField("oneDriveUrl")} placeholder="Cole aqui o link da subpasta desta obra" error={projectErrors.oneDriveUrl}/>
              <p style={{fontSize:"var(--arcd-type-label)",color:"var(--arcd-text-secondary)",marginTop:"var(--arcd-space-1)"}}>O sistema salva apenas o link. Projetos, contratos e documentos permanecem no OneDrive.</p>
            </div>}
            <Sel label="Fase (quadro)" value={form.faseId || (fases[0]?.id||"")} onChange={setField("faseId")}
              options={fases.map(f=>({v:f.id,l:f.nome}))}/>
            <Sel label="Status" value={form.status} onChange={setField("status")} options={[
              { v: "active", l: "Ativa" },
              { v: "paused", l: "Pausada" },
              { v: "done", l: "Concluída" },
            ]} />
            <div style={{ gridColumn:"1/-1", height:1, background:"linear-gradient(90deg,transparent,var(--arcd-border-default),transparent)", margin:"var(--arcd-space-1) var(--arcd-space-0)" }}/>
            <div style={{ gridColumn:"1/-1" }}>
              <p style={{ fontSize:"var(--arcd-type-label)", fontWeight:"var(--arcd-font-weight-semibold)", color:"var(--arcd-action-primary)", textTransform:"uppercase", letterSpacing:"var(--arcd-letter-spacing-body)", marginBottom:"var(--arcd-space-2)" }}>Contrato financeiro</p>
            </div>
            <Sel label="Modalidade do contrato *" value={form.contractType} onChange={setField("contractType")} options={CONTRACT_TYPES}/>
            <Inp label="Valor total do contrato (R$)" type="number" min="0" value={form.contractValue} onChange={setField("contractValue")} placeholder="0,00" error={projectErrors.contractValue}/>
            {(form.contractType === "fixed_labor_admin" || form.contractType === "admin_only") && (
              <div style={{gridColumn: form.contractType==="admin_only"?"1/-1":"auto"}}>
                <Inp label="% Administração" type="number" min="0" max="100" value={form.adminPercentage} onChange={setField("adminPercentage")} placeholder="Ex.: 12" error={projectErrors.adminPercentage}/>
                <p style={{fontSize:"var(--arcd-type-caption)",color:"var(--arcd-text-secondary)",marginTop:"var(--arcd-space-1)"}}>
                  {form.contractType==="admin_only"
                    ? "Por padrão incide sobre todos os custos gastos na obra (mão de obra, benefícios, materiais, terceirizados, equipamentos e rescisões)."
                    : "Por padrão incide só sobre materiais e terceirizados gastos - a mão de obra já está coberta pela parcela fixa abaixo."}
                  {" "}Ajuste abaixo o que entra nessa base.
                </p>
                <div style={{display:"grid",gridTemplateColumns:formGrid(3),gap:"var(--arcd-space-2)",marginTop:"var(--arcd-space-2)"}}>
                  {/** @type {[keyof WorkRecord,string,boolean][]} */ ([
                    ["adminBaseMateriais","Materiais",form.adminBaseMateriais!==false],
                    ["adminBaseMaoDeObra","Mão de obra",form.adminBaseMaoDeObra===true||(form.adminBaseMaoDeObra===undefined&&form.contractType==="admin_only")],
                    ["adminBaseTerceirizados","Terceirizados",form.adminBaseTerceirizados!==false],
                    ["adminBaseEquipamentos","Equipamentos / locação",form.adminBaseEquipamentos??form.contractType==="admin_only"],
                    ["adminBaseEngenhariaCampo","Engenharia de campo",form.adminBaseEngenhariaCampo??form.contractType==="admin_only"],
                  ]).map(([campo,label,checked])=>(
                    <label key={campo} className="works-check" data-checked={checked}>
                      <ChoiceControl type="checkbox" checked={checked} onChange={e=>setField(campo)(e.target.checked)}/>
                      <p style={{fontSize:"var(--arcd-type-label)",fontWeight:"var(--arcd-font-weight-semibold)",color:checked?"var(--arcd-action-primary)":"var(--arcd-text-primary)"}}>{label}</p>
                    </label>
                  ))}
                </div>
                {projectErrors.adminBases&&<p className="works-field-error" role="alert">{projectErrors.adminBases}</p>}
                <Sel label="Categoria de custo da engenharia de campo" value={form.adminFieldEngineeringCategoryId||""} onChange={setField("adminFieldEngineeringCategoryId")} options={[{v:"",l:"Não identificada — conferir classificação"},...categoriasDesp(data).filter(category=>!["material","equipamento","mao_obra","beneficios","rescisao","terceirizado"].includes(category.v))]}/>
                <p>As opções acima alteram somente a base da taxa. Equipamentos e engenharia continuam no custo da obra. Selecione a categoria já usada nos lançamentos de engenharia; não há identificação pelo nome do profissional ou pela descrição.</p>
              </div>
            )}
            {(form.contractType === "fixed_labor" || form.contractType === "fixed_labor_admin") && (
              <Inp label="Valor parcela MO fixo (R$)" type="number" min="0" value={form.parcelaMensal} onChange={setField("parcelaMensal")} placeholder="Ex.: 15.000"/>
            )}
            <div style={{gridColumn:"1/-1",height:1,background:"var(--arcd-border-default)",margin:"var(--arcd-space-1) var(--arcd-space-0)"}}/>
            <p style={{gridColumn:"1/-1",fontSize:"var(--arcd-type-label)",fontWeight:"var(--arcd-font-weight-semibold)",color:"var(--arcd-action-primary)",textTransform:"uppercase",letterSpacing:"var(--arcd-letter-spacing-body)"}}>Cronograma de cobrança</p>
            <Sel label="Frequência de cobrança *" value={form.billingFrequency} onChange={setField("billingFrequency")} options={FREQ_OPTS}/>
            <Inp label="Total de parcelas" type="number" min="1" value={form.totalParcelas} onChange={setField("totalParcelas")} placeholder={form.billingFrequency==="quinzenal"?"Ex.: 24":"Ex.: 12"} error={projectErrors.totalParcelas}/>

            {/* Dias de vencimento - perguntados aqui, na hora de lancar a obra.
                O padrao segue o contrato (15 e 30), mas cada obra pode fugir dele. */}
            {form.billingFrequency === "quinzenal" ? (
              <>
                <Sel label="Vencimento da 1ª quinzena *" value={String(form.diaVenc1||DIA_VENC_1_PADRAO)} onChange={setField("diaVenc1")} options={DIA_OPTS} error={projectErrors.diaVenc1}/>
                <Sel label="Vencimento da 2ª quinzena *" value={String(form.diaVenc2||DIA_VENC_2_PADRAO)} onChange={setField("diaVenc2")} options={DIA_OPTS} error={projectErrors.diaVenc2}/>
              </>
            ) : (
              <Sel label="Dia de vencimento *" value={String(form.diaVenc1||DIA_VENC_1_PADRAO)} onChange={setField("diaVenc1")} options={DIA_OPTS} error={projectErrors.diaVenc1}/>
            )}
            <div style={{gridColumn:"1/-1",background:"color-mix(in srgb, var(--arcd-action-primary) 7%, transparent)",border:"var(--arcd-border-width) solid color-mix(in srgb, var(--arcd-action-primary) 27%, transparent)",borderRadius:"var(--arcd-radius-control)",padding:"var(--arcd-space-2) var(--arcd-space-3)"}}>
              <p style={{fontSize:"var(--arcd-type-label)",color:"var(--arcd-text-muted)",lineHeight:"var(--arcd-line-height-normal)"}}>
                {form.billingFrequency === "quinzenal"
                  ? <>Cada mês gera 2 parcelas: uma no dia <b>{form.diaVenc1||DIA_VENC_1_PADRAO}</b> e outra no dia <b>{form.diaVenc2||DIA_VENC_2_PADRAO}</b>. Padrão do contrato: 15 e 30.</>
                  : <>Cada mês gera 1 parcela, vencendo no dia <b>{form.diaVenc1||DIA_VENC_1_PADRAO}</b>.</>}
                {" "}Em meses mais curtos, o dia 29/30/31 cai no último dia do mês (fev → 28).
              </p>
            </div>
            <div style={{gridColumn:"1/-1",height:1,background:"var(--arcd-border-default)",margin:"var(--arcd-space-1) var(--arcd-space-0)"}}/>
            <p style={{gridColumn:"1/-1",fontSize:"var(--arcd-type-label)",fontWeight:"var(--arcd-font-weight-semibold)",color:"var(--arcd-action-primary)",textTransform:"uppercase",letterSpacing:"var(--arcd-letter-spacing-body)"}}>Período e entrada</p>
            <Inp label="Início do contrato *" type="date" value={form.contractStart} onChange={setField("contractStart")} error={projectErrors.contractStart}/>
            <Inp label="Fim previsto" type="date" value={form.contractEnd} onChange={setField("contractEnd")} error={projectErrors.contractEnd}/>
            {form.contractType !== "admin_only" && (<>
              <Inp label="Entrada (R$)" type="number" min="0" value={form.entrada} onChange={setField("entrada")} placeholder="0,00" error={projectErrors.entrada}/>
              <Inp label="Data da entrada" type="date" value={form.entradaDate} onChange={setField("entradaDate")} error={projectErrors.entradaDate}/>
            </>)}
            {form.contractValue && form.totalParcelas && Number(form.totalParcelas)>0 && form.contractType !== "admin_only" && !form.parcelaMensal && (
              <div style={{gridColumn:"1/-1",background:"color-mix(in srgb, var(--arcd-action-primary) 7%, transparent)",border:"var(--arcd-border-width) solid color-mix(in srgb, var(--arcd-action-primary) 27%, transparent)",borderRadius:"var(--arcd-radius-control)",padding:"var(--arcd-space-2) var(--arcd-space-3)"}}>
                <p style={{fontSize:"var(--arcd-type-label)",color:"var(--arcd-text-secondary)"}}>Parcela MO sugerida: <strong style={{color:"var(--arcd-action-primary)"}}>{(((Number(form.contractValue)-Number(form.entrada||0))/Number(form.totalParcelas))).toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}</strong></p>
                <Btn v="primary" size="sm" style={{marginTop:"var(--arcd-space-1)"}} onClick={()=>setField("parcelaMensal")(String(Math.round((Number(form.contractValue)-Number(form.entrada||0))/Number(form.totalParcelas))))}>
                  Usar este valor →
                </Btn>
              </div>
            )}
            {/* Caixa de obra */}
            <div style={{gridColumn:"1/-1",height:1,background:"var(--arcd-border-default)",margin:"var(--arcd-space-1) var(--arcd-space-0)"}}/>
            <label className="works-check works-check--wide" data-checked={form.hasCaixa} style={{gridColumn:"1/-1"}}>
              <ChoiceControl type="checkbox" checked={form.hasCaixa} onChange={e=>setField("hasCaixa")(e.target.checked)}/>
              <div>
                <p style={{fontSize:"var(--arcd-type-body)",fontWeight:"var(--arcd-font-weight-semibold)",color:form.hasCaixa?"var(--arcd-success-text)":"var(--arcd-text-primary)"}}> Esta obra possui caixa de obra</p>
                <p style={{fontSize:"var(--arcd-type-label)",color:"var(--arcd-text-secondary)",marginTop:"var(--arcd-space-0)"}}>Cliente faz aportes para compra de materiais - controle separado de entradas e gastos</p>
              </div>
            </label>
            {reviewingProject&&<div className="works-review" role="status" style={{gridColumn:"1/-1"}}><div><strong>Revise antes de confirmar</strong><p>{form.name||"Obra sem nome"} · {CONTRACT_LABELS[form.contractType]||form.contractType} · {fmt(Number(form.contractValue||0))}</p><p>{form.billingFrequency==="quinzenal"?"2 cobranças por mês":"1 cobrança por mês"} · {contar(form.totalParcelas||0,"parcela","parcelas")} · início {fmtDate(form.contractStart)}</p></div><span>Nenhuma folha anterior será alterada por este cadastro.</span></div>}
          </div>
        </Modal>
      )}
      {clienteModal&&<ClienteContratualModal
        form={clienteModal} setForm={setClienteModal} onClose={()=>setClienteModal(null)}
        onSave={salvarClienteDaObra} formGrid={formGrid}/>}
    </div>
  );
}
