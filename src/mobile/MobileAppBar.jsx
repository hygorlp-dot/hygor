import { ChevronLeft } from "lucide-react";
import { Button } from "../design-system/primitives/Button.jsx";
import { ActiveProjectSwitcher } from "./ActiveProjectSwitcher.jsx";
import "./styles.css";

export function MobileAppBar({ title, onBack, projects, activeProjectId, onProjectChange, actions }) {
  return <header className="arcd-mobile-app-bar">{onBack && <Button variant="ghost" size="icon" aria-label="Voltar" onClick={onBack}><ChevronLeft size={20} /></Button>}{projects ? <ActiveProjectSwitcher value={activeProjectId} projects={projects} onChange={onProjectChange} /> : <h1 className="arcd-mobile-app-bar__title">{title}</h1>}{actions}</header>;
}
