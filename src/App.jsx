import { lazy, Suspense } from "react";
import OperationalApp from "./routes/OperationalApp";

const ClientPortalApp = lazy(() => import("./client-portal/app/ClientPortalApp.jsx"));

export default function App() {
  if (window.location.pathname === "/cliente" || window.location.pathname.startsWith("/cliente/")) {
    return <Suspense fallback={null}><ClientPortalApp /></Suspense>;
  }
  return <OperationalApp/>;
}
