import { createApprovalEngine } from "./engine.js";

const activeUser=user=>user?.active!==false;
const userView=user=>({id:user.id,nome:user.nome});

export const arcdApprovalResolvers={
  usuario:(reference,_context,data)=>{
    const user=(data.usuarios||[]).find(item=>item.id===reference&&activeUser(item));
    return user?[userView(user)]:[];
  },
  cargo:(reference,_context,data)=>(data.usuarios||[])
    .filter(item=>item.role===reference&&activeUser(item)).map(userView),
  perfil:(reference,context,data)=>
    arcdApprovalResolvers.cargo(reference,context,data),
  grupo:(reference,context,data)=>
    arcdApprovalResolvers.cargo(reference,context,data),
  responsavelObra:(_reference,context,data)=>{
    const project=(data.obras||[]).find(item=>item.id===context?.obraId);
    if(!project?.engineerId)return [];
    const user=(data.usuarios||[])
      .find(item=>item.id===project.engineerId&&activeUser(item));
    return user?[userView(user)]:[];
  },
  gerenteObra:(reference,context,data)=>
    arcdApprovalResolvers.responsavelObra(reference,context,data),
  responsavelCentroCusto:()=>[],
  responsavelDepartamento:()=>[],
  superiorHierarquico:()=>[],
  compradorResponsavel:(_reference,_context,data)=>(data.usuarios||[])
    .filter(item=>item.role==="compras"&&activeUser(item)).map(userView),
  financeiro:(_reference,_context,data)=>(data.usuarios||[])
    .filter(item=>item.role==="financeiro"&&activeUser(item)).map(userView),
  controladoria:()=>[],
  diretoria:()=>[],
  administrador:(_reference,_context,data)=>(data.usuarios||[])
    .filter(item=>item.role==="admin"&&activeUser(item)).map(userView),
  campoSolicitacao:(_reference,context)=>context?.aprovadorEspecificoId
    ?[{id:context.aprovadorEspecificoId,nome:context.aprovadorEspecificoNome||context.aprovadorEspecificoId}]
    :[],
};

export const arcdApprovalEngine=createApprovalEngine(arcdApprovalResolvers);
