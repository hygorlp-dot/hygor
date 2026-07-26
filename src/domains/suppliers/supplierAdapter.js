import { createLegacyAdapter } from "../../edit-engine/adapters/createLegacyAdapter.js";

export const supplierAdapter = createLegacyAdapter({
  fromLegacy(record = {}) {
    return {
      id: record.id || "",
      name: record.nome || "",
      document: record.cnpj || "",
      corporateName: record.razaoSocial || "",
      tradeName: record.nomeFantasia || "",
      categories: Array.isArray(record.categorias) ? record.categorias : [],
      contact: record.contato || "",
      phone: record.telefone || "",
      email: record.email || "",
      postalCode: record.cep || "",
      address: record.endereco || "",
      addressNumber: record.numero || "",
      addressComplement: record.complemento || "",
      neighborhood: record.bairro || "",
      city: record.cidade || "",
      state: record.uf || "",
      notes: record.obs || "",
    };
  },
  toLegacy(values) {
    return {
      nome: String(values.name || "").trim(),
      cnpj: values.document || "",
      razaoSocial: values.corporateName || "",
      nomeFantasia: values.tradeName || "",
      categorias: Array.isArray(values.categories) ? values.categories : [],
      contato: values.contact || "",
      telefone: values.phone || "",
      email: values.email || "",
      cep: values.postalCode || "",
      endereco: values.address || "",
      numero: values.addressNumber || "",
      complemento: values.addressComplement || "",
      bairro: values.neighborhood || "",
      cidade: values.city || "",
      uf: values.state || "",
      obs: values.notes || "",
    };
  },
});
