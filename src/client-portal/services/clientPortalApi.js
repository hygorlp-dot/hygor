async function request(url, options = {}) {
  const response=await fetch(url,{credentials:"same-origin",...options});
  const body=await response.json().catch(()=>({}));
  if(!response.ok){const error=new Error(body.error || "Não foi possível concluir a operação.");error.status=response.status;throw error;}
  return body;
}

export const readClientPortalSession=()=>request("/api/client/auth/session");
export const readClientPortalDashboard=projectId=>request(`/api/client/projects/${encodeURIComponent(projectId)}/dashboard`);
export const logoutClientPortal=()=>request("/api/client/auth/logout",{method:"POST"});
