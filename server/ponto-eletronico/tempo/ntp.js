// Cliente SNTP mínimo (RFC 4330) para MEDIR o desvio do relógio do servidor
// contra servidores rastreáveis à Hora Legal Brasileira (NTP.br stratum 1:
// a.st1.ntp.br ... d.st1.ntp.br, sincronizados com relógios atômicos do
// Observatório Nacional). Não ajusta relógio nenhum: só mede e devolve a
// evidência para ponto_tempo_verificacoes.
//
// A parte de rede (UDP) é injetada; o resto é puro e testado.

export const SERVIDORES_HLB = Object.freeze(["a.st1.ntp.br", "b.st1.ntp.br", "c.st1.ntp.br", "d.st1.ntp.br"]);
const EPOCA_NTP_S = 2_208_988_800;   // 1900-01-01 → 1970-01-01

const escreverTimestamp = (buf, pos, ms) => {
  const seg = Math.floor(ms / 1000) + EPOCA_NTP_S;
  const frac = Math.round(((ms % 1000) / 1000) * 2 ** 32) >>> 0;
  buf.writeUInt32BE(seg >>> 0, pos);
  buf.writeUInt32BE(frac, pos + 4);
};
const lerTimestamp = (buf, pos) => (buf.readUInt32BE(pos) - EPOCA_NTP_S) * 1000 + (buf.readUInt32BE(pos + 4) / 2 ** 32) * 1000;

// Pedido cliente: LI=0, versão 4, modo 3; transmit = t0 (volta como originate).
export function montarPedidoNtp(t0Ms) {
  const b = Buffer.alloc(48);
  b[0] = (0 << 6) | (4 << 3) | 3;
  escreverTimestamp(b, 40, t0Ms);
  return b;
}

// Desvio e atraso (RFC 4330): t0 envio, t1 chegada no servidor, t2 saída do
// servidor, t3 chegada de volta (t0/t3 no relógio local).
export function calcularOffsetNtp(t0, t1, t2, t3) {
  return { offsetMs: ((t1 - t0) + (t2 - t3)) / 2, atrasoMs: (t3 - t0) - (t2 - t1) };
}

export function lerRespostaNtp(buf, t0Ms, t3Ms) {
  if (!Buffer.isBuffer(buf) || buf.length < 48) throw new Error("resposta NTP curta");
  const li = buf[0] >> 6, modo = buf[0] & 7, estrato = buf[1];
  if (modo !== 4) throw new Error(`resposta NTP com modo ${modo}`);
  if (li === 3 || estrato === 0) throw new Error("servidor NTP sem sincronismo (kiss-o'-death/alarme)");
  const originate = lerTimestamp(buf, 24);
  if (Math.abs(originate - t0Ms) > 1) throw new Error("resposta NTP não corresponde ao pedido");
  const t1 = lerTimestamp(buf, 32), t2 = lerTimestamp(buf, 40);
  const { offsetMs, atrasoMs } = calcularOffsetNtp(t0Ms, t1, t2, t3Ms);
  // Dispersão raiz (bytes 8-11, formato 16.16 s) + metade do atraso = incerteza.
  const dispersaoMs = (buf.readUInt32BE(8) / 65536) * 1000;
  return { offsetMs, atrasoMs, estrato, incertezaMs: dispersaoMs + Math.max(0, atrasoMs) / 2 };
}

// enviarUdp({ host, porta, pacote, timeoutMs }) -> Promise<Buffer> (injetado:
// dgram no servidor, falso nos testes). relogio: () => ms do host.
export async function consultarNtp({ servidor, enviarUdp, relogio = () => Date.now(), porta = 123, timeoutMs = 3000 }) {
  const t0 = relogio();
  const resposta = await enviarUdp({ host: servidor, porta, pacote: montarPedidoNtp(t0), timeoutMs });
  const t3 = relogio();
  return { servidor, verificadoEm: new Date(t3).toISOString(), ...lerRespostaNtp(resposta, t0, t3) };
}

// Consulta vários servidores e fica com a medição de menor atraso (a mais
// precisa). Falha de todos = verificação "ok: false" com o erro.
export async function verificarHora({ servidores = SERVIDORES_HLB, enviarUdp, relogio = () => Date.now(), timeoutMs = 3000 }) {
  const medidas = [], erros = [];
  for (const servidor of servidores) {
    try { medidas.push(await consultarNtp({ servidor, enviarUdp, relogio, timeoutMs })); }
    catch (e) { erros.push(`${servidor}: ${String(e?.message || e).slice(0, 80)}`); }
  }
  if (!medidas.length) return { ok: false, servidor: servidores.join(","), verificadoEm: new Date(relogio()).toISOString(), erro: erros.join("; ") || "sem servidores" };
  const melhor = medidas.sort((a, b) => a.atrasoMs - b.atrasoMs)[0];
  return { ok: true, ...melhor, erro: erros.length ? erros.join("; ") : null };
}

// UDP real (Node dgram), usado por api/data.js. Se o ambiente bloquear UDP
// de saída, a verificação volta "ok: false" e a evidência mostra isso.
export function enviarUdpComDgram(dgram) {
  return ({ host, porta, pacote, timeoutMs }) => new Promise((resolve, reject) => {
    const s = dgram.createSocket("udp4");
    const fim = erro => { clearTimeout(t); try { s.close(); } catch { /* fechado */ } if (erro) reject(erro); };
    const t = setTimeout(() => fim(new Error("tempo esgotado")), timeoutMs);
    s.once("error", fim);
    s.once("message", msg => { fim(null); resolve(msg); });
    s.send(pacote, porta, host, e => { if (e) fim(e); });
  });
}
