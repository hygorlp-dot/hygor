import { useState } from "react";
import { Drawer } from "../primitives/Drawer.jsx";
import { Button } from "../primitives/Button.jsx";

function DrawerExample() { const [open, setOpen] = useState(true); return <><Button onClick={() => setOpen(true)}>Abrir detalhes</Button><Drawer open={open} onOpenChange={setOpen} title="Detalhes da obra"><p>Informações complementares ficam em um painel lateral.</p></Drawer></>; }
export default { title: "Sobreposições/Drawer", component: DrawerExample, tags: ["autodocs"] };
export const Default = {};
