// Relações explícitas do ERP; nunca associa pessoas apenas pelo valor.
const find = (items, id) => id ? (items || []).find(item => String(item.id) === String(id)) : null;
export const contraparteDoFato = (data, tipo, item) => {
  const source = item.nota || item.pedido || item;
  let person;
  if (["nota", "pedido", "pagamentoNota", "pagamentoPedido"].includes(tipo)) {
    person = find(data.fornecedores, source.fornecedorId);
    return {
      nome: source.fornecedorNome || person?.nome || person?.razaoSocial || "",
      documento: source.documentoFornecedor || person?.cnpj || person?.cpf || person?.documento || "",
      pix: person?.chavePix || person?.pixKey || "",
    };
  }
  if (["medicao", "entradaContrato"].includes(tipo)) {
    const contract = tipo === "entradaContrato" ? item : find(data.comercial?.contratos, item.contratoId);
    const work = find(data.obras, item.obraId);
    person = find([...(data.clientes || []), ...(data.comercial?.clientes || [])], item.clienteId || contract?.clienteId || work?.clienteId)
      || find(data.comercial?.leads, contract?.leadId);
    return { nome: person?.nome || person?.razaoSocial || contract?.contratante || "", documento: person?.documento || person?.cpfCnpj || person?.cpf || person?.cnpj || "", pix: person?.chavePix || person?.pixKey || "" };
  }
  if (tipo === "medicaoTerc") person = find(data.terceirizados, item.tercId || item.terceiroId);
  if (tipo === "tituloFolha") person = find(data.employees, item.employeeId);
  if (["funcionario", "terceiro"].includes(tipo)) person = item;
  return { nome: person?.name || person?.nome || "", documento: person?.cpf || person?.cnpj || person?.documento || "", pix: person?.pixKey || person?.chavePix || "" };
};
