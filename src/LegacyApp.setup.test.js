import ts from "typescript";
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
    const tree=ts.createSourceFile("LegacyApp.jsx",source,ts.ScriptTarget.Latest,true,ts.ScriptKind.JSX);
    const login=tree.statements.find(node=>ts.isFunctionDeclaration(node)&&node.name?.text==="LoginScreen")?.getText(tree)||"";
    expect(login).toContain("<LazyLoginBrandPanel/>");
    const panel=readFileSync(resolve(process.cwd(), "src/components/login/LoginProjectParallax.jsx"), "utf8");
    expect(panel).toContain('src={BRAND.fullLogoOnDark} alt="MARCELL"');
    expect(login).not.toMatch(/#[0-9a-fA-F]{3,6}/);
    expect(login).toContain('htmlFor="login-identificador"');
    expect(login).toContain("entrarComPin(identificador.trim(),valor)");
    expect(login).not.toMatch(/usuarios\.map|usuarios\.length|selUser|perfis/);
    expect(source).not.toContain("setPerfis(");
  });
});
