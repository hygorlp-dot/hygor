import { Badge } from "../primitives/Badge.jsx";

export default { title: "Primitivos/Badge", component: Badge, tags: ["autodocs"], args: { children: "Em análise" } };
export const Default = {};
export const Success = { args: { tone: "success", children: "Confirmado" } };
export const Danger = { args: { tone: "danger", children: "Bloqueado" } };
