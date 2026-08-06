---
target: diário de obra
total_score: 21
max_score: 40
na_heuristics:
p0_count: 0
p1_count: 4
timestamp: 2026-08-06T14-08-21Z
slug: src-legacyapp-jsx-diarioobra
---
# Crítica de design — Diário de Obra

## Design Health Score

| # | Heurística | Nota | Problema-chave |
|---|---|---:|---|
| 1 | Visibilidade do status | 2/4 | Autosave sem estado persistente de “salvando/salvo/erro”. |
| 2 | Correspondência com o mundo real | 4/4 | Vocabulário e sequência operacional representam muito bem um RDO. |
| 3 | Controle e liberdade | 2/4 | Sem desfazer; documento concluído aparenta continuar editável. |
| 4 | Consistência e padrões | 2/4 | “Excluir” executa cancelamento; status cancelado não aparece no filtro. |
| 5 | Prevenção de erros | 1/4 | Clima nasce como “Bom” sem confirmação e conclusão só explica bloqueios após o clique. |
| 6 | Reconhecimento em vez de memorização | 3/4 | Bom contexto, mas presença exige memorizar um ciclo de quatro estados. |
| 7 | Flexibilidade e eficiência | 1/4 | Falta ação em lote, busca nas listas, recolhimento e retomada por pendências. |
| 8 | Estética e minimalismo | 2/4 | Cerca de 14 seções simultâneas, tipos pequenos e excesso de cartões equivalentes. |
| 9 | Recuperação de erros | 2/4 | Falhas de salvamento dependem de toast, sem repetição ou erro inline persistente. |
| 10 | Ajuda e documentação | 2/4 | Faltam critérios explícitos de conclusão, obrigatoriedade e consequência da edição. |
| **Total** | | **21/40** | **Aceitável, com riscos importantes para uso intensivo em campo.** |

## Veredito de especificidade

O conteúdo é genuinamente específico da engenharia de campo: RDO numerado, clima por turno, avanço ligado ao planejamento, efetivo, terceiros, equipamentos, evidências, IA e revisão técnica. A composição visual, porém, é genérica: uma longa sucessão de cartões com peso semelhante. O produto deveria parecer uma “prancheta de campo auditável”, guiada por pendências e evidências, não um formulário administrativo contínuo.

A varredura determinística encontrou 83 ocorrências no arquivo monolítico, mas apenas três sinais se relacionam diretamente ao Diário: duas bordas laterais grossas (`side-tab`, linhas 30262 e 30464) e Arial no HTML de impressão (linha 30262). O achado de Arial no documento impresso é secundário; as bordas confirmam a dependência excessiva de ornamento lateral para hierarquia. A inspeção estática adicional identificou interações não semânticas, rótulos não associados, estado de presença dependente de cor e alvos de toque pequenos.

## Impressão geral

O domínio é forte e a rastreabilidade é promissora, mas a interface expõe complexidade demais e oferece confiança insuficiente justamente nos momentos críticos: salvar e concluir. A maior oportunidade é transformar as cinco macroetapas visuais em uma jornada real, progressiva e auditável.

## O que funciona

1. A arquitetura do conteúdo conecta relato, planejamento, recursos e evidências; não é um RDO genérico.
2. A IA é enquadrada com responsabilidade e exige revisão humana.
3. O histórico possui busca, filtros, duplicação e PDF, acelerando consulta e repetição.

## Problemas prioritários

### [P1] Autosave sem confiança operacional

Cada alteração grava automaticamente, mas não existe indicador fixo de fila, confirmação, horário ou falha. Em conexão instável, a promessa “salva sozinho” pode induzir perda de confiança ou trabalho. Adotar debounce, estados `Alterações locais → Salvando → Salvo às…`, fila offline, repetição e aviso de saída. Comando sugerido: `$impeccable harden`.

### [P1] Defaults podem virar fatos falsos

Manhã, tarde e noite começam como “Bom”, embora ninguém tenha confirmado. Clima é dado auditável e pode justificar improdutividade. Iniciar como “Não informado”, permitir “Aplicar a todos” e bloquear/alertar na conclusão. Comando sugerido: `$impeccable harden`.

### [P1] O stepper de cinco etapas não governa o formulário

O trilho não navega, não recolhe conteúdo e usa critérios incoerentes com os rótulos. Transformá-lo em navegação sticky real, agrupar/recolher seções, mostrar pendências e distinguir obrigatório de opcional. Comando sugerido: `$impeccable layout` e `$impeccable clarify`.

### [P1] Estados documentais são ambíguos

“Excluir” na verdade cancela; cancelado não aparece no filtro; a navegação não aguarda corretamente a Promise de cancelamento; concluídos aparentam editáveis. Renomear para “Cancelar RDO”, expor status e motivo, aguardar confirmação e tornar concluído imutável ou reabrível apenas com justificativa e nova revisão. Comando sugerido: `$impeccable harden`.

### [P2] Interações frágeis em campo

Tipografia de 8,5–10 px, controles pequenos e presença por ciclo/colorização são inadequados para sol, luvas, movimento, baixa visão e teclado. Usar alvos de 44 px, controle segmentado explícito, ação “Marcar todos presentes”, foco visível e estado por texto+ícone. Comando sugerido: `$impeccable adapt`.

## Personas

**Casey — usuário móvel e interrompido:** enfrenta uma página longa, ações importantes longe do polegar e remoções pequenas. Não há resumo de onde parou nem confirmação persistente do salvamento.

**Jordan — primeira utilização:** pode acreditar que clima “Bom” foi confirmado, interpretar IA como obrigatória e só descobrir a revisão necessária ao tentar concluir. O ciclo de presença não revela previamente seus estados.

**Sam — teclado/baixa visão:** encontra divs clicáveis sem teclado, selects sem rótulos associados, estados por cor, trilho sem semântica e tipos/alvos muito pequenos.

## Observações menores

- Ortografia visível mistura termos com e sem acento.
- O histórico não oferece “Limpar filtros” nem contagem filtrada.
- A busca consulta somente o primeiro campo narrativo preenchido devido ao uso de `descricao || ocorrencias || pendencias`.
- A IA ganha peso visual antes de haver evidência suficiente.
- Estilos quase todos inline dificultam foco, responsividade e consistência.
- Serviços clicáveis usam `div onClick`; textareas e selects de clima carecem de rótulos programáticos.

## Perguntas para orientar a próxima etapa

- O Diário é um formulário completo ou uma sequência de decisões de campo que termina em documento?
- Quais cinco dados mínimos tornam um RDO concluível?
- Que prova concreta deve tranquilizar o usuário se a rede cair após dez minutos?
- Um RDO concluído é imutável ou reabrível mediante nova auditoria?
- O registro inicial de equipe, clima e serviços poderia ser concluído em menos de 60 segundos?
