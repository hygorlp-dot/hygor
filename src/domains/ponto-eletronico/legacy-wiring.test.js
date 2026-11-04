import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = relative => fs.readFileSync(path.resolve(process.cwd(), relative), "utf8");

// A tela Ponto eletrônico só confere e integra batidas (e abre o cadastro) se
// o shell repassar o comando de presença e a navegação. Sem as duas props os
// botões renderizam, mas não fazem nada — e nenhum teste de componente pega.
describe("Ponto eletrônico ligado ao shell", () => {
  it("repassa dispatchAttendanceCommand e onTab para a tela", () => {
    const legacy = read("src/LegacyApp.jsx");
    const render = legacy.split("\n").find(line => line.includes('tab === "ponto_app"') && line.includes("<PontoEletronico"));
    expect(render).toBeTruthy();
    expect(render).toContain("dispatchAttendanceCommand={dispatchAttendanceCommand}");
    expect(render).toContain("onTab={irPara}");
  });
});
