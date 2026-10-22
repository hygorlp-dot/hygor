// Tradução de falhas em mensagens operacionais para quem está na obra.
// Regra: nunca mostrar stack trace nem texto técnico longo ao trabalhador;
// sempre dizer o que acontece com a batida e o que fazer. Puro.

export const TIPO_FALHA = Object.freeze({
  OK: "ok",
  SEM_REDE: "sem_rede",
  SERVIDOR: "servidor_indisponivel",
  REVOGADO: "aparelho_revogado",
  DESCONHECIDO: "aparelho_desconhecido",
  RECUSADO: "recusado",
});

// r = resposta de api() (conexao.js): { ok, status, error, code }.
export function classificarResposta(r) {
  if (r?.ok) return { tipo: TIPO_FALHA.OK, mensagem: "" };
  if (r?.code === "APARELHO_REVOGADO") return { tipo: TIPO_FALHA.REVOGADO, mensagem: "Este aparelho foi desativado no ARCD. As batidas que ainda não foram enviadas continuam guardadas nele." };
  if (r?.code === "APARELHO_DESCONHECIDO" || r?.code === "APARELHO_SEM_TOKEN") return { tipo: TIPO_FALHA.DESCONHECIDO, mensagem: "O ARCD não reconhece mais este aparelho. Pareie de novo com um código gerado no ARCD." };
  const status = Number(r?.status || 0);
  if (status === 0) return { tipo: TIPO_FALHA.SEM_REDE, mensagem: "Sem internet. As batidas ficam guardadas no aparelho e são enviadas quando a conexão voltar." };
  if (status >= 500 || status === 408 || status === 429) return { tipo: TIPO_FALHA.SERVIDOR, mensagem: "O ARCD está temporariamente indisponível. As batidas ficam guardadas e o envio é repetido sozinho." };
  return { tipo: TIPO_FALHA.RECUSADO, mensagem: resumirTexto(r?.error) || `O ARCD recusou o pedido (HTTP ${status}).` };
}

// Primeira linha, sem "at ..."/nomes de classe Java, limitada.
export function resumirTexto(texto, limite = 160) {
  const linha = String(texto ?? "").split("\n").map(l => l.trim()).find(l => l && !/^at\s/.test(l)) || "";
  const semJava = linha.replace(/^[a-z]+(\.[a-zA-Z0-9_$]+)+(Exception|Error):\s*/, "");
  return semJava.length > limite ? `${semJava.slice(0, limite - 1)}…` : semJava;
}

// Mensagem para erros inesperados (exceções) por contexto da operação.
const CONTEXTO = {
  modelos: "O reconhecimento facial não carregou neste aparelho. O encarregado pode registrar o ponto pelo modo Encarregado.",
  camera: "A câmera não respondeu. Tente de novo; se continuar, o encarregado pode registrar o ponto.",
  banco: "O banco de dados do aparelho não abriu. Nenhuma batida foi apagada. Toque em \"Tentar de novo\"; se continuar, chame o suporte do ARCD.",
  sessao: "Não foi possível ler o pareamento guardado no aparelho. Toque em \"Tentar de novo\".",
  pareamento: "O pareamento não foi concluído. Gere um código novo no ARCD e tente de novo.",
  batida: "A batida NÃO foi registrada. Tente de novo; se continuar, avise o encarregado.",
  sincronizacao: "A sincronização falhou. As batidas continuam guardadas e o envio é repetido sozinho.",
  cadastro: "O cadastro do rosto não foi concluído. Tente de novo.",
};
// Para o trabalhador na tela de ponto: só o que fazer, sem o detalhe técnico
// (o detalhe fica no Diagnóstico do modo Encarregado).
export const mensagemParaTrabalhador = contexto => CONTEXTO[contexto] || "Algo deu errado. Tente de novo.";

export function mensagemDeErro(contexto, erro) {
  const base = CONTEXTO[contexto] || "Algo deu errado. Tente de novo.";
  const detalhe = resumirTexto(erro?.message || erro, 90);
  return detalhe ? `${base} (detalhe: ${detalhe})` : base;
}

// Permissão de câmera (useCameraPermissions do expo-camera).
// "configuracoes": negada de vez - pedir de novo não abre nada no Android,
// então o caminho é o botão que abre as configurações do app.
export function estadoPermissaoCamera(permissao) {
  if (!permissao) return "carregando";
  if (permissao.granted) return "concedida";
  return permissao.canAskAgain === false ? "configuracoes" : "pedir";
}
