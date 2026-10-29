import { expect, it } from "vitest";
import { isAppleHeic, patrimonyDocumentMime, withDataUrlMime } from "./document-policy.js";

it("usa a extensão quando o celular ou o WhatsApp não informa o tipo do PDF", () => {
  expect(patrimonyDocumentMime("NF 1234.PDF", "")).toBe("application/pdf");
  expect(patrimonyDocumentMime("nota.pdf", "application/octet-stream")).toBe("application/pdf");
  expect(patrimonyDocumentMime("foto.jpg", "image/jpg")).toBe("image/jpeg");
  expect(patrimonyDocumentMime("foto.jfif", "")).toBe("image/jpeg");
  expect(patrimonyDocumentMime("nota", "application/pdf")).toBe("application/pdf");
  expect(patrimonyDocumentMime("planilha.xlsx", "")).toBe("");
});

it("reescreve só o prefixo do data URL", () => {
  expect(withDataUrlMime("data:application/octet-stream;base64,QUJD", "application/pdf")).toBe("data:application/pdf;base64,QUJD");
  expect(withDataUrlMime("data:;base64,QUJD", "image/png")).toBe("data:image/png;base64,QUJD");
});

it("reconhece foto HEIC do iPhone para orientar a conversão", () => {
  expect(isAppleHeic("IMG_0001.HEIC", "")).toBe(true);
  expect(isAppleHeic("nota.pdf", "image/heif")).toBe(true);
  expect(isAppleHeic("nota.pdf", "application/pdf")).toBe(false);
});
