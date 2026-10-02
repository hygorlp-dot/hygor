// Massa de teste compartilhada pelos testes da central operacional de
// locações (domínio e componente). `HOJE` é fixo: nada aqui depende do relógio.
export const HOJE = "2026-09-15"; // terça-feira

const tarifas = (dia, semana = 0, mes = 0) => ({ dia, semana, quinzena: 0, mes });
const itemFaturado = (rentalId, net) => ({ id: `ci-${rentalId}`, rentalId, workId: "ob-a", competence: "2026-08", status: "billed", netAmountCents: net });

// Setembro/2026:
//  L1  Betoneira · Terras Alpha  · em andamento, vence em 3 dias, medida e não faturada -> A faturar
//  L2  Andaime x4 · Oásis        · encerrada em 05/09, fatura quitada                    -> Encerrada
//  L3  Gerador · Terras Alpha    · programada (20/09)                                    -> Sem medição
//  L4  Betoneira · Oásis         · encerrada em julho (fora de setembro)
//  L5  Andaime x2 · Terras Alpha · cancelada
//  L6  Gerador · Oásis           · em andamento, fatura com recebimento parcial          -> Parcial
//  L7  Andaime x1 · Terras Alpha · em andamento, fatura sem recebimento                  -> Pendente
export const buildRentalData = () => ({
  obras: [
    { id: "ob-a", name: "Terras Alpha", code: "K1-04" },
    { id: "ob-b", name: "Oásis Home Park", code: "P1-08" },
  ],
  proprietariosEquip: [{ id: "own-1", nome: "Locadora Norte" }],
  equipamentos: [
    { id: "eq-bet", nome: "BETONEIRA 400 L", patrimonio: "EQ-023", categoria: "Concreto", proprietarioId: "", quantidadeTotal: 1, tarifas: tarifas(100, 500, 1500), ativo: true },
    { id: "eq-and", nome: "Andaime tubular", patrimonio: "EQ-040", categoria: "Acesso", proprietarioId: "own-1", quantidadeTotal: 10, tarifas: tarifas(10), ativo: true },
    { id: "eq-ger", nome: "Gerador 5 kVA", patrimonio: "EQ-051", categoria: "Energia", proprietarioId: "", quantidadeTotal: 1, tarifas: tarifas(200), ativo: true },
  ],
  equipmentUnits: [],
  locacoesEquip: [
    { id: "L1", equipamentoId: "eq-bet", obraId: "ob-a", inicio: "2026-09-01", fim: "", plannedEndDate: "2026-09-18", quantidade: 1, status: "ativa", lifecycleState: "active", version: 3 },
    { id: "L2", equipamentoId: "eq-and", obraId: "ob-b", inicio: "2026-08-10", fim: "2026-09-05", quantidade: 4, status: "ativa", version: 2 },
    { id: "L3", equipamentoId: "eq-ger", obraId: "ob-a", inicio: "2026-09-20", fim: "", quantidade: 1, status: "ativa", version: 1 },
    { id: "L4", equipamentoId: "eq-bet", obraId: "ob-b", inicio: "2026-07-01", fim: "2026-07-31", quantidade: 1, status: "ativa", version: 1 },
    { id: "L5", equipamentoId: "eq-and", obraId: "ob-a", inicio: "2026-09-02", fim: "", quantidade: 2, status: "cancelada", version: 2, cancelledAt: "2026-09-03T10:00:00Z", cancellationReason: "Pedido duplicado" },
    { id: "L6", equipamentoId: "eq-ger", obraId: "ob-b", inicio: "2026-09-10", fim: "", quantidade: 1, status: "ativa", version: 1 },
    { id: "L7", equipamentoId: "eq-and", obraId: "ob-a", inicio: "2026-09-03", fim: "", quantidade: 1, status: "ativa", version: 1 },
  ],
  rentalChargeItems: [
    { id: "ci-L1", rentalId: "L1", workId: "ob-a", competence: "2026-09", status: "measured", netAmountCents: 150000 },
    itemFaturado("L2", 20000), itemFaturado("L6", 100000), itemFaturado("L7", 28000),
  ],
  rentalInvoices: [
    { id: "inv-L2", rentalId: "L2", workId: "ob-b", number: "FAT-202608-001", status: "paid", netAmountCents: 20000, receivedAmountCents: 20000, openAmountCents: 0 },
    { id: "inv-L6", rentalId: "L6", workId: "ob-b", number: "FAT-202609-002", status: "partially_paid", netAmountCents: 100000, receivedAmountCents: 40000, openAmountCents: 60000 },
    { id: "inv-L7", rentalId: "L7", workId: "ob-a", number: "FAT-202609-003", status: "issued", netAmountCents: 28000, receivedAmountCents: 0, openAmountCents: 28000 },
  ],
  manutencoesEquip: [], transferenciasEquip: [], equipmentUnavailability: [],
});
