import { useEffect, useMemo, useState } from "react";

export const BREAKPOINTS = Object.freeze({ narrow:420, tablet:768, desktop:1100 });

export const resolveBreakpoint = width =>
  width >= BREAKPOINTS.desktop ? "desktop" : width >= BREAKPOINTS.tablet ? "tablet" : "mobile";

const viewportWidth = () => typeof window === "undefined" ? BREAKPOINTS.desktop : window.innerWidth;

export function useBreakpoint() {
  const [width, setWidth] = useState(viewportWidth);

  useEffect(() => {
    const queries = [BREAKPOINTS.narrow, BREAKPOINTS.tablet, BREAKPOINTS.desktop]
      .map(value => window.matchMedia(`(min-width:${value}px)`));
    const update = () => setWidth(window.innerWidth);
    queries.forEach(query => query.addEventListener("change", update));
    return () => queries.forEach(query => query.removeEventListener("change", update));
  }, []);

  return useMemo(() => {
    const bp = resolveBreakpoint(width);
    return {
      bp,
      estreito:width < BREAKPOINTS.narrow,
      isMobile:bp === "mobile",
      isTablet:bp === "tablet",
      isDesktop:bp === "desktop",
      cols:(mobile, tablet, desktop) => `repeat(${bp === "desktop" ? desktop : bp === "tablet" ? tablet : mobile}, 1fr)`,
      pick:(mobile, tablet, desktop) => bp === "desktop" ? desktop : bp === "tablet" ? tablet : mobile,
      formGrid:(columns = 2) => bp === "mobile" ? "1fr" : `repeat(${columns}, 1fr)`,
    };
  }, [width]);
}

