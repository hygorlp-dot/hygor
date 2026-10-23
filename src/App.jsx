import { lazy, Suspense } from "react";
import OperationalApp from "./routes/OperationalApp";

const ClientPortalApp = lazy(() => import("./client-portal/app/ClientPortalApp.jsx"));
const SupplierAcceptancePage = lazy(() => import("./supplier-acceptance/SupplierAcceptancePage.jsx"));

export default function App() {
  if (window.location.pathname === "/cliente" || window.location.pathname.startsWith("/cliente/")) {
    return <Suspense fallback={null}><ClientPortalApp /></Suspense>;
  }
  if (window.location.pathname === "/aceite-pedido") {
    return <Suspense fallback={null}><SupplierAcceptancePage /></Suspense>;
  }
  return <OperationalApp/>;
}
