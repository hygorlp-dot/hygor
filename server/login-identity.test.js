import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { assuntoLimitePinUsuario, resolverUsuarioPorIdentificador, respostaPerfisPublica } from "./login-identity.js";

const USUARIOS = [
  { id: "u-admin", nome: "Maria José Souza", email: "Maria@arcd.test", role: "admin", pin: "hash-1" },
  { id: "u-eng", nome: "João Lima", email: "", role: "engenheiro", pin: "hash-2" },
  { id: "u-inativo", nome: "Pedro Antigo", email: "pedro@arcd.test", role: "admin", active: false },
  { id: "u-ana-1", nome: "Ana Reis", role: "rh" },
  { id: "u-ana-2", nome: "ana  reis", role: "financeiro" },
];

describe("tela de login pública", () => {
  it("não devolve nome, papel nem id de nenhum usuário", () => {
    const resposta = respostaPerfisPublica({ usuarios: USUARIOS });
    expect(resposta).toEqual({ precisaSetup: false });
    const texto = JSON.stringify(resposta);
    USUARIOS.forEach(u => {
      expect(texto).not.toContain(u.id);
      expect(texto).not.toContain(u.nome);
    });
  });

  it("pede o primeiro administrador só quando não há usuário ativo", () => {
    expect(respostaPerfisPublica(null)).toEqual({ precisaSetup: true });
    expect(respostaPerfisPublica({ usuarios: [{ id: "x", nome: "X", active: false }] })).toEqual({ precisaSetup: true });
  });

  it("o endpoint profiles responde só com a resposta pública", () => {
    const fonte = readFileSync(resolve(process.cwd(), "api/data.js"), "utf8");
    const inicio = fonte.indexOf('if (action === "profiles")');
    const trecho = fonte.slice(inicio, fonte.indexOf("\n    }\n", inicio));
    expect(trecho).toContain("res.status(200).json(respostaPerfisPublica(indice))");
    expect(trecho).not.toMatch(/nome|role/);
  });
});

describe("identificação para o login por PIN", () => {
  it("aceita e-mail ou nome completo sem diferenciar maiúsculas, acentos e espaços", () => {
    expect(resolverUsuarioPorIdentificador(USUARIOS, " maria@ARCD.test ")?.id).toBe("u-admin");
    expect(resolverUsuarioPorIdentificador(USUARIOS, "maria jose  souza")?.id).toBe("u-admin");
    expect(resolverUsuarioPorIdentificador(USUARIOS, "JOAO LIMA")?.id).toBe("u-eng");
  });

  it("não resolve usuário inativo, nome parcial, vazio nem nome repetido", () => {
    expect(resolverUsuarioPorIdentificador(USUARIOS, "pedro@arcd.test")).toBeNull();
    expect(resolverUsuarioPorIdentificador(USUARIOS, "Maria")).toBeNull();
    expect(resolverUsuarioPorIdentificador(USUARIOS, "   ")).toBeNull();
    expect(resolverUsuarioPorIdentificador(USUARIOS, "Ana Reis")).toBeNull();
  });

  it("conta tentativas por usuário, além do IP", () => {
    expect(assuntoLimitePinUsuario("u-admin")).toBe("pin-usuario|u-admin");
    const fonte = readFileSync(resolve(process.cwd(), "api/data.js"), "utf8");
    expect(fonte).toContain('rateLimitCentral(assuntoLimitePinUsuario(userId),"status")');
    expect(fonte).toContain('rateLimitCentral(limiteUsuario,"failure")');
  });
});
