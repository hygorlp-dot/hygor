import { useEffect, useState } from "react";
import LandingPage from "./routes/LandingPage";
import OperationalApp from "./routes/OperationalApp";

const canonicalPath = pathname => {
  if (pathname === "/sistema" || pathname === "/app") return "/sistema";
  return "/";
};

// A landing e o ambiente operacional precisam somente de duas rotas. Manter
// esse roteamento nativo reduz o bundle e evita carregar uma dependência com
// vulnerabilidades conhecidas para uma navegação que o navegador já oferece.
const useApplicationPath = () => {
  const [path, setPath] = useState(() => canonicalPath(window.location.pathname));

  useEffect(() => {
    const syncPath = () => {
      const next = canonicalPath(window.location.pathname);
      if (next !== window.location.pathname) window.history.replaceState({}, "", next);
      setPath(next);
    };
    syncPath();
    window.addEventListener("popstate", syncPath);
    return () => window.removeEventListener("popstate", syncPath);
  }, []);

  return path;
};

export default function App() {
  return useApplicationPath() === "/sistema" ? <OperationalApp/> : <LandingPage/>;
}
