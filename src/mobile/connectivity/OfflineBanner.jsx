import { NetworkStatus } from "./NetworkStatus.jsx";
import "./styles.css";

export function OfflineBanner({ status }) {
  if (status !== "offline" && status !== "unstable") return null;
  const message = status === "offline" ? "Sem conexão. Novos envios não foram confirmados no servidor." : "Conexão instável. Aguarde a confirmação do servidor antes de seguir.";
  return <aside className="arcd-offline-banner" data-status={status} role="alert"><NetworkStatus status={status} /><span>{message}</span></aside>;
}
