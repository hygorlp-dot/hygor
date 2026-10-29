import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source=readFileSync(resolve(process.cwd(), "src/LegacyApp.jsx"), "utf8");

describe("primeiro acesso", () => {
  it("declara o estado, apresenta o cadastro inicial e autentica o administrador criado", () => {
    expect(source).toContain('const [firstSetup, setFirstSetup] = useState(false);');
    expect(source).toContain('if (r.precisaSetup) setFirstSetup(true);');
    expect(source).toContain('function LoginScreen({ onLogin, erroInicial="", precisaSetup=false })');
    expect(source).toContain('const criado=await criarPrimeiroAdmin({usuarios:[usuario]});');
    expect(source).toContain('const acesso=await entrarComPin(email||nome,pin);');
    expect(source).toContain('precisaSetup={firstSetup}');
  });

  it("mantém o formulário MRC e solicita uma identificação sem listar operadores", () => {
    const login=source.slice(source.indexOf("function LoginScreen("),source.indexOf("export function GestaoUsuarios("));
    expect(login).toContain("<LazyLoginBrandPanel/>");
    expect(login).toContain('src={BRAND.monogram} alt="MARCELL"');
    expect(login).toContain('htmlFor="login-identificador"');
    expect(login).toContain("entrarComPin(identificador.trim(),valor)");
    expect(login).not.toMatch(/usuarios\.map|usuarios\.length|selUser|perfis/);
    expect(source).not.toContain("setPerfis(");
  });
});
