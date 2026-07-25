// Motor de execução do fluxo de aprovação. Sem React, DOM ou persistência.
//
// Padrão de fábrica com dependências injetadas (igual domains/dre/calculations.js):
// quem resolve "quem é o responsável pela obra" ou "quem é o comprador
// responsável" ainda vive em LegacyApp.jsx (depende de employees/usuarios/obras
// que não foram extraídos). O motor não presume NENHUM cargo fixo - ele só
// sabe executar o que a política manda, usando os resolvedores fornecidos.
//
// Etapas com o MESMO `ordem` rodam em PARALELO (ex.: Financeiro e Engenharia
// aprovando ao mesmo tempo); etapas com `ordem` diferente rodam em sequência.
// A instância pode ter várias etapas "em_andamento" simultaneamente.
import { avaliarCondicoes, calcularVencimento, prazoVencido } from "./calculations.js";
import { encontrarPoliticaAplicavel, congelarPolitica } from "./policies.js";

export const gerarIdAprovacao = (prefixo = "apr") =>
  `${prefixo}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

const TIPOS_SEM_REFERENCIA = new Set([
  "responsavelObra", "gerenteObra", "responsavelCentroCusto", "responsavelDepartamento",
  "superiorHierarquico", "compradorResponsavel", "financeiro", "controladoria",
  "diretoria", "administrador", "campoSolicitacao",
]);

const registrarAuditoria = (auditoria, entrada) => [
  ...(auditoria || []),
  { id: gerarIdAprovacao("aud"), data: entrada.data || new Date().toISOString(), ...entrada },
];

const marcarInstancia = (instancias, instanciaId, patch) =>
  (instancias || []).map(i => (i.id === instanciaId ? { ...i, ...patch } : i));

const ordensUnicas = etapas => [...new Set((etapas || []).map(e => Number(e.ordem || 0)))].sort((a, b) => a - b);

const ETAPA_TERMINAL = new Set(["concluida", "pulada", "bloqueada", "reprovada"]);

export const createApprovalEngine = (resolvedores = {}) => {
  const resolverAprovadoresEtapa = (etapa, contexto, data) => {
    const fn = resolvedores[etapa.tipoAprovador];
    if (!fn) return [];
    if (TIPOS_SEM_REFERENCIA.has(etapa.tipoAprovador)) {
      return fn(null, contexto, data) || [];
    }
    const refs = etapa.referenciasAprovadores || [];
    const vistos = new Set();
    return refs.flatMap(ref => fn(ref, contexto, data) || []).filter(u => {
      if (!u || vistos.has(u.id)) return false;
      vistos.add(u.id);
      return true;
    });
  };

  const aplicarDelegacoes = (usuarios, data, agoraISO) =>
    usuarios.map(u => {
      const delegacao = (data.delegacoesAprovacao || []).find(d =>
        d.ativo && d.usuarioOrigemId === u.id && d.inicio <= agoraISO && (!d.fim || agoraISO <= d.fim)
      );
      if (!delegacao) return u;
      return { id: delegacao.usuarioDestinoId, nome: delegacao.usuarioDestinoNome || delegacao.usuarioDestinoId, substituiu: u.id, substituiuNome: u.nome };
    });

  // Autoaprovação: remove o solicitante da lista de elegíveis desta etapa,
  // salvo quando a política permite explicitamente (§2.6).
  const aplicarRegraAutoaprovacao = (elegiveis, autoaprovacao, contexto) => {
    const modo = autoaprovacao?.modo || "proibida";
    const solicitanteId = contexto?.solicitanteId;
    if (!solicitanteId || modo === "sempre") return { elegiveis, autoaprovacaoDestacada: false };
    if (modo === "abaixo_valor" && Number(contexto?.valorTotal || 0) < Number(autoaprovacao.valorLimite || 0)) {
      return { elegiveis, autoaprovacaoDestacada: elegiveis.some(u => u.id === solicitanteId) };
    }
    if (modo === "perfis_especificos" && (autoaprovacao.perfis || []).includes(contexto?.solicitantePerfil)) {
      return { elegiveis, autoaprovacaoDestacada: elegiveis.some(u => u.id === solicitanteId) };
    }
    const semSolicitante = elegiveis.filter(u => u.id !== solicitanteId);
    if (semSolicitante.length > 0) return { elegiveis: semSolicitante, autoaprovacaoDestacada: false };
    if (modo === "sem_outro_elegivel") return { elegiveis, autoaprovacaoDestacada: true };
    return { elegiveis: [], autoaprovacaoDestacada: false };
  };

  // Resolve TODAS as etapas de um mesmo grupo de ordem (podem ficar
  // paralelamente "em_andamento", cada uma com seu próprio quórum).
  const resolverGrupoOrdem = (politica, resultadosEtapas, ordemAlvo, contexto, data, agora, auditoriaBase) => {
    let auditoria = auditoriaBase;
    const resultados = [...resultadosEtapas];
    let algumaAtiva = false;
    politica.etapas.forEach((etapa, i) => {
      if (Number(etapa.ordem || 0) !== ordemAlvo) return;
      if (!avaliarCondicoes(etapa.condicoes, contexto)) {
        resultados[i] = { ...resultados[i], status: "pulada", motivoConclusao: "Condições da etapa não atendidas para este caso", concluidaEm: agora };
        return;
      }
      const brutos = resolverAprovadoresEtapa(etapa, contexto, data);
      const comDelegacao = aplicarDelegacoes(brutos, data, agora);
      const { elegiveis, autoaprovacaoDestacada } = aplicarRegraAutoaprovacao(comDelegacao, politica.autoaprovacao, contexto);

      if (elegiveis.length > 0) {
        resultados[i] = { ...resultados[i], status: "em_andamento", aprovadoresElegiveis: elegiveis, iniciadaEm: agora, vencimentoEm: calcularVencimento(agora, etapa.prazoValor, etapa.prazoUnidade), autoaprovacaoDestacada };
        algumaAtiva = true;
        return;
      }
      const acao = etapa.semAprovadorAcao || "enviar_administrador";
      auditoria = registrarAuditoria(auditoria, { evento: "etapa_sem_aprovador", motivo: `Etapa "${etapa.nome}": nenhum aprovador elegível (${etapa.tipoAprovador}); ação: ${acao}` });
      if (acao === "pular_etapa") {
        resultados[i] = { ...resultados[i], status: "pulada", motivoConclusao: "Sem aprovador elegível - etapa ignorada conforme configuração", concluidaEm: agora };
        return;
      }
      if (acao === "auto_aprovar_etapa") {
        resultados[i] = { ...resultados[i], status: "concluida", motivoConclusao: "Sem aprovador elegível - aprovada automaticamente conforme configuração", concluidaEm: agora };
        return;
      }
      if (acao === "bloquear") {
        resultados[i] = { ...resultados[i], status: "bloqueada", motivoConclusao: "Sem aprovador elegível - configuração exige bloqueio manual" };
        algumaAtiva = true; // trava o avanço até intervenção manual
        return;
      }
      const admins = (resolvedores.administrador?.(null, contexto, data)) || [];
      resultados[i] = { ...resultados[i], status: "em_andamento", aprovadoresElegiveis: admins, iniciadaEm: agora, vencimentoEm: calcularVencimento(agora, etapa.prazoValor, etapa.prazoUnidade), semAprovadorEncontrado: true };
      algumaAtiva = true;
    });
    return { resultadosEtapas: resultados, algumaAtiva, auditoria };
  };

  // Avança a instância a partir da ordem informada, pulando automaticamente
  // grupos inteiros que ficaram totalmente resolvidos sem intervenção humana
  // (todas as etapas puladas ou auto-aprovadas), até achar um grupo com algo
  // pendente de decisão ou concluir a instância inteira.
  const avancarFluxo = (politica, resultadosEtapas, ordemAtual, contexto, data, agora, auditoriaBase) => {
    const ordens = ordensUnicas(politica.etapas);
    let auditoria = auditoriaBase;
    let resultados = resultadosEtapas;
    // ordemAtual null/undefined (ou não encontrada) significa "não há mais
    // grupos a resolver" - NUNCA reinterpretar isso como "volte ao início".
    if (ordemAtual == null || !ordens.includes(ordemAtual)) {
      return { concluida: true, ordemAtual: null, resultadosEtapas: resultados, auditoria, status: "aprovada" };
    }
    let idxOrdem = ordens.indexOf(ordemAtual);
    while (idxOrdem < ordens.length) {
      const ordemAlvo = ordens[idxOrdem];
      const r = resolverGrupoOrdem(politica, resultados, ordemAlvo, contexto, data, agora, auditoria);
      resultados = r.resultadosEtapas; auditoria = r.auditoria;
      if (r.algumaAtiva) {
        return { concluida: false, ordemAtual: ordemAlvo, resultadosEtapas: resultados, auditoria, status: "em_andamento" };
      }
      idxOrdem++;
    }
    return { concluida: true, ordemAtual: null, resultadosEtapas: resultados, auditoria, status: "aprovada" };
  };

  // Inicia uma instância de aprovação para uma entidade (solicitação, pedido...).
  // `contexto` é um objeto plano com os campos que as condições/políticas
  // consultam (valorTotal, obraId, categoria, solicitanteId, urgencia...).
  const iniciarInstancia = (data, { entidadeTipo, entidadeId, contexto, operador, agora, comportamentoSemPolitica = "auto_aprovar" }) => {
    const dataAgora = agora || new Date().toISOString();
    const politica = encontrarPoliticaAplicavel(data.politicasAprovacao, entidadeTipo, contexto, dataAgora);

    const base = { id: gerarIdAprovacao(), entidadeTipo, entidadeId, iniciadoEm: dataAgora, iniciadoPorId: operador?.id || "", concluidoEm: null };

    if (!politica) {
      if (comportamentoSemPolitica === "bloquear") {
        const instancia = { ...base, policyId: null, policyVersao: null, snapshotPolitica: null, status: "bloqueada", ordemAtual: null, resultadosEtapas: [] };
        const auditoriaAprovacao = registrarAuditoria(data.auditoriaAprovacao, { instanciaId: instancia.id, evento: "bloqueado_sem_politica", usuario: operador?.nome || "", motivo: "Nenhuma política de aprovação aplicável e o comportamento configurado é bloquear." });
        return { data: { ...data, instanciasAprovacao: [...(data.instanciasAprovacao || []), instancia], auditoriaAprovacao }, resumo: { ok: true, status: "bloqueada", instanciaId: instancia.id, semPolitica: true } };
      }
      if (comportamentoSemPolitica === "fila_administrativa") {
        const admins = (resolvedores.administrador?.(null, contexto, data)) || [];
        const instancia = {
          ...base, policyId: null, policyVersao: null, snapshotPolitica: null, status: "em_andamento", ordemAtual: 0,
          resultadosEtapas: [{ etapaId: "fila_administrativa", status: "em_andamento", aprovadoresElegiveis: admins, iniciadaEm: dataAgora, vencimentoEm: null, concluidaEm: null, motivoConclusao: "" }],
        };
        const auditoriaAprovacao = registrarAuditoria(data.auditoriaAprovacao, { instanciaId: instancia.id, evento: "enviado_fila_administrativa", usuario: operador?.nome || "", motivo: "Nenhuma política de aprovação aplicável - enviado à fila administrativa." });
        return { data: { ...data, instanciasAprovacao: [...(data.instanciasAprovacao || []), instancia], auditoriaAprovacao }, resumo: { ok: true, status: "em_andamento", instanciaId: instancia.id, semPolitica: true } };
      }
      const instancia = { ...base, policyId: null, policyVersao: null, snapshotPolitica: null, status: "aprovada", ordemAtual: null, resultadosEtapas: [], concluidoEm: dataAgora };
      const auditoriaAprovacao = registrarAuditoria(data.auditoriaAprovacao, { instanciaId: instancia.id, evento: "aprovado_automatico", usuario: "sistema", motivo: "Aprovado automaticamente por ausência de política aplicável." });
      return { data: { ...data, instanciasAprovacao: [...(data.instanciasAprovacao || []), instancia], auditoriaAprovacao }, resumo: { ok: true, status: "aprovada", instanciaId: instancia.id, semPolitica: true } };
    }

    const snapshot = congelarPolitica(politica);
    if (!snapshot.etapas || snapshot.etapas.length === 0) {
      const instancia = { ...base, policyId: politica.id, policyVersao: politica.versao, snapshotPolitica: snapshot, status: "aprovada", ordemAtual: null, resultadosEtapas: [], concluidoEm: dataAgora };
      const auditoriaAprovacao = registrarAuditoria(data.auditoriaAprovacao, { instanciaId: instancia.id, evento: "aprovado_sem_etapas", usuario: "sistema", motivo: `Política "${politica.nome}" ativa sem etapas configuradas - aprovação automática.` });
      return { data: { ...data, instanciasAprovacao: [...(data.instanciasAprovacao || []), instancia], auditoriaAprovacao }, resumo: { ok: true, status: "aprovada", instanciaId: instancia.id } };
    }

    const resultadosEtapasIniciais = snapshot.etapas.map(e => ({ etapaId: e.id, status: "pendente", aprovadoresElegiveis: [], iniciadaEm: null, vencimentoEm: null, concluidaEm: null, motivoConclusao: "" }));
    const avanco = avancarFluxo(snapshot, resultadosEtapasIniciais, ordensUnicas(snapshot.etapas)[0], contexto, data, dataAgora, data.auditoriaAprovacao);

    const instancia = {
      ...base, policyId: politica.id, policyVersao: politica.versao, snapshotPolitica: snapshot,
      status: avanco.status, ordemAtual: avanco.ordemAtual, resultadosEtapas: avanco.resultadosEtapas,
      concluidoEm: avanco.concluida ? dataAgora : null,
    };
    const auditoriaAprovacao = registrarAuditoria(avanco.auditoria, { instanciaId: instancia.id, evento: "iniciada", usuario: operador?.nome || "", motivo: `Política "${politica.nome}" v${politica.versao} aplicada.` });
    return { data: { ...data, instanciasAprovacao: [...(data.instanciasAprovacao || []), instancia], auditoriaAprovacao }, resumo: { ok: true, status: instancia.status, instanciaId: instancia.id } };
  };

  // Registra a decisão (aprovado/reprovado) de um usuário numa etapa específica
  // (é preciso informar `etapaId` porque, com etapas paralelas, mais de uma
  // pode estar "em_andamento" ao mesmo tempo).
  const registrarDecisao = (data, { instanciaId, etapaId, aprovadorId, aprovadorNome, decisao, justificativa = "", anexos = [], delegadoPor = "", substituiuUsuario = "", contexto, agora }) => {
    const instancia = (data.instanciasAprovacao || []).find(i => i.id === instanciaId);
    if (!instancia) return { data, resumo: { ok: false, motivo: "Instância de aprovação não encontrada" } };
    if (instancia.status !== "em_andamento") return { data, resumo: { ok: false, motivo: "Esta aprovação já foi concluída ou não está em andamento" } };

    const dataAgora = agora || new Date().toISOString();
    const idx = instancia.snapshotPolitica.etapas.findIndex(e => e.id === etapaId);
    if (idx < 0) return { data, resumo: { ok: false, motivo: "Etapa não encontrada nesta instância" } };
    const etapa = instancia.snapshotPolitica.etapas[idx];
    const resultadoAtual = instancia.resultadosEtapas[idx];
    if (resultadoAtual.status !== "em_andamento") return { data, resumo: { ok: false, motivo: "Esta etapa não está aguardando decisão" } };
    const elegivelIds = new Set((resultadoAtual.aprovadoresElegiveis || []).map(u => u.id));
    if (!elegivelIds.has(aprovadorId)) return { data, resumo: { ok: false, motivo: "Este usuário não está entre os aprovadores elegíveis desta etapa" } };

    const decisaoObj = { id: gerarIdAprovacao("dec"), instanciaId, etapaId, aprovadorId, aprovadorNome, decisao, justificativa, data: dataAgora, delegadoPor, substituiuUsuario, anexos };
    const decisoesAprovacao = [...(data.decisoesAprovacao || []), decisaoObj];

    if (decisao === "reprovado") {
      const resultadosEtapas = instancia.resultadosEtapas.map((r, i) => i === idx ? { ...r, status: "reprovada", concluidaEm: dataAgora, motivoConclusao: justificativa || "Reprovado" } : r);
      const instanciasAprovacao = marcarInstancia(data.instanciasAprovacao, instanciaId, { status: "reprovada", concluidoEm: dataAgora, resultadosEtapas });
      const auditoriaAprovacao = registrarAuditoria(data.auditoriaAprovacao, { instanciaId, evento: "reprovado", usuario: aprovadorNome, motivo: justificativa || "" });
      return { data: { ...data, decisoesAprovacao, instanciasAprovacao, auditoriaAprovacao }, resumo: { ok: true, status: "reprovada" } };
    }

    const aprovacoesEtapa = decisoesAprovacao.filter(d => d.instanciaId === instanciaId && d.etapaId === etapaId && d.decisao === "aprovado");
    const distintos = new Set(aprovacoesEtapa.map(d => d.aprovadorId)).size;
    const totalElegiveis = resultadoAtual.aprovadoresElegiveis.length;
    const quorumSatisfeito = etapa.modoQuorum === "todos" ? distintos >= totalElegiveis
      : etapa.modoQuorum === "minimo" ? distintos >= Number(etapa.quantidadeMinima || 1)
      : distintos >= 1; // "qualquer" | "primeiro"

    if (!quorumSatisfeito) {
      const resultadosEtapas = instancia.resultadosEtapas.map((r, i) => i === idx ? { ...r, aprovacoesRegistradas: distintos } : r);
      const instanciasAprovacao = marcarInstancia(data.instanciasAprovacao, instanciaId, { resultadosEtapas });
      return { data: { ...data, decisoesAprovacao, instanciasAprovacao }, resumo: { ok: true, status: "em_andamento", aguardandoQuorum: true } };
    }

    let resultadosEtapas = instancia.resultadosEtapas.map((r, i) => i === idx ? { ...r, status: "concluida", concluidaEm: dataAgora, motivoConclusao: "Quórum atingido" } : r);

    // Etapa concluída - verifica se as OUTRAS etapas do mesmo grupo de ordem
    // (paralelas a esta) já terminaram todas. Se não, fica esperando-as.
    const ordemDaEtapa = Number(etapa.ordem || 0);
    const irmas = instancia.snapshotPolitica.etapas.map((e, i) => ({ e, i })).filter(x => Number(x.e.ordem || 0) === ordemDaEtapa);
    const grupoResolvido = irmas.every(({ i }) => ETAPA_TERMINAL.has(resultadosEtapas[i].status));

    if (!grupoResolvido) {
      const instanciasAprovacao = marcarInstancia(data.instanciasAprovacao, instanciaId, { resultadosEtapas });
      const auditoriaAprovacao = registrarAuditoria(data.auditoriaAprovacao, { instanciaId, evento: "etapa_concluida", usuario: aprovadorNome, motivo: `Etapa "${etapa.nome}" concluída - aguardando etapa(s) paralela(s)` });
      return { data: { ...data, decisoesAprovacao, instanciasAprovacao, auditoriaAprovacao }, resumo: { ok: true, status: "em_andamento", aguardandoParalela: true } };
    }

    // Grupo inteiro concluído - decide a próxima ordem, aplicando a
    // preferência de aprovador repetido quando o grupo atual e o próximo
    // são, cada um, uma única etapa com exatamente o mesmo aprovador.
    const ordens = ordensUnicas(instancia.snapshotPolitica.etapas);
    let proximaOrdemIdx = ordens.indexOf(ordemDaEtapa) + 1;
    if (irmas.length === 1 && proximaOrdemIdx < ordens.length) {
      const proximasIrmas = instancia.snapshotPolitica.etapas.map((e, i) => ({ e, i })).filter(x => Number(x.e.ordem || 0) === ordens[proximaOrdemIdx]);
      if (proximasIrmas.length === 1) {
        const proximaEtapa = proximasIrmas[0].e;
        const proximoIdx = proximasIrmas[0].i;
        const proximosBrutos = resolverAprovadoresEtapa(proximaEtapa, contexto, data);
        const mesmosAprovadores = proximosBrutos.length > 0 && proximosBrutos.every(u => elegivelIds.has(u.id)) && proximosBrutos.length === elegivelIds.size;
        if (mesmosAprovadores && etapa.modoQuorum !== "todos") {
          if (proximaEtapa.consolidarAprovadorRepetido === "ignorar") {
            resultadosEtapas[proximoIdx] = { ...resultadosEtapas[proximoIdx], status: "pulada", motivoConclusao: "Mesmo aprovador da etapa anterior - etapa ignorada conforme configuração", concluidaEm: dataAgora };
            proximaOrdemIdx += 1;
          } else if (proximaEtapa.consolidarAprovadorRepetido === "consolidar") {
            resultadosEtapas[proximoIdx] = { ...resultadosEtapas[proximoIdx], status: "concluida", motivoConclusao: "Consolidada com a decisão da etapa anterior (mesmo aprovador)", concluidaEm: dataAgora };
            proximaOrdemIdx += 1;
          }
        }
      }
    }

    const avanco = avancarFluxo(instancia.snapshotPolitica, resultadosEtapas, ordens[proximaOrdemIdx], contexto, data, dataAgora, data.auditoriaAprovacao);
    const instanciasAprovacao = marcarInstancia(data.instanciasAprovacao, instanciaId, {
      status: avanco.status, ordemAtual: avanco.ordemAtual, resultadosEtapas: avanco.resultadosEtapas,
      concluidoEm: avanco.concluida ? dataAgora : null,
    });
    const auditoriaAprovacao = registrarAuditoria(avanco.auditoria, { instanciaId, evento: avanco.concluida ? "aprovada" : "etapa_concluida", usuario: aprovadorNome, motivo: avanco.concluida ? "Todas as etapas concluídas" : "" });
    return { data: { ...data, decisoesAprovacao, instanciasAprovacao, auditoriaAprovacao }, resumo: { ok: true, status: avanco.status } };
  };

  // Verifica SLA de todas as etapas em andamento (mesmo em paralelo) e aplica
  // a ação de vencimento configurada.
  const aplicarEscalonamento = (data, { contexto, agora } = {}) => {
    const dataAgora = agora || new Date().toISOString();
    let auditoriaAprovacao = data.auditoriaAprovacao;
    const instanciasAprovacao = (data.instanciasAprovacao || []).map(instancia => {
      if (instancia.status !== "em_andamento" || !instancia.snapshotPolitica) return instancia;
      let resultados = [...instancia.resultadosEtapas];
      let mudou = false;
      instancia.snapshotPolitica.etapas.forEach((etapa, i) => {
        const resultado = resultados[i];
        if (resultado.status !== "em_andamento" || !prazoVencido(resultado.vencimentoEm, dataAgora)) return;
        mudou = true;
        const acao = etapa.acaoNoVencimento || "escalonar";
        auditoriaAprovacao = registrarAuditoria(auditoriaAprovacao, { instanciaId: instancia.id, evento: "prazo_vencido", motivo: `Etapa "${etapa.nome}" venceu; ação: ${acao}`, data: dataAgora });
        if (acao === "aprovar_automatico") {
          resultados[i] = { ...resultado, status: "concluida", concluidaEm: dataAgora, motivoConclusao: "Aprovado automaticamente por decurso de prazo (autorizado na política)" };
          return;
        }
        if (acao === "bloquear") { resultados[i] = { ...resultado, status: "bloqueada" }; return; }
        if (acao === "retornar_solicitante") { resultados[i] = { ...resultado, status: "bloqueada", motivoConclusao: "Devolvida ao solicitante por decurso de prazo" }; return; }
        const extras = acao === "enviar_administrador"
          ? (resolvedores.administrador?.(null, contexto || {}, data)) || []
          : (etapa.grupoSubstituto ? (resolvedores.grupo?.(etapa.grupoSubstituto, contexto || {}, data)) || [] : [])
            .concat((etapa.substitutos || []).flatMap(s => (resolvedores.usuario?.(s, contexto || {}, data)) || []));
        const jaTem = new Set(resultado.aprovadoresElegiveis.map(u => u.id));
        const novos = extras.filter(u => u && !jaTem.has(u.id));
        resultados[i] = { ...resultado, aprovadoresElegiveis: [...resultado.aprovadoresElegiveis, ...novos], escalonadoEm: dataAgora };
      });
      if (!mudou) return instancia;

      // Se um "retornar_solicitante"/"bloquear" travou uma etapa, ou se um
      // "aprovar_automatico" concluiu o grupo inteiro, tenta avançar o fluxo.
      const ordemAtual = instancia.ordemAtual;
      const irmasAtuais = instancia.snapshotPolitica.etapas.map((e, i) => ({ e, i })).filter(x => Number(x.e.ordem || 0) === ordemAtual);
      const grupoResolvido = irmasAtuais.every(({ i }) => ETAPA_TERMINAL.has(resultados[i].status));
      if (!grupoResolvido) return { ...instancia, resultadosEtapas: resultados };

      const ordens = ordensUnicas(instancia.snapshotPolitica.etapas);
      const proximaOrdem = ordens[ordens.indexOf(ordemAtual) + 1];
      const avanco = avancarFluxo(instancia.snapshotPolitica, resultados, proximaOrdem, contexto || {}, data, dataAgora, auditoriaAprovacao);
      auditoriaAprovacao = avanco.auditoria;
      return { ...instancia, status: avanco.status, ordemAtual: avanco.ordemAtual, resultadosEtapas: avanco.resultadosEtapas, concluidoEm: avanco.concluida ? dataAgora : null };
    });
    return { data: { ...data, instanciasAprovacao, auditoriaAprovacao }, resumo: { ok: true } };
  };

  // Simula a política (sem persistir nada) para a tela de administração -
  // mostra o fluxo previsto, quem aprovaria e quais etapas seriam ignoradas.
  const simularPolitica = (politica, contexto, data) => {
    const snapshot = congelarPolitica(politica);
    if (!snapshot.etapas || snapshot.etapas.length === 0) {
      return { etapas: [], status: "aprovada", motivo: "Política sem etapas - aprovação automática" };
    }
    const resultadosEtapasIniciais = snapshot.etapas.map(e => ({ etapaId: e.id, status: "pendente", aprovadoresElegiveis: [], iniciadaEm: null, vencimentoEm: null, concluidaEm: null, motivoConclusao: "" }));
    const avanco = avancarFluxo(snapshot, resultadosEtapasIniciais, ordensUnicas(snapshot.etapas)[0], contexto, data, new Date().toISOString(), []);
    return {
      status: avanco.concluida ? "aprovada" : avanco.status,
      etapas: snapshot.etapas.map((e, i) => ({ nome: e.nome, ordem: e.ordem, ...avanco.resultadosEtapas[i] })),
    };
  };

  return { iniciarInstancia, registrarDecisao, aplicarEscalonamento, simularPolitica, resolverAprovadoresEtapa };
};
