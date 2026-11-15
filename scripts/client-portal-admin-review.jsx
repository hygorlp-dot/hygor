// Monta o componente real em uma página exclusiva do servidor local de teste.
import React from "react";
import {createRoot} from "react-dom/client";
import ClientPortalAccess from "../src/domains/administracao/components/ClientPortalAccess.jsx";
import {ThemeProvider} from "../src/design-system/theme/ThemeProvider.jsx";
import {HelpProvider} from "../src/features/help/HelpContext.jsx";
import "../src/index.css";
import "../src/client-portal/styles/portal.css";
import "../src/design-system/themes/operating-contract.css";
import "../src/design-system/themes/module-standard.css";
createRoot(document.getElementById("root")).render(<ThemeProvider><HelpProvider><main className="arcd-client-content"><p>Revisão local com dados fictícios · componente da Central do Administrador</p><ClientPortalAccess currentUser={{id:"admin-local",role:"admin"}} data={{obras:[{id:"obra-local",name:"Casa Aurora · cenário fictício"}]}}/></main></HelpProvider></ThemeProvider>);
