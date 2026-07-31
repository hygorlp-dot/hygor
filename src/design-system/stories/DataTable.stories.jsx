import { DataTable } from "../data/DataTable.jsx";

const columns = [{ key: "nome", header: "Fornecedor" }, { key: "prazo", header: "Prazo" }, { key: "status", header: "Status" }];
const data = [{ id: "1", nome: "Cimento Nordeste", prazo: "2 dias", status: "Em cotação" }, { id: "2", nome: "Aço PE", prazo: "5 dias", status: "Aprovado" }];
export default { title: "Dados/DataTable", component: DataTable, tags: ["autodocs"], args: { data, columns, search: { placeholder: "Buscar fornecedor", fields: ["nome"] }, pagination: { pageSize: 10 } } };
export const Desktop = {};
export const Mobile = { args: { mobile: true, mobileConfig: { title: "nome", subtitle: "prazo", status: "status", primaryFields: ["prazo", "status"] } }, parameters: { viewport: { defaultViewport: "mobile1" } } };
