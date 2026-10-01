// Reconhecimento facial no aparelho: foto da câmera → BlazeFace (onde está o
// rosto e os olhos) → recorte alinhado → MobileFaceNet (vetor de 192).
// A matemática está em src/logica/rosto.js (testada); aqui só a parte que
// depende do React Native: modelos TFLite, recorte/redução e pixels.
import { loadTensorflowModel } from "react-native-fast-tflite";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { Asset } from "expo-asset";
import { File, Paths } from "expo-file-system";
import * as Crypto from "expo-crypto";
import UPNG from "upng-js";
import {
  BLAZEFACE, MOBILEFACENET, decodificarBlazeFace, giroDaCabeca, normalizarL2, olhosENariz,
  pixelsParaTensor, recorteParaIdentidade, rostosDistintos,
} from "../logica/rosto.js";

// SHA-256 dos arquivos de face_detection_tflite (Apache-2.0, ver NOTICE).
// Modelo trocado = app recusa carregar (o reconhecimento é prova de ponto).
const MODELOS = {
  detector: { modulo: require("../../assets/modelos/face_detection_front.tflite"), sha256: "3bc182eb9f33925d9e58b5c8d59308a760f4adea8f282370e428c51212c26633" },
  identidade: { modulo: require("../../assets/modelos/mobilefacenet.tflite"), sha256: "be4bc7cfc53f7bc336d0f28b1ab92535f618c913a422b683210750f6b5354854" },
};

const hex = buffer => Array.from(new Uint8Array(buffer), b => b.toString(16).padStart(2, "0")).join("");

// No APK de produção o require() vira um recurso interno
// ("assets_modelos_..."), que o TFLite não abre como URL; por isso o modelo é
// carregado da cópia file:// que o expo-asset faz - a mesma que teve o SHA conferido.
async function carregarConferido({ modulo, sha256 }) {
  const asset = Asset.fromModule(modulo);
  await asset.downloadAsync();
  const bytes = await new File(asset.localUri).bytes();
  const calculado = hex(await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, bytes));
  if (calculado !== sha256) throw new Error("Os arquivos de reconhecimento facial deste app foram alterados. Reinstale o Ponto de Obra.");
  return loadTensorflowModel({ url: asset.localUri }, []);
}

export async function carregarModelos() {
  const [detector, identidade] = await Promise.all([carregarConferido(MODELOS.detector), carregarConferido(MODELOS.identidade)]);
  return { detector, identidade, modelo: MOBILEFACENET.modelo };
}

const base64ParaBuffer = b64 => {
  const binario = atob(b64);
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return bytes.buffer;
};

// Recorta e reduz para um quadrado `tamanho`x`tamanho` e devolve os pixels RGBA.
async function pixelsDoRecorte(uri, recorte, tamanho) {
  const contexto = ImageManipulator.manipulate(uri);
  contexto.crop(recorte);
  contexto.resize({ width: tamanho, height: tamanho });
  const imagem = await contexto.renderAsync();
  const salvo = await imagem.saveAsync({ format: SaveFormat.PNG, base64: true });
  const png = UPNG.decode(base64ParaBuffer(salvo.base64));
  return new Uint8Array(UPNG.toRGBA8(png)[0]);
}

const limitar = (v, min, max) => Math.max(min, Math.min(max, v));

// foto = { uri, width, height } (takePictureAsync). Devolve o vetor do rosto
// e o giro da cabeça, ou { erro } com uma instrução para a pessoa.
export async function analisarFoto(modelos, foto) {
  // 1. Detecção no quadrado central (o rosto fica no meio na tela de batida).
  const lado = Math.min(foto.width, foto.height);
  const ox = (foto.width - lado) / 2, oy = (foto.height - lado) / 2;
  const rgba = await pixelsDoRecorte(foto.uri, { originX: ox, originY: oy, width: lado, height: lado }, BLAZEFACE.tamanho);
  const saidas = (await modelos.detector.run([pixelsParaTensor(rgba, BLAZEFACE.tamanho, BLAZEFACE.tamanho).buffer])).map(s => new Float32Array(s));
  const caixas = saidas.find(s => s.length === BLAZEFACE.ancoras * BLAZEFACE.valoresPorCaixa);
  const scores = saidas.find(s => s.length === BLAZEFACE.ancoras);
  if (!caixas || !scores) throw new Error("Modelo de detecção com saída inesperada.");
  const rostos = rostosDistintos(decodificarBlazeFace(scores, caixas));
  if (!rostos.length) return { erro: "Não encontrei um rosto. Olhe para a câmera." };
  if (rostos.length > 1 && rostos[1].score > 0.75) return { erro: "Uma pessoa por vez na frente da câmera." };
  const rosto = rostos[0];
  if (rosto.caixa.x2 - rosto.caixa.x1 < 0.22) return { erro: "Chegue um pouco mais perto da câmera." };

  // 2. Recorte alinhado pelos olhos, em pixels da foto original.
  const { olhoEsquerdo, olhoDireito } = olhosENariz(rosto);
  const emPixels = p => ({ x: ox + p.x * lado, y: oy + p.y * lado });
  const r = recorteParaIdentidade(emPixels(olhoEsquerdo), emPixels(olhoDireito));
  if (Math.abs(r.anguloGraus) > 15) return { erro: "Deixe a cabeça reta, olhando para a câmera." };
  const t = Math.min(r.tamanho, foto.width, foto.height);
  const recorte = {
    originX: limitar(r.cx - t / 2, 0, foto.width - t),
    originY: limitar(r.cy - t / 2, 0, foto.height - t),
    width: t, height: t,
  };

  // 3. Vetor de identidade.
  const pixelsRosto = await pixelsDoRecorte(foto.uri, recorte, MOBILEFACENET.tamanho);
  const [saida] = await modelos.identidade.run([pixelsParaTensor(pixelsRosto, MOBILEFACENET.tamanho, MOBILEFACENET.tamanho).buffer]);
  return { vetor: normalizarL2(new Float32Array(saida)), giro: giroDaCabeca(rosto), confiancaDeteccao: rosto.score };
}

// Foto da batida: guardada no aparelho até o envio; o hash vai na batida.
export async function prepararFotoDaBatida(uri) {
  const contexto = ImageManipulator.manipulate(uri);
  contexto.resize({ width: 480 });
  const imagem = await contexto.renderAsync();
  const salvo = await imagem.saveAsync({ format: SaveFormat.JPEG, compress: 0.7 });
  const arquivo = new File(salvo.uri);
  const sha256 = hex(await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, await arquivo.bytes()));
  // Sai do cache (que o Android pode limpar) para a pasta de documentos do
  // app até ser enviada.
  arquivo.move(Paths.document);
  return { uri: arquivo.uri, sha256 };
}

export const lerFotoBase64 = async uri => {
  const arquivo = new File(uri);
  return arquivo.exists ? arquivo.base64() : null;
};

// Depois de aceita pelo servidor, a foto não precisa mais ficar no aparelho.
export const apagarFotoLocal = uri => {
  try { const arquivo = new File(uri); if (arquivo.exists) arquivo.delete(); } catch { /* não trava a fila */ }
};
