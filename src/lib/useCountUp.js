import { useEffect, useRef, useState } from "react";

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

// Anima um número inteiro subindo até `value` quando ele muda. Só faz
// sentido para valores numéricos "crus" (contagens) — strings já formatadas
// (ex.: "R$ 12k") devem usar fade-in simples, não este hook.
export function useCountUp(value, duration = 500) {
  const numeric = typeof value === "number" && Number.isFinite(value);
  const [display, setDisplay] = useState(numeric ? value : 0);
  const fromRef = useRef(0);

  useEffect(() => {
    if (!numeric || prefersReducedMotion()) {
      setDisplay(numeric ? value : 0);
      return;
    }
    const from = fromRef.current;
    const to = value;
    if (from === to) return;
    const start = performance.now();
    let raf;
    const step = now => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(from + (to - from) * eased));
      if (t < 1) raf = requestAnimationFrame(step);
      else fromRef.current = to;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, numeric, duration]);

  return numeric ? display : value;
}
