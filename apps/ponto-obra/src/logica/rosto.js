// Reconhecimento facial do app "Ponto de Obra" - parte em JavaScript puro
// (sem React Native), testável no Node. O app roda os dois modelos TFLite
// (react-native-fast-tflite) e entrega os tensores de saída para cá.
//
// Modelos e geometria portados de face_detection_tflite (Hugo Cornellier,
// Apache-2.0 - ver NOTICE): BlazeFace "front" (MediaPipe, 128x128) para achar
// o rosto e os olhos, e MobileFaceNet (112x112 -> vetor de 192) para a
// identidade.

// ---------------- BlazeFace (detecção) ----------------
export const BLAZEFACE = Object.freeze({
  tamanho: 128,
  valoresPorCaixa: 16,      // cx, cy, w, h + 6 pontos (x,y)
  ancoras: 896,
  scoreMinimo: 0.5,
  limiteLogit: 100,
});

// Âncoras SSD do MediaPipe para o modelo front: strides [8,16,16,16],
// fixedAnchorSize, offset 0.5. Camadas de mesmo stride se juntam: 16x16 com 2
// âncoras por célula + 8x8 com 6 âncoras por célula = 896.
export function ancorasBlazeFaceFront() {
  const strides = [8, 16, 16, 16];
  const ancoras = [];
  let camada = 0;
  while (camada < strides.length) {
    let ultima = camada;
    let porCelula = 0;
    while (ultima < strides.length && strides[ultima] === strides[camada]) { porCelula += 2; ultima++; }
    const lado = Math.ceil(BLAZEFACE.tamanho / strides[camada]);
    for (let y = 0; y < lado; y++) {
      for (let x = 0; x < lado; x++) {
        for (let k = 0; k < porCelula; k++) ancoras.push([(x + 0.5) / lado, (y + 0.5) / lado]);
      }
    }
    camada = ultima;
  }
  return ancoras;
}

const sigmoide = (v, limite = BLAZEFACE.limiteLogit) => 1 / (1 + Math.exp(-Math.max(-limite, Math.min(limite, v))));

// Saída crua -> candidatos normalizados (0..1 no espaço da entrada 128x128).
export function decodificarBlazeFace(scoresBrutos, caixasBrutas, ancoras = ancorasBlazeFaceFront()) {
  const n = BLAZEFACE.valoresPorCaixa, escala = BLAZEFACE.tamanho;
  const candidatos = [];
  for (let i = 0; i < ancoras.length; i++) {
    const score = sigmoide(scoresBrutos[i]);
    if (!(score >= BLAZEFACE.scoreMinimo)) continue;
    const base = i * n;
    const [ax, ay] = ancoras[i];
    const cx = caixasBrutas[base] / escala + ax;
    const cy = caixasBrutas[base + 1] / escala + ay;
    const w = caixasBrutas[base + 2] / escala;
    const h = caixasBrutas[base + 3] / escala;
    if (w <= 0 || h <= 0) continue;
    const pontos = [];
    for (let j = 4; j < n; j += 2) pontos.push({ x: caixasBrutas[base + j] / escala + ax, y: caixasBrutas[base + j + 1] / escala + ay });
    candidatos.push({ score, caixa: { x1: cx - w / 2, y1: cy - h / 2, x2: cx + w / 2, y2: cy + h / 2 }, pontos });
  }
  return candidatos;
}

const iou = (a, b) => {
  const ix = Math.max(0, Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1));
  const iy = Math.max(0, Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1));
  const inter = ix * iy;
  const uniao = (a.x2 - a.x1) * (a.y2 - a.y1) + (b.x2 - b.x1) * (b.y2 - b.y1) - inter;
  return uniao > 0 ? inter / uniao : 0;
};

// Agrupa candidatos do mesmo rosto (as âncoras vizinhas disparam juntas) e
// devolve um rosto por grupo, do mais confiável ao menos.
export function rostosDistintos(candidatos, limiarIou = 0.3) {
  const ordenados = [...candidatos].sort((a, b) => b.score - a.score);
  const rostos = [];
  for (const c of ordenados) if (!rostos.some(r => iou(r.caixa, c.caixa) > limiarIou)) rostos.push(c);
  return rostos;
}

// Pontos do BlazeFace: 0 e 1 = olhos, 2 = ponta do nariz, 3 = boca, 4 e 5 =
// orelhas. Ordena os olhos pela posição na imagem (esquerda/direita da foto).
export function olhosENariz(rosto) {
  const [a, b, nariz] = rosto.pontos;
  const [esq, dir] = a.x <= b.x ? [a, b] : [b, a];
  return { olhoEsquerdo: esq, olhoDireito: dir, nariz };
}

// Giro da cabeça (aproximado, sem unidade): deslocamento do nariz em relação
// ao meio dos olhos, dividido pela distância entre os olhos. ~0 = de frente;
// cerca de +-0,25 ou mais = cabeça virada. Usado na prova de vida.
export function giroDaCabeca(rosto) {
  const { olhoEsquerdo: e, olhoDireito: d, nariz } = olhosENariz(rosto);
  const distancia = Math.hypot(d.x - e.x, d.y - e.y) || 1;
  return (nariz.x - (e.x + d.x) / 2) / distancia;
}

// Recorte alinhado para o MobileFaceNet (mesma geometria da origem): quadrado
// de 2,5x a distância entre os olhos, centro 15% abaixo do meio dos olhos,
// girado para deixar os olhos na horizontal. Coordenadas em pixels.
export function recorteParaIdentidade(olhoEsquerdo, olhoDireito) {
  const dx = olhoDireito.x - olhoEsquerdo.x, dy = olhoDireito.y - olhoEsquerdo.y;
  const angulo = Math.atan2(dy, dx);
  const tamanho = Math.hypot(dx, dy) * 2.5;
  const meioX = (olhoEsquerdo.x + olhoDireito.x) / 2, meioY = (olhoEsquerdo.y + olhoDireito.y) / 2;
  const desloc = tamanho * 0.15;
  return {
    cx: meioX - desloc * Math.sin(angulo),
    cy: meioY + desloc * Math.cos(angulo),
    tamanho,
    anguloGraus: (angulo * 180) / Math.PI,
  };
}

// ---------------- MobileFaceNet (identidade) ----------------
export const MOBILEFACENET = Object.freeze({ tamanho: 112, dimensao: 192, modelo: "mobilefacenet-192-apache2" });

// RGBA (como o decodificador de PNG entrega) -> Float32 RGB em [-1, 1], NHWC.
// Mesma normalização dos dois modelos: x / 127.5 - 1.
export function pixelsParaTensor(rgba, largura, altura) {
  const saida = new Float32Array(largura * altura * 3);
  for (let p = 0, o = 0; p < largura * altura; p++) {
    saida[o++] = rgba[p * 4] / 127.5 - 1;
    saida[o++] = rgba[p * 4 + 1] / 127.5 - 1;
    saida[o++] = rgba[p * 4 + 2] / 127.5 - 1;
  }
  return saida;
}

export function normalizarL2(vetor) {
  let soma = 0;
  for (const v of vetor) soma += v * v;
  const norma = Math.sqrt(soma);
  return norma > 0 ? Array.from(vetor, v => v / norma) : Array.from(vetor);
}

export function similaridadeCosseno(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

// Cadastro: média das capturas (3 a 5 fotos), normalizada.
export function vetorDoCadastro(capturas) {
  if (!capturas?.length) throw new Error("Cadastro sem capturas.");
  const media = new Array(capturas[0].length).fill(0);
  for (const c of capturas) for (let i = 0; i < c.length; i++) media[i] += c[i] / capturas.length;
  return normalizarL2(media);
}

// Identificação 1:N. Só aceita quando o melhor passa do limiar E está
// claramente à frente do segundo - dois parecidos (irmãos, por exemplo) não
// viram uma batida no nome errado; vai para o encarregado.
export const LIMIAR_RECONHECIMENTO = 0.6;
export const MARGEM_SOBRE_SEGUNDO = 0.08;
export function identificar(vetor, cadastros, { limiar = LIMIAR_RECONHECIMENTO, margem = MARGEM_SOBRE_SEGUNDO } = {}) {
  const ranking = (cadastros || [])
    .map(c => ({ employeeId: c.employeeId, similaridade: similaridadeCosseno(vetor, c.vetor) }))
    .sort((a, b) => b.similaridade - a.similaridade);
  const [melhor, segundo] = ranking;
  if (!melhor || melhor.similaridade < limiar) return { reconhecido: false, motivo: "rosto não cadastrado nesta obra", melhor: melhor || null };
  if (segundo && melhor.similaridade - segundo.similaridade < margem) return { reconhecido: false, motivo: "rosto parecido com mais de um cadastro", melhor };
  return { reconhecido: true, employeeId: melhor.employeeId, confianca: Number(melhor.similaridade.toFixed(4)) };
}
