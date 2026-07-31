import { MobileRecordCard } from "../data/MobileRecordCard.jsx";

const columns = [{ key: "descricao", header: "Item" }, { key: "prazo", header: "Prazo" }, { key: "valor", header: "Valor" }];
export default { title: "Dados/MobileRecordCard", component: MobileRecordCard, tags: ["autodocs"], args: { row: { descricao: "Concreto usinado", prazo: "Hoje", valor: "R$ 3.240,00", status: "Atenção" }, columns, config: { title: "descricao", subtitle: "prazo", status: "status", primaryFields: ["valor"] } }, parameters: { viewport: { defaultViewport: "mobile1" } } };
export const Default = {};
