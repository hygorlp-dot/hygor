import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source=readFileSync(resolve(process.cwd(),"src/components/login/LoginProjectParallax.jsx"),"utf8");

describe("parallax da maquete no login",()=>{
  it("mantém paisagem e casa em camadas de profundidade distintas",()=>{
    expect(source).toContain("login-project-landscape");
    expect(source).toContain("login-project-house-layer");
    expect(source).toContain("login-project-house");
  });

  it("respeita redução de movimento e não anima dispositivos de toque",()=>{
    expect(source).toContain('useReducedMotion()');
    expect(source).toContain('window.matchMedia("(pointer: coarse)").matches');
  });

  it("acompanha apenas o cursor dentro da cena com câmera estável",()=>{
    expect(source).toContain('visual.addEventListener("pointermove",move');
    expect(source).toContain('visual.addEventListener("pointerleave",reset)');
    expect(source).not.toContain("houseTargetRotateZ");
    expect(source).not.toContain("previousPointer");
  });
});
