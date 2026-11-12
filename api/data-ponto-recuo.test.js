// @vitest-environment node
import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { criarRecuoConsulta } from '../src/domains/ponto-eletronico/recuo-consulta.js';

const banco = vi.hoisted(() => ({ falhaPerfil: false, falhaConsulta: false, consultas: [] }));
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({
  auth: { getUser: async () => ({ data: { user: { id: 'auth-test' } }, error: null }) },
  from: tabela => {
    banco.consultas.push(tabela);
    const resultado = () => tabela === 'company_app_data'
      ? banco.falhaPerfil ? { error: { status: 402, message: 'quota' } }
        : { data: { value: { obras: [], usuarios: [{ id: 'u', role: 'admin', active: true, authUserId: 'auth-test' }] } } }
      : banco.falhaConsulta ? { error: { status: 402, message: 'quota' } } : { data: [] };
    const q = { select: () => q, eq: () => q, order: () => q,
      maybeSingle: async () => resultado(), then: (ok, fail) => Promise.resolve(resultado()).then(ok, fail) };
    return q;
  },
}) }));
let handler;
beforeAll(async () => {
  vi.stubEnv('SUPABASE_URL', 'https://test.invalid');
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-only-not-a-key');
  handler = (await import('./data.js')).default;
});
beforeEach(() => { banco.falhaPerfil = false; banco.falhaConsulta = false; banco.consultas = []; });
afterAll(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });
async function consultar() {
  const res = { status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; }, setHeader() {}, getHeader() {} };
  await handler({ method: 'POST', headers: {}, body: { action: 'ponto-estabelecimentos', accessToken: 'fake-session' } }, res);
  return res;
}
it('quota na leitura real de perfis vira 401, nega dados, mas permite recuperação finita', async () => {
  banco.falhaPerfil = true;
  const negada = await consultar();
  expect(negada.statusCode).toBe(401);
  expect(negada.body.estabelecimentos).toBeUndefined();
  expect(banco.consultas).not.toContain('ponto_estabelecimentos');
  let agora = 0;
  const recuo = criarRecuoConsulta({ agora: () => agora });
  recuo.falha(negada.statusCode);
  expect(recuo.restante()).toBe(300_000);
  agora = 300_000; expect(recuo.restante()).toBe(0);
  banco.falhaPerfil = false;
  const recuperada = await consultar();
  expect(recuperada.statusCode).toBe(200);
  expect(recuperada.body.estabelecimentos).toEqual([]);
});
it('quota pós-autenticação é sanitizada em 500 na rota real e também desacelera sem travar', async () => {
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  banco.falhaConsulta = true;
  const resposta = await consultar();
  expect(resposta.statusCode).toBe(500);
  expect(resposta.body.code).toBe('DATA_INTERNAL_ERROR');
  expect(resposta.body.error).not.toContain('quota');
  let agora = 0;
  const recuo = criarRecuoConsulta({ agora: () => agora });
  for (const espera of [40_000, 80_000, 160_000, 300_000]) {
    recuo.falha(resposta.statusCode); expect(recuo.restante()).toBe(espera); agora += espera;
  }
  banco.falhaConsulta = false;
  expect((await consultar()).statusCode).toBe(200);
  recuo.sucesso(); expect(recuo.restante()).toBe(0);
  log.mockRestore();
});
