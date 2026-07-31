import { useState } from "react";
import { ClientDashboard } from "../pages/ClientDashboard.jsx";
import { ClientDecisionsPage } from "../pages/ClientDecisionsPage.jsx";
import { ClientFinancialPage } from "../pages/ClientFinancialPage.jsx";
import { ClientProgressPage } from "../pages/ClientProgressPage.jsx";
import { ClientDocumentsPage } from "../pages/ClientDocumentsPage.jsx";
import { ClientTransparencyPage } from "../pages/ClientTransparencyPage.jsx";
import { ClientPortalShell } from "./ClientPortalShell.jsx";

const pathToRoute = path => path.includes("/progresso") ? "progress" : path.includes("/decisoes") ? "decisions" : path.includes("/financeiro") ? "financial" : path.includes("/documentos") ? "documents" : path.includes("/transparencia") ? "transparency" : "home";

export function ClientPortalRouter({ portalData, permissions = {} }) {
  const [active, setActive] = useState(() => pathToRoute(window.location.pathname));
  const navigate = destination => {
    if (destination === "financial" && !permissions.viewFinancial) return;
    if (destination === "documents" && !permissions.downloadDocuments) return;
    if (destination === "transparency" && !permissions.viewProjectCash && !permissions.viewProcurement) return;
    setActive(destination);
  };
  const content = active === "home" ? <ClientDashboard data={portalData} />
    : active === "progress" ? <ClientProgressPage data={portalData} />
      : active === "decisions" ? <ClientDecisionsPage data={portalData} />
        : active === "documents" ? <ClientDocumentsPage data={portalData} />
          : active === "transparency" ? <ClientTransparencyPage data={portalData} permissions={permissions} />
          : <ClientFinancialPage data={portalData} />;
  return <ClientPortalShell project={portalData.project} active={active} permissions={permissions} onNavigate={navigate}>{content}</ClientPortalShell>;
}
