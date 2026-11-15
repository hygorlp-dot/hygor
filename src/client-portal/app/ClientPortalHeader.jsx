import {Button} from "../../design-system/primitives/Button.jsx";
import {Select} from "../../design-system/primitives/Select.jsx";
import {PageHeader} from "../../design-system/patterns/PageHeader.jsx";
import {HelpButton} from "../../features/help/HelpButton.jsx";
import {PORTAL_PAGES,canOpenPortalPage} from "../navigation.js";

export function ClientPortalHeader({project,projects=[],selectedProject,onSelectProject,permissions={},onLogout,logoutBusy,onRefresh}) {
  const topics=PORTAL_PAGES.filter(page=>canOpenPortalPage(page,permissions)).map(page=>page.help);
  return <div className="arcd-client-header">
    <img className="arcd-client-brand" src="/brand/marcell/monogram-azul.svg" alt="MARCELL"/>
    <PageHeader title={project?.name||"Acompanhamento da obra"} secondaryActions={<><HelpButton pageId="cliente" allowedTabs={topics}/><Button variant="secondary" onClick={onRefresh}>Atualizar consulta</Button><Button variant="secondary" onClick={onLogout} disabled={logoutBusy} loading={logoutBusy}>Sair do portal</Button></>}/>
    {projects.length>1&&<Select label="Obra em acompanhamento" value={selectedProject} onChange={event=>onSelectProject(event.target.value)} options={projects.map(item=>({value:item.projectId,label:item.projectId===project.id?project.name:item.name||item.projectId}))}/>}
  </div>;
}
