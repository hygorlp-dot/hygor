// @vitest-environment node
import { describe, it, expect } from "vitest";
import { canonicalizarEvento, validarEvento } from "./evento.js";
import { snapshotFixture } from "../../../server/ponto-eletronico/fiscal/fixtures.test-helper.js";
import { auditarSnapshot } from "../../../server/ponto-eletronico/fiscal/auditoria.js";
describe("captura opt-in protegida sem reescrever APK18", () => {
  it("alterar modo online/offline muda o conteúdo canônico novo", async () => {
    const s = await snapshotFixture(), event = s.eventos[0].payload;
    expect(canonicalizarEvento(event)).not.toBe(canonicalizarEvento({ ...event, offline: !event.offline }));
    s.eventos[0].payload.offline = !event.offline;
    expect((await auditarSnapshot(s)).integridadeValida).toBe(false);
  });
  it("continua lendo eventos antigos sem deduzir seu modo", async () => {
    const s = await snapshotFixture({ withMode: false }), event = s.eventos[0].payload;
    expect(validarEvento(event).ok).toBe(true);
    expect(canonicalizarEvento(event)).toBe(canonicalizarEvento({ ...event, offline: true }));
    const audit = await auditarSnapshot(s);
    expect(audit.integridadeValida).toBe(true); expect(audit.aptoParaGeracao.afd).toBe(false);
  });
  it("nova versão exige booleano e recusa versão desconhecida", async () => {
    const s = await snapshotFixture(), event = s.eventos[0].payload;
    expect(validarEvento({ ...event, offline: undefined }).ok).toBe(false);
    expect(validarEvento({ ...event, versaoCaptura: 2 }).ok).toBe(false);
  });
});
