// Necessário para o React 18 (createRoot + act de "react") não emitir o
// aviso "current testing environment is not configured to support act(...)"
// nos testes que renderizam componentes React.
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

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
