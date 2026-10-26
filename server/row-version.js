// Comparação EXATA de carimbos `updated_at` entre as duas formas que o
// servidor os recebe:
// - PostgREST (supabase-js): texto ISO com microssegundos, ex.
//   "2026-10-26T19:38:33.421305+00:00";
// - Postgres direto, com `updated_at::text`: "2026-10-26 19:38:33.421305+00".
//
// O driver `postgres` devolve timestamptz como Date, que só tem milissegundos.
// Para decidir se uma linha mudou entre a leitura sem lock e a aquisição do
// lock, milissegundos não bastam: duas gravações no mesmo milissegundo
// pareceriam a mesma versão e o servidor reaproveitaria dados velhos. Por isso
// só texto com a fração completa é aceito; qualquer outra coisa (Date, valor
// ausente, formato desconhecido) NÃO é igual, e quem chama relê a linha.
const FORMATO = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,6}))?\s*(Z|[+-]\d{2}(?::?\d{2})?)?$/i;

export const carimboExato = valor => {
  if (typeof valor !== "string") return null;
  const partes = FORMATO.exec(valor.trim());
  if (!partes) return null;
  const [, ano, mes, dia, hora, minuto, segundo, fracao = "", zona = "Z"] = partes;
  let deslocamentoMin = 0;
  if (zona.toUpperCase() !== "Z") {
    const sinal = zona[0] === "-" ? -1 : 1;
    const digitos = zona.slice(1).replace(":", "");
    deslocamentoMin = sinal * (Number(digitos.slice(0, 2)) * 60 + Number(digitos.slice(2) || 0));
  }
  const segundos = Date.UTC(Number(ano), Number(mes) - 1, Number(dia), Number(hora), Number(minuto), Number(segundo)) - deslocamentoMin * 60000;
  if (Number.isNaN(segundos)) return null;
  return `${segundos}.${(fracao + "000000").slice(0, 6)}`;
};

export const mesmoCarimboExato = (a, b) => {
  const ca = carimboExato(a);
  return ca !== null && ca === carimboExato(b);
};
