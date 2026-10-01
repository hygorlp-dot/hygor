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
import { PARAMETROS_FACIAIS as P } from "../logica/calibracao.js";
import { fotoDentroDoLimite } from "../logica/foto.js";

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
  if (!String(asset.localUri || "").startsWith("file://")) throw new Error("modelo de rosto sem cópia local (file://)");
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
  // O recorte do rosto também vira arquivo no cache: apaga na hora.
  apagarFotoLocal(salvo.uri);
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
  if (rostos.length > 1 && rostos[1].score > P.segundoRostoScoreMaximo) return { erro: "Uma pessoa por vez na frente da câmera." };
  const rosto = rostos[0];
  const larguraRosto = rosto.caixa.x2 - rosto.caixa.x1;
  if (larguraRosto < P.larguraMinimaRosto) return { erro: "Chegue um pouco mais perto da câmera." };

  // 2. Recorte alinhado pelos olhos, em pixels da foto original.
  const { olhoEsquerdo, olhoDireito } = olhosENariz(rosto);
  const emPixels = p => ({ x: ox + p.x * lado, y: oy + p.y * lado });
  const r = recorteParaIdentidade(emPixels(olhoEsquerdo), emPixels(olhoDireito));
  // O recorte não é girado: a inclinação só é tolerada até o limite.
  if (Math.abs(r.anguloGraus) > P.inclinacaoMaximaGraus) return { erro: "Deixe a cabeça reta, olhando para a câmera." };
  const t = Math.min(r.tamanho, foto.width, foto.height);
  const recorte = {
    originX: limitar(r.cx - t / 2, 0, foto.width - t),
    originY: limitar(r.cy - t / 2, 0, foto.height - t),
    width: t, height: t,
  };

  // 3. Vetor de identidade.
  const pixelsRosto = await pixelsDoRecorte(foto.uri, recorte, MOBILEFACENET.tamanho);
  const [saida] = await modelos.identidade.run([pixelsParaTensor(pixelsRosto, MOBILEFACENET.tamanho, MOBILEFACENET.tamanho).buffer]);
  return { vetor: normalizarL2(new Float32Array(saida)), giro: giroDaCabeca(rosto), confiancaDeteccao: rosto.score, larguraRosto };
}

// Foto da batida: JPEG dentro do limite do servidor (logica/foto.js),
// guardada na pasta de documentos do app até o envio. O SHA-256 que vai na
// batida é o dos bytes EXATOS do arquivo guardado - o mesmo que será enviado.
// Qualquer falha aqui (ex.: armazenamento cheio) lança: quem chama registra a
// batida sem foto e avisa (a batida nunca depende da foto).
export async function prepararFotoDaBatida(uri, larguraOriginal) {
  const escolhida = await fotoDentroDoLimite({
    async gerar({ largura, qualidade }) {
      const contexto = ImageManipulator.manipulate(uri);
      // Não aumenta foto menor que o alvo.
      contexto.resize({ width: larguraOriginal ? Math.min(largura, larguraOriginal) : largura });
      const imagem = await contexto.renderAsync();
      const salvo = await imagem.saveAsync({ format: SaveFormat.JPEG, compress: qualidade });
      const arquivo = new File(salvo.uri);
      return { arquivo, bytes: await arquivo.bytes() };
    },
    async descartar(gerada) { try { gerada?.arquivo?.delete(); } catch { /* tentativa descartada */ } },
  });
  const sha256 = hex(await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, escolhida.bytes));
  // Sai do cache (que o Android pode limpar) para a pasta de documentos.
  // move() é assíncrono no SDK 57: sem o await, o caminho guardado podia ser
  // o do cache e a foto "sumia" antes do envio.
  const destino = new File(Paths.document, `batida-${sha256.slice(0, 16)}-${Date.now()}.jpg`);
  await escolhida.arquivo.move(destino);
  if (!destino.exists) throw new Error("a foto não foi gravada no aparelho");
  return { uri: destino.uri, sha256, bytes: escolhida.bytes.length };
}

// null = arquivo não existe mais (a fila marca "sem arquivo" e segue).
export const lerFotoBase64 = async uri => {
  const arquivo = new File(uri);
  return arquivo.exists ? arquivo.base64() : null;
};

// Apaga arquivo de imagem do aparelho: foto da batida depois do OK do
// servidor, capturas cruas da câmera e recortes intermediários do rosto.
export const apagarFotoLocal = uri => {
  if (!uri) return;
  try { const arquivo = new File(uri); if (arquivo.exists) arquivo.delete(); } catch { /* não trava a fila */ }
};
