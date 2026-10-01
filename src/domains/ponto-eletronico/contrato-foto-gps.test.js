// @vitest-environment node
import { describe, expect, it } from "vitest";
import { LIMITE_FOTO_BYTES, bytesDoBase64, ehJpeg } from "./foto.js";
import { canonicalizarMarcacao, gpsParaMarcacao, validarMarcacao } from "./marcacao.js";

describe("contrato da foto (app e servidor)", () => {
  it("limite de 1,5 MB e JPEG pelo cabeçalho", () => {
    expect(LIMITE_FOTO_BYTES).toBe(1_500_000);
    expect(ehJpeg(new Uint8Array([0xff, 0xd8, 0]))).toBe(true);
    expect(ehJpeg(new Uint8Array([0x89, 0x50]))).toBe(false);
    expect(ehJpeg(null)).toBe(false);
  });

  it("tamanho do base64 sem decodificar bate com o real", () => {
    for (const n of [0, 1, 2, 3, 10, 1_000_001]) {
      const b64 = Buffer.alloc(n, 7).toString("base64");
      expect(bytesDoBase64(b64)).toBe(n);
      expect(bytesDoBase64(`data:image/jpeg;base64,${b64}`)).toBe(n);
    }
  });
});

describe("GPS da marcação", () => {
  it("só passa GPS dentro do intervalo; o resto vira null em vez de recusar a batida", () => {
    expect(gpsParaMarcacao({ lat: -8.28, lng: -35.97, precisao: 10, em: 1 })).toEqual({ lat: -8.28, lng: -35.97, precisao: 10 });
    expect(gpsParaMarcacao({ lat: -8.28, lng: -35.97, precisao: -1 })).toEqual({ lat: -8.28, lng: -35.97, precisao: null });
    for (const ruim of [null, undefined, "x", {}, { lat: 91, lng: 0 }, { lat: 0, lng: 181 }, { lat: "a", lng: 1 }]) expect(gpsParaMarcacao(ruim)).toBeNull();
  });

  it("GPS saneado sempre passa na validação e não muda o hash de um GPS que já era válido", () => {
    const gps = { lat: -8.28, lng: -35.97, precisao: 10 };
    const base = { id: "7d6c3f6e-1a2b-4c3d-8e9f-0a1b2c3d4e5f", dispositivoId: "6f1c9a52-0f0e-4f5e-9d7b-3a1d2c4b5e6f", nsr: 1, employeeId: "e1", marcadoEm: "2026-10-01T10:00:00.000Z", metodo: "facial", hashAnterior: "0".repeat(64), hash: "a".repeat(64) };
    expect(validarMarcacao({ ...base, gps: gpsParaMarcacao(gps) }).ok).toBe(true);
    expect(canonicalizarMarcacao({ ...base, gps: gpsParaMarcacao({ ...gps, em: 123 }) })).toBe(canonicalizarMarcacao({ ...base, gps }));
  });
});
