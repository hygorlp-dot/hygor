import {expect,it} from "vitest";
import {isClientPortalLocation,portalRoute,portalLoginUrl} from "../routes.js";
it("abre o portal na raiz do domínio solicitado sem mudar o ERP",()=>{
  expect(isClientPortalLocation({hostname:"portaldocliente.marcelleng.com.br",pathname:"/"})).toBe(true);
  expect(isClientPortalLocation({hostname:"marcellapp.vercel.app",pathname:"/"})).toBe(false);
  expect(isClientPortalLocation({hostname:"localhost",pathname:"/cliente"})).toBe(true);
  expect(isClientPortalLocation({hostname:"fake-portaldocliente.marcelleng.com.br",pathname:"/"})).toBe(false);
  expect(portalLoginUrl({hostname:"marcellapp.vercel.app"})).toBe("https://portaldocliente.marcelleng.com.br/");
  expect(portalLoginUrl({hostname:"127.0.0.1",origin:"http://127.0.0.1:4197"})).toBe("http://127.0.0.1:4197/cliente");
});
it("conserva identidade da obra e recusa caminhos malformados",()=>{
  expect(portalRoute("/cliente/obra/obra%20a/fotos")).toEqual({projectId:"obra a",page:"fotos"});
  expect(portalRoute("/cliente/obra/%E0%A4%A/fotos").page).toBe("unknown");
});
