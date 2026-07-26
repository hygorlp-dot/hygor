import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source=readFileSync(resolve(process.cwd(),"src/components/login/LoginProjectParallax.jsx"),"utf8");

describe("parallax da maquete no login",()=>{
  it("mantém paisagem e casa em camadas de profundidade distintas",()=>{
    expect(source).toContain("login-projects-depth.webp");
    expect(source).toContain("login-architectural-landscape.webp");
    expect(source).toContain("login-project-landscape");
    expect(source).toContain("login-project-house-layer");
    expect(source).toContain("login-project-house");
    expect(source).toContain("login-project-brand-watermark");
  });

  it("respeita redução de movimento e não anima dispositivos de toque",()=>{
    expect(source).toContain('useReducedMotion()');
    expect(source).toContain('window.matchMedia("(pointer: coarse)").matches');
  });

  it("aceita vídeo configurado sem sacrificar economia de dados ou fallback",()=>{
    expect(source).toContain("VITE_LOGIN_BACKGROUND_VIDEO_URL");
    expect(source).toContain("navigator.connection?.saveData");
    expect(source).toContain("autoPlay muted loop playsInline preload=\"metadata\"");
    expect(source).toContain("onError={()=>setVideoFailed(true)}");
    expect(source).toContain("poster={architecturalLandscape}");
    expect(source).toContain("{!showVideo&&<div className=\"login-project-house-layer\">");
  });

  it("acompanha apenas o cursor dentro da cena com câmera estável",()=>{
    expect(source).toContain('visual.addEventListener("pointermove",move');
    expect(source).toContain('visual.addEventListener("pointerleave",reset)');
    expect(source).not.toContain("houseTargetRotateZ");
    expect(source).not.toContain("previousPointer");
  });
});
