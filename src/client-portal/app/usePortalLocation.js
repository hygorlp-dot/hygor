import {useEffect, useState} from "react";
import {portalRoute} from "../routes.js";
export function usePortalLocation() {
  const [path, setPath] = useState(() => window.location.pathname);
  useEffect(() => {
    const update = () => setPath(window.location.pathname);
    window.addEventListener("popstate", update);
    return () => window.removeEventListener("popstate", update);
  }, []);
  return portalRoute(path);
}
