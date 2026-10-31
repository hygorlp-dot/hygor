import {data as reviewData,profile} from './rebranding-refinement-data.mjs';
export {profile};
export const data=structuredClone(reviewData);
data.orcamentos[0].itens.find(item=>item.id==='item-b').materialId='steel';
data.orcamentos.push({...structuredClone(data.orcamentos[0]),id:'budget-b',obraId:'b',nome:'Horizonte — orçamento executivo'});
data.planos.push({...structuredClone(data.planos[0]),id:'plan-b',obraId:'b',budgetId:'budget-b'});
