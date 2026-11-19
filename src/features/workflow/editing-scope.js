const editors=new Set();
export function registerWorkspaceEditor(){
  const editor={};editors.add(editor);return ()=>editors.delete(editor);
}
export const hasWorkspaceEditor=()=>editors.size>0;
