import { exigir, fixo, texto, numero, cpf, identificacao, periodo, dh, validarDh, inpi, crc16Kermit, sha256, arquivoLinhas, ASSINATURA_EXTERNA, pacoteNaoAssinado } from "./campos.js";

export const VERSAO_AFD = "004";
const n = (v, width, field) => fixo(numero(v, width, field), width, field);
const crc = line => line + crc16Kermit(line);
function inscricaoObra(e) {
  exigir(!(e.cno && e.caepf), "CNO_E_CAEPF_SIMULTANEOS");
  const value = e.cno || e.caepf || "";
  exigir(!value || new RegExp("^\\d{" + (e.cno ? 12 : 14) + "}$").test(value), "INSCRICAO_OBRA_INVALIDA");
  return fixo(value, 14, "cnoCaepf", true);
}
export function cabecalhoAfd({ empregador, rep, de, ate, geradoEm }) {
  periodo(de, ate);
  const [tipo, id] = identificacao(empregador);
  const [tipoDev, dev] = identificacao(rep.desenvolvedor, "desenvolvedor");
  return crc("0000000001" + tipo + fixo(id, 14, "empregador") + inscricaoObra(empregador)
    + fixo(texto(empregador.nome, 150, "nomeEmpregador"), 150, "nomeEmpregador")
    + fixo(inpi(rep.inpi), 17, "inpi") + de + ate + dh(geradoEm, empregador.timezone)
    + VERSAO_AFD + tipoDev + fixo(dev, 14, "desenvolvedor") + " ".repeat(30));
}
export function registroAfd(registro, timezone, previousHash = "") {
  const r = registro;
  exigir([2, 4, 5, 6, 7].includes(r.tipo), "TIPO_AFD_NAO_SUPORTADO");
  let line = n(numero(r.nsr, 9, "nsr", 1), 9, "nsr") + r.tipo;
  if (r.tipo === 2) {
    const [type, id] = identificacao(r.empregador);
    line += dh(r.gravadoEm, timezone) + fixo(cpf(r.responsavelCpf), 14, "responsavelCpf") + type + fixo(id, 14, "empregador")
      + inscricaoObra(r.empregador) + fixo(texto(r.empregador.nome, 150, "nome"), 150, "nome")
      + fixo(texto(r.local, 100, "local"), 100, "local");
    return { linha: crc(line) };
  }
  if (r.tipo === 4) return { linha: crc(line + dh(r.antes, timezone) + dh(r.depois, timezone) + cpf(r.responsavelCpf)) };
  if (r.tipo === 5) {
    exigir(["I", "A", "E"].includes(r.operacao), "OPERACAO_EMPREGADO_INVALIDA");
    line += dh(r.gravadoEm, timezone) + r.operacao + fixo(cpf(r.cpf), 12, "cpf")
      + fixo(texto(r.nome, 52, "nome"), 52, "nome") + fixo(r.demaisDados || "", 4, "demaisDados", true) + cpf(r.responsavelCpf);
    return { linha: crc(line) };
  }
  if (r.tipo === 6) {
    exigir(["02", "07", "08"].includes(r.evento), "EVENTO_SENSIVEL_INVALIDO");
    return { linha: line + dh(r.gravadoEm, timezone) + r.evento };
  }
  exigir(["01", "02", "03", "04", "05"].includes(r.coletor), "COLETOR_AUSENTE_OU_INVALIDO");
  exigir(typeof r.offline === "boolean", "MODO_CAPTURA_AUSENTE");
  exigir(previousHash === "" || /^[a-f0-9]{64}$/i.test(previousHash), "HASH_ANTERIOR_INVALIDO");
  line += dh(r.marcadoEm, timezone) + fixo(cpf(r.cpf), 12, "cpf") + dh(r.gravadoEm, timezone) + r.coletor + (r.offline ? "1" : "0");
  const hash = sha256(Buffer.from(line + previousHash, "latin1"));
  return { linha: line + hash, hash };
}
export function gerarAfd({ empregador, rep, registros, de, ate, geradoEm }) {
  exigir(Array.isArray(registros), "REGISTROS_AUSENTES");
  // A ARP atual não fornece o histórico administrativo com hash fiscal AFD.
  // Não adotar por suposição um encadeamento entre tipos heterogêneos.
  exigir(!registros.some(r => r.tipo === 7) || registros.every(r => r.tipo === 7), "CADEIA_AFD_MISTA_REQUER_VALIDACAO");
  const header = cabecalhoAfd({ empregador, rep, de, ate, geradoEm });
  // A cadeia de origem inteira é necessária. Nunca reiniciar hash no começo do filtro.
  const sorted = [...registros].sort((a, b) => Number(a.nsr) - Number(b.nsr));
  let previousHash = "", previousNsr = 0, hashAnteriorAoPeriodo = null;
  const counts = Object.fromEntries([2, 3, 4, 5, 6, 7].map(t => [t, 0]));
  const lines = [header], hashes = {};
  for (const r of sorted) {
    exigir(Number(r.nsr) === previousNsr + 1, "CADEIA_NSR_INCOMPLETA");
    previousNsr = Number(r.nsr);
    const before = previousHash;
    const result = registroAfd(r, empregador.timezone, previousHash);
    if (result.hash) { previousHash = result.hash; hashes[r.nsr] = result.hash; }
    // Anteriores ao período participam da cadeia, mas não da contagem/arquivo.
    const date = dh(r.tipo === 4 ? r.depois : r.gravadoEm, empregador.timezone).slice(0, 10);
    if (date >= de && date <= ate) {
      if (hashAnteriorAoPeriodo === null) hashAnteriorAoPeriodo = before;
      lines.push(result.linha); counts[r.tipo]++;
    }
  }
  lines.push("999999999" + [2, 3, 4, 5, 6, 7].map(t => n(counts[t], 9, "contador")).join("") + "9", ASSINATURA_EXTERNA);
  return pacoteNaoAssinado("AFD" + rep.inpi + empregador.numero + "REP_P.txt", arquivoLinhas(lines), { versaoLeiaute: VERSAO_AFD, hashes, hashAnteriorAoPeriodo: hashAnteriorAoPeriodo || "", criterioPeriodo: "gravacao_na_arp", contagens: counts });
}

// Valida bytes independentemente do modelo que gerou o arquivo.
export function validarAfd(bytes, { hashAnterior = "" } = {}) {
  const erros = [];
  const lines = Buffer.from(bytes).toString("latin1").split("\r\n");
  if (lines.pop() !== "" || lines.some(l => !l || /[\r\n]/.test(l))) return { ok: false, erros: ["QUEBRA_LINHA_INVALIDA"] };
  const header = lines.shift(), signature = lines.pop(), trailer = lines.pop();
  if (header?.length !== 302 || !header.startsWith("0000000001") || header.slice(250, 253) !== "004" || crc16Kermit(header.slice(0, -4)) !== header.slice(-4)) erros.push("CABECALHO_INVALIDO");
  try {
    identificacao({ tipo: header[10] === "1" ? "cnpj" : header[10] === "2" ? "cpf" : "", numero: header.slice(11, 25).trim() });
    identificacao({ tipo: header[253] === "1" ? "cnpj" : header[253] === "2" ? "cpf" : "", numero: header.slice(254, 268).trim() });
    inpi(header.slice(189, 206).trim()); periodo(header.slice(206, 216), header.slice(216, 226)); validarDh(header.slice(226, 250));
  } catch { erros.push("DADOS_CABECALHO_INVALIDOS"); }
  if (signature !== ASSINATURA_EXTERNA) erros.push("MARCADOR_ASSINATURA_INVALIDO");
  const counts = Object.fromEntries([2, 3, 4, 5, 6, 7].map(t => [t, 0]));
  let nsr = 0, previousHash = hashAnterior;
  for (const line of lines) {
    const type = Number(line[9]), current = Number(line.slice(0, 9).trim());
    if (!Number.isSafeInteger(current) || current <= nsr) erros.push("NSR_FORA_DE_ORDEM");
    nsr = current;
    const sizes = { 2: 331, 4: 73, 5: 118, 6: 36, 7: 137 };
    if (line.length !== sizes[type]) erros.push("TAMANHO_REGISTRO_INVALIDO");
    if ([2, 4, 5].includes(type) && crc16Kermit(line.slice(0, -4)) !== line.slice(-4)) erros.push("CRC_INVALIDO");
    if (type === 7) {
      try {
        validarDh(line.slice(10, 34)); cpf(line.slice(34, 46).trim()); validarDh(line.slice(46, 70));
        exigir(["01", "02", "03", "04", "05"].includes(line.slice(70, 72)) && ["0", "1"].includes(line[72]), "COLETOR_OU_MODO_INVALIDO");
      } catch { erros.push("DADOS_MARCACAO_INVALIDOS"); }
      const expected = sha256(Buffer.from(line.slice(0, 73) + previousHash, "latin1"));
      if (expected !== line.slice(73)) erros.push("HASH_AFD_INVALIDO");
      previousHash = line.slice(73);
    }
    if (type in counts) counts[type]++; else erros.push("TIPO_INVALIDO");
  }
  const expectedTrailer = "999999999" + [2, 3, 4, 5, 6, 7].map(t => String(counts[t]).padEnd(9, " ")).join("") + "9";
  if (trailer !== expectedTrailer) erros.push("TRAILER_INVALIDO");
  return { ok: erros.length === 0, erros, contagens: counts, assinaturaVerificada: false };
}
