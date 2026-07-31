import { describe, expect, it } from "vitest";
import {
  canUploadToDestination,
  isAcceptedUploadMime,
  uploadDestination,
  uploadStoragePrefix,
} from "./upload-policy";

describe("política de upload", () => {
  it("mantém engenheiro restrito à própria obra em upload operacional", () => {
    const user = { id: "u-1", obraId: "obra-1" };
    expect(canUploadToDestination(user, { obraId: "obra-1" })).toBe(true);
    expect(canUploadToDestination(user, { obraId: "obra-2" })).toBe(false);
    expect(canUploadToDestination(user, { obraId: "" })).toBe(false);
  });

  it("permite chat corporativo autenticado sem transformar obra em caminho livre", () => {
    const user = { id: "u-1", obraId: "obra-1" };
    expect(canUploadToDestination(user, { obraId: "obra-2", folder: "chat" })).toBe(true);
    expect(uploadStoragePrefix({ obraId: "obra-2", folder: "chat" })).toBe("chat");
    expect(uploadDestination("chat/../../obra-2")).toBe("work");
    expect(uploadStoragePrefix({ obraId: "../obra 2", folder: "desconhecida" })).toBe("obra2");
  });

  it("aceita somente imagens na obra e documentos seguros no chat", () => {
    expect(isAcceptedUploadMime("image/jpeg", "work")).toBe(true);
    expect(isAcceptedUploadMime("application/pdf", "work")).toBe(false);
    expect(isAcceptedUploadMime("application/pdf", "chat")).toBe(true);
    expect(isAcceptedUploadMime("application/x-msdownload", "chat")).toBe(false);
    expect(isAcceptedUploadMime("text/html", "chat")).toBe(false);
  });

  it("nega qualquer destino quando não há usuário autenticado", () => {
    expect(canUploadToDestination(null, { folder: "chat" })).toBe(false);
  });
});
