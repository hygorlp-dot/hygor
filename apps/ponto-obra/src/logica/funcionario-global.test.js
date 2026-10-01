// @vitest-environment node
//
// FUNCIONÁRIO GLOBAL (01/10/2026): o funcionário pertence à empresa, não a
// uma obra. Qualquer funcionário ativo cadastra o rosto e bate ponto em
// qualquer aparelho; o aparelho só diz ONDE a batida aconteceu (obra de
// captura). A obra que recebe cada intervalo de trabalho é a APROPRIADA,
// tratada fora da ARP, com auditoria - nunca alterando a marcação fiscal.
// Aparelho, servidor e Postgres reais (PGlite, migrations 016 + 017 + 018).
import { beforeEach, describe, expect, it, vi } from "vitest";
import { enviarPendentes, sincronizarCadastro } from "./sincronizacao.js";
import { identificar, vetorDoCadastro } from "./rosto.js";
import { DADOS_BASE, JPEG, criarAparelho, criarServidor } from "./cenario.test-helper.js";

vi.setConfig({ testTimeout: 60000, hookTimeout: 60000 });

const sincronizar = ap => sincronizarCadastro({ armazem: ap.armazem, api: ap.api, monotonico: ap.monotonico });
const enviar = ap => enviarPendentes({ armazem: ap.armazem, api: ap.api });
const vetor = (i, ruido = 0) => { const v = Array.from({ length: 192 }, (_, k) => (k === i ? 1 : 0) + (k === i + 1 ? ruido : 0)); const n = Math.hypot(...v); return v.map(x => x / n); };
const JOAO = { tipo: "funcionario", id: "e1", cpf: "12345678909" };   // "Zé Pedreiro", lotado na obra-a
const CONSENTIMENTO = { termoVersao: "2026-10", aceitoEm: "2026-10-01T09:00:00.000Z", textoSha256: "x" };
const cadastrarRosto = (ap, employeeId, i) => ap.api("ponto-cadastrar-biometria", {
  employeeId, modelo: "mobilefacenet-192-apache2", vetor: vetorDoCadastro([vetor(i), vetor(i, 0.04)]), fotos: [JPEG.toString("base64")],
  consentimento: CONSENTIMENTO, responsavelId: "u-enc",
});

let s, A, B;
beforeEach(async () => {
  const dados = DADOS_BASE();
  dados.employees.push(
    { id: "e4", name: "Ana Carpinteira", cpf: "529.982.247-25", obra: "obra-x", active: true },        // lotada numa 3ª obra
    { id: "e5", name: "Beto Desligado", cpf: "111.222.333-96", obra: "obra-a", active: true, endDate: "2026-09-01" },
  );
  s = await criarServidor({ dados, estabelecimento: false, comResponsavel: false });
  s.estX = await s.criarEstabelecimento("Estabelecimento X", ["obra-a"]);
  s.estY = await s.criarEstabelecimento("Estabelecimento Y", ["obra-b"]);
  A = await criarAparelho(s, { obraId: "obra-a", nome: "Tablet A" });
  B = await criarAparelho(s, { obraId: "obra-b", nome: "Tablet B" });
  // Encarregado autorizado SÓ na obra-b.
  await s.admin("ponto-responsavel-pin", { userId: "u-enc", pin: "2468", obras: ["obra-b"] });
  await sincronizar(A); await sincronizar(B);
});

describe("funcionário é global da empresa", () => {
  it("todo aparelho recebe todos os ativos: lotado na A aparece no B, lotado na X aparece no A, desligado não aparece", async () => {
    const noA = (await A.armazem.cadastro()).funcionarios, noB = (await B.armazem.cadastro()).funcionarios;
    expect(noB.map(f => f.id)).toContain("e1");                                   // lotado na obra-a, no tablet B
    expect(noA.map(f => f.id)).toContain("e4");                                   // lotada na obra-x, no tablet A
    expect(noA.map(f => f.id)).toContain("e3");                                   // lotado na obra-b, no tablet A
    for (const lista of [noA, noB]) expect(lista.map(f => f.id)).not.toContain("e5");
    expect(noA.map(f => f.id)).toEqual(noB.map(f => f.id));                       // a mesma base em todo aparelho
    expect(noA.find(f => f.id === "e4").lotacaoObraId).toBe("obra-x");            // lotação só como informação
  });

  it("rosto cadastrado no Tablet B (responsável da obra B) de quem é lotado na A é reconhecido no Tablet A", async () => {
    expect((await cadastrarRosto(B, "e1", 3)).ok).toBe(true);
    expect((await cadastrarRosto(A, "e1", 3)).status).toBe(403);                  // o responsável não é da obra A
    await sincronizar(A);
    const id = identificar(vetor(3, 0.08), (await A.armazem.cadastro()).biometrias);
    expect(id).toMatchObject({ reconhecido: true, employeeId: "e1" });
  });

  it("mudar a lotação do funcionário não apaga nem invalida a biometria", async () => {
    await cadastrarRosto(B, "e1", 3);
    s.dados.employees.find(e => e.id === "e1").obra = "obra-b";                   // RH muda a lotação
    await sincronizar(A); await sincronizar(B);
    for (const ap of [A, B]) expect((await ap.armazem.cadastro()).biometrias.map(b => b.employeeId)).toEqual(["e1"]);
    s.dados.employees.find(e => e.id === "e1").endDate = "2026-10-01";             // desligado: sai de todos os aparelhos
    await sincronizar(A);
    const cad = await A.armazem.cadastro();
    expect(cad.funcionarios.map(f => f.id)).not.toContain("e1");
    expect(cad.biometrias.map(b => b.employeeId)).not.toContain("e1");
  });

  it("vetores só descem quando o conjunto muda (assinatura) e o aparelho guarda os que já tem", async () => {
    await cadastrarRosto(B, "e1", 3);
    await sincronizar(A);
    const assinatura = (await A.armazem.cadastro()).biometriasAssinatura;
    A.chamadas.length = 0;
    await sincronizar(A);
    const r = await s.tratar({ action: "ponto-sincronizar", body: { biometriasAssinatura: assinatura }, headers: { authorization: `Bearer ${A.token}` } });
    expect(r.json).toMatchObject({ biometrias: null, biometriasAssinatura: assinatura });
    expect((await A.armazem.cadastro()).biometrias.map(b => b.employeeId)).toEqual(["e1"]);   // manteve os vetores
    await cadastrarRosto(B, "e4", 7);
    await sincronizar(A);
    const cad = await A.armazem.cadastro();
    expect(cad.biometriasAssinatura).not.toBe(assinatura);
    expect(cad.biometrias.map(b => b.employeeId).sort()).toEqual(["e1", "e4"]);
    // As fotos do cadastro nunca vão para os aparelhos - só o vetor.
    expect(JSON.stringify(cad.biometrias)).not.toMatch(/foto|base64|\/9j\//);
  });
});

describe("João muda de obra no mesmo dia", () => {
  async function diaDoJoao() {
    s.relogioServidor = Date.parse("2026-10-01T10:00:00.000Z");             // 07:00 em Recife
    await sincronizar(A); await sincronizar(B);
    const b1 = await A.bater({ pessoa: JOAO });
    s.relogioServidor = Date.parse("2026-10-01T14:30:00.000Z");             // 11:30: chega na obra B
    await sincronizar(B);
    const b2 = await B.bater({ pessoa: JOAO });
    s.relogioServidor = Date.parse("2026-10-01T20:00:00.000Z");             // 17:00: sai da obra B
    await sincronizar(B);
    const b3 = await B.bater({ pessoa: JOAO });
    await enviar(A); await enviar(B);
    return [b1, b2, b3];
  }

  it("mesmo employeeId, aparelhos e obras de captura preservados, NSR de cada estabelecimento", async () => {
    const [b1, b2, b3] = await diaDoJoao();
    const eventos = await s.sql("select event_id, employee_id, dispositivo_id, obra_id, estabelecimento_id, local_sequence from public.ponto_eventos order by marcado_em");
    expect(eventos.map(e => [e.event_id, e.employee_id, e.dispositivo_id, e.obra_id])).toEqual([
      [b1.eventId, "e1", A.dispositivoId, "obra-a"], [b2.eventId, "e1", B.dispositivoId, "obra-b"], [b3.eventId, "e1", B.dispositivoId, "obra-b"],
    ]);
    expect(eventos.map(e => e.estabelecimento_id)).toEqual([s.estX, s.estY, s.estY]);       // da obra do APARELHO, não da lotação
    expect((await s.fiscais(s.estX)).map(f => [Number(f.nsr), f.event_id])).toEqual([[1, b1.eventId]]);
    expect((await s.fiscais(s.estY)).map(f => [Number(f.nsr), f.event_id])).toEqual([[1, b2.eventId], [2, b3.eventId]]);
    // Reenvio: idempotente, mesmos NSR.
    const r = await B.api("ponto-enviar-marcacoes", { eventos: [b2, b3] });
    expect(r.resultados.map(x => [x.status, x.nsr])).toEqual([["ja_registrado", 1], ["ja_registrado", 2]]);
  });

  it("a proposta separa os intervalos por obra (07:00–11:30 A, 11:30–17:00 B) e a apropriação não toca na ARP", async () => {
    const [b1, b2, b3] = await diaDoJoao();
    const antesArp = JSON.stringify([await s.sql("select * from public.ponto_eventos order by event_id"), await s.sql("select * from public.ponto_arp_registros order by event_id")]);
    const prop = (await s.admin("ponto-apropriacao-propor", { employeeId: "e1", data: "2026-10-01" })).json;
    expect(prop.intervalos.map(i => [i.inicio, i.fim, i.obraApropriadaId, i.mudouDeObra])).toEqual([
      [b1.marcadoEm, b2.marcadoEm, "obra-a", true], [b2.marcadoEm, b3.marcadoEm, "obra-b", false],
    ]);
    expect(prop.avisos).toEqual([]);
    for (const i of prop.intervalos) {
      const r = await s.admin("ponto-apropriacao-salvar", { apropriacao: { employeeId: "e1", data: "2026-10-01", inicio: i.inicio, fim: i.fim, obraApropriadaId: i.obraApropriadaId, origem: "proposta_capturas" } });
      expect(r.status).toBe(200);
    }
    const lista = (await s.admin("ponto-apropriacoes", { employeeId: "e1", de: "2026-10-01", ate: "2026-10-01" })).json.apropriacoes;
    expect(lista.map(a => [a.obraApropriadaId, a.status])).toEqual([["obra-a", "ativa"], ["obra-b", "ativa"]]);   // duas obras no mesmo dia
    // A ARP não mudou nada: eventos, obras de captura, NSR e hashes.
    const depoisArp = JSON.stringify([await s.sql("select * from public.ponto_eventos order by event_id"), await s.sql("select * from public.ponto_arp_registros order by event_id")]);
    expect(depoisArp).toBe(antesArp);
  });
});

describe("apropriação: correção com auditoria, sem tocar na marcação", () => {
  const salvar = (extra = {}) => s.admin("ponto-apropriacao-salvar", { apropriacao: {
    employeeId: "e1", data: "2026-10-01", inicio: "2026-10-01T14:30:00.000Z", fim: "2026-10-01T20:00:00.000Z", obraApropriadaId: "obra-b", origem: "manual", ...extra,
  } });

  it("B → C com motivo: guarda antes, depois, responsável, data e motivo; sem motivo ou com versão velha é recusado", async () => {
    const { json: { id, version } } = await salvar();
    expect((await salvar({ id, version, obraApropriadaId: "obra-x" })).json.error).toMatch(/motivo/);
    const r = await salvar({ id, version, obraApropriadaId: "obra-x", motivo: "trabalhou na obra X a tarde, conforme diário de obra" });
    expect(r.json).toMatchObject({ id, version: 2 });
    expect((await salvar({ id, version: 1, obraApropriadaId: "obra-a", motivo: "x" })).status).toBe(409);
    const aud = (await s.admin("ponto-apropriacao-auditoria", { id })).json.auditoria;
    expect(aud.map(a => a.acao)).toEqual(["criada", "alterada"]);
    expect(aud[1]).toMatchObject({ responsavelId: "u-admin", motivo: "trabalhou na obra X a tarde, conforme diário de obra" });
    expect([aud[1].antes.obra_apropriada_id, aud[1].depois.obra_apropriada_id]).toEqual(["obra-b", "obra-x"]);
    expect(aud[1].em).toBeTruthy();
    // Cancelar também exige motivo e fica auditado.
    expect((await s.admin("ponto-apropriacao-cancelar", { id, version: 2, motivo: "" })).status).toBe(400);
    expect((await s.admin("ponto-apropriacao-cancelar", { id, version: 2, motivo: "lançada em duplicidade" })).status).toBe(200);
    expect((await s.admin("ponto-apropriacao-auditoria", { id })).json.auditoria.map(a => a.acao)).toEqual(["criada", "alterada", "cancelada"]);
  });

  it("vários intervalos no mesmo dia, mas nunca sobrepostos para o mesmo funcionário", async () => {
    expect((await salvar({ inicio: "2026-10-01T10:00:00.000Z", fim: "2026-10-01T14:30:00.000Z", obraApropriadaId: "obra-a" })).status).toBe(200);
    expect((await salvar()).status).toBe(200);                                                                    // 11:30–17:00 B
    expect((await salvar({ inicio: "2026-10-01T13:00:00.000Z", fim: "2026-10-01T15:00:00.000Z", obraApropriadaId: "obra-x" })).json.error).toMatch(/sobrepõe/);
    expect((await salvar({ employeeId: "e2" })).status).toBe(200);                                                // outro funcionário, mesmo horário: ok
  });

  it("no banco: apropriação só muda pelas funções, nunca é apagada, e a auditoria é imutável", async () => {
    await salvar();
    await expect(s.sql("update public.ponto_apropriacoes set obra_apropriada_id = 'obra-z'")).rejects.toThrow(/só muda pelas funções/);
    await expect(s.sql("delete from public.ponto_apropriacoes")).rejects.toThrow();
    await expect(s.sql("update public.ponto_apropriacoes_auditoria set motivo = 'x'")).rejects.toThrow(/imutável/);
    await expect(s.sql("delete from public.ponto_apropriacoes_auditoria")).rejects.toThrow(/imutável/);
    // E a obra de CAPTURA de uma batida continua não podendo ser "corrigida".
    await sincronizar(A);
    await A.bater({ pessoa: JOAO }); await enviar(A);
    await expect(s.sql("update public.ponto_eventos set obra_id = 'obra-b'")).rejects.toThrow(/imutável/);
  });

  it("só gestão (admin/RH/engenheiro) apropria; financeiro só consulta; sem sessão nada", async () => {
    s.dados.usuarios.push({ id: "u-fin", role: "financeiro", nome: "Fin", active: true }, { id: "u-rh", role: "rh", nome: "RH", active: true });
    const como = (quem, action, body) => s.tratar({ action, body: { accessToken: quem, ...body } });
    const ap = { employeeId: "e1", data: "2026-10-01", inicio: "2026-10-01T10:00:00.000Z", fim: "2026-10-01T12:00:00.000Z", obraApropriadaId: "obra-a" };
    expect((await como("u-fin", "ponto-apropriacao-salvar", { apropriacao: ap })).status).toBe(403);
    expect((await como("u-fin", "ponto-apropriacoes", { employeeId: "e1" })).status).toBe(200);
    expect((await como("u-rh", "ponto-apropriacao-salvar", { apropriacao: ap })).status).toBe(200);
    expect((await s.tratar({ action: "ponto-apropriacao-salvar", body: { apropriacao: ap } })).status).toBe(401);
  });
});
