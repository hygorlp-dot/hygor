import { createClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { criarValidadorDeToken } from "./token-auth.js";

const usuarioDoServidor = { id: "u-servidor", email: "servidor@arcd.test" };
const fakeAuth = ({ claims, getUser } = {}) => ({
  auth: {
    getUser: getUser || vi.fn(async () => ({ data: { user: usuarioDoServidor }, error: null })),
    getClaims: claims || vi.fn(async () => ({ data: { claims: { sub: "u-local", email: "local@arcd.test", role: "authenticated" } }, error: null })),
  },
});

describe("validação do token de sessão", () => {
  it("sem token não chama ninguém", async () => {
    const db = fakeAuth();
    expect(await criarValidadorDeToken(db, { local: () => true })("")).toEqual({ data: null, error: null });
    expect(db.auth.getUser).not.toHaveBeenCalled();
    expect(db.auth.getClaims).not.toHaveBeenCalled();
  });

  it("desligado (padrão), valida no servidor de autenticação", async () => {
    const db = fakeAuth();
    const r = await criarValidadorDeToken(db, { local: () => false })("jwt");
    expect(r.data.user).toEqual(usuarioDoServidor);
    expect(db.auth.getClaims).not.toHaveBeenCalled();
  });

  it("a variável AUTH_LOCAL_JWT liga o modo local; sem ela fica desligado", async () => {
    const antes = process.env.AUTH_LOCAL_JWT;
    try {
      delete process.env.AUTH_LOCAL_JWT;
      const db = fakeAuth();
      await criarValidadorDeToken(db)("jwt");
      expect(db.auth.getClaims).not.toHaveBeenCalled();
      process.env.AUTH_LOCAL_JWT = "1";
      const db2 = fakeAuth();
      await criarValidadorDeToken(db2)("jwt");
      expect(db2.auth.getClaims).toHaveBeenCalledTimes(1);
      expect(db2.auth.getUser).not.toHaveBeenCalled();
    } finally {
      if (antes === undefined) delete process.env.AUTH_LOCAL_JWT; else process.env.AUTH_LOCAL_JWT = antes;
    }
  });

  it("ligado, um sucesso local dispensa a chamada de rede e devolve o formato do getUser", async () => {
    const db = fakeAuth();
    const r = await criarValidadorDeToken(db, { local: () => true })("jwt");
    expect(r).toEqual({ data: { user: { id: "u-local", email: "local@arcd.test" } }, error: null });
    expect(db.auth.getUser).not.toHaveBeenCalled();
  });

  it.each([
    ["getClaims devolve erro", () => vi.fn(async () => ({ data: null, error: { message: "expired" } }))],
    ["getClaims lança (JWKS inacessível)", () => vi.fn(async () => { throw new Error("rede"); })],
    ["claims sem sub (token anon/service)", () => vi.fn(async () => ({ data: { claims: { role: "anon" } }, error: null }))],
    ["role diferente de authenticated", () => vi.fn(async () => ({ data: { claims: { sub: "x", role: "service_role" } }, error: null }))],
  ])("ligado, %s: cai no getUser, que continua sendo a autoridade", async (_nome, criar) => {
    const db = fakeAuth({ claims: criar() });
    const r = await criarValidadorDeToken(db, { local: () => true })("jwt");
    expect(r.data.user).toEqual(usuarioDoServidor);
    expect(db.auth.getUser).toHaveBeenCalledTimes(1);
  });

  it("um getUser com erro (token inválido) é repassado como está", async () => {
    const erro = { message: "invalid JWT" };
    const db = fakeAuth({ claims: vi.fn(async () => ({ data: null, error: erro })), getUser: vi.fn(async () => ({ data: { user: null }, error: erro })) });
    const r = await criarValidadorDeToken(db, { local: () => true })("ruim");
    expect(r.error).toBe(erro);
  });

  it("cliente sem getClaims (versão antiga) usa o getUser", async () => {
    const db = { auth: { getUser: vi.fn(async () => ({ data: { user: usuarioDoServidor }, error: null })) } };
    const r = await criarValidadorDeToken(db, { local: () => true })("jwt");
    expect(r.data.user).toEqual(usuarioDoServidor);
  });
});

// A biblioteca de verdade: um JWT ES256 (o tipo de chave do projeto) assinado
// aqui, verificado offline com a chave pública. Garante que o formato que
// `criarValidadorDeToken` espera (data.claims.sub/role/email) é o que o
// supabase-js devolve, e que assinatura adulterada ou token vencido não passam.
describe("getClaims do supabase-js (ES256, sem rede)", () => {
  const b64 = dados => Buffer.from(dados).toString("base64url");
  const assinar = async (privada, kid, claims) => {
    const cabecalho = b64(JSON.stringify({ alg: "ES256", typ: "JWT", kid }));
    const corpo = b64(JSON.stringify(claims));
    const assinatura = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, privada, Buffer.from(`${cabecalho}.${corpo}`));
    return `${cabecalho}.${corpo}.${b64(new Uint8Array(assinatura))}`;
  };
  const preparar = async () => {
    const par = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
    const jwk = { ...(await crypto.subtle.exportKey("jwk", par.publicKey)), kid: "k1", alg: "ES256", use: "sig", key_ops: ["verify"] };
    const cliente = createClient("https://exemplo.supabase.co", "anon-key", { auth: { persistSession: false, autoRefreshToken: false } });
    return { par, jwk, cliente };
  };
  const agora = () => Math.floor(Date.now() / 1000);
  const claimsValidos = { sub: "auth-123", email: "a@arcd.test", role: "authenticated", aud: "authenticated", exp: agora() + 3600 };

  it("aceita token válido e expõe sub, email e role em data.claims", async () => {
    const { par, jwk, cliente } = await preparar();
    const jwt = await assinar(par.privateKey, "k1", claimsValidos);
    const { data, error } = await cliente.auth.getClaims(jwt, { keys: [jwk] });
    expect(error).toBeNull();
    expect(data.claims).toMatchObject({ sub: "auth-123", email: "a@arcd.test", role: "authenticated" });
  });

  it("rejeita assinatura adulterada e token vencido", async () => {
    const { par, jwk, cliente } = await preparar();
    const jwt = await assinar(par.privateKey, "k1", claimsValidos);
    const [c, , s] = jwt.split(".");
    const adulterado = `${c}.${b64(JSON.stringify({ ...claimsValidos, sub: "invasor" }))}.${s}`;
    const r1 = await cliente.auth.getClaims(adulterado, { keys: [jwk] });
    expect(r1.data?.claims?.sub).not.toBe("invasor");
    expect(r1.error).toBeTruthy();
    const vencido = await assinar(par.privateKey, "k1", { ...claimsValidos, exp: agora() - 60 });
    const r2 = await cliente.auth.getClaims(vencido, { keys: [jwk] });
    expect(r2.error).toBeTruthy();
  });
});
