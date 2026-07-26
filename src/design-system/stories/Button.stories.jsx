import { Button } from "../primitives/Button.jsx";

export default { title: "Primitivos/Button", component: Button, tags: ["autodocs"], args: { children: "Salvar" } };
export const Default = {};
export const Loading = { args: { loading: true, children: "Salvando" } };
export const Disabled = { args: { disabled: true } };
export const Danger = { args: { variant: "danger", children: "Excluir" } };
