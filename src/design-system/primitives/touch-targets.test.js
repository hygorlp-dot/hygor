import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = relative => fs.readFileSync(path.resolve(process.cwd(), relative), "utf8");

describe("mobile touch targets", () => {
  it("keeps shared controls at the ARCD minimum target on mobile", () => {
    const styles = read("src/design-system/primitives/styles.css");
    expect(styles).toContain("@media (max-width: 767px)");
    expect(styles).toContain(".arcd-button:not(.arcd-button--link) { min-height: var(--arcd-touch-target-min); }");
    expect(styles).toContain(".arcd-button--icon { width: var(--arcd-touch-target-min);");
    expect(styles).toContain(".arcd-check { min-height: var(--arcd-touch-target-min); }");
  });

  it("applies the same mobile target to legacy action controls", () => {
    const legacy = read("src/LegacyApp.jsx");
    expect(legacy).toContain(".arcd-btn{min-height:var(--arcd-touch-target-min)!important}");
    expect(legacy).toContain(".arcd-tab{min-height:var(--arcd-touch-target-min)}");
    expect(legacy).toContain("width:var(--arcd-touch-target-min)!important;height:var(--arcd-touch-target-min)!important;");
  });
});
