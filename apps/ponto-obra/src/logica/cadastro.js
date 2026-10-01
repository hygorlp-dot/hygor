// Situação do cadastro da obra no aparelho (base única que veio do ARCD). Puro.
// Decide o que a tela de ponto oferece: obra sem rosto cadastrado leva ao
// cadastro facial; sem responsável com PIN, primeiro o ARCD.
export function resumoCadastro(cadastro) {
  const funcionarios = cadastro?.funcionarios || [];
  const ativos = new Set(funcionarios.map(f => f.id));
  const comRosto = new Set((cadastro?.biometrias || []).map(b => b.employeeId).filter(id => ativos.has(id))).size;
  return {
    totalFuncionarios: funcionarios.length,
    comRosto,
    semRostos: comRosto === 0,
    temResponsavel: (cadastro?.responsaveis || []).length > 0,
    sincronizado: !!cadastro?.sincronizadoEm,
  };
}
