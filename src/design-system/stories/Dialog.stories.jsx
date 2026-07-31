import { useState } from "react";
import { Dialog } from "../primitives/Dialog.jsx";
import { Button } from "../primitives/Button.jsx";

function DialogExample() { const [open, setOpen] = useState(true); return <><Button onClick={() => setOpen(true)}>Abrir diálogo</Button><Dialog open={open} onOpenChange={setOpen} title="Confirmar exclusão"><p>Esta ação precisa de confirmação explícita.</p></Dialog></>; }
export default { title: "Sobreposições/Dialog", component: DialogExample, tags: ["autodocs"] };
export const Default = {};
