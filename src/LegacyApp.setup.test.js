import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source=readFileSync(resolve(process.cwd(), "src/LegacyApp.jsx"), "utf8");

describe("primeiro acesso", () => {
  it("declara o estado, apresenta o cadastro inicial e autentica o administrador criado", () => {
    expect(source).toContain('const [firstSetup, setFirstSetup] = useState(false);');
    expect(source).toContain('if (r.precisaSetup) setFirstSetup(true);');
    expect(source).toContain('function LoginScreen({ perfis, onLogin, erroInicial="", precisaSetup=false })');
    expect(source).toContain('const criado=await criarPrimeiroAdmin({usuarios:[usuario]});');
    expect(source).toContain('const acesso=await entrarComPin(usuario.id,pin);');
    expect(source).toContain('precisaSetup={firstSetup}');
  });
});
