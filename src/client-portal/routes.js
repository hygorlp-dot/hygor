import {activeCompany,companyIsolationActive} from '../lib/company-scope.js';
import {portalNavigationPath} from './company.js';
export const CLIENT_PORTAL_HOST = "portaldocliente.marcelleng.com.br";
export const CLIENT_PORTAL_ORIGIN = `https://${CLIENT_PORTAL_HOST}`;
export const isClientPortalLocation = ({hostname = "", pathname = "/"} = {}) => hostname.toLowerCase() === CLIENT_PORTAL_HOST || pathname === "/cliente" || pathname.startsWith("/cliente/");
export function portalRoute(pathname) {
  const match = pathname.match(/^\/cliente\/obra\/([^/]+)(?:\/([^/]+))?\/?$/);
  if (!match) return {projectId:"", page:["/", "/cliente", "/cliente/"].includes(pathname) ? "home" : "unknown"};
  try { return {projectId:decodeURIComponent(match[1]), page:match[2] || "home"}; }
  catch { return {projectId:"", page:"unknown"}; }
}
export const portalProjectPath = (projectId, page = "home") => `/cliente/obra/${encodeURIComponent(projectId)}${page === "home" ? "" : `/${page}`}`;
export function navigatePortal(path, {replace = false} = {}) {
  window.history[replace ? "replaceState" : "pushState"]({}, "", portalNavigationPath(path));
  window.dispatchEvent(new PopStateEvent("popstate"));
}
export function portalLoginUrl(location) {
  const path=["localhost", "127.0.0.1", "[::1]"].includes(location.hostname) ? `${location.origin}/cliente` : `${CLIENT_PORTAL_ORIGIN}/`;
  return companyIsolationActive()?`${path}?empresa=${activeCompany()}`:path;
}
