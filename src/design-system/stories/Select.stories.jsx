import { Select } from "../primitives/Select.jsx";

export default { title: "Primitivos/Select", component: Select, tags: ["autodocs"], args: { label: "Obra", placeholder: "Selecione", options: [{ value: "b2-04", label: "B2-04" }, { value: "h-02", label: "H-02" }] } };
export const Default = {};
export const Error = { args: { error: "Selecione uma obra." } };
export const Disabled = { args: { disabled: true, value: "b2-04" } };
