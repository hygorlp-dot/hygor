import { useMemo, useState } from "react";
import { MobileAppBar } from "./MobileAppBar.jsx";
import { MobileBottomNavigation } from "./MobileBottomNavigation.jsx";
import { MobileMoreMenu } from "./MobileMoreMenu.jsx";
import { MobilePageContainer } from "./MobilePageContainer.jsx";
import "./styles.css";

export function MobileAppShell({ title, children, projects = [], initialProjectId, active, onNavigate, allowed, moreItems = [], onBack, actions }) {
  const [activeProjectId, setActiveProjectId] = useState(initialProjectId || projects[0]?.id || "");
  const [moreOpen, setMoreOpen] = useState(false);
  const activeProject = useMemo(() => projects.find(project => project.id === activeProjectId), [activeProjectId, projects]);
  const navigate = destination => { if (destination === "more") setMoreOpen(true); else onNavigate?.(destination); };
  return <div className="arcd-mobile-shell"><MobileAppBar title={activeProject ? `Obra atual · ${activeProject.name}` : title} onBack={onBack} projects={projects.length ? projects : undefined} activeProjectId={activeProjectId} onProjectChange={setActiveProjectId} actions={actions} /><MobilePageContainer>{children}</MobilePageContainer><MobileBottomNavigation active={active} allowed={allowed} onNavigate={navigate} /><MobileMoreMenu open={moreOpen} onOpenChange={setMoreOpen} items={moreItems} onNavigate={onNavigate} /></div>;
}
