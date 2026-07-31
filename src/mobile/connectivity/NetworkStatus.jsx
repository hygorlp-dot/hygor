import { useEffect, useState } from "react";
import "./styles.css";

function readOnline() { return typeof navigator === "undefined" || navigator.onLine !== false; }

export function NetworkStatus({ status: controlledStatus }) {
  const [online, setOnline] = useState(readOnline);
  useEffect(() => {
    const update = () => setOnline(readOnline());
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => { window.removeEventListener("online", update); window.removeEventListener("offline", update); };
  }, []);
  const status = controlledStatus || (online ? "online" : "offline");
  const labels = { online: "Online", unstable: "Conexão instável", offline: "Offline" };
  return <span className="arcd-network-status" data-status={status} role="status"><span aria-hidden="true">●</span>{labels[status] || labels.online}</span>;
}
