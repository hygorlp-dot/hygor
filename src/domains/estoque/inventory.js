// E1.2 (roadmap 7,6 → 9): inventário com ajuste. A obra conta o material; o
// servidor compara com o saldo do sistema, guarda a contagem e, quando
// aplicada, gera os ajustes (sobra → "ajuste", falta → "ajuste_saida").
// Diferença acima da alçada do engenheiro (a mesma das compras, R$ 5.000 por
// padrão) espera o Administrador. Como a perda avulsa, o ajuste não lança nada
// na DRE: o custo do material já entrou pela nota.
import { calcSaldos, custoMedioPonderado, saldoDe } from "./calculations.js";
import { limiteAprovacaoEngenheiro } from "../compras/purchase-approval.js";

export const INVENTORY_STATUS = Object.freeze({
  APLICADO: "aplicado",
  AGUARDANDO: "aguardando_aprovacao",
  REJEITADO: "rejeitado",
});

const arred = (valor, casas = 4) => Math.round(Number(valor || 0) * 10 ** casas) / 10 ** casas;
const reais = valor => Math.round(Number(valor || 0) * 100) / 100;

export const inventarioPendenteDaObra = (data, obraId) => (data?.inventarios || [])
  .find(item => item?.obraId === obraId && item.status === INVENTORY_STATUS.AGUARDANDO) || null;

// Monta as linhas da contagem a partir do saldo de agora. Só o servidor chama
// com o saldo vigente; a tela usa a mesma função para mostrar a prévia.
export const linhasDoInventario = (data, obraId, contagens = []) => {
  const saldos = calcSaldos(data?.movEstoque);
  const materiais = new Map((data?.materiais || []).map(item => [String(item.id), item]));
  return contagens.map(contagem => {
    const materialId = String(contagem?.materialId || "");
    const material = materiais.get(materialId);
    const saldoSistema = arred(saldoDe(saldos, obraId, materialId));
    const contado = arred(contagem?.contado);
    const custo = custoMedioPonderado(data?.movEstoque, materialId) ?? Number(material?.precoMedio || 0);
    return { materialId, saldoSistema, contado, diferenca: arred(contado - saldoSistema), valorUnit: arred(custo) };
  });
};

export const resumoDoInventario = linhas => {
  const comDiferenca = linhas.filter(linha => Math.abs(linha.diferenca) > 1e-6);
  const valor = sinal => reais(comDiferenca.filter(linha => Math.sign(linha.diferenca) === sinal)
    .reduce((soma, linha) => soma + Math.abs(linha.diferenca) * linha.valorUnit, 0));
  const valorFaltas = valor(-1), valorSobras = valor(1);
  return { itensComDiferenca: comDiferenca.length, valorFaltas, valorSobras, valorDiferencas: reais(valorFaltas + valorSobras) };
};

export const precisaAprovacao = (data, resumo, actorRole) =>
  actorRole !== "admin" && resumo.valorDiferencas > limiteAprovacaoEngenheiro(data) + 0.005;

// Movimentos que aplicam a contagem. Recusa se a falta já não cabe no saldo
// atual (o estoque mudou entre a contagem e a aprovação).
export const ajustesDoInventario = (data, inventario) => {
  const saldos = calcSaldos(data?.movEstoque);
  const movimentos = [];
  for (const linha of inventario.linhas || []) {
    if (Math.abs(linha.diferenca) <= 1e-6) continue;
    const qtd = arred(Math.abs(linha.diferenca));
    if (linha.diferenca < 0 && qtd > saldoDe(saldos, inventario.obraId, linha.materialId) + 1e-4) {
      return { ok: false, reason: "O estoque desta obra mudou desde a contagem. Faça uma nova contagem." };
    }
    movimentos.push({
      id: `${inventario.id}-${linha.materialId}`, obraId: inventario.obraId, materialId: linha.materialId,
      tipo: linha.diferenca > 0 ? "ajuste" : "ajuste_saida", qtd, valorUnit: linha.valorUnit,
      data: inventario.data, descricao: `Inventário de ${inventario.data}: ${inventario.motivo}`.trim(),
      transacaoId: "", servicoId: "", etapa: "", inventarioId: inventario.id,
    });
  }
  return { ok: true, movimentos };
};
