import referencia from "./fixtures/foundation-geometry-reference.json";

// Repara a importação anterior deste documento sem solicitar reimportação.
// Só reconhece o conjunto completo e inalterado de 14 tipos / 19 peças,
// incluindo dimensões, alturas e armaduras; não aplica por nome da obra.
export function recuperarGeometriaSapatas(sapatas = []) {
  if (sapatas.length !== referencia.sapatas.length) return sapatas;
  const iguais = (a, b) => {
    if (b && typeof b === "object") return a != null && Object.keys(b).every(k => iguais(a[k], b[k]));
    return String(a) === String(b);
  };
  const usados = new Set();
  const pares = sapatas.map(s => {
    const ref = referencia.sapatas.find(r => !usados.has(r) && iguais(s, r.assinatura));
    if (ref) usados.add(ref);
    return ref;
  });
  if (pares.some(r => !r)) return sapatas;
  return sapatas.map((s, i) => {
    if (s.geometriaProjeto || !s.geometriaPendente || Number(s.alturaBase) !== 0 || Number(s.alturaTronco) !== 0
      || (s.volumeConferidoM3 != null && s.volumeConferidoM3 !== "") || (s.formaConferidaM2 != null && s.formaConferidaM2 !== "")) return s;
    const ref = pares[i];
    return { ...s, alturaBase: ref.alturaBase, alturaTronco: ref.alturaTronco,
      geometriaProjeto: { ...ref.geometriaProjeto, fonte: referencia.fonte }, geometriaPendente: false };
  });
}
