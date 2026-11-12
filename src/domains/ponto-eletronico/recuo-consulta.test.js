import { expect, it } from 'vitest';
import { criarRecuoConsulta } from './recuo-consulta.js';
it('limita recuo de falhas comuns a cinco minutos e reinicia após sucesso', () => {
  let agora = 0;
  const recuo = criarRecuoConsulta({ agora: () => agora });
  for (const esperado of [40_000, 80_000, 160_000, 300_000, 300_000]) {
    recuo.falha(503); expect(recuo.restante()).toBe(esperado);
    agora += esperado; expect(recuo.restante()).toBe(0);
  }
  recuo.sucesso(); recuo.falha(0); expect(recuo.restante()).toBe(40_000);
});
