import {ClientDashboard} from "../pages/ClientDashboard.jsx";
import {ClientDecisionsPage} from "../pages/ClientDecisionsPage.jsx";
import {ClientFinancialPage} from "../pages/ClientFinancialPage.jsx";
import {ClientProgressPage} from "../pages/ClientProgressPage.jsx";
import {ClientDocumentsPage} from "../pages/ClientDocumentsPage.jsx";
import {ClientTransparencyPage} from "../pages/ClientTransparencyPage.jsx";
import {ClientPhotosPage} from "../pages/ClientPhotosPage.jsx";
import {ClientCostsPage} from "../pages/ClientCostsPage.jsx";
import {ClientBudgetPage} from "../pages/ClientBudgetPage.jsx";
import {ClientAdministrationTeamPage} from '../pages/ClientAdministrationTeamPage.jsx';
import {ClientPurchasesPage} from "../pages/ClientPurchasesPage.jsx";
import {ClientCashPage} from "../pages/ClientTransparencyPage.jsx";
import {ClientAccountPage} from "../pages/ClientAccountPage.jsx";
import {ClientPortalShell} from "./ClientPortalShell.jsx";
import {usePortalLocation} from "./usePortalLocation.js";
import {PORTAL_PAGES,canOpenPortalPage} from "../navigation.js";
import {navigatePortal,portalProjectPath} from "../routes.js";
import {useHelpTopic} from "../../features/help/HelpContext.jsx";
import {EmptyState} from "../../design-system/patterns/FeedbackState.jsx";
import {Button} from "../../design-system/primitives/Button.jsx";

export function ClientPortalRouter({portalData,permissions={},...sessionProps}) {
  const route=usePortalLocation();
  const page=PORTAL_PAGES.find(item=>item.path===route.page||(route.page==="fotos"&&item.id==="photos"));
  const allowed=canOpenPortalPage(page,permissions);
  const active=page?.id || "unknown";
  useHelpTopic("cliente",page?.help || "cliente_inicio");
  const navigate=id=>{
    const next=PORTAL_PAGES.find(item=>item.id===id);
    if(!canOpenPortalPage(next,permissions))return;
    navigatePortal(portalProjectPath(sessionProps.selectedProject||route.projectId||portalData.project.id,next.path));
  };
  const content=!allowed ? <EmptyState title="Área indisponível" description="Seu acesso não permite consultar esta área. Escolha uma das opções disponíveis." action={<Button onClick={()=>navigate("home")}>Voltar ao início</Button>}/>
    : active==="photos" ? <ClientPhotosPage data={portalData}/>
    : active==="costs" ? <ClientCostsPage data={portalData}/>
    : active==="budget" ? <ClientBudgetPage data={portalData}/>
    : active==='administration' ? <ClientAdministrationTeamPage data={portalData} permissions={permissions}/>
    : active==="cash" ? <ClientCashPage data={portalData}/>
    : active==="purchases" ? <ClientPurchasesPage data={portalData}/>
    : active==="home" ? <ClientDashboard data={portalData} permissions={permissions} onNavigate={navigate}/>
      : active==="progress" ? <ClientProgressPage data={portalData}/>
        : active==="decisions" ? <ClientDecisionsPage data={portalData}/>
          : active==="documents" ? <ClientDocumentsPage data={portalData}/>
            : active==="transparency" ? <ClientTransparencyPage data={portalData} permissions={permissions}/>
              : active==="account" ? <ClientAccountPage onSessionEnded={sessionProps.onLogout}/>
                : <ClientFinancialPage data={portalData} permissions={permissions}/>;
  return <ClientPortalShell project={portalData.project} active={active} permissions={permissions} onNavigate={navigate} {...sessionProps}>{content}</ClientPortalShell>;
}
