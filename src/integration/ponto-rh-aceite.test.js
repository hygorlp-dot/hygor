// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { criarServidor, criarAparelho } from '../../apps/ponto-obra/src/logica/cenario.test-helper.js';
import { sincronizarCadastro, enviarPendentes } from '../../apps/ponto-obra/src/logica/sincronizacao.js';
import { calculateAttendanceDayCost } from '../domains/ponto/payroll.js';
import { ADVANCE_COMMAND, applyAdvanceCommand, advanceDeductionForPeriod } from '../domains/rh/advance-commands.js';
import { registrarPagamentoEConciliar } from '../domains/conciliacao/mutations.js';
import { cltAdvanceHtml } from '../domains/ponto/clt-report.js';
import { dadosEnsaio, ensaio } from './ponto-rh-aceite.fixture.js';

vi.setConfig({ testTimeout: 60000, hookTimeout: 60000 });
let servidor;
afterEach(async () => { await servidor?.pg.close(); servidor = null; });
const sync = ap => sincronizarCadastro({ armazem: ap.armazem, api: ap.api, monotonico: ap.monotonico });
const enviar = ap => enviarPendentes({ armazem: ap.armazem, api: ap.api });

describe('aceite operacional: trecho app → ARP → consulta → apropriação (SQL real local)', () => {
  it('preserva identidade, quatro batidas offline, intervalo e duas obras após resposta perdida', async () => {
    servidor = await criarServidor({ dados: dadosEnsaio() });
    const a = await criarAparelho(servidor, { obraId: 'obra-a' });
    const b = await criarAparelho(servidor, { obraId: 'obra-b' });
    await sync(a); await sync(b);
    for (const ap of [a, b]) {
      expect((await ap.armazem.cadastro()).funcionarios.map(e => e.id).sort()).toEqual(['e1', 'e2']);
      ap.online = false;
    }
    const e1 = await a.bater(); // 07:00 local
    a.passar(4 * 3600000);
    const e2 = await a.bater(); // 11:00 local
    b.monotonicoMs += 5 * 3600000;
    servidor.relogioServidor += 3600000;
    const e3 = await b.bater(); // 12:00 local, outra obra
    b.passar(4 * 3600000);
    const e4 = await b.bater(); // 16:00 local
    expect(await servidor.eventos()).toHaveLength(0);
    expect(servidor.dados.attendance).toEqual({}); // sem envio não inventa falta
    a.online = true; b.online = true;
    a.perderResposta = 1;
    expect(await enviar(a)).toMatchObject({ enviadas: 0, semRede: true });
    expect(await a.armazem.eventosPendentes(10)).toHaveLength(2);
    expect(await enviar(a)).toMatchObject({ enviadas: 2 });
    expect(await enviar(b)).toMatchObject({ enviadas: 2 });
    expect(await servidor.eventos()).toHaveLength(4);
    expect(await servidor.fiscais(servidor.estabelecimentoA)).toHaveLength(4);
    const consulta = await servidor.admin('ponto-marcacoes', { de: '2026-10-01T00:00:00Z', ate: '2026-10-02T00:00:00Z' });
    expect(consulta.status).toBe(200);
    expect(new Set(consulta.json.marcacoes.map(e => e.id))).toEqual(new Set([e1.eventId, e2.eventId, e3.eventId, e4.eventId]));
    const proposta = await servidor.admin('ponto-apropriacao-propor', { employeeId: 'e1', data: '2026-10-01' });
    expect(proposta.json.avisos).toEqual([]);
    expect(proposta.json.intervalos.map(i => [i.obraApropriadaId, (Date.parse(i.fim) - Date.parse(i.inicio)) / 60000])).toEqual([
      ['obra-a', ensaio.minutosObraA], ['obra-b', ensaio.minutosObraB],
    ]);
    for (const intervalo of proposta.json.intervalos) {
      const salvo = await servidor.admin('ponto-apropriacao-salvar', { apropriacao: { ...intervalo, employeeId: 'e1', data: '2026-10-01', motivo: 'Conferência do ensaio' } });
      expect(salvo.status).toBe(200);
    }
    const rows = await servidor.sql('select employee_id, obra_apropriada_id from ponto_apropriacoes');
    expect(rows).toHaveLength(2);
    expect(rows.every(r => r.employee_id === 'e1')).toBe(true);
    const repetir = await a.api('ponto-enviar-marcacoes', { eventos: [e1, e2] });
    expect(repetir.resultados.map(r => r.status)).toEqual(['ja_registrado', 'ja_registrado']);
    expect(await servidor.eventos()).toHaveLength(4);
  });

  it('marca saída ausente como ocorrência e recusa gestão por usuário sem papel autorizado', async () => {
    servidor = await criarServidor({ dados: dadosEnsaio() });
    const ap = await criarAparelho(servidor);
    await sync(ap); const evento = await ap.bater(); await enviar(ap);
    const proposta = await servidor.admin('ponto-apropriacao-propor', { employeeId: 'e1', data: '2026-10-01' });
    expect(proposta.json.intervalos).toEqual([]);
    expect(proposta.json.avisos).toMatchObject([{ tipo: 'sem_saida', eventId: evento.eventId }]);
    const tentativa = await servidor.tratar({ action: 'ponto-apropriacao-salvar', body: { accessToken: 'u-enc', apropriacao: {} } });
    expect(tentativa.status).toBe(403);
    expect(await servidor.sql('select * from ponto_apropriacoes')).toEqual([]);
  });
});

describe('aceite operacional: cálculo e conciliação isolados, sem ligação automática ao fechamento', () => {
  it('diária 120 menos adiantamento 20 resulta em 100; conciliar 40 deixa 60 sem novo custo', () => {
    const dados = dadosEnsaio();
    const criado = applyAdvanceCommand(dados, {
      type: ADVANCE_COMMAND.PAYROLL_ADVANCE_CREATED, actorId: 'u-rh', actorName: 'RH fictício', expectedVersion: 0,
      payload: { advance: { id: 'ensaio-adiantamento', empId: 'e1', date: '2026-10-21', amount: ensaio.adiantamento, installmentCount: 1, firstDueDate: '2026-11-05' } },
    }, '2026-10-21T12:00:00Z');
    expect(criado.ok).toBe(true);
    const custo = calculateAttendanceDayCost({ employee: dados.employees[0], record: { status: 'P' } });
    const desconto = advanceDeductionForPeriod(criado.data.advances[0], ensaio.periodoInicio, ensaio.periodoFim);
    expect(custo.laborCost).toBe(120);
    expect(desconto).toBe(20);
    expect(custo.laborCost - desconto).toBe(100);
    // Entrada explícita do teste: NÃO simula que aprovação já criou este título.
    dados.titulosFolha = [{ id: 'ensaio-titulo', employeeId: 'e1', competencia: '2026-11', periodoInicio: ensaio.periodoInicio, periodoFim: ensaio.periodoFim,
      bruto: 120, beneficios: 0, adiantamentos: 20, descontos: 0, liquido: 100, valorPago: 0, saldo: 100, status: 'em_aberto', liquidacoes: [], rateiosPorObra: [{ obraId: 'obra-a', valor: 50 }, { obraId: 'obra-b', valor: 50 }] }];
    dados.transacoes = [{ id: 'ensaio-banco', extratoId: 'ensaio-extrato', data: '2026-11-06', valor: -40, status: 'pendente' }];
    const resultado = registrarPagamentoEConciliar(dados, { transacaoId: 'ensaio-banco', tipo: 'tituloFolha', entidadeId: 'ensaio-titulo', valor: 40, operador: { id: 'u-fin', nome: 'Financeiro fictício' } });
    expect(resultado.resumo.ok).toBe(true);
    expect(resultado.data.titulosFolha[0]).toMatchObject({ saldo: ensaio.saldo, status: 'parcial' });
    expect(resultado.data.reconciliationLinks).toHaveLength(1);
    expect(resultado.data.outrasDesp).toEqual([]);
    expect(resultado.data.despesasEmpresa).toEqual([]);
    const repetido = registrarPagamentoEConciliar(resultado.data, { transacaoId: 'ensaio-banco', tipo: 'tituloFolha', entidadeId: 'ensaio-titulo', valor: 40, operador: { id: 'u-fin' } });
    expect(repetido.resumo.ok).toBe(false);
    expect(repetido.data).toEqual(resultado.data);
  });

  it('emitir recibo mantém assinatura e data em branco e não altera dados financeiros', () => {
    const data = dadosEnsaio();
    const entrada = { company: { companyName: 'Empresa fictícia' }, employee: data.employees[0], advance: { id: 'ensaio-adiantamento', date: '2026-10-21', amount: 20 } };
    const antes = structuredClone(entrada);
    const html = cltAdvanceHtml(entrada);
    expect(html).toContain('Data do recebimento: ____/____/________');
    expect(html).toContain('Declaração a ser assinada somente após o recebimento');
    expect(html.includes('não registra nova saída financeira nem comprova transferência bancária')).toBe(true);
    expect(entrada).toEqual(antes);
    expect(data.pagamentosFolha).toEqual([]);
  });
});
