import { createElement } from "react";
import { SupplierCategoriesField } from "./SupplierCategoriesField.jsx";

export const supplierEditorSchema = {
  entity: "supplier",
  title: { create: "Novo fornecedor", edit: "Editar fornecedor" },
  presentation: "drawer",
  sections: [
    { id: "identification", title: "Identificação" },
    { id: "contact", title: "Contato" },
    { id: "address", title: "Endereço" },
  ],
  fields: [
    { name: "name", label: "Nome ou razão social", type: "text", required: true, section: "identification" },
    { name: "document", label: "CNPJ", type: "text", section: "identification" },
    { name: "corporateName", label: "Razão social", type: "text", section: "identification" },
    { name: "tradeName", label: "Nome fantasia", type: "text", section: "identification" },
    { name: "categories", label: "O que fornece", section: "identification", render: props => createElement(SupplierCategoriesField, props) },
    { name: "contact", label: "Contato", type: "text", section: "contact" },
    { name: "phone", label: "Telefone", type: "text", section: "contact" },
    { name: "email", label: "E-mail", type: "text", section: "contact", validate: value => value && !String(value).includes("@") ? "Informe um e-mail válido." : null },
    { name: "postalCode", label: "CEP", type: "text", section: "address" },
    { name: "address", label: "Endereço", type: "text", section: "address" },
    { name: "addressNumber", label: "Número", type: "text", section: "address" },
    { name: "addressComplement", label: "Complemento", type: "text", section: "address" },
    { name: "neighborhood", label: "Bairro", type: "text", section: "address" },
    { name: "city", label: "Cidade", type: "text", section: "address" },
    { name: "state", label: "UF", type: "text", section: "address" },
    { name: "notes", label: "Observações", type: "textarea", section: "address" },
  ],
};
