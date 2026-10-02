// Massa da Central de cobranças. `HOJE` fixo; nada depende do relógio.
export const BILLING_HOJE = "2026-09-15";
export const BILLING_YM = "2026-09";

const t = (dia, semana = 0, mes = 0) => ({ dia, semana, quinzena: 0, mes });

// Setembro/2026:
//  B1  Betoneira (própria)          · Terras Alpha · 30 dias          -> R$ 1.500
//  A1  Andaime x2 (terceiro)        · Terras Alpha · 10 dias          -> receita 200, repasse 160
//  T1  Escora (terceiro, SEM tarifa de custo) · Terras Alpha · 5 dias -> receita 250, repasse 0  (pendência)
//  G1  Gerador (próprio) 25% desc.  · Oásis        · 21 dias          -> bruto 4.200, desconto 1.050 (desconto elevado)
//  S1  Serra (própria, SEM tarifa)  · Oásis        · 2 dias           -> sem cobrança (pendência)
//  C1  Grua (terceiro, custo > receita) · Green Garden · 10 dias      -> receita 1.000, repasse 1.500 (obra negativa)
// Agosto/2026: B0 Betoneira · Terras Alpha · 31 dias -> R$ 1.600 (base de comparação)
// Manutenção da betoneira em setembro: R$ 300 (paga pela empresa).
export const buildBillingData = () => ({
  config: { companyName: "ARCD Construtech" },
  obras: [
    { id: "ob-a", name: "Terras Alpha", code: "K1-04", status: "active" },
    { id: "ob-b", name: "Oásis Home Park", code: "P1-08", status: "active" },
    { id: "ob-c", name: "Green Garden", code: "G2-01", status: "active" },
  ],
  proprietariosEquip: [{ id: "own-1", nome: "Locadora Norte" }],
  equipamentos: [
    { id: "eq-bet", nome: "BETONEIRA 400 L", patrimonio: "EQ-023", categoria: "Concreto", quantidadeTotal: 1, tarifas: t(100, 500, 1500), ativo: true },
    { id: "eq-and", nome: "Andaime tubular", patrimonio: "EQ-040", categoria: "Acesso", proprietarioId: "own-1", quantidadeTotal: 10, tarifas: t(10), tarifasCusto: t(8), ativo: true },
    { id: "eq-esc", nome: "Escora metálica", patrimonio: "EQ-061", categoria: "Acesso", proprietarioId: "own-1", quantidadeTotal: 4, tarifas: t(50), ativo: true },
    { id: "eq-ger", nome: "Gerador 5 kVA", patrimonio: "EQ-051", categoria: "Energia", quantidadeTotal: 1, tarifas: t(200), ativo: true },
    { id: "eq-ser", nome: "Serra circular", patrimonio: "EQ-077", categoria: "Corte", quantidadeTotal: 1, tarifas: {}, ativo: true },
    { id: "eq-gru", nome: "Grua 30 m", patrimonio: "EQ-090", categoria: "Içamento", proprietarioId: "own-1", quantidadeTotal: 1, tarifas: t(100), tarifasCusto: t(150), ativo: true },
  ],
  equipmentUnits: [],
  locacoesEquip: [
    { id: "B1", equipamentoId: "eq-bet", obraId: "ob-a", inicio: "2026-09-01", fim: "", quantidade: 1, status: "ativa" },
    { id: "A1", equipamentoId: "eq-and", obraId: "ob-a", inicio: "2026-09-01", fim: "2026-09-10", quantidade: 2, status: "ativa" },
    { id: "T1", equipamentoId: "eq-esc", obraId: "ob-a", inicio: "2026-09-01", fim: "2026-09-05", quantidade: 1, status: "ativa" },
    { id: "G1", equipamentoId: "eq-ger", obraId: "ob-b", inicio: "2026-09-10", fim: "", quantidade: 1, status: "ativa", descontoPct: 25 },
    { id: "S1", equipamentoId: "eq-ser", obraId: "ob-b", inicio: "2026-09-05", fim: "2026-09-06", quantidade: 1, status: "ativa" },
    { id: "C1", equipamentoId: "eq-gru", obraId: "ob-c", inicio: "2026-09-01", fim: "2026-09-10", quantidade: 1, status: "ativa" },
    { id: "B0", equipamentoId: "eq-bet", obraId: "ob-a", inicio: "2026-08-01", fim: "2026-08-31", quantidade: 1, status: "ativa" },
  ],
  manutencoesEquip: [{ id: "M1", equipamentoId: "eq-bet", data: "2026-09-12", custo: 300, pagoPor: "empresa", status: "concluida" }],
  rentalChargeItems: [
    { id: "ci-B1", rentalId: "B1", workId: "ob-a", competence: "2026-09", status: "billed", netAmountCents: 150000 },
    { id: "ci-G1", rentalId: "G1", workId: "ob-b", competence: "2026-09", status: "billed", netAmountCents: 300000 },
    { id: "ci-C1", rentalId: "C1", workId: "ob-c", competence: "2026-09", status: "measured", netAmountCents: 100000 },
  ],
  rentalInvoices: [
    { id: "inv-B1", rentalId: "B1", workId: "ob-a", number: "FAT-202609-001", competence: "2026-09", status: "paid", netAmountCents: 150000, receivedAmountCents: 150000, openAmountCents: 0, dueDate: "2026-09-20" },
    { id: "inv-G1", rentalId: "G1", workId: "ob-b", number: "FAT-202609-002", competence: "2026-09", status: "issued", netAmountCents: 300000, receivedAmountCents: 0, openAmountCents: 300000, dueDate: "2026-09-10" },
  ],
  transferenciasEquip: [], equipmentUnavailability: [],
});
