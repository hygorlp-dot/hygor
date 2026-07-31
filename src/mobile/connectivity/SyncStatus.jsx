import "./styles.css";

const messages = {
  idle: "Aguardando alteração.",
  syncing: "Sincronizando…",
  synced: "Sincronizado.",
  pending: "Salvo neste aparelho. Aguardando conexão.",
  failed: "Falha de sincronização. Tente novamente quando houver conexão.",
};

export function SyncStatus({ state = "idle", updatedAt }) {
  const timestamp = state === "synced" && updatedAt ? `Sincronizado às ${updatedAt}.` : null;
  return <p className="arcd-sync-status" data-state={state} role="status">{timestamp || messages[state] || messages.idle}</p>;
}
