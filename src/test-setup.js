// Necessário para o React 18 (createRoot + act de "react") não emitir o
// aviso "current testing environment is not configured to support act(...)"
// nos testes que renderizam componentes (landing page).
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
