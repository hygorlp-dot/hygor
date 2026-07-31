import { PageHeader } from "../patterns/PageHeader.jsx";
import { Button } from "../primitives/Button.jsx";

export default { title: "Padrões/PageHeader", component: PageHeader, tags: ["autodocs"], args: { title: "Planejamento", description: "Acompanhe o plano da obra.", breadcrumb: ["Obras", "B2-04"] } };
export const Default = { args: { primaryAction: <Button>Nova atividade</Button>, secondaryActions: <Button variant="secondary">Exportar</Button> } };
