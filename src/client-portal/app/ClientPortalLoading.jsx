import {LoadingState} from "../../design-system/patterns/LoadingState.jsx";
import "../styles/portal.css";
export function ClientPortalLoading() {
  return <main className="arcd-client-loading"><div className="arcd-material-panel"><LoadingState label="acompanhamento da obra"/></div></main>;
}
