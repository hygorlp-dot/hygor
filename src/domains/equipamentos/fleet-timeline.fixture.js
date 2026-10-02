// Cenário da timeline da frota (Setembro/2026, hoje = 15/09). Usado pelos
// testes de domínio, de componente e pelo e2e.
export const TIMELINE_HOJE = "2026-09-15";
export const TIMELINE_YM = "2026-09";

const tarifas = (dia, mes) => ({ dia, semana: 0, quinzena: 0, mes });
const rental = (id, equipamentoId, obraId, inicio, fim, quantidade = 1, extra = {}) =>
  ({ id, equipamentoId, obraId, inicio, fim, quantidade, status: "ativa", tarifas: tarifas(100, 1500), ...extra });

export const buildTimelineData = () => ({
  obras: [
    { id: "ob-a", name: "Terras Alpha", code: "K1-04" },
    { id: "ob-b", name: "Oásis Home Park", code: "P1-08" },
    { id: "ob-c", name: "Residencial Green Garden Parque das Árvores Torre Norte", code: "G2-01" },
  ],
  proprietariosEquip: [{ id: "own-n", nome: "Locadora Norte" }],
  equipamentos: [
    { id: "eq-bet", nome: "Betoneira 400 L", categoria: "Concreto", patrimonio: "EQ-007", quantidadeTotal: 1, tarifas: tarifas(100, 1500) },
    { id: "eq-and", nome: "Andaimes tubulares 1,50 m prensados com sapata ajustável", categoria: "Elevação", proprietarioId: "own-n", quantidadeTotal: 10, tarifas: tarifas(10, 150) },
    { id: "eq-ger", nome: "Gerador 5 kVA", categoria: "Energia", patrimonio: "EQ-021", quantidadeTotal: 1, tarifas: tarifas(80, 1200) },
    { id: "eq-esc", nome: "Escora metálica", categoria: "Elevação", proprietarioId: "own-n", quantidadeTotal: 4, tarifas: tarifas(5, 60) },
    { id: "eq-ser", nome: "Serra circular", categoria: "Corte", patrimonio: "EQ-033", quantidadeTotal: 1, status: "manutencao", tarifas: tarifas(40, 500) },
    { id: "eq-gru", nome: "Grua 30 m", categoria: "Elevação", proprietarioId: "own-n", quantidadeTotal: 1, tarifas: tarifas(500, 9000) },
    { id: "eq-vib", nome: "Vibrador de imersão", categoria: "Concreto", patrimonio: "EQ-012", quantidadeTotal: 1, tarifas: tarifas(30, 400) },
    { id: "eq-com", nome: "Compactador de solo", categoria: "Terraplenagem", patrimonio: "EQ-040", quantidadeTotal: 1, tarifas: tarifas(90, 1300) },
    { id: "eq-old", nome: "Martelete antigo", categoria: "Corte", ativo: false, quantidadeTotal: 1 },
  ],
  locacoesEquip: [
    rental("R-BET", "eq-bet", "ob-a", "2026-09-01", "2026-09-18"),
    rental("R-AND1", "eq-and", "ob-b", "2026-08-20", "2026-09-10", 6),
    rental("R-AND2", "eq-and", "ob-c", "2026-09-05", "2026-10-20", 3),
    rental("R-GER", "eq-ger", "ob-b", "2026-09-08", "2026-09-08"),
    rental("R-GRU", "eq-gru", "ob-c", "2026-09-10", ""),
    rental("R-VIB", "eq-vib", "ob-a", "2026-08-01", "2026-10-31"),
    rental("R-COM1", "eq-com", "ob-b", "2026-09-01", "2026-09-04"),
    rental("R-COM2", "eq-com", "ob-a", "2026-09-10", "2026-09-15"),
    rental("R-OLD", "eq-bet", "ob-b", "2026-06-01", "2026-06-10"),
  ],
  manutencoesEquip: [
    { id: "M-BET", equipamentoId: "eq-bet", inicio: "2026-09-12", fim: "2026-09-12", quantidade: 1, status: "programada", descricao: "Troca de correia" },
  ],
  equipmentUnavailability: [
    { id: "IND-GER", equipmentId: "eq-ger", type: "reservation", startDate: "2026-09-22", endDate: "2026-09-26", quantity: 1, workId: "ob-a", reason: "Reserva para concretagem", status: "ativa" },
  ],
  transferenciasEquip: [],
});

export const ownerNameFor = data => id => (data.proprietariosEquip || []).find(item => item.id === id)?.nome || "Terceiro";
