import { useEffect, useRef } from "react";

export function KeyboardAwareContainer({ children, className = "" }) {
  const containerRef = useRef(null);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return undefined;
    const updateInset = () => {
      const inset = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
      containerRef.current?.style.setProperty("--arcd-mobile-keyboard-inset", `${inset}px`);
    };
    updateInset();
    viewport.addEventListener("resize", updateInset);
    viewport.addEventListener("scroll", updateInset);
    return () => {
      viewport.removeEventListener("resize", updateInset);
      viewport.removeEventListener("scroll", updateInset);
    };
  }, []);

  return <div ref={containerRef} className={`arcd-mobile-editor__content ${className}`.trim()}>{children}</div>;
}
