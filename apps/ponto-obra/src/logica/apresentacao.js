// O que cada tela MOSTRA, decidido fora do React (puro, testado no Node).
// Nada aqui decide regra de batida: só traduz estado já existente em texto,
// tom e ícone. Regra de ouro do design: estado = ícone + texto + cor.

// ---------- Status do aparelho (canto da tela de ponto) ----------
// Conciso: o detalhe (mensagem do servidor, estabelecimento etc.) fica em
// Encarregado → Sincronização / Diagnóstico.
// situacao = { online, pendentes, aviso }; horaConfiavel = relogio.agora().
export function statusDoAparelho({ online = false, pendentes = 0, aviso = "" } = {}, { horaConfiavel = true } = {}) {
  const fila = pendentes > 0 ? `${pendentes} ${pendentes === 1 ? "pendente" : "pendentes"}` : "";
  let s;
  // Hora é o aviso mais longo: sem a fila junto, cabe ao lado da obra em 360 px.
  if (!horaConfiavel) s = { tom: "atencao", icone: "alerta", texto: "Hora não verificada", detalhe: "" };
  else if (!online) s = { tom: "neutro", icone: "offline", texto: "Offline", detalhe: fila };
  else if (aviso) s = { tom: "atencao", icone: "alerta", texto: "Envio pendente", detalhe: fila };
  else if (pendentes > 0) s = { tom: "neutro", icone: "sincronizando", texto: "Enviando", detalhe: fila };
  else s = { tom: "sucesso", icone: "ok", texto: "Sincronizado", detalhe: "" };
  return { ...s, rotuloAcessivel: `Situação: ${s.texto}${s.detalhe ? `, ${s.detalhe}` : ""}` };
}

// ---------- Fases do reconhecimento ----------
// A tela avança por fases nomeadas; texto e guia facial vêm daqui.
export const FASE = Object.freeze({
  PRONTO: "pronto",
  OLHAR: "olhar",            // tirando a foto de frente
  ANALISAR: "analisar",      // procurando quem é
  VIRAR: "virar",            // prova de vida: virar o rosto
  CONFIRMADO: "confirmado",  // identidade + prova de vida ok
  REGISTRANDO: "registrando",
});

export function instrucaoDaFase(fase, nome = "") {
  const primeiro = String(nome || "").trim().split(/\s+/)[0] || "";
  switch (fase) {
    case FASE.OLHAR: return "Olhe para a câmera";
    case FASE.ANALISAR: return "Continue olhando";
    case FASE.VIRAR: return primeiro ? `${primeiro}, vire um pouco o rosto` : "Vire um pouco o rosto";
    case FASE.CONFIRMADO: return "Identidade confirmada";
    case FASE.REGISTRANDO: return "Registrando ponto";
    default: return "Olhe para a câmera";
  }
}

// Guia facial: neutra → ouro (rosto encontrado) → verde (confirmado).
export function guiaDaFase(fase) {
  if (fase === FASE.VIRAR) return "detectado";
  if (fase === FASE.CONFIRMADO || fase === FASE.REGISTRANDO) return "confirmado";
  return "neutro";
}

export const emAndamento = fase => fase !== FASE.PRONTO;

// ---------- Falhas na tela de ponto ----------
// "reconhecimento": incerteza normal (rosto não confirmado, ângulo, distância)
// - tom neutro, nunca vermelho. "atencao": algo a resolver que não é defeito
// (cadastro desatualizado). "erro": falha real (câmera, modelos, batida
// não gravada) - tom de erro. A mensagem já vem operacional (falhas.js).
const TITULO_ERRO = {
  camera: "A câmera não respondeu",
  modelos: "Reconhecimento indisponível",
  batida: "O ponto não foi registrado",
  cadastro: "Cadastro desatualizado",
};
export function falhaNaTela({ tipo = "reconhecimento", contexto = "", mensagem = "", podeEncarregado = false } = {}) {
  if (tipo === "atencao") return { tom: "atencao", icone: "alerta", titulo: TITULO_ERRO[contexto] || "Chame o encarregado", mensagem, podeEncarregado };
  if (tipo === "erro") return { tom: "erro", icone: "erro", titulo: TITULO_ERRO[contexto] || "Algo deu errado", mensagem, podeEncarregado };
  return { tom: "neutro", icone: "alerta", titulo: "Não consegui confirmar seu rosto", mensagem: mensagem || "Olhe de frente e tente novamente.", podeEncarregado };
}

// ---------- Sem câmera ----------
// estado = estadoPermissaoCamera() (falhas.js). O ponto nunca fica impedido:
// sempre há o caminho do encarregado (registro sem foto).
export function telaSemCamera(estado) {
  const configuracoes = estado === "configuracoes";
  return {
    titulo: "Câmera necessária",
    texto: configuracoes
      ? "A permissão da câmera foi negada. Abra as configurações do app, toque em \"Permissões\" e libere a \"Câmera\"."
      : "O ponto é registrado pelo reconhecimento do rosto. Permita o uso da câmera.",
    acao: configuracoes ? "abrir_configuracoes" : "pedir_permissao",
    rotuloAcao: configuracoes ? "Abrir configurações" : "Permitir câmera",
    alternativa: "Registrar com encarregado",
  };
}

// ---------- Comprovante (estado de sucesso) ----------
// A Portaria exige acesso do trabalhador ao registro: tudo o que o
// comprovante antigo mostrava continua aqui, em hierarquia. NSR: o app
// nunca mostra um número - só diz que o ARCD atribui depois do envio.
// c = retorno de registrar() (App.js); hora já formatada pela tela.
export function linhasDoComprovante(c, { obra = null, online = false } = {}) {
  const detalhes = [
    { rotulo: "CPF", valor: c.cpfMascarado || "não informado", mono: true },
    { rotulo: "Código do registro", valor: String(c.hash || "").slice(0, 16), mono: true },
    { rotulo: "NSR", valor: "atribuído pelo ARCD após o envio" },
  ];
  const avisos = [];
  if (!c.horaConfiavel) avisos.push("Hora do aparelho: será conferida na sincronização.");
  if (c.avisoFoto) avisos.push(c.avisoFoto);
  const ms = Date.parse(c.marcadoEm);
  return {
    titulo: "Ponto registrado",
    nome: c.nome,
    saudacao: Number.isFinite(ms) ? `${saudacao(ms)}, ${c.nome}` : c.nome,
    // Marcações da pessoa hoje neste aparelho (a última é esta).
    batidasHoje: Array.isArray(c.batidasHoje) && c.batidasHoje.length > 1 ? c.batidasHoje.slice(-6) : [],
    obra: obra?.nome || "",
    registro: `Registro local nº ${c.localSequence}`,
    numeroRegistro: String(c.localSequence),
    envio: online
      ? { tom: "neutro", icone: "sincronizando", texto: "Enviando ao ARCD" }
      : { tom: "neutro", icone: "offline", texto: "Será enviado quando houver conexão." },
    detalhes,
    avisos,
  };
}

// ---------- Saudação e batidas do dia ----------
const FUSO = "America/Recife";
const horaLocal = ms => Number(new Date(ms).toLocaleString("en-US", { timeZone: FUSO, hour: "2-digit", hour12: false })) % 24;
const diaLocal = ms => new Date(ms).toLocaleDateString("en-CA", { timeZone: FUSO });

export function saudacao(ms) {
  const h = horaLocal(ms);
  return h >= 5 && h < 12 ? "Bom dia" : h >= 12 && h < 18 ? "Boa tarde" : "Boa noite";
}

// Horários (HH:MM, fuso da obra) em que a pessoa marcou no dia da batida,
// em ordem. Só leitura dos eventos já gravados; não classifica entrada/saída
// (isso é do tratamento no ARCD). eventos = armazem.eventosRecentes().
export function batidasDoDia(eventos, { tipo = "funcionario", id, marcadoEm }) {
  const ref = Date.parse(marcadoEm);
  if (!id || !Number.isFinite(ref)) return [];
  const campo = tipo === "terceiro" ? "terceiroId" : "employeeId";
  return (eventos || [])
    .filter(e => Number(e?.formatVersion) === 2 && String(e?.[campo] || "") === String(id) && Number.isFinite(Date.parse(e?.marcadoEm)))
    .filter(e => diaLocal(Date.parse(e.marcadoEm)) === diaLocal(ref))
    .map(e => Date.parse(e.marcadoEm))
    .sort((a, b) => a - b)
    .map(ms => new Date(ms).toLocaleTimeString("pt-BR", { timeZone: FUSO, hour: "2-digit", minute: "2-digit" }));
}

// Frase falada na confirmação (só o primeiro nome).
export function falaDeConfirmacao(nome, ms) {
  const primeiro = String(nome || "").trim().split(/\s+/)[0];
  return primeiro ? `${saudacao(ms)}, ${primeiro}. Ponto registrado.` : "Ponto registrado.";
}

// ---------- Modo Encarregado ----------
// Menu em seções (como Ajustes): cada linha = rótulo, valor opcional, chevron.
// resumo = resumoCadastro(cadastro); situacao = estado da tela.
export function secoesDoEncarregado({ resumo = {}, situacao = {} } = {}) {
  const pendentes = situacao.pendentes || 0;
  return [
    { titulo: "Cadastros", linhas: [
      { id: "cadastro", rotulo: "Cadastrar rosto", valor: resumo.totalFuncionarios ? `${resumo.comRosto} de ${resumo.totalFuncionarios}` : "" },
    ] },
    { titulo: "Registros", linhas: [
      { id: "manual", rotulo: "Registrar funcionário" },
      { id: "terceiro", rotulo: "Acesso de terceirizado" },
    ] },
    { titulo: "Sistema", linhas: [
      { id: "sincronizacao", rotulo: "Sincronização", valor: pendentes ? `${pendentes} ${pendentes === 1 ? "pendente" : "pendentes"}` : situacao.online ? "Em dia" : "Offline",
        tom: situacao.aviso || situacao.fotosComProblema ? "atencao" : null },
      { id: "diagnostico", rotulo: "Diagnóstico" },
      { id: "voz", rotulo: "Confirmação por voz", valor: situacao.voz === false ? "Desligada" : "Ligada", acao: true },
      { id: "fixar", rotulo: "Fixar aplicativo na tela", acao: true },
    ] },
  ];
}

// ---------- Cadastro facial guiado ----------
export const PASSO_CADASTRO = Object.freeze({ PESSOA: "pessoa", INTRO: "intro", TERMO: "termo", CAPTURA: "captura", CONCLUIDO: "concluido" });
export function passoDoCadastro({ pessoa = null, introVista = false, aceitoEm = null, concluido = false } = {}) {
  if (!pessoa) return PASSO_CADASTRO.PESSOA;
  if (concluido) return PASSO_CADASTRO.CONCLUIDO;
  if (!introVista) return PASSO_CADASTRO.INTRO;
  if (!aceitoEm) return PASSO_CADASTRO.TERMO;
  return PASSO_CADASTRO.CAPTURA;
}
export const rotuloDaCaptura = (feitas, total) => `${Math.min(feitas + 1, total)} de ${total}`;

// ---------- Pareamento ----------
// 8 casas, em dois grupos de 4 (mais fácil de copiar do ARCD).
export function casasDoCodigo(codigo, total = 8) {
  const digitos = String(codigo || "").replace(/\D/g, "").slice(0, total);
  return Array.from({ length: total }, (_, i) => ({ digito: digitos[i] || "", ativa: i === Math.min(digitos.length, total - 1) && digitos.length < total }));
}
