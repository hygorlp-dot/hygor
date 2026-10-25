// Gates OBJETIVOS do scorecard do Ponto de Obra.
//
// Cada gate verifica um fato verificável, nunca gosto:
//   - teste(...): um teste NOMEADO existiu e passou no relatório JSON do Vitest
//     (teste apagado conta como falha - sumir com o teste é regressão);
//   - evidencia(...): resultado de um comando (expo-doctor, bundle, prebuild)
//     gravado pelo release-check;
//   - estatico(...): checagem no código/configuração do repositório.
//
// Nota da categoria = 10 x (peso aprovado / peso total), limitada pelo TETO
// da categoria. O teto existe quando falta evidência que só o mundo físico dá
// (aparelho real, medição de campo): sem ela a nota não sobe, por melhor que
// esteja o código. Ver docs/QUALITY-SCORECARD.md.
//
// Status de um gate: "pass" | "fail" | "nao_verificado" (evidência ausente -
// conta como não aprovado; na CI, --exigir-evidencias transforma em falha).

const ok = (detalhe = "") => ({ status: "pass", detalhe });
const falha = (detalhe = "") => ({ status: "fail", detalhe });
const semEvidencia = (detalhe = "evidência não coletada nesta execução") => ({ status: "nao_verificado", detalhe });

// ---------- construtores ----------
// Teste nomeado: arquivo (trecho do caminho) + título (trecho). Todos os
// títulos listados precisam existir e passar.
export const teste = (arquivo, ...titulos) => ctx => {
  if (!ctx.vitest) return semEvidencia("relatório do Vitest ausente");
  const resultados = [];
  for (const titulo of titulos) {
    const achado = ctx.testes.find(t => t.arquivo.includes(arquivo) && t.titulo.includes(titulo));
    if (!achado) return falha(`teste ausente: ${arquivo} › ${titulo}`);
    if (achado.status !== "passed") return falha(`teste ${achado.status}: ${arquivo} › ${titulo}`);
    resultados.push(titulo);
  }
  return ok(`${resultados.length} teste(s) passando`);
};

const evidencia = (passo, extra = () => null) => ctx => {
  const e = ctx.evidencias?.passos?.[passo];
  if (!e) return semEvidencia(`passo "${passo}" não executado`);
  if (!e.ok) return falha(e.detalhe || `passo "${passo}" falhou`);
  const problema = extra(e, ctx);
  return problema ? falha(problema) : ok(e.detalhe || "ok");
};

const estatico = fn => ctx => {
  try { const r = fn(ctx); return r === true ? ok() : typeof r === "string" ? falha(r) : r; } catch (e) { return falha(String(e.message || e)); }
};

// ---------- auxiliares estáticos ----------
const appJson = ctx => JSON.parse(ctx.ler("app.json")).expo;
const fontesDoApp = ctx => ctx.arquivosApp().filter(f => !/\.test\.js$|\.test-helper\.js$/.test(f));
const procurar = (ctx, regex, arquivos = fontesDoApp(ctx)) => arquivos.filter(f => regex.test(ctx.ler(f)));
const resumoImpeccable = ctx => {
  const m = ctx.ler("IMPECCABLE-REVIEW.md").match(/<!--\s*impeccable-resumo([\s\S]*?)-->/);
  if (!m) return null;
  return Object.fromEntries(m[1].trim().split("\n").map(l => l.split(":").map(s => s.trim())).filter(p => p.length === 2).map(([k, v]) => [k, Number(v)]));
};
const linhasDaMatriz = ctx => {
  const md = ctx.existe("docs/device-matrix.md") ? ctx.ler("docs/device-matrix.md") : "";
  const tabela = md.split("\n").filter(l => /^\|/.test(l) && !/^\|\s*-/.test(l));
  if (tabela.length < 2) return [];
  const cab = tabela[0].split("|").map(s => s.trim().toLowerCase());
  return tabela.slice(1).map(l => Object.fromEntries(l.split("|").map(s => s.trim()).map((v, i) => [cab[i], v])));
};
// Aparelho só conta como testado quando a linha diz "aprovado" na coluna status.
const aparelhosAprovados = ctx => linhasDaMatriz(ctx).filter(l => /^aprovado$/i.test(l.status || ""));
const ESTADOS_DE_TELA = ["01-ponto-sincronizado", "02-ponto-offline", "07-ponto-virar", "09-ponto-falha-reconhecimento", "11-sucesso-online", "13-camera-negada", "15-pareamento", "20-encarregado-menu", "22-diagnostico", "26-cadastro-captura"];

// ---------- categorias ----------
// teto: { valor, enquanto(ctx) -> motivo|null }. O teto vale enquanto
// "enquanto" devolver um motivo.
export const CATEGORIAS = [
  {
    id: "android", nome: "Robustez Android", critica: false,
    teto: { valor: 9.3, enquanto: ctx => (aparelhosAprovados(ctx).length < 3 ? `matriz de dispositivos com ${aparelhosAprovados(ctx).length} de 3 aparelhos aprovados` : null) },
    gates: [
      { id: "expo-doctor", peso: 2, bloqueia: true, descricao: "expo-doctor sem erro", verificar: evidencia("expoDoctor") },
      { id: "bundle-android", peso: 2, bloqueia: true, descricao: "bundle Android gerado", verificar: evidencia("bundle") },
      { id: "tflite-no-bundle", peso: 2, bloqueia: true, descricao: "os 2 modelos .tflite no bundle", verificar: evidencia("bundle", e => (e.tflite >= 2 ? null : `só ${e.tflite} .tflite no bundle`)) },
      { id: "prebuild", peso: 2, bloqueia: true, descricao: "prebuild + verificar-prebuild (SQLCipher, permissões, autolinking)", verificar: evidencia("prebuild") },
      { id: "sqlcipher-config", peso: 1, bloqueia: true, descricao: "SQLCipher ligado no app.json", verificar: estatico(ctx => appJson(ctx).plugins.some(p => Array.isArray(p) && p[0] === "expo-sqlite" && p[1]?.useSQLCipher === true) || "useSQLCipher desligado") },
      { id: "reabertura", peso: 2, descricao: "evento e sequência sobrevivem a fechar e abrir o banco", verificar: teste("armazem-sqlite.test", "evento sobrevive a fechar e abrir o app", "sequência local continua depois de reabrir") },
      { id: "transacao-duravel", peso: 1, descricao: "transação atômica e gravação durável", verificar: teste("armazem-sqlite.test", "transação que falha não deixa evento pela metade", "gravação durável: synchronous=FULL e WAL") },
      { id: "tflite-carregamento", peso: 1, descricao: "modelos TFLite pela cópia file:// do expo-asset", verificar: teste("codigo-fonte.test", "os DOIS modelos TFLite carregam") },
      { id: "falhas-fisicas", peso: 2, descricao: "câmera, GPS, rede e processo: falha não perde batida", verificar: teste("robustez-fisica.test", "app reaberto no meio da fila", "câmera indisponível", "GPS desligado", "timeout de rede") },
    ],
  },
  {
    id: "offline", nome: "Operação offline", critica: true,
    gates: [
      { id: "sem-internet", peso: 3, bloqueia: true, descricao: "sem internet nada se perde e a reconexão envia tudo", verificar: teste("regressao.test", "sem internet a rodada não lança") },
      { id: "servidor-500", peso: 2, bloqueia: true, descricao: "servidor fora do ar mantém pendentes", verificar: teste("regressao.test", "servidor fora do ar (503)") },
      { id: "hora-offline", peso: 2, descricao: "hora confiável offline dentro da validade; vencida sinaliza", verificar: teste("regressao.test", "validade da referência", "reboot: bate com a hora do celular sinalizada") },
      { id: "gps-ausente", peso: 1, descricao: "batida sem GPS", verificar: teste("regressao.test", "GPS inválido ou ausente", "sincronização sem GPS segue normalmente") },
      { id: "lote-offline", peso: 2, descricao: "450 eventos offline saem em lotes sem buraco", verificar: teste("regressao.test", "lote grande: 450 eventos offline") },
      { id: "registro-manual-offline", peso: 1, descricao: "registro manual sem modelo, câmera, GPS ou internet", verificar: teste("regressao.test", "registro manual não depende de modelo") },
      { id: "falhas-de-rede", peso: 2, bloqueia: true, descricao: "timeout, 500 intermitente e rede que volta", verificar: teste("robustez-fisica.test", "timeout de rede", "servidor alterna 500 e 200", "rede cai no meio do lote") },
    ],
  },
  {
    id: "integridade", nome: "Integridade", critica: true,
    gates: [
      { id: "sequencia-nunca-renumerada", peso: 3, bloqueia: true, descricao: "sequência local nunca renumerada", verificar: teste("regressao.test", "sequência local nunca é renumerada", "batidas simultâneas nunca pegam a mesma sequência local") },
      { id: "arp-so-acrescenta", peso: 2, bloqueia: true, descricao: "confirmação da ARP só acrescenta ao lado", verificar: teste("armazem-sqlite.test", "confirmação da ARP só acrescenta NSR/hash fiscal") },
      { id: "envio-por-eventid", peso: 2, bloqueia: true, descricao: "evento só sai da fila pela resposta do seu eventId", verificar: teste("regressao.test", "evento nunca é marcado como enviado antes de a ARP responder pelo SEU eventId") },
      { id: "hash-sql-js", peso: 2, descricao: "hash fiscal SQL = JS e cadeia confere", verificar: teste("arp-migration.pglite.test", "hash fiscal calculado no SQL é o MESMO do JavaScript") },
      { id: "append-only", peso: 2, bloqueia: true, descricao: "UPDATE/DELETE/TRUNCATE bloqueados", verificar: teste("arp-migration.pglite.test", "UPDATE, DELETE e TRUNCATE bloqueados", "INSERT direto (fora da ARP) é recusado") },
      { id: "leitura-sem-efeito", peso: 1, descricao: "leitura do comprovante não toca fila nem cadeia", verificar: teste("armazem-sqlite.test", "eventosRecentes (comprovante)") },
      { id: "nsr-so-do-servidor", peso: 2, bloqueia: true, descricao: "aparelho não gera NSR", verificar: teste("codigo-fonte.test", "REP-P: o aparelho não gera NSR") },
    ],
  },
  {
    id: "seguranca", nome: "Segurança local", critica: true,
    gates: [
      { id: "sem-log", peso: 3, bloqueia: true, descricao: "nenhum console.* no app", verificar: teste("codigo-fonte.test", "nenhum console.* no app") },
      { id: "sqlcipher-conexao", peso: 2, bloqueia: true, descricao: "transação na conexão com a chave do SQLCipher", verificar: teste("codigo-fonte.test", "transação do banco na conexão que tem a chave") },
      { id: "android-config", peso: 2, bloqueia: true, descricao: "sem backup, SQLCipher, sem sobreposição, sem WRITE_SETTINGS", verificar: teste("codigo-fonte.test", "configuração Android: sem backup do banco") },
      { id: "diagnostico-sem-pessoal", peso: 2, bloqueia: true, descricao: "diagnóstico nunca inclui token, PIN, CPF, vetor ou foto", verificar: teste("diagnostico", "nunca inclui token, PIN, CPF, vetor ou foto") },
      { id: "pin-hash", peso: 1, descricao: "PIN conferido offline contra hash", verificar: teste("ponta-a-ponta.test", "PIN do encarregado confere offline contra o hash") },
      { id: "token-hash", peso: 1, descricao: "só o hash do token no banco", verificar: teste("regressao.test", "só o hash do token vai para o banco") },
      { id: "atividades-exportadas", peso: 1, bloqueia: true, descricao: "só a atividade de entrada exportada (prebuild)", verificar: evidencia("prebuild", e => (e.atividadesExportadas === undefined ? null : e.atividadesExportadas > 1 ? `${e.atividadesExportadas} atividades exportadas` : null)) },
      { id: "auditoria-documentada", peso: 1, descricao: "auditoria de segurança documentada (SQLCipher, SecureStore, backup, screenshots, clipboard, intents, storage, logs)", verificar: estatico(ctx => {
        if (!ctx.existe("docs/seguranca.md")) return "docs/seguranca.md ausente";
        const md = ctx.ler("docs/seguranca.md").toLowerCase();
        const faltam = ["sqlcipher", "securestore", "backup", "screenshot", "clipboard", "intent", "armazenamento", "log"].filter(t => !md.includes(t));
        return faltam.length ? `itens sem auditoria: ${faltam.join(", ")}` : true;
      }) },
    ],
  },
  {
    id: "sincronizacao", nome: "Sincronização", critica: false,
    gates: [
      { id: "idempotencia", peso: 3, descricao: "reenvio devolve o mesmo NSR", verificar: teste("atualizacao-formato1.test", "ABC recebe o NSR 50") },
      { id: "ordem-offline", peso: 2, descricao: "eventos offline de vários aparelhos na ordem de gravação", verificar: teste("rep-p-ponta-a-ponta.test", "A1 A2 / B1 B2 offline") },
      { id: "foto-depois-do-ok", peso: 2, descricao: "foto só é apagada depois do OK", verificar: teste("regressao.test", "foto só é apagada do aparelho depois do OK do servidor") },
      { id: "fila-de-fotos-robusta", peso: 2, descricao: "foto sumida, trocada ou grande não trava a fila", verificar: teste("regressao.test", "arquivo sumido vira 'sem arquivo'", "foto trocada é recusada pelo servidor", "foto acima do limite não é enviada") },
      { id: "revogado-e-desconhecido", peso: 1, descricao: "revogado e token inválido tratados", verificar: teste("regressao.test", "aparelho revogado: a rodada avisa", "token inválido leva a parear de novo") },
      { id: "biometrias-por-assinatura", peso: 1, descricao: "vetores só descem quando mudam", verificar: teste("funcionario-global.test", "vetores só descem quando o conjunto muda") },
    ],
  },
  {
    id: "multiobra", nome: "Multiobra", critica: false,
    gates: [
      { id: "funcionario-global", peso: 3, descricao: "todo aparelho recebe todos os ativos", verificar: teste("funcionario-global.test", "todo aparelho recebe todos os ativos", "rosto cadastrado no Tablet B") },
      { id: "lotacao-nao-invalida", peso: 1, descricao: "mudar lotação não invalida biometria", verificar: teste("funcionario-global.test", "mudar a lotação do funcionário não apaga") },
      { id: "apropriacao", peso: 2, descricao: "apropriação por intervalos fora da ARP, auditada", verificar: teste("funcionario-global.test", "a proposta separa os intervalos por obra", "B → C com motivo", "vários intervalos no mesmo dia") },
      { id: "migration-018", peso: 3, bloqueia: true, descricao: "contrato da migration 018 (banco novo, 016→017→018, sobreposição, versão, auditoria, cancelamento, permissões, reversão)", verificar: teste("apropriacao-migration.pglite.test", "banco novo", "016 → 017 → 018", "sobreposição", "versão", "auditoria", "cancelamento", "permissões", "reversão") },
      { id: "copy-global", peso: 1, descricao: "nenhum texto do app diz 'nesta obra' para funcionário (regra é global)", verificar: estatico(ctx => { const r = procurar(ctx, /n[ae]sta obra|desta obra/i); return r.length ? `texto por obra em: ${r.join(", ")}` : true; }) },
    ],
  },
  {
    id: "facial", nome: "Reconhecimento facial", critica: false,
    teto: { valor: 8.7, enquanto: ctx => (/MEDIÇÃO DE CAMPO:\s*registrada/i.test(ctx.existe("docs/calibracao-facial.md") ? ctx.ler("docs/calibracao-facial.md") : "") ? null : "sem medição de FAR/FRR em campo com rostos reais (só sintética)") },
    gates: [
      { id: "identificacao", peso: 2, descricao: "reconhece certo, recusa desconhecido e ambíguo", verificar: teste("rosto.test", "reconhece a pessoa certa", "rosto desconhecido não vira batida", "dois cadastros parecidos demais") },
      { id: "far-frr-sintetico", peso: 3, descricao: "suíte sintética de FAR/FRR, margem e segundo candidato", verificar: teste("avaliacao-facial.test", "FAR e FRR", "segundo candidato", "margem", "varredura de limiares") },
      { id: "calibracao-anonima", peso: 2, bloqueia: true, descricao: "calibração de campo sem vetor nem imagem", verificar: teste("calibracao-campo.test", "sessão de calibração guarda só métricas", "relatório anônimo") },
      { id: "escala-1n", peso: 1, descricao: "1:N com 500 funcionários", verificar: teste("escala-reconhecimento.test", "500 funcionários") },
      { id: "anti-spoof-honesto", peso: 2, descricao: "anti-spoof documentado sem afirmar liveness forte", verificar: estatico(ctx => {
        if (!ctx.existe("docs/anti-spoof.md")) return "docs/anti-spoof.md ausente";
        const md = ctx.ler("docs/anti-spoof.md").toLowerCase();
        const ataques = ["foto impressa", "foto na tela", "vídeo", "replay", "pessoa real", "parcialmente coberto"];
        const faltam = ataques.filter(a => !md.includes(a));
        if (faltam.length) return `ataques sem avaliação: ${faltam.join(", ")}`;
        return md.includes("não é liveness forte") || "falta a declaração de que virar o rosto não é liveness forte";
      }) },
      { id: "limiares-centralizados", peso: 1, descricao: "limiares só em calibracao.js", verificar: teste("codigo-fonte.test", "parâmetros faciais só em calibracao.js") },
    ],
  },
  {
    id: "ux_trabalhador", nome: "UI/UX trabalhador", critica: false,
    teto: { valor: 9.0, enquanto: ctx => (linhasDaMatriz(ctx).some(l => /^ok$/i.test(l["validação visual"] || "")) ? null : "telas validadas só no harness web (sem screenshot em aparelho físico)") },
    gates: [
      { id: "status-conciso", peso: 2, descricao: "status com ícone + texto + cor", verificar: teste("apresentacao.test", "status sempre tem ícone e texto", "offline não é erro") },
      { id: "fases-camera", peso: 2, descricao: "fases da câmera e guia facial", verificar: teste("apresentacao.test", "as fases seguem o roteiro", "guia facial: neutra") },
      { id: "falha-nao-alarmista", peso: 2, descricao: "incerteza neutra; vermelho só em falha real", verificar: teste("apresentacao.test", "rosto não confirmado é incerteza normal", "falha real (batida não gravada") },
      { id: "sucesso-completo", peso: 2, descricao: "comprovante como estado completo", verificar: teste("apresentacao.test", "mostra o que o trabalhador precisa ver", "comprovante offline tranquiliza") },
      { id: "sem-termo-tecnico", peso: 1, descricao: "nada de TFLite/modelo para o trabalhador", verificar: teste("apresentacao.test", "nenhuma instrução ao trabalhador fala de modelo") },
      { id: "fuso-do-estabelecimento", peso: 2, descricao: "hora no fuso do estabelecimento (sem fuso fixo nas telas)", verificar: estatico(ctx => { const r = procurar(ctx, /America\/Recife/, fontesDoApp(ctx).filter(f => /src\/(telas|logica\/apresentacao|logica\/diagnostico)/.test(f))); return r.length ? `fuso fixo em: ${r.join(", ")}` : true; }) },
      { id: "design-system", peso: 2, bloqueia: true, descricao: "detector Impeccable RN (cor, gradiente, sombra, raio, espaço, fonte)", verificar: teste("design-system.test", "nenhuma cor solta", "sem gradiente, sem sombra decorativa", "raio só por token", "espaço só na grade") },
      { id: "telas-validadas", peso: 1, descricao: "screenshots dos estados críticos", verificar: estatico(ctx => { const faltam = ESTADOS_DE_TELA.filter(e => !ctx.existe(`docs/ui/${e}.png`)); return faltam.length ? `sem screenshot: ${faltam.join(", ")}` : true; }) },
      { id: "impeccable-p0-p1", peso: 3, bloqueia: true, descricao: "Impeccable: P0 = 0 e P1 = 0 ou justificado", verificar: estatico(ctx => {
        const r = resumoImpeccable(ctx);
        if (!r) return "IMPECCABLE-REVIEW.md sem bloco impeccable-resumo";
        if (r.p0 > 0) return `${r.p0} P0 aberto(s)`;
        if (r.p1 > (r.p1_justificados || 0)) return `${r.p1 - (r.p1_justificados || 0)} P1 sem justificativa`;
        return true;
      }) },
    ],
  },
  {
    id: "ux_encarregado", nome: "UI/UX encarregado", critica: false,
    teto: { valor: 9.0, enquanto: ctx => (linhasDaMatriz(ctx).some(l => /^ok$/i.test(l["validação visual"] || "")) ? null : "telas validadas só no harness web (sem screenshot em aparelho físico)") },
    gates: [
      { id: "menu-seccionado", peso: 3, descricao: "menu em seções, sem botões soltos", verificar: teste("apresentacao.test", "menu em três seções") },
      { id: "cadastro-guiado", peso: 3, descricao: "cadastro facial guiado com progresso", verificar: teste("apresentacao.test", "cadastro facial é guiado") },
      { id: "pareamento-simples", peso: 1, descricao: "pareamento em 8 casas", verificar: teste("apresentacao.test", "8 casas, só dígitos") },
      { id: "sincronizacao-legivel", peso: 1, descricao: "sincronização com estado por escrito", verificar: teste("apresentacao.test", "sincronização sinaliza atenção") },
      { id: "funcionarios", peso: 2, descricao: "lista de funcionários com situação do rosto", verificar: teste("apresentacao.test", "funcionários: situação do rosto por escrito") },
      { id: "acessivel", peso: 2, bloqueia: true, descricao: "todo controle com nome acessível", verificar: teste("design-system.test", "todo Pressable tem papel e nome acessível") },
    ],
  },
  {
    id: "acessibilidade", nome: "Acessibilidade", critica: true,
    gates: [
      { id: "alvos-44", peso: 2, bloqueia: true, descricao: "alvos >= 44", verificar: teste("design-system.test", "alvos de toque: mínimo 44") },
      { id: "contraste", peso: 2, bloqueia: true, descricao: "contraste WCAG", verificar: teste("design-system.test", "contraste: texto principal e secundário") },
      { id: "nomes-acessiveis", peso: 2, bloqueia: true, descricao: "labels em todo controle", verificar: teste("design-system.test", "todo Pressable tem papel e nome acessível") },
      { id: "tamanho-minimo", peso: 1, descricao: "nada abaixo de 13 px", verificar: teste("design-system.test", "nada abaixo de 13 px") },
      { id: "nao-so-cor", peso: 2, descricao: "estado com texto + cor + ícone", verificar: teste("apresentacao.test", "status sempre tem ícone e texto") },
      { id: "font-scaling", peso: 1, descricao: "todo token tipográfico com limite de escala", verificar: estatico(ctx => (/escalaMax/.test(ctx.ler("src/ui/tokens.js")) ? true : "tokens sem escalaMax")) },
    ],
  },
  {
    id: "release", nome: "Governança de release", critica: false,
    gates: [
      { id: "versao-semver", peso: 1, descricao: "appVersion em semver", verificar: estatico(ctx => (/^\d+\.\d+\.\d+$/.test(appJson(ctx).version) ? true : `versão inválida: ${appJson(ctx).version}`)) },
      { id: "versao-rep", peso: 1, descricao: "versão do software REP separada da do app", verificar: estatico(ctx => (/versao:\s*"\d+\.\d+\.\d+[^"]*"/.test(ctx.lerRaiz("src/domains/ponto-eletronico/rep-p.js")) ? true : "REP_P.versao ausente")) },
      { id: "versoes-no-diagnostico", peso: 2, descricao: "appVersion, REP version, versionCode e commit no Diagnóstico", verificar: teste("diagnostico", "versões de release separadas") },
      { id: "commit-no-build", peso: 1, descricao: "commit do build (EAS ou git) no app", verificar: estatico(ctx => (/EAS_BUILD_GIT_COMMIT_HASH/.test(ctx.ler("app.config.js")) ? true : "commit do build ausente")) },
      { id: "metadados-do-build", peso: 1, descricao: "perfil e data do build no app", verificar: estatico(ctx => (/EAS_BUILD_PROFILE/.test(ctx.ler("app.config.js")) && /buildEm/.test(ctx.ler("app.config.js")) ? true : "perfil/data do build ausentes")) },
      { id: "perfis-eas", peso: 1, descricao: "perfis homologacao e producao separados", verificar: estatico(ctx => { const b = JSON.parse(ctx.ler("eas.json")).build; return b.homologacao?.environment === "preview" && b.homologacao?.env?.PONTO_AMBIENTE === "homologacao" && b.producao?.env?.PONTO_AMBIENTE === "producao" && !b.piloto ? true : "perfis EAS sem isolamento explícito"; }) },
      { id: "release-check", peso: 2, descricao: "npm run mobile:release-check existe", verificar: estatico(ctx => (/"mobile:release-check"/.test(ctx.lerRaiz("package.json")) ? true : "script mobile:release-check ausente")) },
      { id: "ci-relatorio", peso: 2, descricao: "CI roda o scorecard e guarda o relatório", verificar: estatico(ctx => { const y = ctx.lerRaiz(".github/workflows/quality.yml"); return /mobile-release-check|mobile:release-check/.test(y) && /mobile-quality-report/.test(y) ? true : "CI sem scorecard/artifact"; }) },
      { id: "arvore-limpa", peso: 1, descricao: "build a partir de commit limpo", verificar: evidencia("gitLimpo") },
    ],
  },
  {
    id: "diagnostico", nome: "Diagnóstico", critica: false,
    gates: [
      { id: "secoes", peso: 3, descricao: "seções Aplicativo, Aparelho, Sincronização, REP-P, Hora, Modelos", verificar: teste("diagnostico", "seções do suporte") },
      { id: "privacidade", peso: 3, bloqueia: true, descricao: "lista fechada sem dado pessoal", verificar: teste("diagnostico", "nunca inclui token, PIN, CPF, vetor ou foto") },
      { id: "hora", peso: 2, descricao: "estado da referência de hora", verificar: teste("diagnostico", "estados da referência") },
      { id: "matriz-de-hora", peso: 2, descricao: "matriz de comportamento da hora", verificar: teste("matriz-hora.test", "sem medição", "medição válida", "medição vencida", "fora da tolerância", "offline", "NTP indisponível") },
    ],
  },
  {
    id: "rep_p_tecnico", nome: "Arquitetura REP-P (técnica)", critica: true,
    gates: [
      { id: "arp-nsr", peso: 3, bloqueia: true, descricao: "NSR por estabelecimento, idempotente, sem lacuna", verificar: teste("arp-migration.pglite.test", "NSR começa em 1", "dois aparelhos (obras diferentes) do MESMO estabelecimento", "mesmo eventId reenviado") },
      { id: "arp-atomica", peso: 2, bloqueia: true, descricao: "erro desfaz tudo sem queimar NSR", verificar: teste("arp-migration.pglite.test", "erro no meio da transação desfaz tudo") },
      { id: "apropriacao-fora-da-arp", peso: 2, descricao: "apropriação não toca a ARP", verificar: teste("funcionario-global.test", "a proposta separa os intervalos por obra") },
      { id: "sem-falsa-conformidade", peso: 2, bloqueia: true, descricao: "nenhuma tela declara REP-P conforme", verificar: estatico(ctx => { const r = procurar(ctx, /REP-P conforme|conforme a Portaria/i); return r.length ? `afirmação de conformidade em: ${r.join(", ")}` : true; }) },
      { id: "situacao-pendente", peso: 1, descricao: "situação formal sempre 'não conforme' até a Fase 2", verificar: estatico(ctx => (/conforme:\s*false/.test(ctx.lerRaiz("src/domains/ponto-eletronico/rep-p.js")) ? true : "situacaoRepP pode afirmar conformidade")) },
    ],
  },
  {
    id: "testes", nome: "CI / testes", critica: true,
    gates: [
      { id: "suite-verde", peso: 4, bloqueia: true, descricao: "toda a suíte do ponto passa", verificar: ctx => (!ctx.vitest ? semEvidencia() : ctx.vitest.falhas === 0 ? ok(`${ctx.vitest.aprovados} testes`) : falha(`${ctx.vitest.falhas} teste(s) falhando`)) },
      { id: "ci-018", peso: 2, descricao: "CI nomeia a migration 018 nos contratos", verificar: estatico(ctx => (/apropriacao-migration\.pglite\.test/.test(ctx.lerRaiz(".github/workflows/quality.yml")) ? true : "018 fora do job de migrations")) },
      { id: "ci-postgres", peso: 2, descricao: "job de concorrência real em Postgres", verificar: estatico(ctx => (/arp-concorrencia\.pg\.test/.test(ctx.lerRaiz(".github/workflows/quality.yml")) ? true : "job Postgres ausente")) },
      { id: "ci-mobile", peso: 2, descricao: "job mobile com doctor, bundle, prebuild e testes", verificar: estatico(ctx => { const y = ctx.lerRaiz(".github/workflows/quality.yml"); return /expo-doctor|release-check/.test(y) && /prebuild/.test(y) ? true : "job mobile incompleto"; }) },
    ],
  },
];

export const CATEGORIAS_CRITICAS = CATEGORIAS.filter(c => c.critica).map(c => c.id);
