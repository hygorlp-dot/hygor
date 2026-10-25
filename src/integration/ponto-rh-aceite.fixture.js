// Exclusivo para testes locais. Não é seed de produção nem cadastro da K1-10.
export function dadosEnsaio() {
  return {
    obras: [{ id: 'obra-a', name: 'Ensaio A' }, { id: 'obra-b', name: 'Ensaio B' }],
    usuarios: [
      { id: 'u-admin', nome: 'Admin fictício', role: 'admin', active: true },
      { id: 'u-enc', nome: 'Encarregado fictício', role: 'user', active: true },
      { id: 'u-rh', nome: 'RH fictício', role: 'rh', active: true },
      { id: 'u-fin', nome: 'Financeiro fictício', role: 'financeiro', active: true },
    ],
    employees: [
      { id: 'e1', name: 'Pessoa diária fictícia', cpf: '123.456.789-09', obra: 'obra-a', active: true, remunerationMode: 'daily', dailyRate: 120, vtDaily: 0, vrDaily: 0, workdayHours: 8 },
      { id: 'e2', name: 'Pessoa CLT fictícia', cpf: '987.654.321-00', obra: 'obra-a', active: true, employmentType: 'clt', remunerationMode: 'clt', remunerationEffectiveFrom: '2026-10-01', startDate: '2026-10-01', monthlySalary: 3000, vtDaily: 0, vrDaily: 0, workdayHours: 8 },
    ],
    terceirizados: [], attendance: {}, advances: [],
    titulosFolha: [], pagamentosFolha: [], transacoes: [],
    notasFiscais: [], pedidos: [], medicoes: [], medicoesTerc: [], caixaObra: [],
    outrasDesp: [], despesasEmpresa: [], historicoConc: [], reconciliationLinks: [],
  };
}

// Valores deliberadamente simples; não definem política de parcelas CLT.
export const ensaio = Object.freeze({
  periodoInicio: '2026-10-21', periodoFim: '2026-11-05',
  diaria: 120, adiantamento: 20, liquidoDiaria: 100, pagamentoParcial: 40, saldo: 60,
  minutosObraA: 240, minutosObraB: 240,
});
