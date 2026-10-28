// Material aplicado por tarefa (Onda 3.5 do roadmap de correção).
//
// O consumo de estoque carimbado com a tarefa (3.2), valorizado pelo custo
// do movimento, mostra quanto material foi efetivamente usado em cada tarefa. O recebimento de compras NÃO entra: todo recebimento já vira
// entrada de estoque, e somar os dois contaria o mesmo material duas vezes.
//
// Não vira o "custo real" do CPI: o orçamento não separa material de mão de
// obra por etapa, e comparar só o material com o valor agregado total
// deixaria o CPI otimista. Fica como "material aplicado", ao lado do custo
// completo lançado na tarefa (e como referência para lançá-lo).
const inativo = mov => ["cancelado","cancelada","estornado","estornada"].includes(String(mov?.status || "").toLowerCase());

export const custoApropriadoPorTarefa = (movEstoque = [], obraId = "") => {
  const porTarefa = new Map();
  (movEstoque || [])
    .filter(mov => mov?.tipo === "consumo" && mov.tarefaId && String(mov.obraId) === String(obraId) && !inativo(mov))
    .forEach(mov => {
      const valor = Number(mov.qtd || 0) * Number(mov.valorUnit || 0);
      const atual = porTarefa.get(String(mov.tarefaId)) || { material:0, movimentos:0 };
      porTarefa.set(String(mov.tarefaId), { material:atual.material + valor, movimentos:atual.movimentos + 1 });
    });
  return porTarefa;
};

export const aplicarCustoApropriado = (tarefas = [], porTarefa = new Map()) =>
  (tarefas || []).map(tarefa => {
    if (tarefa?.titulo) return tarefa;
    const apropriado = porTarefa.get(String(tarefa.id));
    return apropriado ? { ...tarefa, materialAplicado:apropriado.material } : tarefa;
  });

export const totalMaterialAplicado = tarefas =>
  (tarefas || []).filter(t => !t?.titulo).reduce((soma, t) => soma + Number(t.materialAplicado || 0), 0);
