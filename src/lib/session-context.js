// Apenas contexto de navegação. Dados de negócio e autenticação não devem
// usar este fallback: memória não confirma persistência no aparelho.
const memory = new Map();
export const sessionContext = {
  getItem(key) {
    try {
      const value=globalThis.sessionStorage.getItem(key);
      if(value===null)memory.delete(key);else memory.set(key,value);
      return value;
    } catch { return memory.get(key) ?? null; }
  },
  setItem(key,value) {
    memory.set(key,String(value));
    try { globalThis.sessionStorage.setItem(key,String(value)); } catch { /* Navegação ainda funciona nesta página. */ }
  },
  removeItem(key) {
    memory.delete(key);
    try { globalThis.sessionStorage.removeItem(key); } catch { /* Sem contexto salvo. */ }
  },
};
