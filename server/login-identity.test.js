import { describe, expect, it } from "vitest";
import {
  assuntoLimitePinUsuario,
  normalizarIdentificador,
  resolverUsuarioPorIdentificador,
  respostaPerfisPublica,
} from "./login-identity.js";

const usuarios = [
  { id:"admin-a", nome:"Maria José Souza", email:"Maria@arcd.test", role:"admin", pin:"hash-privado" },
  { id:"engenheiro-a", nome:"João Lima", email:"", role:"engenheiro" },
  { id:"inativo", nome:"Pedro Antigo", email:"pedro@arcd.test", active:false },
  { id:"ana-a", nome:"Ana Reis", email:"ana-a@arcd.test" },
  { id:"ana-b", nome:"ana  reis", email:"ana-b@arcd.test" },
];

describe("identificação privada no login por PIN", () => {
  it("publica somente o estado de primeiro acesso", () => {
    expect(respostaPerfisPublica({usuarios})).toEqual({precisaSetup:false});
    expect(respostaPerfisPublica(null)).toEqual({precisaSetup:true});
    expect(respostaPerfisPublica({usuarios:[usuarios[2]]})).toEqual({precisaSetup:false});
  });

  it.each([
    ["  maria@ARCD.test  ", "admin-a"],
    ["  MARIA JOSE   SOUZA ", "admin-a"],
    ["JOAO LIMA", "engenheiro-a"],
    ["ana-a@arcd.test", "ana-a"],
  ])("resolve %s por correspondência completa", (identificador, id) => {
    expect(resolverUsuarioPorIdentificador(usuarios, identificador)?.id).toBe(id);
  });

  it.each(["Pedro Antigo", "pedro@arcd.test", "Maria", "Ana Reis", "", "   ", null, {}])(
    "recusa identificação inexistente, parcial, inativa ou ambígua: %s", identificador => {
      expect(resolverUsuarioPorIdentificador(usuarios, identificador)).toBeNull();
    },
  );

  it("não resolve um e-mail duplicado pelo nome de um terceiro usuário", () => {
    const duplicados = [
      {id:"a", nome:"Primeiro", email:"repetido@arcd.test"},
      {id:"b", nome:"Segundo", email:"REPETIDO@arcd.test"},
      {id:"c", nome:"repetido@arcd.test"},
    ];
    expect(resolverUsuarioPorIdentificador(duplicados, "repetido@arcd.test")).toBeNull();
  });

  it("normaliza as variações antes de contabilizar um identificador desconhecido", () => {
    expect(normalizarIdentificador("  José   Silva ")).toBe("jose silva");
    expect(normalizarIdentificador(undefined)).toBe("");
  });

  it("mantém um único sujeito de limite para nome, e-mail e sessão por ID", () => {
    const porNome=resolverUsuarioPorIdentificador(usuarios,"maria jose souza");
    const porEmail=resolverUsuarioPorIdentificador(usuarios,"maria@arcd.test");
    expect(assuntoLimitePinUsuario(porNome.id)).toBe("pin-usuario|admin-a");
    expect(assuntoLimitePinUsuario(porEmail.id)).toBe(assuntoLimitePinUsuario("admin-a"));
  });
});
