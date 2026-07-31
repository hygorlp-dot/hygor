import { Camera, ClipboardCheck, HardHat, PackageCheck, UsersRound } from "lucide-react";
import { FieldActionGrid } from "./FieldActionGrid.jsx";
import { FieldContextHeader } from "./FieldContextHeader.jsx";
import "./styles.css";

export const FIELD_ACTIONS = Object.freeze([
  { id: "attendance", label: "Registrar ponto", description: "Entrada e presença da equipe", icon: UsersRound },
  { id: "daily-log", label: "Diário do dia", description: "Atividades e ocorrências", icon: ClipboardCheck },
  { id: "photo", label: "Adicionar foto", description: "Evidência da obra", icon: Camera },
  { id: "material-receipt", label: "Receber material", description: "Conferir entrega", icon: PackageCheck },
  { id: "tasks", label: "Consultar tarefas", description: "Frentes prioritárias", icon: HardHat },
]);

export function FieldHome({ project, userName, actions = FIELD_ACTIONS, allowedActions, onSelectAction }) {
  const visibleActions = actions.map(action => ({ ...action, disabled: action.disabled || (allowedActions && !allowedActions.includes(action.id)) }));
  return <section className="arcd-field-home"><FieldContextHeader project={project} userName={userName} /><FieldActionGrid actions={visibleActions} onSelect={onSelectAction} /></section>;
}
