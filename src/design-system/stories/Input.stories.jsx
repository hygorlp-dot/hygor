import { Input } from "../primitives/Input.jsx";

export default { title: "Primitivos/Input", component: Input, tags: ["autodocs"], args: { label: "E-mail corporativo", placeholder: "nome@empresa.com.br" } };
export const Default = {};
export const Error = { args: { error: "Informe um e-mail válido.", value: "invalido" } };
export const Disabled = { args: { disabled: true, value: "operador@arcd.com.br" } };
