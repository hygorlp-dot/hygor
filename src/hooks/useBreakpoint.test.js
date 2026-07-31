import { describe, expect, it } from "vitest";
import { BREAKPOINTS, resolveBreakpoint } from "./useBreakpoint";

describe("breakpoints responsivos", () => {
  it("classifica os limites sem lacunas", () => {
    expect(resolveBreakpoint(360)).toBe("mobile");
    expect(resolveBreakpoint(BREAKPOINTS.tablet - 1)).toBe("mobile");
    expect(resolveBreakpoint(BREAKPOINTS.tablet)).toBe("tablet");
    expect(resolveBreakpoint(BREAKPOINTS.desktop - 1)).toBe("tablet");
    expect(resolveBreakpoint(BREAKPOINTS.desktop)).toBe("desktop");
  });
});

