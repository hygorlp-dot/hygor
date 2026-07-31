import { useState } from "react";
import { ClientPortalBottomNav } from "./ClientPortalBottomNav.jsx";
import { ClientPortalHeader } from "./ClientPortalHeader.jsx";
import { ClientPortalMoreMenu } from "./ClientPortalMoreMenu.jsx";
import "../styles/portal.css";

export function ClientPortalShell({ project, active, permissions, children, onNavigate }) {
  const [moreOpen, setMoreOpen] = useState(false);
  const navigate = destination => destination === "more" ? setMoreOpen(true) : onNavigate?.(destination);
  return <div className="arcd-client-shell"><ClientPortalHeader project={project} onOpenMore={() => setMoreOpen(true)} /><main className="arcd-client-content">{children}</main><ClientPortalBottomNav active={active} permissions={permissions} onNavigate={navigate} /><ClientPortalMoreMenu open={moreOpen} onOpenChange={setMoreOpen} onNavigate={onNavigate} permissions={permissions} /></div>;
}
