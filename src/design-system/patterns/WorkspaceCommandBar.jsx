import './command-bar.css';

// Um ponto de operação; os controles conservam seus rótulos e a ordem de Tab.
export function WorkspaceCommandBar({label,scope,children,actions}){
 return <div className="workspace-command-bar" role="group" aria-label={label}>
  {scope&&<div className="workspace-command-bar__scope">{scope}</div>}
  {children&&<div className="workspace-command-bar__controls">{children}</div>}
  {actions&&<div className="workspace-command-bar__actions">{actions}</div>}
 </div>;
}
export function WorkspaceHeading({title,navigation}){
 return <header className="workspace-heading"><h1>{title}</h1>{navigation}</header>;
}
