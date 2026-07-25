// Seleção e validação de políticas de aprovação. Sem React, DOM ou
// persistência. Regras de negócio isoladas do motor de execução
// (engine.js) para poderem ser testadas e reaproveitadas na tela de
// administração (validação antes de publicar, simulação).
import { avaliarCondicoes } from "./calculations.js";

const dentroDaVigencia = (politica, dataISO) => {
  const data = dataISO || new Date().toISOString();
  if (politica.vigenciaInicio && data < politica.vigenciaInicio) return false;
  if (politica.vigenciaFim && data > politica.vigenciaFim) return false;
  return true;
};

// Entre as políticas ATIVAS, dentro da vigência, aplicáveis ao tipo de
// entidade e cujas condições batem com o contexto, devolve a de MAIOR
// prioridade (número maior = prioridade maior). Nunca decide sozinha
// qual comportamento seguir quando não encontra nenhuma - isso é
// responsabilidade de quem chama (ver engine.iniciarInstancia).
export const encontrarPoliticaAplicavel = (politicas, entidadeTipo, contexto, dataISO) => {
  const candidatas = (politicas || [])
    .filter(p => p.ativa && p.entidadeTipo === entidadeTipo && dentroDaVigencia(p, dataISO))
    .filter(p => avaliarCondicoes(p.condicoes, contexto))
    .sort((a, b) => Number(b.prioridade || 0) - Number(a.prioridade || 0));
  return candidatas[0] || null;
};

// Fotografia imutável da política no momento em que uma instância de
// aprovação começa (§2.8). Mudanças futuras na política NÃO alteram
// processos já iniciados - eles continuam lendo este snapshot.
export const congelarPolitica = politica => JSON.parse(JSON.stringify(politica));

//
// VALIDAÇÃO (§18) - separada em erros bloqueantes e alertas não bloqueantes.
// `contextoDados` é opcional: quando informado (ex.: lista de usuários,
// grupos), a validação também checa coisas que dependem da base (grupo
// vazio, aprovador inexistente). Sem ele, só as checagens estruturais rodam.
//
export const validarPolitica = (politica, contextoDados = {}) => {
  const erros = [];
  const alertas = [];
  const etapas = politica.etapas || [];

  if (!String(politica.nome || "").trim()) erros.push("A política precisa de um nome.");
  if (politica.vigenciaInicio && politica.vigenciaFim && politica.vigenciaInicio > politica.vigenciaFim) {
    erros.push("A vigência final não pode ser anterior à vigência inicial.");
  }
  if (etapas.length > 20) alertas.push("Mais de 20 etapas - considere simplificar a política.");

  const semAprovadorBloqueiaTudo = etapas.length > 0 && etapas.every(e =>
    (!e.referenciasAprovadores || e.referenciasAprovadores.length === 0) && e.semAprovadorAcao === "bloquear"
  );
  if (semAprovadorBloqueiaTudo) {
    erros.push("Todas as etapas ficariam sem aprovador e a ação configurada é bloquear - isso travaria toda compra sob esta política.");
  }

  etapas.forEach((e, i) => {
    const rotulo = `Etapa ${i + 1} (${e.nome || "sem nome"})`;
    if (!e.tipoAprovador) {
      erros.push(`${rotulo}: selecione um tipo de aprovador.`);
    }
    if ((!e.referenciasAprovadores || e.referenciasAprovadores.length === 0) &&
        ["usuario", "cargo", "perfil", "grupo"].includes(e.tipoAprovador)) {
      alertas.push(`${rotulo}: nenhum ${e.tipoAprovador} selecionado ainda.`);
    }
    if (e.modoQuorum === "minimo" && Number(e.quantidadeMinima || 0) > 0 &&
        Array.isArray(e.referenciasAprovadores) && e.quantidadeMinima > e.referenciasAprovadores.length) {
      erros.push(`${rotulo}: quantidade mínima (${e.quantidadeMinima}) maior que o número de aprovadores configurados (${e.referenciasAprovadores.length}).`);
    }
    if (e.acaoNoVencimento === "escalonar" && !e.substitutos?.length && !e.grupoSubstituto) {
      alertas.push(`${rotulo}: escalonamento configurado sem substituto ou grupo definido.`);
    }
    if (e.substitutos?.some(s => s === e.tipoAprovadorUsuarioId)) {
      erros.push(`${rotulo}: o substituto não pode ser o próprio aprovador da etapa.`);
    }
    if (!e.semAprovadorAcao) {
      alertas.push(`${rotulo}: nenhuma ação de contingência definida para quando não houver aprovador elegível - o padrão será enviar para a fila administrativa.`);
    }
  });

  // Duas regras idênticas (mesmas condições, mesma prioridade) dentro do
  // conjunto de políticas fornecido em contextoDados.politicasExistentes.
  if (Array.isArray(contextoDados.politicasExistentes)) {
    const outras = contextoDados.politicasExistentes.filter(p => p.id !== politica.id && p.entidadeTipo === politica.entidadeTipo && p.ativa);
    const conflita = outras.find(p =>
      Number(p.prioridade || 0) === Number(politica.prioridade || 0) &&
      JSON.stringify((p.condicoes || []).map(c => [c.campo, c.operador, c.valor]).sort()) ===
      JSON.stringify((politica.condicoes || []).map(c => [c.campo, c.operador, c.valor]).sort())
    );
    if (conflita) alertas.push(`Já existe a política "${conflita.nome}" com as mesmas condições e a mesma prioridade - o critério de desempate pode ficar ambíguo.`);
  }

  if (politica.autoaprovacao?.modo === "proibida" && etapas.length === 1 &&
      etapas[0].tipoAprovador === "campoSolicitacao") {
    alertas.push("Autoaprovação proibida, mas a única etapa aprova pelo próprio campo da solicitação - confirme que isso nunca aponta para o solicitante.");
  }

  return { erros, alertas, valida: erros.length === 0 };
};
