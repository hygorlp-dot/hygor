import { Suspense } from "react";
import { lazyWithCssRetry as lazy } from "./lib/lazy-with-css-retry.js";
import OperationalApp from "./routes/OperationalApp";
import { isClientPortalLocation } from "./client-portal/routes.js";
import { LoadingState } from "./design-system/patterns/LoadingState.jsx";

const SupplierQuotePage = lazy(() => import("./supplier-quote/SupplierQuotePage.jsx"));
const ClientPortalApp = lazy(() => import("./client-portal/app/ClientPortalApp.jsx"));
const SupplierAcceptancePage = lazy(() => import("./supplier-acceptance/SupplierAcceptancePage.jsx"));

export default function App() {
  if (isClientPortalLocation(window.location)) return <Suspense fallback={<LoadingState label="portal do cliente"/>}><ClientPortalApp /></Suspense>;
  if(window.location.pathname === "/responder-cotacao")return <Suspense fallback={null}><SupplierQuotePage/></Suspense>;
  if (window.location.pathname === "/aceite-pedido") {
    return <Suspense fallback={null}><SupplierAcceptancePage /></Suspense>;
  }
  return <OperationalApp/>;
}
