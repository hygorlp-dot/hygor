import {useHelpTopic} from '../../features/help/HelpContext.jsx';
// Declarações extraídas literalmente da entrada legada; não importar LegacyApp aqui.
import { uid, today, fmtDateFull } from "../../legacy/format.js";
import { C } from "../../legacy/palette.js";
import { Btn, Ic, Modal, Inp, Sel, Badge } from "../../legacy/ui.jsx";
import { ROLE_TABS } from "./abas-acesso.js";
import { useState } from "react";
import { definirPinOperador } from "../../api";
import { provisionarContaEmail } from "../../api";
import { useCallback } from "react";
import { listarPresencas } from "../../api";
import { useEffect } from "react";
import { criarPollingAdaptativo } from "../sync/polling";
import { useMemo } from "react";
import { allowedTabsForUser } from "./abas-acesso.js";
import { arcdApprovalEngine as motorAprovacaoGenerico } from "../aprovacoes/arcd-engine.js";
import { OPERADORES } from "../aprovacoes/index.js";
import { useBreakpoint } from "../../hooks/useBreakpoint";
import { podeAdministrarPoliticas } from "../aprovacoes/index.js";
import { validarPolitica } from "../aprovacoes/index.js";
import { podeGerenciarDelegacoes } from "../aprovacoes/index.js";
import UserDirectory from "./components/UserDirectory.jsx";
import {Tabs,TabsList,TabsTrigger,TabsContent} from "../../components/ui/tabs.jsx";
import { moduleForTab } from "../../navigation/erp-navigation.js";


//
// SISTEMA DE LOGIN E PERMISSÕES
//

export const ROLES = [
  { v:"admin",      l:"Administrador",     desc:"Acesso total ao sistema",             color:"#D4AF37" },
  { v:"engenheiro", l:"Engenheiro de Campo",desc:"Obras, Ponto, Equipe, Terceiros",    color:"#1565C0" },
  { v:"engenheiro_auditor", l:"Engenheiro Auditor",desc:"Auditoria técnica, vistorias e conferências", color:"#0F766E" },
  { v:"compras",    l:"Setor de Compras",   desc:"Solicitações, pedidos, fornecedores e estoque", color:"#D97706" },
  { v:"rh",         l:"RH / Gestão",       desc:"Equipe, Terceirizados, Folha e Rescisão", color:"#2E7D32" },
  { v:"financeiro", l:"Financeiro",         desc:"Pagamentos, notas, conciliação, DRE e auditoria", color:"#6A1B9A" },
  { v:"comercial",  l:"Comercial",          desc:"Orçamentos e atividades comerciais", color:"#2E7D32" },
  { v:"visualizador",l:"Visualizador",      desc:"Somente Dashboard (somente leitura)", color:"#6B6459" },
];



export const ACCESS_SECTORS=[
  {id:"engenharia",label:"Engenharia",color:"#1565C0",tabs:[
    ["obras","Obras"],["orc","Orçamento"],["plan","Planejamento"],["plan_suprimentos","Marcos e Curva A"],["rdo","Diário de obra"],["conferencia","Conferência"],["med","Medição técnica"],
    ["equip","Equipamentos"],["licenca","Licenciamento"],["obsoletos","Obsoletos"],
  ]},
  {id:"compras",label:"Compras",color:"#D97706",tabs:[
    ["cmp","Compras e solicitações"],["fornecedores","Fornecedores e ranking"],["est","Estoque"],
  ]},
  {id:"financeiro",label:"Financeiro",color:"#6A1B9A",tabs:[
    ["dre_emp","DRE Empresa"],["dre","DRE Obras"],["fin","Gestão financeira"],["conc","Conciliação"],
    ["equip_fin","Locação de equipamentos"],["medicoes","Medições financeiras"],["caixa","Caixa da obra"],["relat","Relatórios"],
  ]},
  {id:"rh",label:"Recursos Humanos",color:"#0F766E",tabs:[
    ["equipe","Equipes"],["equipe_obras","Equipe nas Obras"],["ponto","Ponto por obra"],["ponto_geral","Gestão geral do ponto"],["ponto_app","Ponto eletrônico (app)"],["terc","Terceirizados"],["folha","Folha de pagamento"],["resc","Rescisões"],["rh_indic","Indicadores"],["conc","Conciliação da folha"],
  ]},
  {id:"comercial",label:"Comercial",color:"#2E7D32",tabs:[
    ["com_workspace","Comercial da empresa"],["com_real_estate","Venda de imóveis"],["com_pipeline","Pipeline"],["com_relationships","Relacionamentos"],["com_deals","Propostas e contratos"],["com_management","Gestão comercial"],
  ]},
  {id:"geral",label:"Recursos gerais",color:"#6B6459",tabs:[
    ["patrimonio","Patrimônio da empresa"],["ia","Inteligência artificial"],["cad","Cadastros gerais"],
  ]},
];


//  Gestão de Usuários (dentro de Config)

export function GestaoUsuarios({ data, update, showToast, currentUser }) {
  useHelpTopic("config","config_membros",10);
  const emptyU = { id:"", nome:"", role:"engenheiro", email:"", obraId:"", maxDesconto:10, active:true, accessTabs:[...ROLE_TABS.engenheiro] };
  const [modal,   setModal]   = useState(false);
  const [editorTab,setEditorTab]=useState("dados");
  const [pinModal,setPinModal] = useState(null); // userId
  const [form,    setForm]    = useState(emptyU);
  const [newPin,  setNewPin]  = useState("");
  const [newPin2, setNewPin2] = useState("");
  const [contaModal,setContaModal]=useState(null);
  const [senhaTemp,setSenhaTemp]=useState("");
  const [senhaTemp2,setSenhaTemp2]=useState("");
  const [ativandoConta,setAtivandoConta]=useState(false);
  const [presencas,setPresencas] = useState([]);
  const [presencaBusy,setPresencaBusy] = useState(false);
  const [presencaErro,setPresencaErro] = useState("");
  const F = k => v => setForm(f=>({...f,[k]:v}));
  const mudarPerfil=role=>setForm(f=>({...f,role,accessTabs:[...(ROLE_TABS[role]||["home"])]}));
  const toggleTela=tab=>setForm(f=>{const atual=new Set(f.accessTabs||[]);atual.has(tab)?atual.delete(tab):atual.add(tab);return{...f,accessTabs:[...atual]};});
  const toggleSetor=setor=>setForm(f=>{const atual=new Set(f.accessTabs||[]);const ids=setor.tabs.map(([id])=>id);const todos=ids.every(id=>atual.has(id));ids.forEach(id=>todos?atual.delete(id):atual.add(id));return{...f,accessTabs:[...atual]};});

  const saveUser = async () => {
    if (!form.nome.trim()) { showToast("Nome obrigatório.","error"); return; }
    if(form.id===currentUser?.id&&form.role!=="admin"){showToast("O administrador logado não pode retirar o próprio acesso administrativo.","error");return;}
    const accessTabs=form.role==="admin"?[...ROLE_TABS.admin]:[...new Set(["home",...(form.accessTabs||[])])].filter(tab=>ROLE_TABS.admin.includes(tab)&&tab!=="config");
    const payload = { ...form,accessTabs,maxDesconto:Math.max(0,Math.min(100,Number(form.maxDesconto||0))), id: form.id||uid(), createdAt: form.createdAt||new Date().toISOString() };
    // PIN só é definido via modal separado
    if (!form.id) payload.pin = ""; // novo usuário sem PIN → admin define depois
    const usuarios = form.id
      ? (data.usuarios||[]).map(u=>u.id===form.id?payload:u)
      : [...(data.usuarios||[]), payload];
    const obras=(data.obras||[]).map(o=>o.engineerId===payload.id?{...o,engineer:payload.role==="engenheiro"&&payload.active!==false?payload.nome:"",engineerId:payload.role==="engenheiro"&&payload.active!==false?payload.id:""}:o);
    update({...data, usuarios, obras});
    setModal(false);
    showToast(form.id?"Usuário atualizado.":"Usuário cadastrado. Defina o PIN agora.");
    if (!form.id) setPinModal(payload.id);
  };

  const savePin = async (userId) => {
    if (newPin.length < 4) { showToast("PIN mínimo 4 dígitos.","error"); return; }
    if (newPin !== newPin2) { showToast("PINs não coincidem.","error"); return; }
    const sincronizado=await update({__aguardarFila:true});
    if(!sincronizado?.ok){showToast("Conclua o salvamento pendente antes de definir o PIN.","error");return;}
    const resultado=await definirPinOperador(userId,newPin);
    if(!resultado.ok){showToast(resultado.erro||"Não foi possível definir o PIN.","error");return;}
    update({__adotarServidor:true,data:resultado.data,updatedAt:resultado.updatedAt});
    setPinModal(null); setNewPin(""); setNewPin2("");
    showToast("PIN definido com sucesso.");
  };

  const ativarContaEmail=async()=>{
    if(senhaTemp.length<8){showToast("A senha temporária deve ter ao menos 8 caracteres.","error");return;}
    if(senhaTemp!==senhaTemp2){showToast("As senhas não coincidem.","error");return;}
    const sincronizado=await update({__aguardarFila:true});
    if(!sincronizado?.ok){showToast("Conclua o salvamento pendente antes de ativar a conta.","error");return;}
    setAtivandoConta(true);
    const r=await provisionarContaEmail(contaModal,senhaTemp);
    setAtivandoConta(false);
    if(!r.ok){showToast(r.erro||"Não foi possível ativar a conta.","error");return;}
    update({__adotarServidor:true,data:r.data,updatedAt:r.updatedAt});
    setContaModal(null);setSenhaTemp("");setSenhaTemp2("");showToast("Conta de e-mail ativada. Entregue a senha temporária ao operador.");
  };

  const toggleActive = (id) => {
    const usuarios = (data.usuarios||[]).map(u=>u.id===id?{...u,active:!u.active}:u);
    update({...data,usuarios});
    showToast("Status atualizado.");
  };

  const carregarPresencas = useCallback(async () => {
    if (currentUser?.role !== "admin") return;
    setPresencaBusy(true);
    const r = await listarPresencas();
    if (r.ok) { setPresencas(r.presencas); setPresencaErro(""); }
    else setPresencaErro(r.erro || "Não foi possível consultar quem está on-line.");
    setPresencaBusy(false);
  }, [currentUser?.role]);

  useEffect(() => {
    if (currentUser?.role !== "admin") return undefined;
    const polling = criarPollingAdaptativo({ tarefa: carregarPresencas, visivelMs: 30000, ocultoMs: 120000 });
    polling.iniciar();
    return polling.parar;
  }, [currentUser?.role, carregarPresencas]);

  const presencasPorUsuario = useMemo(() => {
    const mapa = new Map();
    presencas.forEach(p => {
      if (!mapa.has(p.userId)) mapa.set(p.userId, []);
      mapa.get(p.userId).push(p);
    });
    mapa.forEach(lista => lista.sort((a,b)=>new Date(b.lastSeen)-new Date(a.lastSeen)));
    return mapa;
  }, [presencas]);

  const fmtUltimaAtividade = iso => {
    if (!iso) return "Nunca registrado";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "Horário indisponível";
    const segundos = Math.max(0, Math.round((Date.now()-d.getTime())/1000));
    if (segundos < 60) return "Agora";
    if (segundos < 3600) return `Há ${Math.floor(segundos/60)} min`;
    return d.toLocaleString("pt-BR", { day:"2-digit", month:"2-digit", hour:"2-digit", minute:"2-digit" });
  };

  return (
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      <UserDirectory users={data.usuarios||[]} works={data.obras||[]} roles={ROLES} currentUser={currentUser} presences={presencasPorUsuario} onRefresh={carregarPresencas} refreshing={presencaBusy} presenceError={presencaErro} formatActivity={fmtUltimaAtividade}
        onAdd={()=>{setForm(emptyU);setEditorTab("dados");setModal(true);}}
        onEdit={u=>{setForm({...u,accessTabs:[...allowedTabsForUser(u)]});setEditorTab("dados");setModal(true);}}
        onLogin={u=>{if(!u.email){showToast("Cadastre o e-mail do operador antes de ativar a conta.","error");return;}setContaModal(u.id);setSenhaTemp("");setSenhaTemp2("");}}
        onPin={u=>setPinModal(u.id)} onToggle={toggleActive}
        onAllWorks={u=>{update({...data,usuarios:(data.usuarios||[]).map(x=>x.id===u.id?{...x,obraId:""}:x)});showToast(`${u.nome} agora pode acessar todas as obras.`);}} />

      {/* Modal: cadastro de usuário */}
      {modal&&(
        <Modal title={form.id?"Editar usuário":"Novo usuário"} onClose={()=>setModal(false)} wide>
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <Tabs value={editorTab} onValueChange={setEditorTab}><TabsList aria-label="Cadastro do membro"><TabsTrigger value="dados">Dados do membro</TabsTrigger><TabsTrigger value="permissoes">Permissões de acesso</TabsTrigger></TabsList><TabsContent value="dados"><div style={{display:"flex",flexDirection:"column",gap:12}}><Inp label="Nome completo *" value={form.nome} onChange={F("nome")} placeholder="Nome do usuário"/>
            <Sel label="Perfil-base *" value={form.role} onChange={mudarPerfil} options={ROLES.map(r=>({v:r.v,l:r.l}))}/>
            <Inp label="E-mail" value={form.email} onChange={F("email")} placeholder="email@empresa.com"/>
            <Inp label="Limite de desconto comercial (%)" type="number" value={form.maxDesconto??10} onChange={F("maxDesconto")} placeholder="10"/>
            <Sel label="Restringir a obra (opcional)" value={form.obraId} onChange={F("obraId")}
              options={[{v:"",l:"Todas as obras"},...data.obras.map(o=>({v:o.id,l:o.name}))]}/>
            </div></TabsContent><TabsContent value="permissoes"><div style={{display:"flex",flexDirection:"column",gap:12}}><div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:6,padding:"10px 12px"}}>
              <p style={{fontSize:"var(--arcd-type-label)",color:C.muted}}>
                O perfil-base preenche uma sugestão. O acesso efetivo é definido pelas telas marcadas abaixo.
              </p>
            </div>
            {form.role==="admin"?<div style={{background:`${C.yellow}10`,border:`1px solid ${C.yellow}`,borderRadius:6,padding:"10px 12px"}}><p style={{fontSize:"var(--arcd-type-label)",color:C.yellowD,fontWeight:600}}>ADMINISTRADOR · ACESSO TOTAL</p><p style={{fontSize:"var(--arcd-type-label)",color:C.muted,marginTop:2}}>O administrador sempre acessa todos os setores, usuários e configurações.</p></div>:<div style={{display:"flex",flexDirection:"column",gap:8}}>
              <div><p style={{fontSize:"var(--arcd-type-label)",fontWeight:600,color:C.text}}>ACESSOS DESTE USUÁRIO</p><p style={{fontSize:"var(--arcd-type-caption)",color:C.muted,marginTop:2}}>Marque o setor inteiro ou escolha telas individualmente. Dashboard é liberado automaticamente.</p></div>
              {ACCESS_SECTORS.map(setor=>{const selecionadas=setor.tabs.filter(([id])=>(form.accessTabs||[]).includes(id)).length;const todas=selecionadas===setor.tabs.length;return <div key={setor.id} style={{border:`1px solid ${todas?setor.color:C.border}`,borderLeft:`1px solid ${setor.color}`,borderRadius:6,padding:"9px 10px",background:todas?`${setor.color}08`:C.surface}}>
                <button onClick={()=>toggleSetor(setor)} style={{display:"flex",width:"100%",justifyContent:"space-between",alignItems:"center",gap:8,border:0,background:"transparent",cursor:"pointer",padding:0,textAlign:"left"}}><span style={{fontSize:"var(--arcd-type-label)",fontWeight:600,color:setor.color}}>{setor.label.toUpperCase()}</span><span style={{fontSize:"var(--arcd-type-caption)",color:C.muted}}>{selecionadas}/{setor.tabs.length} · {todas?"DESMARCAR SETOR":"MARCAR SETOR"}</span></button>
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:5,marginTop:7}}>{setor.tabs.map(([id,label])=>{const marcado=(form.accessTabs||[]).includes(id);return <label key={id} style={{display:"flex",alignItems:"center",gap:7,border:`1px solid ${marcado?setor.color:C.border}`,background:marcado?`${setor.color}0B`:C.bg,borderRadius:6,padding:"6px 8px",cursor:"pointer"}}><input type="checkbox" checked={marcado} onChange={()=>toggleTela(id)}/><span style={{fontSize:"var(--arcd-type-label)",color:marcado?C.text:C.muted,fontWeight:marcado?600:500}}>{label}</span></label>;})}</div>
              </div>;})}
            </div>}
            </div></TabsContent></Tabs><div style={{display:"flex",gap:8}}>
              <Btn v="ghost" onClick={()=>setModal(false)} full>Cancelar</Btn>
              <Btn onClick={saveUser} full><Ic n="check"/> Salvar</Btn>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal: definir PIN */}
      {pinModal&&(
        <Modal title="Definir PIN de acesso" onClose={()=>{setPinModal(null);setNewPin("");setNewPin2("");}}>
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <div style={{background:C.surface,border:`1.5px solid ${C.border}`,borderRadius:6,padding:"10px 14px"}}>
              <p style={{fontSize:"var(--arcd-type-body)",color:C.muted}}>Usuário: <strong style={{color:C.text}}>{(data.usuarios||[]).find(u=>u.id===pinModal)?.nome||"-"}</strong></p>
              <p style={{fontSize:"var(--arcd-type-label)",color:C.muted,marginTop:4}}>O PIN é pessoal e deve ter entre 4 e 6 dígitos numéricos.</p>
            </div>
            <Inp label="Novo PIN *" type="password" value={newPin} onChange={setNewPin} placeholder="4 a 6 dígitos"/>
            <Inp label="Confirmar PIN *" type="password" value={newPin2} onChange={setNewPin2} placeholder="Repita o PIN"/>
            <div style={{display:"flex",gap:8}}>
              <Btn v="ghost" onClick={()=>{setPinModal(null);setNewPin("");setNewPin2("");}} full>Cancelar</Btn>
              <Btn v="primary" onClick={()=>savePin(pinModal)} full><Ic n="check"/> Definir PIN</Btn>
            </div>
          </div>
        </Modal>
      )}

      {contaModal&&<Modal title={(data.usuarios||[]).find(u=>u.id===contaModal)?.authUserId?"Redefinir senha do operador":"Ativar acesso por e-mail"} onClose={()=>setContaModal(null)}><div style={{display:"flex",flexDirection:"column",gap:12}}><div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:7,padding:"10px 12px"}}><p style={{fontSize:"var(--arcd-type-body)",fontWeight:600,color:C.text}}>{(data.usuarios||[]).find(u=>u.id===contaModal)?.nome}</p><p style={{fontSize:"var(--arcd-type-label)",color:C.muted,marginTop:3}}>{(data.usuarios||[]).find(u=>u.id===contaModal)?.email}</p></div><Inp label="Senha temporária *" type="password" value={senhaTemp} onChange={setSenhaTemp} placeholder="Mínimo 8 caracteres"/><Inp label="Confirmar senha *" type="password" value={senhaTemp2} onChange={setSenhaTemp2} placeholder="Repita a senha"/><p style={{fontSize:"var(--arcd-type-label)",color:C.muted,lineHeight:1.45}}>O operador usará seu e-mail e esta senha na nova tela de login. O PIN continuará disponível somente durante a transição.</p><div style={{display:"flex",gap:8}}><Btn v="ghost" full onClick={()=>setContaModal(null)}>Cancelar</Btn><Btn full onClick={ativarContaEmail} disabled={ativandoConta}>{ativandoConta?"Ativando...":"Ativar conta"}</Btn></div></div></Modal>}
    </div>
  );
}


//
// GESTÃO DE APROVAÇÕES - tela administrativa sobre o motor genérico de
// domains/aprovacoes/ (engine.js + policies.js). O motor já suporta qualquer
// setor; hoje só existem resolvedores de aprovador genéricos
// (resolvedoresAprovacaoGenericos, acima) - por isso a lista de tipos de
// processo e de aprovador abaixo fica restrita ao que realmente resolve
// alguém. Adicionar um novo setor é trabalho de desenvolvimento (escrever o
// resolvedor), não de configuração - por design, o motor nunca inventa um
// aprovador para um cargo/departamento que a base não tem.
export const SETORES_APROVACAO = [
  { v: "solicitacaoCompra", l: "Compras · Solicitação de compra" },
  { v: "pagamentoTerceiro", l: "Terceiros · Pagamento" },
];

export const MOTORES_APROVACAO_POR_ENTIDADE = { solicitacaoCompra: () => motorAprovacaoGenerico, pagamentoTerceiro: () => motorAprovacaoGenerico };

export const TIPOS_APROVADOR_APROVACAO = [
  { v: "usuario", l: "Usuário específico", refs: "usuario" },
  { v: "cargo", l: "Perfil de acesso (cargo)", refs: "role" },
  { v: "responsavelObra", l: "Engenheiro responsável pela obra", refs: null },
  { v: "compradorResponsavel", l: "Setor de Compras", refs: null },
  { v: "financeiro", l: "Setor Financeiro", refs: null },
  { v: "administrador", l: "Administrador", refs: null },
  { v: "campoSolicitacao", l: "Aprovador indicado na solicitação", refs: null },
];

export const CAMPOS_CONTEXTO_APROVACAO = [
  { v: "valorTotal", l: "Valor total (R$)" },
  { v: "obraId", l: "Obra" },
  { v: "categoria", l: "Categoria do item" },
  { v: "urgencia", l: "Prioridade da solicitação" },
  { v: "solicitanteId", l: "Solicitante" },
  { v: "possuiMedicao", l: "Pagamento vinculado a uma medição do terceiro?" },
];

export const ROTULOS_OPERADOR_APROVACAO = {
  igual:"é igual a", diferente:"é diferente de", maior:"maior que", maior_igual:"maior ou igual a",
  menor:"menor que", menor_igual:"menor ou igual a", entre:"entre (mín, máx)",
  contem:"contém o texto", pertence_lista:"está na lista", nao_pertence_lista:"não está na lista",
};

export const ROTULOS_MODO_QUORUM = { qualquer:"Qualquer um decide", todos:"Todos precisam aprovar", minimo:"Quantidade mínima" };

export const ROTULOS_SEM_APROVADOR = { enviar_administrador:"Enviar para o administrador", pular_etapa:"Pular etapa (segue sem aprovação)", auto_aprovar_etapa:"Aprovar automaticamente", bloquear:"Bloquear até intervenção manual" };

export const ROTULOS_ACAO_VENCIMENTO = { escalonar:"Escalonar para substituto/administrador", aprovar_automatico:"Aprovar automaticamente", bloquear:"Bloquear até intervenção manual", retornar_solicitante:"Devolver ao solicitante" };

export const ROTULOS_AUTOAPROVACAO = { proibida:"Nunca permitir", sempre:"Sempre permitir", abaixo_valor:"Permitir abaixo de um valor", perfis_especificos:"Permitir para perfis específicos", sem_outro_elegivel:"Permitir só quando não houver outro aprovador" };


export const novaCondicaoAprovacao = () => ({ id: uid(), campo: "valorTotal", operador: "maior", valor: "" });

export const novaEtapaAprovacao = ordem => ({
  id: uid(), ordem, nome: "", tipoAprovador: "administrador", referenciasAprovadores: [],
  modoQuorum: "qualquer", quantidadeMinima: 1, prazoValor: 0, prazoUnidade: "dias_uteis",
  acaoNoVencimento: "escalonar", substitutos: [], grupoSubstituto: "",
  semAprovadorAcao: "enviar_administrador", consolidarAprovadorRepetido: "manter", condicoes: [],
});

export const novaPoliticaAprovacao = () => ({
  id: "", nome: "", descricao: "", ativa: true, prioridade: 10, entidadeTipo: "solicitacaoCompra",
  vigenciaInicio: "", vigenciaFim: "", condicoes: [], etapas: [novaEtapaAprovacao(0)],
  autoaprovacao: { modo: "proibida", valorLimite: 0, perfis: [] },
});


// Modelos iniciais por porte de empresa (§ "Assistente de configuração por
// porte" do pedido original). Só preenchem o formulário - nada é salvo até o
// admin revisar e confirmar, e tudo continua editável depois.
export const etapaModelo = (ordem, nome, tipoAprovador) => ({ ...novaEtapaAprovacao(ordem), nome, tipoAprovador });

export const MODELOS_PORTE_APROVACAO = {
  enxuto: () => ({
    ...novaPoliticaAprovacao(), nome: "Alçada do administrador acima de R$ 5.000",
    descricao: "Times pequenos: abaixo do limite, segue direto (comportamento padrão da tela de Aprovações). Acima, só o administrador decide.",
    condicoes: [{ ...novaCondicaoAprovacao(), campo: "valorTotal", operador: "maior", valor: "5000" }],
    etapas: [etapaModelo(0, "Aprovação do administrador", "administrador")],
    autoaprovacao: { modo: "sem_outro_elegivel", valorLimite: 0, perfis: [] },
  }),
  intermediario: () => ({
    ...novaPoliticaAprovacao(), nome: "Responsável da obra + financeiro",
    descricao: "Passa primeiro pelo responsável da obra e depois pelo financeiro, em sequência.",
    etapas: [etapaModelo(0, "Responsável da obra", "responsavelObra"), etapaModelo(1, "Financeiro", "financeiro")],
  }),
  segregado: () => ({
    ...novaPoliticaAprovacao(), nome: "Responsável da obra → financeiro → administrador",
    descricao: "Segregação de funções completa: três etapas em sequência, sem acúmulo implícito.",
    etapas: [etapaModelo(0, "Responsável da obra", "responsavelObra"), etapaModelo(1, "Financeiro", "financeiro"), etapaModelo(2, "Administrador", "administrador")],
  }),
};


// Condição de contexto (valor livre, exceto quando o campo tem opções
// conhecidas na base - aí usa Sel para não deixar o admin digitar um id que
// não existe).
export function EditorCondicaoAprovacao({ condicao, data, onChange, onRemove }) {
  const valorInput = condicao.campo === "obraId"
    ? <Sel label="Valor" value={condicao.valor||""} onChange={v=>onChange({...condicao,valor:v})} options={[{v:"",l:"Selecione a obra"},...(data.obras||[]).map(o=>({v:o.id,l:o.name}))]}/>
    : condicao.campo === "urgencia"
    ? <Sel label="Valor" value={condicao.valor||""} onChange={v=>onChange({...condicao,valor:v})} options={[{v:"normal",l:"Normal"},{v:"urgente",l:"Urgente"}]}/>
    : condicao.campo === "solicitanteId"
    ? <Sel label="Valor" value={condicao.valor||""} onChange={v=>onChange({...condicao,valor:v})} options={[{v:"",l:"Selecione o usuário"},...(data.usuarios||[]).map(u=>({v:u.id,l:u.nome}))]}/>
    : condicao.campo === "possuiMedicao"
    ? <Sel label="Valor" value={condicao.valor||""} onChange={v=>onChange({...condicao,valor:v})} options={[{v:"sim",l:"Sim, há medição"},{v:"nao",l:"Não, pagamento manual/sem medição"}]}/>
    : <Inp label="Valor" value={condicao.valor??""} onChange={v=>onChange({...condicao,valor:v})} placeholder={["entre","pertence_lista","nao_pertence_lista"].includes(condicao.operador)?"Separe por vírgula":""}/>;
  return <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr auto",gap:6,alignItems:"end",background:C.surface,border:`1px solid ${C.border}`,borderRadius:7,padding:8}}>
    <Sel label="Campo" value={condicao.campo} onChange={v=>onChange({...condicao,campo:v,valor:""})} options={CAMPOS_CONTEXTO_APROVACAO}/>
    <Sel label="Condição" value={condicao.operador} onChange={v=>onChange({...condicao,operador:v})} options={OPERADORES.map(op=>({v:op,l:ROTULOS_OPERADOR_APROVACAO[op]||op}))}/>
    {valorInput}
    <Btn size="sm" v="ghost" onClick={onRemove}><Ic n="trash"/></Btn>
  </div>;
}


export function EditorEtapaAprovacao({ etapa, data, onChange, onRemove }) {
  const { cols } = useBreakpoint();
  const tipoDef = TIPOS_APROVADOR_APROVACAO.find(t => t.v === etapa.tipoAprovador);
  const refOptions = tipoDef?.refs === "usuario"
    ? (data.usuarios||[]).filter(u=>u.active!==false).map(u=>({id:u.id,l:u.nome}))
    : tipoDef?.refs === "role" ? ROLES.map(r=>({id:r.v,l:r.l})) : [];
  const toggleRef = id => onChange({...etapa, referenciasAprovadores: etapa.referenciasAprovadores.includes(id)
    ? etapa.referenciasAprovadores.filter(x=>x!==id) : [...etapa.referenciasAprovadores, id]});
  return <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:9,padding:11,display:"flex",flexDirection:"column",gap:8}}>
    <div style={{display:"grid",gridTemplateColumns:"1fr 90px auto",gap:6,alignItems:"end"}}>
      <Inp label="Nome da etapa" value={etapa.nome} onChange={v=>onChange({...etapa,nome:v})} placeholder="Ex.: Aprovação do engenheiro"/>
      <Inp label="Ordem" type="number" value={etapa.ordem} onChange={v=>onChange({...etapa,ordem:Number(v||0)})}/>
      <Btn size="sm" v="ghost" onClick={onRemove}><Ic n="trash"/> Remover etapa</Btn>
    </div>
    <p style={{fontSize:"var(--arcd-type-caption)",color:C.muted}}>Etapas com a mesma ordem rodam em paralelo; ordens diferentes rodam em sequência.</p>
    <Sel label="Quem aprova" value={etapa.tipoAprovador} onChange={v=>onChange({...etapa,tipoAprovador:v,referenciasAprovadores:[]})} options={TIPOS_APROVADOR_APROVACAO}/>
    {tipoDef?.refs && <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:5}}>
      {refOptions.map(o=><label key={o.id} style={{display:"flex",alignItems:"center",gap:6,border:`1px solid ${etapa.referenciasAprovadores.includes(o.id)?C.blue:C.border}`,background:etapa.referenciasAprovadores.includes(o.id)?`${C.blue}0B`:C.bg,borderRadius:6,padding:"5px 7px",cursor:"pointer"}}>
        <input type="checkbox" checked={etapa.referenciasAprovadores.includes(o.id)} onChange={()=>toggleRef(o.id)}/>
        <span style={{fontSize:"var(--arcd-type-label)",color:C.text}}>{o.l}</span>
      </label>)}
      {!refOptions.length && <p style={{fontSize:"var(--arcd-type-caption)",color:C.muted}}>Nenhuma opção cadastrada.</p>}
    </div>}
    <div style={{display:"grid",gridTemplateColumns:cols(2,4,4),gap:6}}>
      <Sel label="Quórum" value={etapa.modoQuorum} onChange={v=>onChange({...etapa,modoQuorum:v})} options={Object.entries(ROTULOS_MODO_QUORUM).map(([v,l])=>({v,l}))}/>
      {etapa.modoQuorum==="minimo" && <Inp label="Quantidade mínima" type="number" value={etapa.quantidadeMinima} onChange={v=>onChange({...etapa,quantidadeMinima:Math.max(1,Number(v||1))})}/>}
      <Inp label="Prazo" type="number" value={etapa.prazoValor} onChange={v=>onChange({...etapa,prazoValor:Math.max(0,Number(v||0))})}/>
      <Sel label="Unidade do prazo" value={etapa.prazoUnidade} onChange={v=>onChange({...etapa,prazoUnidade:v})} options={[{v:"dias_uteis",l:"Dias úteis"},{v:"horas",l:"Horas"}]}/>
      <Sel label="Sem aprovador elegível" value={etapa.semAprovadorAcao} onChange={v=>onChange({...etapa,semAprovadorAcao:v})} options={Object.entries(ROTULOS_SEM_APROVADOR).map(([v,l])=>({v,l}))}/>
      <Sel label="Ao vencer o prazo" value={etapa.acaoNoVencimento} onChange={v=>onChange({...etapa,acaoNoVencimento:v})} options={Object.entries(ROTULOS_ACAO_VENCIMENTO).map(([v,l])=>({v,l}))}/>
      <Sel label="Aprovador repetido na próxima etapa" value={etapa.consolidarAprovadorRepetido} onChange={v=>onChange({...etapa,consolidarAprovadorRepetido:v})} options={[{v:"manter",l:"Manter separado"},{v:"consolidar",l:"Uma decisão conclui as duas"},{v:"ignorar",l:"Pular a próxima automaticamente"}]}/>
    </div>
    <div style={{display:"flex",flexDirection:"column",gap:5}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><span style={{fontSize:"var(--arcd-type-caption)",fontWeight:600,color:C.muted}}>CONDIÇÕES DA ETAPA (opcional - sem condição, a etapa sempre roda)</span><Btn size="sm" v="ghost" onClick={()=>onChange({...etapa,condicoes:[...etapa.condicoes,novaCondicaoAprovacao()]})}><Ic n="plus"/> Condição</Btn></div>
      {etapa.condicoes.map(c=><EditorCondicaoAprovacao key={c.id} condicao={c} data={data} onChange={nc=>onChange({...etapa,condicoes:etapa.condicoes.map(x=>x.id===nc.id?nc:x)})} onRemove={()=>onChange({...etapa,condicoes:etapa.condicoes.filter(x=>x.id!==c.id)})}/>)}
    </div>
  </div>;
}


export function GestaoAprovacoes({ data, update, showToast, currentUser }) {
  const { cols } = useBreakpoint();
  const [modal, setModal] = useState(null);
  const [simulando, setSimulando] = useState(null);
  const [contextoSim, setContextoSim] = useState({ valorTotal:"", obraId:"", categoria:"", urgencia:"normal", solicitanteId:"" });
  const [resultadoSim, setResultadoSim] = useState(null);
  const politicas = data.politicasAprovacao || [];

  const podeAdministrar = podeAdministrarPoliticas(currentUser?.role);

  const abrirNova = () => setModal(novaPoliticaAprovacao());
  const abrirEditar = p => setModal(JSON.parse(JSON.stringify(p)));

  const validacaoAtual = modal ? validarPolitica(modal, { politicasExistentes: politicas }) : null;

  const salvar = () => {
    if (!validacaoAtual.valida) { showToast(validacaoAtual.erros[0], "error"); return; }
    const agora = new Date().toISOString();
    const existente = modal.id && politicas.some(p => p.id === modal.id);
    const payload = {
      ...modal, id: modal.id || uid(),
      versao: existente ? Number(modal.versao||1) + 1 : 1,
      criadoPorId: modal.criadoPorId || currentUser?.id || "", criadoPor: modal.criadoPor || currentUser?.nome || "",
      criadoEm: modal.criadoEm || agora, atualizadoPor: currentUser?.nome || "", atualizadoEm: agora,
    };
    const politicasAprovacao = existente ? politicas.map(p => p.id === payload.id ? payload : p) : [...politicas, payload];
    update({ ...data, politicasAprovacao });
    setModal(null);
    showToast(existente ? `Política atualizada para a versão ${payload.versao}. Processos já em andamento continuam na versão anterior.` : "Política criada.");
    if (validacaoAtual.alertas.length) showToast(validacaoAtual.alertas[0], "warn");
  };

  const alternarAtiva = p => {
    update({ ...data, politicasAprovacao: politicas.map(x => x.id === p.id ? { ...x, ativa: !x.ativa, atualizadoPor: currentUser?.nome || "", atualizadoEm: new Date().toISOString() } : x) });
    showToast(p.ativa ? "Política desativada." : "Política ativada.");
  };

  const abrirSimulador = p => { setSimulando(p); setResultadoSim(null); };
  const executarSimulacao = () => {
    const motor = MOTORES_APROVACAO_POR_ENTIDADE[simulando.entidadeTipo]?.();
    if (!motor) { showToast("Nenhum motor de execução cadastrado para este tipo de processo.", "error"); return; }
    const contexto = { valorTotal:Number(contextoSim.valorTotal||0), obraId:contextoSim.obraId, categoria:contextoSim.categoria, urgencia:contextoSim.urgencia, solicitanteId:contextoSim.solicitanteId||currentUser?.id||"" };
    setResultadoSim(motor.simularPolitica(simulando, contexto, data));
  };

  const eventosAuditoria = useMemo(() => [...(data.auditoriaAprovacao||[])].sort((a,b)=>String(b.data||"").localeCompare(String(a.data||""))).slice(0,200), [data.auditoriaAprovacao]);

  const delegacoes = data.delegacoesAprovacao || [];
  const [delegForm, setDelegForm] = useState({ usuarioOrigemId:"", usuarioDestinoId:"", inicio:today(), fim:"", escopo:"" });
  const podeDelegar = podeGerenciarDelegacoes(currentUser?.role);

  if (!podeAdministrar) return <div style={{padding:24,textAlign:"center",color:C.red}}>Acesso exclusivo da administração.</div>;

  const mudarComportamentoSemPolitica = v => {
    update({ ...data, configAprovacao: { ...data.configAprovacao, comportamentoSemPolitica: v } });
    showToast("Comportamento padrão atualizado.");
  };

  const criarDelegacao = () => {
    if (!delegForm.usuarioOrigemId || !delegForm.usuarioDestinoId) { showToast("Selecione quem está ausente e quem vai substituir.", "error"); return; }
    if (delegForm.usuarioOrigemId === delegForm.usuarioDestinoId) { showToast("O substituto não pode ser o mesmo usuário ausente.", "error"); return; }
    if (!delegForm.inicio) { showToast("Informe a data de início da delegação.", "error"); return; }
    if (delegForm.fim && delegForm.fim < delegForm.inicio) { showToast("A data final não pode ser anterior ao início.", "error"); return; }
    const destino = (data.usuarios||[]).find(u => u.id === delegForm.usuarioDestinoId);
    const registro = { id: uid(), usuarioOrigemId: delegForm.usuarioOrigemId, usuarioDestinoId: delegForm.usuarioDestinoId, usuarioDestinoNome: destino?.nome||"", inicio: delegForm.inicio, fim: delegForm.fim||"", escopo: delegForm.escopo||"", ativo: true, criadoEm: new Date().toISOString() };
    update({ ...data, delegacoesAprovacao: [...delegacoes, registro] });
    setDelegForm({ usuarioOrigemId:"", usuarioDestinoId:"", inicio:today(), fim:"", escopo:"" });
    showToast("Delegação criada.");
  };
  const revogarDelegacao = id => {
    update({ ...data, delegacoesAprovacao: delegacoes.map(d => d.id===id ? { ...d, ativo:false } : d) });
    showToast("Delegação revogada.");
  };

  return <div style={{display:"flex",flexDirection:"column",gap:12}}>
    <div style={{background:`${C.yellow}0B`,border:`1px solid ${C.yellow}44`,borderRadius:7,padding:"9px 11px",display:"flex",flexDirection:"column",gap:8}}>
      <p style={{fontSize:"var(--arcd-type-label)",color:C.muted}}>Quando nenhuma política ativa se aplicar a um processo, o app nunca trava sozinho - ele segue o comportamento padrão abaixo. Hoje só o setor de Compras tem aprovadores conectados ao motor; outros setores exigem trabalho de desenvolvimento antes de aparecerem aqui.</p>
      <div style={{maxWidth:340}}><Sel label="Comportamento sem política aplicável" value={data.configAprovacao?.comportamentoSemPolitica||"auto_aprovar"} onChange={mudarComportamentoSemPolitica} options={[{v:"auto_aprovar",l:"Aprovar automaticamente"},{v:"fila_administrativa",l:"Enviar à fila do administrador"},{v:"bloquear",l:"Bloquear até intervenção manual"}]}/></div>
    </div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
      <b style={{fontSize:"var(--arcd-type-body)",color:C.text}}>{politicas.length} política(s) de aprovação cadastrada(s)</b>
      <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
        <Btn v="ghost" onClick={()=>setModal(MODELOS_PORTE_APROVACAO.enxuto())}>Modelo enxuto</Btn>
        <Btn v="ghost" onClick={()=>setModal(MODELOS_PORTE_APROVACAO.intermediario())}>Modelo intermediário</Btn>
        <Btn v="ghost" onClick={()=>setModal(MODELOS_PORTE_APROVACAO.segregado())}>Modelo segregado</Btn>
        <Btn onClick={abrirNova}><Ic n="plus"/> Do zero</Btn>
      </div>
    </div>
    <p style={{fontSize:"var(--arcd-type-caption)",color:C.muted,marginTop:-6}}>Os modelos só preenchem o formulário como ponto de partida - nada é salvo até você revisar e confirmar, e tudo continua editável depois.</p>
    <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,overflow:"hidden"}}>
      {politicas.map((p,i)=><div key={p.id} style={{display:"grid",gridTemplateColumns:"minmax(0,1fr) auto",gap:9,padding:"11px 12px",borderTop:i?`1px solid ${C.line}`:"none",alignItems:"center"}}>
        <div style={{minWidth:0}}>
          <div style={{display:"flex",alignItems:"center",gap:7,flexWrap:"wrap"}}>
            <p style={{fontSize:"var(--arcd-type-label)",fontWeight:600,color:C.text}}>{p.nome||"Sem nome"}</p>
            <Badge color={p.ativa?C.green:C.muted}>{p.ativa?"ATIVA":"INATIVA"}</Badge>
            <Badge color={C.blue}>v{p.versao}</Badge>
          </div>
          <p style={{fontSize:"var(--arcd-type-caption)",color:C.muted,marginTop:3}}>{SETORES_APROVACAO.find(s=>s.v===p.entidadeTipo)?.l||p.entidadeTipo} · prioridade {p.prioridade} · {p.etapas.length} etapa(s){p.condicoes.length?` · ${p.condicoes.length} condição(ões)`:" · sem condição (aplica sempre que ativa)"}</p>
        </div>
        <div style={{display:"flex",gap:6,flexWrap:"wrap",justifyContent:"flex-end"}}>
          <Btn size="sm" v="ghost" onClick={()=>abrirSimulador(p)}><Ic n="eye"/> Simular</Btn>
          <Btn size="sm" v="ghost" onClick={()=>abrirEditar(p)}>Editar</Btn>
          <Btn size="sm" v={p.ativa?"ghost":"success"} onClick={()=>alternarAtiva(p)}>{p.ativa?"Desativar":"Ativar"}</Btn>
        </div>
      </div>)}
      {!politicas.length && <p style={{padding:30,textAlign:"center",fontSize:"var(--arcd-type-label)",color:C.muted}}>Nenhuma política cadastrada ainda. Enquanto isso, tudo segue o comportamento padrão acima.</p>}
    </div>

    {podeDelegar && <>
      <b style={{fontSize:"var(--arcd-type-label)",color:C.text,marginTop:4}}>Delegações (férias, afastamento, substituição)</b>
      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:12,display:"flex",flexDirection:"column",gap:8}}>
        <div style={{display:"grid",gridTemplateColumns:cols(1,2,4),gap:6}}>
          <Sel label="Usuário ausente" value={delegForm.usuarioOrigemId} onChange={v=>setDelegForm({...delegForm,usuarioOrigemId:v})} options={[{v:"",l:"Selecione"},...(data.usuarios||[]).map(u=>({v:u.id,l:u.nome}))]}/>
          <Sel label="Substituto" value={delegForm.usuarioDestinoId} onChange={v=>setDelegForm({...delegForm,usuarioDestinoId:v})} options={[{v:"",l:"Selecione"},...(data.usuarios||[]).map(u=>({v:u.id,l:u.nome}))]}/>
          <Inp label="Início" type="date" value={delegForm.inicio} onChange={v=>setDelegForm({...delegForm,inicio:v})}/>
          <Inp label="Fim (opcional)" type="date" value={delegForm.fim} onChange={v=>setDelegForm({...delegForm,fim:v})}/>
        </div>
        <Inp label="Escopo/motivo (anotação - ainda não filtra por setor)" value={delegForm.escopo} onChange={v=>setDelegForm({...delegForm,escopo:v})} placeholder="Ex.: férias, cobre só Compras"/>
        <Btn onClick={criarDelegacao}><Ic n="plus"/> Criar delegação</Btn>
        <div style={{display:"flex",flexDirection:"column",gap:5,marginTop:4}}>
          {delegacoes.map(d=><div key={d.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,background:C.surface,border:`1px solid ${C.border}`,borderRadius:7,padding:"7px 9px"}}>
            <div style={{minWidth:0}}>
              <p style={{fontSize:"var(--arcd-type-label)",color:C.text}}>{(data.usuarios||[]).find(u=>u.id===d.usuarioOrigemId)?.nome||"Usuário removido"} → {d.usuarioDestinoNome||"?"} <Badge color={d.ativo?C.green:C.muted}>{d.ativo?"ATIVA":"REVOGADA"}</Badge></p>
              <p style={{fontSize:"var(--arcd-type-caption)",color:C.muted,marginTop:2}}>{fmtDateFull(d.inicio)}{d.fim?` até ${fmtDateFull(d.fim)}`:" · sem data de fim"}{d.escopo?` · ${d.escopo}`:""}</p>
            </div>
            {d.ativo && <Btn size="sm" v="ghost" onClick={()=>revogarDelegacao(d.id)}>Revogar</Btn>}
          </div>)}
          {!delegacoes.length && <p style={{fontSize:"var(--arcd-type-label)",color:C.muted}}>Nenhuma delegação cadastrada.</p>}
        </div>
      </div>
    </>}

    <b style={{fontSize:"var(--arcd-type-label)",color:C.text,marginTop:4}}>Auditoria de aprovações</b>
    <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,overflow:"hidden"}}>
      {eventosAuditoria.map((e,i)=><div key={e.id||i} style={{display:"grid",gridTemplateColumns:"minmax(0,1fr) auto",gap:9,padding:"9px 12px",borderTop:i?`1px solid ${C.line}`:"none"}}>
        <div style={{minWidth:0}}><p style={{fontSize:"var(--arcd-type-label)",color:C.text}}>{e.motivo||e.evento}</p><p style={{fontSize:"var(--arcd-type-caption)",color:C.muted,marginTop:2}}>{e.evento}{e.usuario?` · ${e.usuario}`:""}{e.instanciaId?` · ${e.instanciaId}`:""}</p></div>
        <p style={{fontSize:"var(--arcd-type-caption)",color:C.muted,whiteSpace:"nowrap"}}>{e.data?new Date(e.data).toLocaleString("pt-BR"):""}</p>
      </div>)}
      {!eventosAuditoria.length && <p style={{padding:20,textAlign:"center",fontSize:"var(--arcd-type-label)",color:C.muted}}>Nenhum evento de aprovação registrado ainda.</p>}
    </div>

    {modal && <Modal wide title={modal.id?`Editar política · v${modal.versao||1}`:"Nova política de aprovação"} onClose={()=>setModal(null)}>
      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        <div style={{display:"grid",gridTemplateColumns:cols(1,2,2),gap:8}}>
          <Inp label="Nome da política *" value={modal.nome} onChange={v=>setModal({...modal,nome:v})} placeholder="Ex.: Alçada de pedidos até R$ 5.000"/>
          <Sel label="Tipo de processo" value={modal.entidadeTipo} onChange={v=>setModal({...modal,entidadeTipo:v})} options={SETORES_APROVACAO}/>
          <Inp label="Prioridade (maior vence em caso de empate)" type="number" value={modal.prioridade} onChange={v=>setModal({...modal,prioridade:Number(v||0)})}/>
          <label style={{display:"flex",alignItems:"center",gap:7,marginTop:18}}><input type="checkbox" checked={modal.ativa} onChange={()=>setModal({...modal,ativa:!modal.ativa})}/><span style={{fontSize:"var(--arcd-type-label)",color:C.text}}>Política ativa</span></label>
          <Inp label="Vigência início (opcional)" type="date" value={modal.vigenciaInicio} onChange={v=>setModal({...modal,vigenciaInicio:v})}/>
          <Inp label="Vigência fim (opcional)" type="date" value={modal.vigenciaFim} onChange={v=>setModal({...modal,vigenciaFim:v})}/>
        </div>
        <Inp label="Descrição (opcional)" value={modal.descricao} onChange={v=>setModal({...modal,descricao:v})} multiline/>

        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><b style={{fontSize:"var(--arcd-type-label)",color:C.text}}>Condições para esta política se aplicar</b><Btn size="sm" v="ghost" onClick={()=>setModal({...modal,condicoes:[...modal.condicoes,novaCondicaoAprovacao()]})}><Ic n="plus"/> Condição</Btn></div>
        <p style={{fontSize:"var(--arcd-type-caption)",color:C.muted,marginTop:-6}}>Sem nenhuma condição, a política se aplica sempre que estiver ativa e dentro da vigência.</p>
        {modal.condicoes.map(c=><EditorCondicaoAprovacao key={c.id} condicao={c} data={data} onChange={nc=>setModal({...modal,condicoes:modal.condicoes.map(x=>x.id===nc.id?nc:x)})} onRemove={()=>setModal({...modal,condicoes:modal.condicoes.filter(x=>x.id!==c.id)})}/>)}

        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:4}}><b style={{fontSize:"var(--arcd-type-label)",color:C.text}}>Etapas de aprovação</b><Btn size="sm" v="ghost" onClick={()=>setModal({...modal,etapas:[...modal.etapas,novaEtapaAprovacao(modal.etapas.length)]})}><Ic n="plus"/> Etapa</Btn></div>
        {!modal.etapas.length && <div style={{background:`${C.blue}0B`,border:`1px solid ${C.blue}44`,borderRadius:7,padding:"8px 10px",fontSize:"var(--arcd-type-label)",color:C.muted}}>Sem nenhuma etapa, esta política aprova automaticamente - use isso para dispensar aprovação explicitamente (fica registrado como decisão da política, não como aprovação humana).</div>}
        {modal.etapas.map(e=><EditorEtapaAprovacao key={e.id} etapa={e} data={data} onChange={ne=>setModal({...modal,etapas:modal.etapas.map(x=>x.id===ne.id?ne:x)})} onRemove={()=>setModal({...modal,etapas:modal.etapas.filter(x=>x.id!==e.id)})}/>)}

        <b style={{fontSize:"var(--arcd-type-label)",color:C.text,marginTop:4}}>Autoaprovação (o próprio solicitante aprova)</b>
        <div style={{display:"grid",gridTemplateColumns:cols(1,2,2),gap:8}}>
          <Sel label="Quando permitir" value={modal.autoaprovacao.modo} onChange={v=>setModal({...modal,autoaprovacao:{...modal.autoaprovacao,modo:v}})} options={Object.entries(ROTULOS_AUTOAPROVACAO).map(([v,l])=>({v,l}))}/>
          {modal.autoaprovacao.modo==="abaixo_valor" && <Inp label="Valor limite (R$)" type="number" value={modal.autoaprovacao.valorLimite} onChange={v=>setModal({...modal,autoaprovacao:{...modal.autoaprovacao,valorLimite:Number(v||0)}})}/>}
        </div>
        {modal.autoaprovacao.modo==="perfis_especificos" && <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:5}}>
          {ROLES.map(r=><label key={r.v} style={{display:"flex",alignItems:"center",gap:6,border:`1px solid ${modal.autoaprovacao.perfis.includes(r.v)?C.blue:C.border}`,background:modal.autoaprovacao.perfis.includes(r.v)?`${C.blue}0B`:C.bg,borderRadius:6,padding:"5px 7px",cursor:"pointer"}}>
            <input type="checkbox" checked={modal.autoaprovacao.perfis.includes(r.v)} onChange={()=>setModal({...modal,autoaprovacao:{...modal.autoaprovacao,perfis:modal.autoaprovacao.perfis.includes(r.v)?modal.autoaprovacao.perfis.filter(x=>x!==r.v):[...modal.autoaprovacao.perfis,r.v]}})}/>
            <span style={{fontSize:"var(--arcd-type-label)",color:C.text}}>{r.l}</span>
          </label>)}
        </div>}

        {validacaoAtual.erros.length>0 && <div style={{background:`${C.red}0C`,border:`1px solid ${C.red}55`,borderRadius:7,padding:"9px 11px"}}>{validacaoAtual.erros.map((m,i)=><p key={i} style={{fontSize:"var(--arcd-type-label)",color:C.red}}>· {m}</p>)}</div>}
        {validacaoAtual.alertas.length>0 && <div style={{background:`${C.yellow}0C`,border:`1px solid ${C.yellow}55`,borderRadius:7,padding:"9px 11px"}}>{validacaoAtual.alertas.map((m,i)=><p key={i} style={{fontSize:"var(--arcd-type-label)",color:C.yellowD}}>· {m}</p>)}</div>}

        <div style={{display:"flex",gap:8}}>
          <Btn v="ghost" full onClick={()=>setModal(null)}>Cancelar</Btn>
          <Btn full onClick={salvar} disabled={!validacaoAtual.valida}><Ic n="check"/> {modal.id?"Salvar nova versão":"Criar política"}</Btn>
        </div>
      </div>
    </Modal>}

    {simulando && <Modal title={`Simular · ${simulando.nome}`} onClose={()=>setSimulando(null)}>
      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        <div style={{display:"grid",gridTemplateColumns:cols(1,2,2),gap:8}}>
          <Inp label="Valor total (R$)" type="number" value={contextoSim.valorTotal} onChange={v=>setContextoSim({...contextoSim,valorTotal:v})}/>
          <Sel label="Obra" value={contextoSim.obraId} onChange={v=>setContextoSim({...contextoSim,obraId:v})} options={[{v:"",l:"Nenhuma"},...(data.obras||[]).map(o=>({v:o.id,l:o.name}))]}/>
          <Sel label="Prioridade" value={contextoSim.urgencia} onChange={v=>setContextoSim({...contextoSim,urgencia:v})} options={[{v:"normal",l:"Normal"},{v:"urgente",l:"Urgente"}]}/>
          <Sel label="Solicitante" value={contextoSim.solicitanteId} onChange={v=>setContextoSim({...contextoSim,solicitanteId:v})} options={[{v:"",l:"Eu mesmo"},...(data.usuarios||[]).map(u=>({v:u.id,l:u.nome}))]}/>
        </div>
        <Btn onClick={executarSimulacao}><Ic n="check"/> Simular</Btn>
        {resultadoSim && <div style={{display:"flex",flexDirection:"column",gap:7}}>
          <Badge color={resultadoSim.status==="aprovada"?C.green:resultadoSim.status==="em_andamento"?C.blue:C.orange}>{resultadoSim.status.toUpperCase()}</Badge>
          {resultadoSim.etapas.map((e,i)=><div key={i} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:7,padding:"8px 10px"}}>
            <p style={{fontSize:"var(--arcd-type-label)",fontWeight:600,color:C.text}}>{e.nome||`Etapa ${i+1}`} · {e.status}</p>
            <p style={{fontSize:"var(--arcd-type-caption)",color:C.muted,marginTop:2}}>{(e.aprovadoresElegiveis||[]).map(a=>a.nome).join(", ")||e.motivoConclusao||"Sem aprovador elegível"}</p>
          </div>)}
          {!resultadoSim.etapas.length && <p style={{fontSize:"var(--arcd-type-label)",color:C.muted}}>{resultadoSim.motivo}</p>}
        </div>}
      </div>
    </Modal>}
  </div>;
}


// NAVEGAÇÃO - grupos e sub-tabs
//

// Os módulos compartilham os mesmos destinos e permissões da aplicação.
export const TAB_META_BASE = {
  equipe_obras: { label: "Equipe nas Obras", icon: "users" },
  admin_central:{ label:"Central do administrador", icon:"shield" },
  aprov_pend:{ label:"Minhas aprovações", icon:"check" },
  home:   { label: "Dashboard",  icon: "home"   },
  tv:     { label: "Modo TV",    icon: "eye"   },
  chat:   { label: "Comunicação",icon: "mail"   },
  obras:  { label: "Obras",      icon: "building"},
  orc:    { label: "Orçamento",  icon: "fileText"},
  com_dash:{label:"Dashboard",icon:"chart"},
  com_workspace:{label:"Comercial da empresa",icon:"clipboard"},
  com_real_estate:{label:"Venda de imóveis",icon:"building"},
  com_pipeline:{label:"Pipeline",icon:"funnel"},
  com_relationships:{label:"Relacionamentos",icon:"users"},
  com_deals:{label:"Propostas e contratos",icon:"fileText"},
  com_management:{label:"Gestão comercial",icon:"chart"},
  com_indicacoes:{label:"Indicações",icon:"users"},
  com_leads:{label:"Leads",icon:"user"},
  com_funil:{label:"Funil",icon:"funnel"},
  com_jornada:{label:"Jornada",icon:"trending"},
  com_agenda:{label:"Agenda",icon:"calendar"},
  com_reunioes:{label:"Reuniões",icon:"users"},
  com_tarefas:{label:"Tarefas",icon:"clipboard"},
  com_propostas:{label:"Propostas",icon:"fileText"},
  com_negociacoes:{label:"Negociações",icon:"handshake"},
  com_contratos:{label:"Contratos",icon:"file"},
  com_clientes:{label:"Clientes",icon:"users"},
  com_parceiros:{label:"Parceiros",icon:"handshake"},
  com_metas:{label:"Metas e comissões",icon:"target"},
  com_perdas:{label:"Perdas",icon:"alert"},
  com_relatorios:{label:"Relatórios",icon:"trending"},
  plan:   { label: "Planejamento", icon: "calendar"},
  projetos: { label:"Projetos", icon:"building" },
  arquivos: { label:"Arquivos", icon:"folder" },
  plan_suprimentos: { label:"Marcos e Curva A", icon:"trending" },
  rdo:    { label: "Diário de obra", icon: "clipboard"},
  conferencia: { label: "Conferência", icon: "check"},
  med:    { label: "Medição",        icon: "ruler"},
  ponto:  { label: "Ponto por obra", icon: "clock"},
  ponto_geral: { label: "Gestão do ponto", icon: "calendar"},
  ponto_app: { label: "Ponto eletrônico (app)", icon: "smartphone"},
  equipe: { label: "Equipes", icon: "users"},
  terc:   { label: "Terceirizados", icon: "handshake" },
  folha:  { label: "Folha",      icon: "wallet"  },
  resc:   { label: "Rescisão",   icon: "briefcase"  },
  rh_indic: { label: "Indicadores", icon: "trending" },
  dre_emp:  { label: "DRE empresa", icon: "chart" },
  dre:      { label: "DRE obras",   icon: "building" },
  fin:      { label: "Gestão financeira", icon: "trending" },
  conc:     { label: "Conciliação", icon: "receipt" },
  est:      { label: "Estoque",     icon: "box" },
  equip:    { label: "Equipamentos", icon: "wrench" },
  equip_fin:{ label: "Locação de equipamentos", icon: "wrench" },
  patrimonio:{ label: "Patrimônio da empresa", icon: "box" },
  licenca:  { label: "Licenciamento", icon: "file" },
  cmp:      { label: "Compras",     icon: "cart" },
  fornecedores: { label: "Fornecedores", icon: "handshake" },
  suprimentos: { label: "Curva e preços", icon: "trending" },
  cad:      { label: "Cadastros",   icon: "settings" },
  medicoes: { label: "Medições",   icon: "ruler" },
  caixa:    { label: "Caixa da obra", icon: "wallet" },
  relat:    { label: "Relatórios", icon: "trending" },
  ia:     { label: "IA",         icon: "ia"  },
  ia_config: { label: "Configurar Gemini", icon: "settings" },
  config: { label: "Ajustes",    icon: "settings" },
  obsoletos: { label: "Telas antigas", icon: "trash" },
};


//
export const TAB_META = Object.fromEntries(Object.entries(TAB_META_BASE).map(([id,meta])=>[id,{...meta,group:moduleForTab(id)?.id}]));
