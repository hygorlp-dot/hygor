import { describe, expect, it } from "vitest";
import { cn } from "./cn.js";

describe("cn", () => {
  it("combina classes condicionais", () => {
    expect(cn("base", false && "hidden", "active")).toContain("base");
    expect(cn("base", false && "hidden", "active")).toContain("active");
  });
});
