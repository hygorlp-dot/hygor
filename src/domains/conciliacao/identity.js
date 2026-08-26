// Registro de identidades usado pela conciliação. Ele não escolhe nem grava
// nada: apenas torna explícitas as evidências e conflitos de contraparte.
import { semAcento } from "./calculations.js";

const normalizarDocumento = value => String(value || "").replace(/\D/g, "");
const normalizarPixIdentidade = value => String(value || "").trim().toLocaleLowerCase("pt-BR").replace(/\s+/g, "");
const normalizarNomeIdentidade = value => semAcento(value).replace(/\b(ltda|me|eireli|sa|s\/a)\b/g, "").replace(/[^a-z0-9]+/g, " ").trim();

const text = value => String(value || "").trim();
const values = (...items) => [...new Set(items.flatMap(item => Array.isArray(item) ? item : [item]).map(text).filter(Boolean))];

const registro = (tipo, item, extra = {}) => ({
  tipo, id:String(item?.id || ""), nome:text(item?.name || item?.nome || item?.razaoSocial || item?.contratante),
  razaoSocial:text(item?.razaoSocial), nomeFantasia:text(item?.nomeFantasia),
  aliases:values(item?.aliases, item?.apelidos, extra.aliases),
  documentos:values(item?.cpf, item?.cnpj, item?.documento, item?.cpfCnpj, extra.documentos).map(normalizarDocumento).filter(Boolean),
  pix:values(item?.pixKey, item?.chavePix, item?.pix, extra.pix).map(normalizarPixIdentidade).filter(Boolean),
  emails:values(item?.email, item?.emails).map(value=>value.toLowerCase()),
  telefones:values(item?.telefone, item?.phone, item?.celular).map(normalizarDocumento).filter(Boolean),
  bancos:values(item?.banco, item?.agencia && item?.conta ? `${item.agencia}/${item.conta}` : ""),
  obras:values(item?.obra, item?.obraId, item?.obrasRelacionadas),
  contratos:values(item?.contratoId, item?.contratosRelacionados),
});

const add = (map, key, item) => {
  if(!key)return;
  const list=map.get(key)||[];
  if(!list.some(existing=>existing.tipo===item.tipo&&existing.id===item.id))list.push(item);
  map.set(key,list);
};

export const criarRegistroIdentidades = (data = {}) => {
  const registros=[];
  const incluir=(tipo, items, extraForItem=()=>({})) => (items||[]).forEach(item=>{
    const itemRegistro=registro(tipo,item,extraForItem(item));
    if(itemRegistro.id||itemRegistro.nome)registros.push(itemRegistro);
  });
  incluir("empresa",data.contasBancarias);
  incluir("operario",data.employees);
  incluir("terceirizado",data.terceirizados);
  incluir("fornecedor",data.fornecedores);
  incluir("proprietario_equipamento",data.proprietariosEquip);
  incluir("cliente",data.clientes);
  incluir("cliente",data.comercial?.leads);
  incluir("contratante",data.comercial?.contratos,item=>({aliases:[item.contratante],contratos:[item.id],obras:[item.obraId]}));

  const porPix=new Map(), porDocumento=new Map(), porNome=new Map();
  registros.forEach(item=>{
    item.pix.forEach(key=>add(porPix,key,item));
    item.documentos.forEach(key=>add(porDocumento,key,item));
    values(item.nome,item.razaoSocial,item.nomeFantasia,item.aliases).map(normalizarNomeIdentidade).filter(Boolean).forEach(key=>add(porNome,key,item));
  });
  return {registros,porPix,porDocumento,porNome};
};

const collect = (map, key) => key ? (map.get(key)||[]) : [];
export const identificarContraparte = (transaction = {}, registry) => {
  const pix=normalizarPixIdentidade(transaction.chavePix||transaction.pixKey||transaction.chave);
  const documento=normalizarDocumento(transaction.contraparteDocumento||transaction.cpfCnpj);
  const nome=normalizarNomeIdentidade(transaction.contraparteNome||transaction.nomeContraparte||"");
  const hits=[...collect(registry?.porPix,pix),...collect(registry?.porDocumento,documento),...collect(registry?.porNome,nome)];
  const unique=[...new Map(hits.map(item=>[`${item.tipo}:${item.id}`,item])).values()];
  const evidencias=[];
  if(pix&&collect(registry?.porPix,pix).length)evidencias.push("chave PIX cadastrada");
  if(documento&&collect(registry?.porDocumento,documento).length)evidencias.push("CPF/CNPJ cadastrado");
  if(nome&&collect(registry?.porNome,nome).length)evidencias.push("nome cadastrado");
  return {registro:unique.length===1?unique[0]:null,registros:unique,evidencias,conflito:unique.length>1};
};
