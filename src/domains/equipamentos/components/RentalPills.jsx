import { Ban, CalendarClock, CheckCircle2, CircleAlert, CircleDashed, CircleSlash, Clock, FileText, Lock, PlayCircle } from "lucide-react";
import { RENTAL_SITUATION_LABEL } from "../rental-operations.js";

// Estado nunca só por cor: cada situação/cobrança tem ícone + texto + tom.
const SITUATION = {
  em_andamento: { icon: PlayCircle, tone: "info" },
  programada: { icon: CalendarClock, tone: "neutral" },
  encerrada: { icon: CheckCircle2, tone: "success" },
  cancelada: { icon: Ban, tone: "danger" },
};
const BILLING = {
  em_dia: { icon: CheckCircle2, tone: "success" },
  pendente: { icon: Clock, tone: "warning" },
  parcial: { icon: CircleDashed, tone: "warning" },
  a_faturar: { icon: FileText, tone: "info" },
  sem_medicao: { icon: CircleSlash, tone: "neutral" },
  encerrada: { icon: Lock, tone: "neutral" },
};

const Pill = ({ icon: Icon, tone, children }) => (
  <span className="ro-pill" data-tone={tone}><Icon size={13} aria-hidden="true" />{children}</span>
);

export const SituationPill = ({ row }) => <Pill {...SITUATION[row.situacao]}>{RENTAL_SITUATION_LABEL[row.situacao]}</Pill>;
export const BillingPill = ({ cobranca }) => <Pill {...BILLING[cobranca.estado]}>{cobranca.label}</Pill>;
export const AlertFlag = ({ children }) => <span className="ro-flag"><CircleAlert size={13} aria-hidden="true" />{children}</span>;
