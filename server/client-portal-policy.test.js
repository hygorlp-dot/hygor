import { describe, expect, it } from "vitest";
import { authorizeClientPortalAccess, clientPortalPermissions } from "./client-portal-policy.js";

describe("client portal server policy", () => {
  it("grants only the financial profile capabilities", () => {
    const permissions = clientPortalPermissions({ profile:"financial" });
    expect(permissions.viewFinancial).toBe(true);
    expect(permissions.viewProjectCash).toBe(true);
    expect(permissions.viewProcurement).toBe(true);
    expect(permissions.approveMeasurements).toBe(true);
    expect(permissions.viewMedia).toBe(false);
    expect(permissions.openAssistance).toBe(false);
  });

  it("requires active membership of the requested project", () => {
    expect(authorizeClientPortalAccess({ client:{ active:true, profile:"owner", projectIds:["obra-a"] }, projectId:"obra-b", capability:"viewProgress" })).toMatchObject({ ok:false, status:403 });
    expect(authorizeClientPortalAccess({ client:{ active:true, profile:"observer", projectIds:["obra-a"] }, projectId:"obra-a", capability:"viewFinancial" })).toMatchObject({ ok:false, status:403 });
  });

  it("supports explicit grant and revocation without inventing a capability", () => {
    const permissions = clientPortalPermissions({ profile:"observer", grant:["openAssistance", "not-real"], revoke:["viewMedia"] });
    expect(permissions.openAssistance).toBe(true);
    expect(permissions.viewMedia).toBe(false);
    expect(permissions).not.toHaveProperty("not-real");
  });
});
