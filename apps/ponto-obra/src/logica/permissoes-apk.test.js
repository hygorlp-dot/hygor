// @vitest-environment node
import { describe, expect, it } from "vitest";
import { conferirPermissoesApk } from "../../scripts/permissoes-apk.mjs";

const base = "package: br.com.arcd.pontoobra.homologacao\nuses-permission: name='android.permission.CAMERA'\nuses-permission: name='android.permission.ACCESS_FINE_LOCATION'\nuses-permission: name='android.permission.INTERNET'\n";
const bloqueadas = ["android.permission.READ_PHONE_STATE", "android.permission.RECORD_AUDIO"];

describe("permissões do APK compilado", () => {
  it("aceita câmera, localização e rede sem permissão bloqueada", () => {
    expect(conferirPermissoesApk(base, bloqueadas)).toEqual([
      "android.permission.ACCESS_FINE_LOCATION", "android.permission.CAMERA", "android.permission.INTERNET",
    ]);
  });

  it("rejeita READ_PHONE_STATE acrescentada pelo manifest merger de uma dependência", () => {
    expect(() => conferirPermissoesApk(`${base}uses-permission: name='android.permission.READ_PHONE_STATE'\n`, bloqueadas)).toThrow("READ_PHONE_STATE");
  });

  it("também rejeita permissão bloqueada restrita a uma versão do Android", () => {
    expect(() => conferirPermissoesApk(`${base}uses-permission-sdk-23: name='android.permission.RECORD_AUDIO'\n`, bloqueadas)).toThrow("RECORD_AUDIO");
  });

  it("não aceita manifesto vazio ou sem câmera", () => {
    expect(() => conferirPermissoesApk("", bloqueadas)).toThrow("necessárias");
    expect(() => conferirPermissoesApk(base.replace("uses-permission: name='android.permission.CAMERA'\n", ""), bloqueadas)).toThrow("CAMERA");
  });
});
