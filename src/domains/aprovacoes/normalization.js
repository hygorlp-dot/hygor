const registroValido = value => value && typeof value === "object" && !Array.isArray(value);

const resultadoPadrao = (etapa, instancia) => ({
  etapaId: etapa.id || "",
  status: Number(etapa.ordem || 0) === Number(instancia.ordemAtual || 0)
    && instancia.status === "em_andamento"
    ? "em_andamento"
    : "pendente",
  aprovadoresElegiveis: [],
  iniciadaEm: null,
  vencimentoEm: null,
  concluidaEm: null,
  motivoConclusao: "",
});

const normalizarResultado = (resultado, etapa, instancia) => {
  const base = resultadoPadrao(etapa, instancia);
  if (!registroValido(resultado)) return base;
  return {
    ...base,
    ...resultado,
    etapaId: resultado.etapaId || etapa.id || "",
    status: resultado.status || base.status,
    aprovadoresElegiveis: Array.isArray(resultado.aprovadoresElegiveis)
      ? resultado.aprovadoresElegiveis.filter(registroValido)
      : [],
  };
};

// Instâncias antigas viviam no blob sem normalizador dedicado. Um merge
// interrompido podia deixar `null` na coleção ou em `resultadosEtapas`; como
// o menu global consulta `status` em todo render, um único registro inválido
// derrubava a aplicação inteira. A normalização preserva os registros válidos,
// realinha cada resultado com sua etapa e descarta somente entradas impossíveis.
export const normalizeApprovalInstances = instances => (
  Array.isArray(instances) ? instances : []
).filter(registroValido).map(instancia => {
  const snapshot = registroValido(instancia.snapshotPolitica)
    ? instancia.snapshotPolitica
    : null;
  const etapasOriginais = Array.isArray(snapshot?.etapas) ? snapshot.etapas : [];
  const resultadosOriginais = Array.isArray(instancia.resultadosEtapas)
    ? instancia.resultadosEtapas
    : [];
  const pares = etapasOriginais
    .map((etapa, index) => ({ etapa, resultado: resultadosOriginais[index] }))
    .filter(({ etapa }) => registroValido(etapa));

  if (!snapshot) {
    return {
      ...instancia,
      resultadosEtapas: resultadosOriginais.filter(registroValido).map(resultado => ({
        ...resultado,
        status: resultado.status || "pendente",
        aprovadoresElegiveis: Array.isArray(resultado.aprovadoresElegiveis)
          ? resultado.aprovadoresElegiveis.filter(registroValido)
          : [],
      })),
    };
  }

  const etapas = pares.map(({ etapa }) => etapa);
  const resultadosEtapas = pares.map(({ etapa, resultado }) => (
    normalizarResultado(resultado, etapa, instancia)
  ));
  return {
    ...instancia,
    snapshotPolitica: { ...snapshot, etapas },
    resultadosEtapas,
  };
});
