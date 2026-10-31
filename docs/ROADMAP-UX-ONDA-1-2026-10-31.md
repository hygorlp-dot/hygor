# Primeira onda — layout de Compras e rotina financeira

31/10/2026. Implementação local do [roadmap de Financeiro e Compras](ROADMAP-UX-FINANCEIRO-COMPRAS-2026-10-31.md). Marca, logo, Source Sans 3 e tokens existentes preservados. Sem publicação, migração ou alteração na conta da Vobi.

## UX01 — Compras com o registro mais próximo

- Cabeçalho reúne título e obra; a ação principal acompanha a área. Cotações oferece “Adicionar cotação” uma única vez no cabeçalho.
- Retorno à fila fica acessível no mesmo cabeçalho; análise de documento e criação de solicitação continuam disponíveis em Mais ações.
- Removidos os títulos redundantes antes da lista. Consulta DRE passa para depois do conteúdo operacional, mantendo competência e acesso existentes.
- Busca e botão de filtros dividem uma linha no celular. As datas continuam preenchidas ao recolher os filtros.
- “Comparar propostas” é um botão nativo, com expansão e identificação da cotação. Exclusão fica no menu do registro, reutilizando o componente dos pedidos.
- Respostas pendentes continuam usando a abertura automática e contagens existentes; não foram escondidas para atingir uma meta de altura.

## UX02 — Financeiro organizado por finalidade

- **Rotina:** Hoje, Documentos, Pagamentos, Notas fiscais e Fechamento, conforme perfil.
- **Análises:** Visão financeira, Custos por etapa e Relatórios financeiros, conforme perfil.
- **Ferramentas:** Administrativo, Homologação e Modo IA, conforme perfil.
- Desktop usa grupos visíveis; o seletor móvel apresenta grupos nativos e identifica o grupo ativo abaixo do campo.
- A conciliação continua acessível pela navegação autorizada do módulo Financeiro. Não foi criada outra tela de conciliação nem alterada sua permissão.
- Mantidos os filtros de obra, a escolha da fila Hoje, os avisos de vencidos e a distinção entre competência, vencimento e caixa.

## Correção de continuidade encontrada na verificação

A memória de apresentação era atualizada apenas em um efeito após renderizar. Foi reproduzida a perda da última escolha quando uma atualização e a desmontagem ocorriam no mesmo lote. O teste novo falhou antes da correção, com o valor antigo preservado.

`useWorkspaceState` agora registra a escolha na memória da sessão no próprio setter, antes da navegação, e calcula atualizações funcionais sucessivas a partir desse registro. A inicialização não sobrescreve uma escolha mais recente. O estado permanece em memória; não há persistência em banco, armazenamento de formulário financeiro ou mudança de permissões.

## Medida de aproveitamento

Posição do primeiro registro de cotação no cenário sintético, com página no topo, filtros adicionais recolhidos no celular e sem retorno de fornecedor pendente:

| Janela | Primeiro registro |
|---|---:|
| 1440 × 900 | 517 px |
| 1024 × 900 | 517 px |
| 768 × 900 | 517 px |
| 610 × 1244 | 573 px |
| 390 × 844 | 547 px |
| 320 × 844 | 565 px |

A observação anterior em 610 × 1244 mostrava o registro em aproximadamente 836 px: a nova composição recupera cerca de 263 px antes do registro. Trata-se de altura de interface; não é uma medição de ganho de produtividade em uso real. Filas com respostas pendentes priorizam os registros de revisão de fornecedor.

## Notas de design

Avaliação manual da entrega local, de 0 a 10, considerando cinco critérios com o mesmo peso. As notas representam as telas e estados inspecionados; serão revistas conforme as próximas jornadas forem integradas.

| Critério | UX01 · Compras | UX02 · Financeiro |
|---|---:|---:|
| Hierarquia e próxima ação | 9,0 | 8,5 |
| Consistência de texto e componentes | 9,0 | 9,0 |
| Aproveitamento do espaço | 8,5 | 8,0 |
| Adaptação a telas e conteúdo | 8,0 | 8,0 |
| Clareza dos controles e teclado | 8,5 | 8,5 |
| **Nota da entrega** | **8,6** | **8,4** |

Para melhorar: comparativos com muitos fornecedores ainda dependem de rolagem interna; formulários extensos e documentos de outras origens têm refinamentos previstos nas próximas ondas. No Financeiro, a linha da fila ainda precisa oferecer a próxima ação específica da origem, além do memorial — UX04.

## Verificação

Evidências visuais e métricas: `artifacts/roadmap-wave-one/verification.json` e capturas no mesmo diretório. Roteiro: `node scripts/roadmap-wave-one-verify.mjs`.

O roteiro usa somente endereço local, dados sintéticos e APIs interceptadas. Verifica seis larguras, ausência de transbordamento da página, posição dos registros e botões, criação cancelada de cotação, estados vazios, filtros preservados, menu por teclado/Escape, grupos financeiros e retorno entre módulos. Inclui uma janela de 720 × 450 como equivalente de composição a 200% de zoom em 1440 × 900; não constitui auditoria completa de acessibilidade.

Os roteiros de Compras foram atualizados para acessar o seletor móvel, abrir ferramentas antes de escolhê-las e usar o botão nativo de comparação. Quando existem duas ações de decisão, a verificação identifica a do cabeçalho. A checagem de obra também confirma a seleção após retornar à fila e trocar de área.

A bateria final usa um build estático local na porta 4199, com todas as APIs interceptadas pelos testes. Isso evita que recargas do servidor de desenvolvimento compartilhado invalidem a jornada durante alterações locais. A prévia da porta 4198 continua disponível ao usuário.

| Verificação final | Resultado |
|---|---|
| Testes direcionados de componentes, ligação com DRE/cotação e memória da sessão | 20 testes aprovados em cinco arquivos; inclui regressão que falhou antes da correção |
| Regressão completa de Compras em build estático | 41 cenários aprovados, sem retries |
| Continuidade financeira em 1440 e 390 px | Dez verificações aprovadas |
| Planejamento, compras, financeiro, orçamento e retorno à obra | Jornadas aprovadas em 1440, 390 e 320 px, 32 capturas, sem erros de página |
| Layout da primeira onda | Seis larguras, 37 capturas incluindo vazios, filtros, menus e composição equivalente a zoom de 200%; sem transbordamento da página nos cenários verificados |
| Lint e TypeScript | Aprovados |
| Build direto do Vite | Aprovado; permanece aviso de chunks acima de 650 kB |
| Detector de layout Impeccable nos arquivos visuais alterados | Sem ocorrências; complementado pela inspeção das capturas |

Logs finais em `artifacts/roadmap-wave-one/`: `compras-static-final.log`, `workflow-static-final.log`, `layout-static-final.log`, `finance-navigation-static-final.log` e `build.log`. Capturas de continuidade em `artifacts/workflow-priorities/`. A contagem de capturas não deve ser somada à de testes como se fossem verificações independentes equivalentes.

Reprodução local estática:

```powershell
npx vite preview --host 127.0.0.1 --port 4199 --strictPort --outDir artifacts/roadmap-wave-one/build
```

Em outro terminal, usar `PLAYWRIGHT_PORT=4199` na suíte de Compras, `WORKFLOW_BASE_URL=http://127.0.0.1:4199` no roteiro de continuidade e `ROADMAP_BASE_URL=http://127.0.0.1:4199` no roteiro desta onda. `finance-navigation-verify.mjs` aceita o endereço como primeiro argumento. Os endereços e as variáveis desses testes não alteram o servidor de desenvolvimento do usuário.

**Posição:** UX01 e UX02 concluídas, onda 1 de 4. Próxima onda: UX03 e UX04, conferência conectada da compra e ação específica na fila financeira. Aprovações, pagamentos e conciliações continuam nos comandos e permissões existentes.
