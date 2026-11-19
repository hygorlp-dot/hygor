// Necessário para o React 18 (createRoot + act de "react") não emitir o
// aviso "current testing environment is not configured to support act(...)"
// nos testes que renderizam componentes React.
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// jsdom não fornece MediaQueryList. Os componentes usam o mesmo contrato do
// navegador para acompanhar as larguras, inclusive após resize nos testes.
if (typeof window !== "undefined" && typeof window.matchMedia !== "function") {
  window.matchMedia = query => {
    const listeners = new Set();
    const matches = () => {
      const limits = [...query.matchAll(/\((min|max)-width:\s*(\d+)px\)/g)];
      return limits.length > 0 && limits.every(([, bound, width]) => bound === "min"
        ? window.innerWidth >= Number(width) : window.innerWidth <= Number(width));
    };
    let previous = matches();
    const media = {
      media: query, get matches() { return matches(); }, onchange: null,
      addEventListener(type, listener) { if (type === "change") listeners.add(listener); },
      removeEventListener(type, listener) { if (type === "change") listeners.delete(listener); },
      addListener(listener) { listeners.add(listener); },
      removeListener(listener) { listeners.delete(listener); },
      dispatchEvent(event) { for (const listener of listeners) listener(event); media.onchange?.(event); return true; },
    };
    window.addEventListener("resize", () => {
      const current = matches();
      if (current !== previous) { previous = current; media.dispatchEvent({ matches: current, media: query }); }
    });
    return media;
  };
}

// jsdom não implementa ResizeObserver. Recharts' ResponsiveContainer usa
// isso internamente (new ResizeObserver(callback)) para medir o
// container - sem este stub, qualquer teste que renderize um gráfico
// Recharts lança "ResizeObserver is not defined" antes mesmo de montar.
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
