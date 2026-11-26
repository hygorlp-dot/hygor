import {canManagePurchases} from "../src/domains/compras/permissions.js";

export const validatePurchaseChanges = (user, previous = [], next = []) => {
  const nextIds = new Set((next || []).map(order => String(order.id)));
  const removed = (previous || []).filter(order => !nextIds.has(String(order.id)));
  if (!removed.length) return "";
  if (!canManagePurchases(user?.role))
    return "Seu perfil não possui permissão para excluir compras.";
  if (user?.obraId && removed.some(order => String(order.obraId) !== String(user.obraId)))
    return "Não é permitido excluir compras de outra obra.";
  return "";
};

const objeto = value => value && typeof value === "object" && !Array.isArray(value);

// A Conferência tem segregação de função: o vistoriador registra e julga;
// quem recebeu o ajuste apenas anexa a própria evidência. A validação precisa
// acontecer no servidor, pois esconder botões no React não impede uma chamada
// manual à API.
const compactarPermissao = value => {
  if(Array.isArray(value))return value.map(compactarPermissao);
  if(!objeto(value))return value;
  const out={};
  Object.entries(value).forEach(([key,item])=>{
    if(item===undefined||item===""||(Array.isArray(item)&&item.length===0))return;
    out[key]=compactarPermissao(item);
  });
  return out;
};
const igualPermissao=(a,b)=>JSON.stringify(compactarPermissao(a))===JSON.stringify(compactarPermissao(b));
export const validarExclusaoObras=(usuario,anterior=[],proximo=[])=>{
  if(usuario?.role==="admin")return "";
  if(!Array.isArray(anterior)||!Array.isArray(proximo))return "Formato de obras inválido.";
  const idsDepois=new Set(proximo.map(obra=>String(obra?.id||"")).filter(Boolean));
  const removida=anterior.some(obra=>obra?.id&&!idsDepois.has(String(obra.id)));
  return removida?"Somente o administrador pode excluir uma obra.":"";
};
export const validarAlteracoesConferencias=(usuario,anterior=[],proximo=[],autoritativo=[],obras=[])=>{
  if(usuario?.role==="admin")return "";
  if(!Array.isArray(anterior)||!Array.isArray(proximo))return "Formato de conferências inválido.";
  const antes=new Map(anterior.map(c=>[String(c.id),c]));
  const depois=new Map(proximo.map(c=>[String(c.id),c]));
  const atual=new Map((autoritativo||[]).map(c=>[String(c.id),c]));
  const adicionadas=[...depois.entries()].filter(([id])=>!antes.has(id));
  const removidas=[...antes.keys()].filter(id=>!depois.has(id));
  if(removidas.length)return "Somente o administrador pode excluir uma vistoria.";
  for(const [,nova] of adicionadas){
    if(usuario?.role!=="engenheiro_auditor")return "Somente o administrador ou o engenheiro auditor pode criar uma vistoria.";
    const obra=(obras||[]).find(o=>String(o.id)===String(nova?.obraId));
    const estaNoEscopo=!usuario.obraId||String(usuario.obraId)===String(obra?.id);
    if(!obra||!estaNoEscopo)return "Esta obra não está disponível no escopo do engenheiro auditor.";
    if(String(nova?.responsavelId)!==String(usuario.id)||String(nova?.responsavel||"").trim()!==String(usuario.nome||"").trim())return "A nova vistoria deve ser registrada automaticamente em nome do engenheiro auditor conectado.";
    if((nova?.pendencias||[]).length)return "Crie a vistoria primeiro; as pendências devem ser registradas dentro dela.";
  }

  for(const [id,nova] of depois){
    const antiga=antes.get(id);
    if(!antiga)continue;
    if(igualPermissao(antiga,nova))continue;
    const vigente=atual.get(id)||antiga;
    if(usuario?.role==="engenheiro_auditor"&&vigente?.responsavelId===usuario?.id){
      const imutaveis=["id","obraId","codigo","responsavelId","responsavel","criadoEm"];
      if(imutaveis.some(k=>!igualPermissao(antiga?.[k],nova?.[k])))return "O responsável pela vistoria não pode alterar a autoria ou o vínculo da conferência.";
      continue;
    }

    if(usuario?.role!=="engenheiro")return "Somente o engenheiro auditor responsável ou o administrador pode alterar esta vistoria.";

    const topoAntigo={...antiga},topoNovo={...nova};
    delete topoAntigo.pendencias;delete topoNovo.pendencias;
    delete topoAntigo.atualizadoEm;delete topoNovo.atualizadoEm;
    if(!igualPermissao(topoAntigo,topoNovo))return "O responsável pelo ajuste possui acesso somente para enviar a foto da correção.";
    const pendAntes=new Map((antiga?.pendencias||[]).map(p=>[String(p.id),p]));
    const pendDepois=new Map((nova?.pendencias||[]).map(p=>[String(p.id),p]));
    if([...pendDepois.keys()].some(pid=>!pendAntes.has(pid))||[...pendAntes.keys()].some(pid=>!pendDepois.has(pid)))return "O responsável pelo ajuste não pode criar ou excluir pendências.";
    for(const [pid,pendNova] of pendDepois){
      const pendAntiga=pendAntes.get(pid);
      if(igualPermissao(pendAntiga,pendNova))continue;
      const pendVigente=(vigente?.pendencias||[]).find(p=>String(p.id)===pid)||pendAntiga;
      if(pendVigente?.responsavelAjusteId!==usuario?.id)return "Você não pode alterar uma pendência atribuída a outro responsável.";
      if(pendAntiga?.status==="resolvida")return "Uma pendência conforme não aceita nova evidência sem reabertura pelo vistoriador.";
      const camposPermitidos=new Set(["status","fotos","validacaoStatus","validacaoObservacao","validadoPorId","validadoPor","validadoEm","resolvidoEm"]);
      const campos=new Set([...Object.keys(pendAntiga||{}),...Object.keys(pendNova||{})]);
      if([...campos].some(k=>!camposPermitidos.has(k)&&!igualPermissao(pendAntiga?.[k],pendNova?.[k])))return "O responsável pelo ajuste não pode editar os dados da pendência.";
      const fotosAntes=pendAntiga?.fotos||[],fotosDepois=pendNova?.fotos||[];
      if(fotosDepois.length<=fotosAntes.length)return "Envie uma nova foto para registrar a correção.";
      for(let i=0;i<fotosAntes.length;i++){
        const a={...fotosAntes[i]},b={...fotosDepois[i]};delete a.id;delete b.id;
        if(!igualPermissao(a,b))return "As evidências anteriores não podem ser alteradas ou removidas.";
      }
      const adicionadas=fotosDepois.slice(fotosAntes.length);
      if(adicionadas.some(f=>f.tipo!=="ajuste"||f.enviadoPorId!==usuario.id||!/^https:\/\//i.test(String(f.url||""))))return "A nova evidência deve ser a foto de correção enviada pelo próprio responsável.";
      if(pendNova.status!=="aguardando_validacao"||pendNova.validacaoStatus||pendNova.validadoEm||pendNova.resolvidoEm)return "Depois da foto, a pendência deve aguardar a validação do vistoriador.";
    }
  }
  return "";
};
