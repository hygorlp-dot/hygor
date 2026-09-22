// Cotas de cada corte após a última anotação de armadura. O quadro dá
// a dimensão total exata; os afastamentos externos fecham o topo sem somar
// cotas intermediárias arredondadas (13 + 13 pode representar 25 cm).
export function extrairGeometriaSapata(texto, tipo) {
  const referencia = tipo.tipo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const blocos = String(texto).split(new RegExp(`(?:^|\\n)${referencia}(?=\\s*(?:\\n|$))`, "g")).slice(1);
  const cortes = [];
  for (const bloco of blocos) {
    const fim = bloco.search(/\nP\d+(?:\s|$)/);
    const corte = fim < 0 ? bloco : bloco.slice(0, fim);
    const anotacoes = [...corte.matchAll(/C=\d+(?:-\d+)?/g)];
    if (!anotacoes.length) continue;
    const ultima = anotacoes.at(-1);
    const depois = corte.slice(ultima.index + ultima[0].length).trim();
    if (!/^[\d\s.,]+$/.test(depois)) continue;
    const valores = depois.match(/\d+(?:[.,]\d+)?/g)?.map(v => Number(v.replace(",", "."))) || [];
    const dimensao = (cortes.length === 0 ? tipo.largura : tipo.comprimento) * 100;
    // Corte X traz quatro cotas e as alturas; Y traz quatro cotas (ou
    // três quando o topo termina na borda) e a altura total.
    const cadeia = cortes.length === 0 ? valores.slice(0, 4) : valores.slice(0, -1);
    if (![3, 4].includes(cadeia.length)) continue;
    const soma = cadeia.reduce((a, b) => a + b, 0);
    if (Math.abs(soma - dimensao) > 1.01) continue;
    const esquerda = cadeia[0];
    const direita = cadeia.length === 4 ? cadeia[3] : 0;
    const topo = dimensao - esquerda - direita;
    if (!(topo > 0 && topo <= dimensao)) continue;
    cortes.push({ topo: topo / 100, afastamentos: [esquerda / 100, direita / 100], cotasCm: cadeia });
    if (cortes.length === 2) break;
  }
  if (cortes.length !== 2) return null;
  return { modelo: "prismoide-retangular", topoLargura: cortes[0].topo, topoComprimento: cortes[1].topo,
    afastamentosX: cortes[0].afastamentos, afastamentosY: cortes[1].afastamentos,
    cotasCortesCm: cortes.map(c => c.cotasCm), fonte: "Quadro e cortes do detalhamento de fundação" };
}

export function calcularGeometriaSapata(tipo) {
  const g = tipo.geometriaProjeto;
  if (g?.modelo !== "prismoide-retangular") return null;
  const A = Number(tipo.largura), B = Number(tipo.comprimento);
  const a = Number(g.topoLargura), b = Number(g.topoComprimento);
  const base = Number(tipo.alturaBase), h = Number(tipo.alturaTronco);
  if (![A, B, a, b, base].every(n => Number.isFinite(n) && n > 0) || !Number.isFinite(h) || h < 0 || a > A || b > B) return null;
  const volumeBase = A * B * base;
  // Integração das seções retangulares que variam linearmente em altura.
  const volumeTronco = h * (2 * A * B + A * b + a * B + 2 * a * b) / 6;
  const bordasX = (g.afastamentosX || []).filter(v => v === 0).length;
  const bordasY = (g.afastamentosY || []).filter(v => v === 0).length;
  const forma = 2 * (A + B) * base + bordasX * h * (B + b) / 2 + bordasY * h * (A + a) / 2;
  return { volumeBase, volumeTronco, forma };
}
