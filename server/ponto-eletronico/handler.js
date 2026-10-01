// Ações do app "Ponto de Obra" (REP-P) - despachadas por api/data.js para
// toda action que começa com "ponto-" (sem criar uma rota nova na Vercel).
//
// Dois tipos de chamador:
// - ARCD (usuário logado): parear/revogar aparelho, PIN de responsável,
//   consultar marcações e situação da biometria;
// - aparelho da obra (token próprio, Authorization: Bearer): parear,
//   sincronizar cadastro e hora, enviar marcações, fotos e biometria.
//
// Funcionários vêm da base única do ARCD (data.employees) - o app não tem
// cadastro próprio.
//
// Registros de ponto (docs/REP-P-ARQUITETURA.md):
// - formato 2 (atual): o aparelho manda EVENTOS com sequência local; a ARP
//   (./arp/) atribui o NSR fiscal POR ESTABELECIMENTO numa transação do banco
//   (ponto_arp_registrar, migration 017) e responde por evento;
// - formato 1 (LEGADO, apps antigos): "nsr" por aparelho em ponto_marcacoes
//   (migration 016) - continua aceito para não perder batida, sem NSR fiscal.
// A hora vem da fonte de hora oficial (./tempo/), não de new Date() solto.
import crypto from "node:crypto";
import { calcularHashMarcacao, validarMarcacao, verificarCadeia, HASH_INICIAL, sequenciaLegadaDoAparelho } from "../../src/domains/ponto-eletronico/marcacao.js";
import { funcionariosDaObra, terceirizadosDaObra } from "../../src/domains/ponto-eletronico/funcionarios.js";
import { LIMITE_FOTO_BYTES } from "../../src/domains/ponto-eletronico/foto.js";
import { validarEstabelecimento, pendenciasFiscais } from "../../src/domains/ponto-eletronico/estabelecimento.js";
import { situacaoRepP } from "../../src/domains/ponto-eletronico/rep-p.js";
import { criarArp } from "./arp/arp.js";
import { POLITICA_PADRAO, criarFonteHora } from "./tempo/fonte-hora.js";

export const BUCKET_PONTO = "ponto-obra";
export const PAPEIS_GESTAO = new Set(["admin", "rh", "engenheiro"]);
export const PAPEIS_CONSULTA = new Set(["admin", "rh", "engenheiro", "engenheiro_auditor", "financeiro"]);
// Dados fiscais do estabelecimento (inscrição, CNO...): só admin e RH.
export const PAPEIS_FISCAL = new Set(["admin", "rh"]);
export const PIN_ITERACOES = 60000;
const VALIDADE_CODIGO_MS = 30 * 60 * 1000;
const MAX_MARCACOES_POR_LOTE = 500;
const MAX_FOTO_BYTES = LIMITE_FOTO_BYTES;  // mesmo limite que o app respeita antes de enviar

const sha256 = valor => crypto.createHash("sha256").update(valor).digest("hex");
const texto = v => String(v ?? "").trim();
const erro = (status, mensagem, extra = {}) => ({ status, json: { error: mensagem, ...extra } });
const ok = json => ({ status: 200, json });

export const gerarCodigoPareamento = () => String(crypto.randomInt(0, 100_000_000)).padStart(8, "0");
export const gerarTokenAparelho = () => crypto.randomBytes(32).toString("base64url");
export const hashPin = (pin, salt, iteracoes = PIN_ITERACOES) =>
  crypto.pbkdf2Sync(String(pin), String(salt), iteracoes, 32, "sha256").toString("hex");

const decodificarFoto = base64 => {
  const limpo = texto(base64).replace(/^data:image\/jpeg;base64,/, "");
  if (!limpo) return null;
  const buffer = Buffer.from(limpo, "base64");
  if (buffer.length < 2 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return { invalida: "a foto precisa ser JPEG" };
  if (buffer.length > MAX_FOTO_BYTES) return { invalida: "foto acima de 1,5 MB" };
  return { buffer, sha256: sha256(buffer) };
};

// Identificação do aparelho que o app manda (ponto-parear / ponto-sincronizar):
// só campos conhecidos, texto curto - nada pessoal e nada arbitrário no banco.
const CAMPOS_APARELHO = ["marca", "modelo", "android", "build", "commit"];
export const limparAparelho = bruto => Object.fromEntries(CAMPOS_APARELHO
  .filter(k => bruto && typeof bruto === "object" && bruto[k] !== undefined && bruto[k] !== null && texto(bruto[k]))
  .map(k => [k, texto(bruto[k]).slice(0, 80)]));
const limparVersao = v => texto(v).slice(0, 40);

const linhaDispositivo = d => ({
  id: d.id, obraId: d.obra_id, nome: d.nome, status: d.status, appVersao: d.app_versao,
  aparelho: d.aparelho || {}, ultimoContatoEm: d.ultimo_contato_em, ultimoGps: d.ultimo_gps,
  estabelecimentoId: d.estabelecimento_id || null,
  // Sequência LOCAL do aparelho (não é NSR). A "legada" é a do formato 1.
  ultimaSequenciaLocal: Number(d.ultima_sequencia_local || 0), ultimaSequenciaLegada: Number(d.ultimo_nsr || 0),
  criadoEm: d.criado_em, criadoPor: d.criado_por, revogadoEm: d.revogado_em,
});

// Formato 1 (LEGADO): o "nsr" gravado era a sequência do aparelho - sai como
// sequência local; NSR fiscal não existe para esses registros.
const linhaMarcacao = m => ({
  id: m.id, eventId: m.id, formato: 1, dispositivoId: m.dispositivo_id, obraId: m.obra_id,
  nsr: null, localSequence: sequenciaLegadaDoAparelho(m), legacyDeviceSequence: sequenciaLegadaDoAparelho(m),
  estabelecimentoId: null, fiscalHash: null, situacaoFiscal: "legado_sem_nsr",
  tipoRegistro: m.tipo_registro,
  employeeId: m.employee_id, terceiroId: m.terceiro_id, marcadoEm: m.marcado_em, horaConfiavel: m.hora_confiavel,
  relogioAlterado: m.relogio_alterado, metodo: m.metodo, confianca: m.confianca === null ? null : Number(m.confianca),
  encarregadoId: m.encarregado_id, gps: m.gps, temFoto: !!m.foto_sha256, recebidoEm: m.recebido_em,
});

// Formato 2: evento local + (se for ponto aceito) registro fiscal da ARP.
const linhaEvento = ({ evento: e, fiscal: f }) => ({
  id: e.event_id, eventId: e.event_id, formato: 2, dispositivoId: e.dispositivo_id, obraId: e.obra_id,
  nsr: f ? Number(f.nsr) : null, localSequence: Number(e.local_sequence), estabelecimentoId: e.estabelecimento_id || null,
  fiscalHash: f?.fiscal_hash || null, gravadoEm: f?.gravado_em || null,
  situacaoFiscal: f ? "registrado" : e.tipo_registro === "acesso_terceiro" ? "acesso_sem_nsr" : "sem_nsr",
  tipoRegistro: e.tipo_registro, employeeId: e.employee_id, terceiroId: e.terceiro_id, marcadoEm: e.marcado_em,
  horaConfiavel: e.hora_confiavel, relogioAlterado: e.relogio_alterado, fonteHora: e.fonte_hora,
  idadeReferenciaMs: e.idade_referencia_ms === null ? null : Number(e.idade_referencia_ms),
  metodo: e.metodo, confianca: e.confianca === null ? null : Number(e.confianca),
  encarregadoId: e.encarregado_id, gps: e.gps, temFoto: !!e.foto_sha256, recebidoEm: e.recebido_em,
});

const linhaEstabelecimento = (e, obras = []) => ({
  id: e.id, nome: e.nome, tipoInscricao: e.tipo_inscricao, numeroInscricao: e.numero_inscricao,
  cno: e.cno, caepf: e.caepf, cei: e.cei, timezone: e.timezone, ativo: e.ativo, obras,
});

const caminhoFotoMarcacao = (obraId, marcadoEm, id) => `marcacoes/${obraId}/${String(marcadoEm).slice(0, 10)}/${id}.jpg`;

// fonteHora: fonte de hora oficial (tempo/fonte-hora.js). Sem ela, monta a
// padrão (relógio do host + última verificação NTP gravada). "agora" só
// existe para os testes fixarem o relógio do host.
// verificarHoraNtp: async () => medição (tempo/ntp.js verificarHora), usada
// pela ação ponto-tempo-verificar.
export function criarTratadorPonto({ db, company, autenticarUsuario, lerDados, agora: agoraDoHost, fonteHora, verificarHoraNtp, politicaHora = POLITICA_PADRAO }) {
  const fonte = fonteHora || criarFonteHora({
    relogioHost: agoraDoHost ? () => agoraDoHost().getTime() : () => Date.now(),
    politica: politicaHora,
    ultimaVerificacao: async () => {
      const { data, error } = await db.from("ponto_tempo_verificacoes").select("*").eq("ok", true).order("verificado_em", { ascending: false }).limit(1);
      if (error) throw error;
      const v = data?.[0];
      return v ? { ok: true, servidor: v.servidor, verificadoEm: v.verificado_em, offsetMs: Number(v.offset_ms), incertezaMs: v.incerteza_ms === null ? null : Number(v.incerteza_ms) } : null;
    },
  });
  const agora = () => fonte.agora();
  const arp = criarArp({ db, company, fonteHora: fonte, hashFn: sha256 });

  // Estabelecimento do aparelho: o já fixado nele, ou o da obra (vínculo do
  // ARCD). Obra sem vínculo = sem estabelecimento (as batidas esperam no
  // aparelho; nunca se usa a obra como estabelecimento).
  const estabelecimentoDoAparelho = async dispositivo => {
    let id = dispositivo.estabelecimento_id || null;
    if (!id) {
      const { data, error } = await db.from("ponto_estabelecimento_obras").select("estabelecimento_id")
        .eq("company_id", company).eq("obra_id", dispositivo.obra_id).maybeSingle();
      if (error) throw error;
      id = data?.estabelecimento_id || null;
    }
    if (!id) return null;
    const { data: e, error } = await db.from("ponto_estabelecimentos").select("*").eq("company_id", company).eq("id", id).maybeSingle();
    if (error) throw error;
    return e ? { id: e.id, nome: e.nome, ativo: e.ativo, timezone: e.timezone } : null;
  };

  const doUsuario = async (body, papeis) => {
    const usuario = await autenticarUsuario(body);
    if (!usuario) return { falha: erro(401, "Sessão inválida.") };
    if (!papeis.has(usuario.role)) return { falha: erro(403, "Seu perfil não pode gerenciar o ponto eletrônico.") };
    return { usuario };
  };

  const doAparelho = async (headers, body) => {
    const bruto = texto(headers?.authorization).replace(/^Bearer\s+/i, "") || texto(body?.tokenAparelho);
    if (!bruto) return { falha: erro(401, "Aparelho não identificado.", { code: "APARELHO_SEM_TOKEN" }) };
    const { data, error } = await db.from("ponto_dispositivos").select("*").eq("company_id", company).eq("token_hash", sha256(bruto)).maybeSingle();
    if (error) throw error;
    if (!data) return { falha: erro(401, "Aparelho não reconhecido. Pareie de novo pelo ARCD.", { code: "APARELHO_DESCONHECIDO" }) };
    if (data.status !== "ativo") return { falha: erro(403, "Este aparelho foi desativado no ARCD.", { code: "APARELHO_REVOGADO" }) };
    return { dispositivo: data };
  };

  // Evento/marcação para foto: formato 2 (event_id) ou legado (id).
  const localizarParaFoto = async id => {
    if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
    const atual = await arp.localizarEvento(id);
    if (atual) return { id: atual.event_id, obra_id: atual.obra_id, marcado_em: atual.marcado_em, foto_sha256: atual.foto_sha256, dispositivo_id: atual.dispositivo_id };
    const { data, error } = await db.from("ponto_marcacoes").select("id,obra_id,marcado_em,foto_sha256,dispositivo_id")
      .eq("company_id", company).eq("id", id).maybeSingle();
    if (error) throw error;
    return data;
  };

  const acoes = {
    // ---------------- ARCD (usuário) ----------------
    async "ponto-codigo-pareamento"({ body }) {
      const { usuario, falha } = await doUsuario(body, PAPEIS_GESTAO);
      if (falha) return falha;
      const obraId = texto(body.obraId), nome = texto(body.nome) || "Aparelho da obra";
      const dados = await lerDados();
      if (!(dados?.obras || []).some(o => String(o.id) === obraId)) return erro(400, "Obra não encontrada.");
      const codigo = gerarCodigoPareamento();
      const expiraEm = new Date(agora().getTime() + VALIDADE_CODIGO_MS).toISOString();
      const { error } = await db.from("ponto_pareamentos").insert({
        company_id: company, codigo_hash: sha256(codigo), obra_id: obraId, nome, expira_em: expiraEm, criado_por: String(usuario.id),
      });
      if (error) throw error;
      return ok({ codigo, expiraEm, obraId, nome });
    },

    async "ponto-dispositivos"({ body }) {
      const { falha } = await doUsuario(body, PAPEIS_CONSULTA);
      if (falha) return falha;
      let consulta = db.from("ponto_dispositivos").select("*").eq("company_id", company);
      if (texto(body.obraId)) consulta = consulta.eq("obra_id", texto(body.obraId));
      const { data, error } = await consulta.order("criado_em", { ascending: false });
      if (error) throw error;
      return ok({ dispositivos: (data || []).map(linhaDispositivo), servidorMs: agora().getTime() });
    },

    async "ponto-dispositivo-revogar"({ body }) {
      const { usuario, falha } = await doUsuario(body, PAPEIS_GESTAO);
      if (falha) return falha;
      const { error } = await db.from("ponto_dispositivos")
        .update({ status: "revogado", revogado_por: String(usuario.id), revogado_em: agora().toISOString() })
        .eq("company_id", company).eq("id", texto(body.dispositivoId));
      if (error) throw error;
      return ok({ revogado: true });
    },

    async "ponto-marcacoes"({ body }) {
      const { falha } = await doUsuario(body, PAPEIS_CONSULTA);
      if (falha) return falha;
      const de = texto(body.de) || new Date(agora().getTime() - 86_400_000).toISOString();
      const ate = texto(body.ate) || agora().toISOString();
      let consulta = db.from("ponto_marcacoes").select("*").eq("company_id", company).gte("marcado_em", de).lte("marcado_em", ate);
      if (texto(body.obraId)) consulta = consulta.eq("obra_id", texto(body.obraId));
      if (texto(body.employeeId)) consulta = consulta.eq("employee_id", texto(body.employeeId));
      const { data, error } = await consulta.order("marcado_em", { ascending: false }).limit(2000);
      if (error) throw error;
      const atuais = await arp.consultar({ obraId: body.obraId, de, ate, employeeId: body.employeeId });
      const marcacoes = [...atuais.map(linhaEvento), ...(data || []).map(linhaMarcacao)]
        .sort((a, b) => String(b.marcadoEm).localeCompare(String(a.marcadoEm)));
      return ok({ marcacoes, servidorMs: agora().getTime() });
    },

    async "ponto-foto-url"({ body }) {
      const { falha } = await doUsuario(body, PAPEIS_CONSULTA);
      if (falha) return falha;
      const m = await localizarParaFoto(texto(body.marcacaoId));
      if (!m?.foto_sha256) return erro(404, "Marcação sem foto.");
      const assinada = await db.storage.from(BUCKET_PONTO).createSignedUrl(caminhoFotoMarcacao(m.obra_id, m.marcado_em, m.id), 300);
      if (assinada.error) return erro(404, "A foto ainda não chegou do aparelho.");
      return ok({ url: assinada.data.signedUrl, expiraEmSegundos: 300 });
    },

    async "ponto-responsavel-pin"({ body }) {
      const { usuario, falha } = await doUsuario(body, PAPEIS_GESTAO);
      if (falha) return falha;
      const pin = texto(body.pin);
      if (!/^\d{4,8}$/.test(pin)) return erro(400, "O PIN do app deve ter de 4 a 8 números.");
      const userId = texto(body.userId) || String(usuario.id);
      const dados = await lerDados();
      const alvo = (dados?.usuarios || []).find(u => String(u.id) === userId && u.active !== false);
      if (!alvo) return erro(400, "Usuário não encontrado.");
      const salt = crypto.randomBytes(16).toString("hex");
      const obras = Array.isArray(body.obras) ? body.obras.map(String) : [];
      const { error } = await db.from("ponto_responsaveis").upsert({
        company_id: company, user_id: userId, nome: String(alvo.nome || alvo.email || "Responsável"),
        pin_hash: hashPin(pin, salt), pin_salt: salt, pin_iteracoes: PIN_ITERACOES, obras, ativo: true,
        atualizado_por: String(usuario.id), atualizado_em: agora().toISOString(),
      }, { onConflict: "company_id,user_id" });
      if (error) throw error;
      return ok({ salvo: true, userId, obras });
    },

    async "ponto-responsaveis"({ body }) {
      const { falha } = await doUsuario(body, PAPEIS_GESTAO);
      if (falha) return falha;
      const { data, error } = await db.from("ponto_responsaveis").select("user_id,nome,obras,ativo,atualizado_em").eq("company_id", company);
      if (error) throw error;
      return ok({ responsaveis: (data || []).map(r => ({ userId: r.user_id, nome: r.nome, obras: r.obras || [], ativo: r.ativo, atualizadoEm: r.atualizado_em })) });
    },

    async "ponto-biometria-status"({ body }) {
      const { falha } = await doUsuario(body, PAPEIS_CONSULTA);
      if (falha) return falha;
      const { data, error } = await db.from("ponto_biometrias").select("employee_id,criado_em,qualidade,cadastrado_por")
        .eq("company_id", company).order("criado_em", { ascending: false });
      if (error) throw error;
      const ultima = new Map();
      (data || []).forEach(b => { if (!ultima.has(b.employee_id)) ultima.set(b.employee_id, b); });
      return ok({ biometrias: [...ultima.values()].map(b => ({ employeeId: b.employee_id, cadastradaEm: b.criado_em, qualidade: b.qualidade, cadastradoPor: b.cadastrado_por })) });
    },

    async "ponto-biometria-excluir"({ body }) {
      const { falha } = await doUsuario(body, PAPEIS_GESTAO);
      if (falha) return falha;
      // Direito do titular (LGPD) / desligamento: biometria pode ser apagada.
      // As marcações já feitas permanecem (registro legal).
      const { error } = await db.from("ponto_biometrias").delete().eq("company_id", company).eq("employee_id", texto(body.employeeId));
      if (error) throw error;
      return ok({ excluida: true });
    },

    // ---------------- estabelecimento fiscal ----------------
    async "ponto-estabelecimentos"({ body }) {
      const { falha } = await doUsuario(body, PAPEIS_CONSULTA);
      if (falha) return falha;
      const [{ data: ests, error: e1 }, { data: vinc, error: e2 }, { data: conts, error: e3 }] = await Promise.all([
        db.from("ponto_estabelecimentos").select("*").eq("company_id", company).order("nome", { ascending: true }),
        db.from("ponto_estabelecimento_obras").select("obra_id,estabelecimento_id").eq("company_id", company),
        db.from("ponto_arp_contadores").select("estabelecimento_id,ultimo_nsr").eq("company_id", company),
      ]);
      if (e1) throw e1;
      if (e2) throw e2;
      if (e3) throw e3;
      const lista = (ests || []).map(e => {
        const obras = (vinc || []).filter(v => v.estabelecimento_id === e.id).map(v => v.obra_id);
        const l = linhaEstabelecimento(e, obras);
        return { ...l, ultimoNsr: Number((conts || []).find(c => c.estabelecimento_id === e.id)?.ultimo_nsr || 0), pendencias: pendenciasFiscais(l) };
      });
      return ok({ estabelecimentos: lista, repP: situacaoRepP() });
    },

    async "ponto-estabelecimento-salvar"({ body }) {
      const { usuario, falha } = await doUsuario(body, PAPEIS_FISCAL);
      if (falha) return falha;
      const v = validarEstabelecimento(body.estabelecimento || {});
      if (!v.ok) return erro(400, v.erros.join("; "));
      const e = v.estabelecimento;
      const linha = {
        nome: e.nome, tipo_inscricao: e.tipoInscricao, numero_inscricao: e.numeroInscricao,
        cno: e.cno, caepf: e.caepf, cei: e.cei, timezone: e.timezone, ativo: e.ativo,
      };
      if (e.id) {
        const { data, error } = await db.from("ponto_estabelecimentos")
          .update({ ...linha, atualizado_por: String(usuario.id), atualizado_em: agora().toISOString() })
          .eq("company_id", company).eq("id", e.id).select("*");
        if (error) throw error;
        if (!data?.length) return erro(404, "Estabelecimento não encontrado.");
        return ok({ estabelecimento: linhaEstabelecimento(data[0]) });
      }
      const id = crypto.randomUUID();
      const { error } = await db.from("ponto_estabelecimentos").insert({ company_id: company, id, ...linha, criado_por: String(usuario.id) });
      if (error) throw error;
      return ok({ estabelecimento: linhaEstabelecimento({ id, ...linha }) });
    },

    // Liga (ou desliga, com estabelecimentoId vazio) uma obra a um
    // estabelecimento. Aparelho que já gravou registro num estabelecimento
    // fica nele: trocar a obra de estabelecimento depois disso exige parear
    // os aparelhos de novo.
    async "ponto-estabelecimento-vincular-obra"({ body }) {
      const { usuario, falha } = await doUsuario(body, PAPEIS_FISCAL);
      if (falha) return falha;
      const obraId = texto(body.obraId), estabId = texto(body.estabelecimentoId) || null;
      const dados = await lerDados();
      if (!(dados?.obras || []).some(o => String(o.id) === obraId)) return erro(400, "Obra não encontrada.");
      const { data: fixos, error: eF } = await db.from("ponto_dispositivos").select("id,estabelecimento_id")
        .eq("company_id", company).eq("obra_id", obraId);
      if (eF) throw eF;
      if ((fixos || []).some(d => d.estabelecimento_id && d.estabelecimento_id !== estabId)) {
        return erro(409, "Esta obra já tem aparelho com registros em outro estabelecimento. Pareie os aparelhos de novo antes de trocar.");
      }
      if (!estabId) {
        const { error } = await db.from("ponto_estabelecimento_obras").delete().eq("company_id", company).eq("obra_id", obraId);
        if (error) throw error;
        return ok({ obraId, estabelecimentoId: null });
      }
      const { error } = await db.from("ponto_estabelecimento_obras").upsert(
        { company_id: company, obra_id: obraId, estabelecimento_id: estabId, vinculado_por: String(usuario.id), vinculado_em: agora().toISOString() },
        { onConflict: "company_id,obra_id" });
      if (error) throw error;
      return ok({ obraId, estabelecimentoId: estabId });
    },

    // ---------------- fonte de hora ----------------
    async "ponto-tempo-status"({ body }) {
      const { falha } = await doUsuario(body, PAPEIS_CONSULTA);
      if (falha) return falha;
      const { data, error } = await db.from("ponto_tempo_verificacoes").select("*").order("verificado_em", { ascending: false }).limit(10);
      if (error) throw error;
      return ok({ tempo: await fonte.evidencia(), verificacoes: data || [] });
    },

    // Mede o relógio do servidor contra o NTP.br (HLB). Chamada pela rotina
    // agendada (cron) ou por admin. Só grava a medição - não ajusta relógio.
    async "ponto-tempo-verificar"({ body, cron }) {
      if (!cron) {
        const { usuario, falha } = await doUsuario(body, PAPEIS_FISCAL);
        if (falha) return falha;
        if (usuario.role !== "admin") return erro(403, "Só o administrador verifica a hora manualmente.");
      }
      if (!verificarHoraNtp) return erro(501, "Verificação de hora não configurada neste servidor.");
      const v = await verificarHoraNtp();
      const { error } = await db.from("ponto_tempo_verificacoes").insert({
        fonte: "ntp", servidor: texto(v.servidor).slice(0, 200), verificado_em: v.verificadoEm,
        offset_ms: v.ok ? v.offsetMs : null, atraso_ms: v.ok ? v.atrasoMs : null, incerteza_ms: v.ok ? v.incertezaMs : null,
        estrato: v.ok ? v.estrato : null, ok: !!v.ok, erro: v.erro ? texto(v.erro).slice(0, 500) : null,
      });
      if (error) throw error;
      fonte.limparCache();
      return ok({ verificacao: v, tempo: await fonte.evidencia() });
    },

    // ---------------- aparelho da obra ----------------
    async "ponto-parear"({ body }) {
      const codigo = texto(body.codigo).replace(/\D/g, "");
      if (codigo.length !== 8) return erro(400, "O código tem 8 números.");
      const { data: par, error } = await db.from("ponto_pareamentos").select("*")
        .eq("company_id", company).eq("codigo_hash", sha256(codigo)).maybeSingle();
      if (error) throw error;
      if (!par || par.usado_em) return erro(400, "Código inválido ou já usado. Gere outro no ARCD.", { code: "CODIGO_INVALIDO" });
      if (new Date(par.expira_em).getTime() < agora().getTime()) return erro(400, "Código expirado. Gere outro no ARCD.", { code: "CODIGO_EXPIRADO" });
      const token = gerarTokenAparelho();
      const id = crypto.randomUUID();
      // Consome o código ANTES de criar o aparelho, com a condição de ainda
      // não ter sido usado: dois aparelhos com o mesmo código ao mesmo tempo
      // - só um consegue a linha de volta.
      const { data: consumido, error: errUso } = await db.from("ponto_pareamentos")
        .update({ usado_em: agora().toISOString(), dispositivo_id: id })
        .eq("company_id", company).eq("codigo_hash", sha256(codigo)).is("usado_em", null)
        .select("codigo_hash");
      if (errUso) throw errUso;
      if (!consumido?.length) return erro(400, "Código inválido ou já usado. Gere outro no ARCD.", { code: "CODIGO_INVALIDO" });
      const estab = await estabelecimentoDoAparelho({ obra_id: par.obra_id });
      const { error: errIns } = await db.from("ponto_dispositivos").insert({
        company_id: company, id, obra_id: par.obra_id, nome: par.nome, token_hash: sha256(token),
        ...(estab ? { estabelecimento_id: estab.id } : {}),
        status: "ativo", ultimo_nsr: 0, ultimo_hash: HASH_INICIAL,
        app_versao: limparVersao(body.appVersao), aparelho: limparAparelho(body.aparelho),
        criado_por: par.criado_por, ultimo_contato_em: agora().toISOString(),
      });
      if (errIns) throw errIns;
      const dados = await lerDados();
      const obra = (dados?.obras || []).find(o => String(o.id) === String(par.obra_id));
      return ok({ dispositivoId: id, token, obra: { id: par.obra_id, nome: obra?.name || "" }, estabelecimento: estab, nome: par.nome, servidorMs: agora().getTime() });
    },

    async "ponto-sincronizar"({ body, headers }) {
      const { dispositivo, falha } = await doAparelho(headers, body);
      if (falha) return falha;
      const dados = await lerDados();
      const obraId = dispositivo.obra_id;
      const funcionarios = funcionariosDaObra(dados?.employees, obraId);
      const ids = new Set(funcionarios.map(f => f.id));
      const [{ data: bios, error: errBio }, { data: resps, error: errResp }] = await Promise.all([
        db.from("ponto_biometrias").select("employee_id,modelo,vetor,criado_em").eq("company_id", company).order("criado_em", { ascending: false }),
        db.from("ponto_responsaveis").select("user_id,nome,pin_hash,pin_salt,pin_iteracoes,obras,ativo").eq("company_id", company).eq("ativo", true),
      ]);
      if (errBio) throw errBio;
      if (errResp) throw errResp;
      const vigentes = new Map();
      (bios || []).forEach(b => { if (ids.has(b.employee_id) && !vigentes.has(b.employee_id)) vigentes.set(b.employee_id, b); });
      const update = { ultimo_contato_em: agora().toISOString() };
      if (limparVersao(body.appVersao)) update.app_versao = limparVersao(body.appVersao);
      if (body.gps && Number.isFinite(Number(body.gps.lat)) && Number.isFinite(Number(body.gps.lng))) update.ultimo_gps = { lat: Number(body.gps.lat), lng: Number(body.gps.lng), precisao: Number(body.gps.precisao) || null, em: agora().toISOString() };
      if (Object.keys(limparAparelho(body.aparelho)).length) update.aparelho = limparAparelho(body.aparelho);
      const { error: errUp } = await db.from("ponto_dispositivos").update(update).eq("company_id", company).eq("id", dispositivo.id);
      if (errUp) throw errUp;
      const obra = (dados?.obras || []).find(o => String(o.id) === String(obraId));
      const estabelecimento = await estabelecimentoDoAparelho(dispositivo);
      const tempo = await fonte.evidencia();
      return ok({
        servidorMs: tempo.serverTimeMs,
        tempo,
        repP: situacaoRepP(),
        estabelecimento,
        // Topo da cadeia LOCAL já recebida (formato 2) e, para apps antigos, a do formato 1.
        cadeiaLocal: { ultimaSequencia: Number(dispositivo.ultima_sequencia_local || 0), ultimoHash: dispositivo.ultimo_hash_local || HASH_INICIAL },
        dispositivo: { id: dispositivo.id, nome: dispositivo.nome, obraId, ultimoNsr: Number(dispositivo.ultimo_nsr || 0), ultimoHash: dispositivo.ultimo_hash || HASH_INICIAL },
        obra: { id: obraId, nome: obra?.name || "" },
        funcionarios,
        terceirizados: terceirizadosDaObra(dados?.terceirizados, obraId),
        biometrias: [...vigentes.values()].map(b => ({ employeeId: b.employee_id, modelo: b.modelo, vetor: b.vetor, cadastradaEm: b.criado_em })),
        responsaveis: (resps || [])
          .filter(r => !(r.obras || []).length || (r.obras || []).map(String).includes(String(obraId)))
          .map(r => ({ userId: r.user_id, nome: r.nome, pinHash: r.pin_hash, pinSalt: r.pin_salt, pinIteracoes: r.pin_iteracoes })),
      });
    },

    async "ponto-enviar-marcacoes"({ body, headers }) {
      const { dispositivo, falha } = await doAparelho(headers, body);
      if (falha) return falha;
      // Formato 2: { eventos } -> ARP. Resposta POR EVENTO (eventId -> nsr ->
      // fiscalHash); nada de confirmar lote por "último NSR".
      if (Array.isArray(body.eventos)) {
        const { resultados, hora } = await arp.registrarEventos({ dispositivo, eventos: body.eventos });
        if (resultados.some(r => r.status === "dispositivo_revogado")) return erro(403, "Este aparelho foi desativado no ARCD.", { code: "APARELHO_REVOGADO" });
        const { data: d, error: errD } = await db.from("ponto_dispositivos").select("ultima_sequencia_local,ultimo_hash_local")
          .eq("company_id", company).eq("id", dispositivo.id).maybeSingle();
        if (errD) throw errD;
        return ok({
          resultados,
          cadeiaLocal: { ultimaSequencia: Number(d?.ultima_sequencia_local || 0), ultimoHash: d?.ultimo_hash_local || HASH_INICIAL },
          servidorMs: hora.serverTimeMs, tempo: hora,
        });
      }
      // ---- formato 1 (LEGADO) ----
      const lote = Array.isArray(body.marcacoes) ? body.marcacoes.slice(0, MAX_MARCACOES_POR_LOTE) : [];
      if (!lote.length) return ok({ aceitas: 0, ultimoNsr: Number(dispositivo.ultimo_nsr || 0), ultimoHash: dispositivo.ultimo_hash, erro: null, servidorMs: agora().getTime() });
      const doAparelhoCerto = lote.filter(m => texto(m.dispositivoId).toLowerCase() === String(dispositivo.id).toLowerCase());
      if (doAparelhoCerto.length !== lote.length) return erro(400, "Lote contém marcação de outro aparelho.");
      for (const m of lote) {
        const v = validarMarcacao(m);
        if (!v.ok) return erro(400, `Marcação NSR ${m.nsr} inválida: ${v.erros.join("; ")}`, { nsrComErro: Number(m.nsr) || null });
      }
      const cadeia = await verificarCadeia(lote, { nsr: dispositivo.ultimo_nsr, hash: dispositivo.ultimo_hash }, sha256);
      let resultado = { aceitas: 0, ultimo_nsr: dispositivo.ultimo_nsr, ultimo_hash: dispositivo.ultimo_hash, erro: null };
      if (cadeia.aceitas.length) {
        const { data, error } = await db.rpc("ponto_registrar_marcacoes", {
          p_company_id: company, p_dispositivo_id: dispositivo.id,
          p_marcacoes: cadeia.aceitas.map(m => ({ ...m, extra: { recebidoPor: "api/data", divergenciaMs: Number(m.divergenciaMs) || null } })),
        });
        if (error) throw error;
        resultado = Array.isArray(data) ? data[0] : data;
      }
      return ok({
        aceitas: Number(resultado.aceitas || 0), ultimoNsr: Number(resultado.ultimo_nsr || 0), ultimoHash: resultado.ultimo_hash,
        erro: cadeia.erro || resultado.erro || null, nsrComErro: cadeia.nsrComErro, servidorMs: agora().getTime(),
      });
    },

    async "ponto-enviar-foto"({ body, headers }) {
      const { dispositivo, falha } = await doAparelho(headers, body);
      if (falha) return falha;
      const foto = decodificarFoto(body.foto);
      if (!foto || foto.invalida) return erro(400, foto?.invalida || "Foto ausente.");
      const m = await localizarParaFoto(texto(body.marcacaoId));
      if (!m || String(m.dispositivo_id) !== String(dispositivo.id)) return erro(404, "Marcação não encontrada neste aparelho.");
      // A foto precisa ser exatamente a que foi registrada na marcação (o hash
      // dela entrou no encadeamento) - não dá para trocar a foto depois.
      if (m.foto_sha256 !== foto.sha256) return erro(400, "Foto não corresponde à registrada na marcação.");
      const { error: errUp } = await db.storage.from(BUCKET_PONTO)
        .upload(caminhoFotoMarcacao(m.obra_id, m.marcado_em, m.id), foto.buffer, { contentType: "image/jpeg", upsert: false });
      if (errUp && !/exists|duplicate/i.test(String(errUp.message || ""))) throw errUp;
      return ok({ recebida: true });
    },

    async "ponto-cadastrar-biometria"({ body, headers }) {
      const { dispositivo, falha } = await doAparelho(headers, body);
      if (falha) return falha;
      const dados = await lerDados();
      const funcionario = funcionariosDaObra(dados?.employees, dispositivo.obra_id).find(f => f.id === texto(body.employeeId));
      if (!funcionario) return erro(400, "Funcionário não está ativo nesta obra no cadastro do ARCD.");
      const vetor = Array.isArray(body.vetor) ? body.vetor.map(Number) : [];
      if (vetor.length < 64 || vetor.length > 1024 || vetor.some(v => !Number.isFinite(v))) return erro(400, "Vetor facial inválido.");
      const consentimento = body.consentimento || {};
      if (!texto(consentimento.termoVersao) || !texto(consentimento.aceitoEm)) return erro(400, "Sem o consentimento do funcionário a biometria não pode ser cadastrada (LGPD).");
      const responsavelId = texto(body.responsavelId);
      const { data: resp, error: errResp } = await db.from("ponto_responsaveis").select("user_id,obras,ativo").eq("company_id", company).eq("user_id", responsavelId).maybeSingle();
      if (errResp) throw errResp;
      if (!resp?.ativo || ((resp.obras || []).length && !(resp.obras || []).map(String).includes(String(dispositivo.obra_id)))) return erro(403, "Responsável sem permissão nesta obra.");
      const id = crypto.randomUUID();
      const fotos = [];
      for (const [i, bruto] of (Array.isArray(body.fotos) ? body.fotos.slice(0, 5) : []).entries()) {
        const foto = decodificarFoto(bruto);
        if (!foto || foto.invalida) return erro(400, foto?.invalida || "Foto do cadastro ausente.");
        const caminho = `biometria/${funcionario.id}/${id}-${i + 1}.jpg`;
        const { error: errUp } = await db.storage.from(BUCKET_PONTO).upload(caminho, foto.buffer, { contentType: "image/jpeg", upsert: false });
        if (errUp) throw errUp;
        fotos.push({ caminho, sha256: foto.sha256 });
      }
      const { error } = await db.from("ponto_biometrias").insert({
        company_id: company, id, employee_id: funcionario.id, modelo: texto(body.modelo) || "desconhecido", vetor,
        qualidade: Number.isFinite(Number(body.qualidade)) ? Number(body.qualidade) : null, fotos,
        consentimento: { termoVersao: texto(consentimento.termoVersao), aceitoEm: texto(consentimento.aceitoEm), textoSha256: texto(consentimento.textoSha256) },
        cadastrado_por: responsavelId, dispositivo_id: dispositivo.id,
      });
      if (error) throw error;
      return ok({ biometriaId: id, employeeId: funcionario.id });
    },
  };

  // cron: true quando a chamada veio da rotina agendada autenticada (api/data.js).
  return async function tratar({ action, body = {}, headers = {}, cron = false }) {
    const acao = acoes[action];
    if (!acao) return erro(400, "Ação do ponto eletrônico desconhecida.");
    return acao({ body, headers, cron });
  };
}

export const ehAcaoPonto = action => typeof action === "string" && action.startsWith("ponto-");
// Reexportado para o app e os testes compartilharem o mesmo cálculo.
export { calcularHashMarcacao };
