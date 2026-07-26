import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const asset = name => resolve(process.cwd(), "src/assets", name);

describe("orçamento de mídia do login", () => {
  it("mantém as imagens visuais comprimidas dentro do orçamento", () => {
    const files = [
      asset("login-architectural-landscape.webp"),
      asset("login-projects-depth.webp"),
    ];
    const sizes = files.map(file => statSync(file).size);

    expect(sizes.every(size => size <= 120 * 1024)).toBe(true);
    expect(sizes.reduce((total, size) => total + size, 0)).toBeLessThanOrEqual(180 * 1024);
  });

  it("mantém o vídeo de abertura dentro do orçamento de entrega", () => {
    expect(statSync(resolve(process.cwd(), "public/media/login-background.webm")).size).toBeLessThanOrEqual(3 * 1024 * 1024);
  });

  it("faz o login consumir as versões WebP, não os PNGs de origem", () => {
    const component = readFileSync(asset("../components/login/LoginProjectParallax.jsx"), "utf8");

    expect(component).toContain("login-architectural-landscape.webp");
    expect(component).toContain("login-projects-depth.webp");
    expect(component).not.toContain("login-architectural-landscape.png");
    expect(component).not.toContain("login-projects-depth.png");
    expect(component).toContain("/media/login-background.webm");
  });
});
