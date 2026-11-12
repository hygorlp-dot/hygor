// Apenas consultas. Não usar no envio de batidas nem em filas de gravação.
export function criarRecuoConsulta({ agora = Date.now } = {}) {
  let espera = 20_000, permitidoEm = 0;
  return {
    restante: () => Math.max(0, permitidoEm - agora()),
    sucesso() { espera = 20_000; permitidoEm = 0; },
    falha(status) {
      // A API legada também retorna 401 quando a leitura de perfis falha.
      // Limpar dados protege o acesso; recuo finito permite recuperar sem recarga.
      espera = (status >= 401 && status <= 403) ? 300_000
          : Math.min(300_000, espera * 2);
      permitidoEm = agora() + espera;
    },
  };
}
