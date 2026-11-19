# Continuação da auditoria — acessibilidade e PostgreSQL local

**Situação mais recente, 15/11/2026:** [tipografia e planos antigos](TIPOGRAFIA-E-PLANOS-LEGADOS-2026-11-15.md) concluídos localmente, DRE preservado e relatórios atualizados. Os testes PostgreSQL abaixo pertencem à rodada anterior; o banco descartável não foi reaberto nesta continuação.

Execução autorizada em 14/11/2026, após o [relatório anterior](EXECUCAO-ROADMAP-2026-11-14.md). Evidências desta continuação: `artifacts/pendencias-20261114/`. Todo o trabalho permaneceu local, sem push, PR, migração remota ou publicação na Vercel.

**Continuações seguintes:** a divisão dos chunks e o alinhamento do `DESIGN.md` avançaram em [desempenho e design](PERFORMANCE-E-DESIGN-2026-11-14.md). O aviso de chunks grandes foi eliminado; o excesso agregado de gzip também foi resolvido em [gzip e relatórios](GZIP-E-RELATORIOS-2026-11-14.md), com limite preservado e DRE conferido. Os resultados abaixo pertencem à rodada de acessibilidade e PostgreSQL e permanecem como evidência histórica.

## Pendências solicitadas

| Pendência | Resultado comprovado |
| --- | --- |
| 21 elementos com divergência entre nome acessível e texto visível | Reproduzidos na compilação inicial desta continuação e corrigidos. A nova varredura das 65 abas em desktop e celular, 130 combinações, não encontrou violações nas regras axe executadas. |
| 15 testes dependentes de PostgreSQL real | Executados em PostgreSQL 17.12 local e descartável: 15 aprovados, sem pulos. A rodada teve 16 testes aprovados ao incluir a checagem estática de JSONB do mesmo arquivo. |
| DRE a cada etapa | Preservado nas 130 consultas de interface; 20 checkpoints financeiros repetidos e aprovados. Dois testes concorrentes PostgreSQL comparam o DRE empresarial antes/depois dos dados efetivamente persistidos. |
| Descarte do banco | Servidor parado, pasta temporária removida e porta 55439 sem listener. Comprovante: `postgres-disposal.json`. |

## Correções de acessibilidade

1. **Compras e equipamentos:** os componentes compartilhados `WorkspaceNavigation` e `FlowTabs` agora incluem o contador visível no nome acessível, inclusive quando a quantidade é zero. O separador textual também existe no DOM, evitando anunciar o nome e o número concatenados. IDs de destino, seleção, permissões e quantidades não foram alterados.
2. **Equipes:** o botão contém o nome da pessoa; iniciais decorativas e informação trabalhista ficam fora desse botão. O valor continua disponível somente para os perfis autorizados. A abertura por nome e teclado é preservada, com os mesmos controles de cadastro e desligamento.
3. **Ponto e botão compartilhado:** um `title` explicativo não substitui mais o texto de um botão com rótulo visível. A dica continua disponível; botões compostos apenas por ícone conservam o nome explícito ou o título. Ações indisponíveis continuam desabilitadas.
4. **Ajuda/manual:** revista a orientação de Equipes para explicar que o valor é uma informação separada do botão do nome. Manual regenerado e conferido, com 141 guias para 65 abas. Os ajustes de nome e separação de texto não introduzem operação financeira.

Três regressões novas falharam antes da correção e passaram depois. A primeira verificação de navegador após ajustar os nomes ainda encontrou 11 elementos: o contador tinha separação visual, mas faltava um espaço textual. Essa causa foi corrigida na base compartilhada; a repetição nas dez combinações afetadas passou sem violações antes da varredura completa. Os resultados intermediários foram preservados em `a11y-red-tests.json` e `a11y-after-primeira-rodada.json`.

Os testes de navegação foram atualizados para aceitar o contador no nome, sem substituir IDs de operação nem enfraquecer as verificações de permissão. Também foram corrigidas referências antigas ao nome móvel “Abrir Compras e suprimentos”, cujo controle atual inclui o texto visível “Compras”.

## PostgreSQL real e conferência do DRE

Foi usado o arquivo de binários Windows distribuído pela EDB, conforme a opção de arquivo ZIP indicada na [página oficial do PostgreSQL para Windows](https://www.postgresql.org/download/windows/). Origem, SHA-256 e caminhos estão em `postgres-runtime.json`; a consulta à instância em execução está em `postgres-observed.json`.

O cluster foi inicializado em uma pasta exclusiva do diretório temporário, sem registrar serviço no Windows. Escutou apenas em `127.0.0.1:55439`; o banco foi `mrc_qa_integrity`. A variável `PONTO_PG_URL` foi definida somente no processo dos testes para essa conexão local. Nenhuma conexão de produção foi reutilizada. As migrations necessárias aos testes foram executadas somente nesse banco descartável.

| Arquivo | Casos dependentes de PostgreSQL | Conferência |
| --- | ---: | --- |
| `server/closed-dre-locking.pg.test.js` | 2 | Duas conexões concorrentes; escritor aguarda o fechamento e depois rejeita alteração retroativa com `CLOSED_DRE_IMMUTABLE`. Conferir os valores persistidos e a projeção empresarial. |
| `server/jsonb-gravacao.test.js` | 1 | `sql.json` grava objeto JSONB; o uso incorreto de serialização dupla produz texto e é identificado. A checagem estática adicional também passou. |
| `server/orcamentos-linha-propria.pg.test.js` | 7 | Gravação e leitura das linhas, orçamento aprovado imutável, concorrência e proteção contra sobrescrita/perda de versões. |
| `server/ponto-eletronico/arp/arp-concorrencia.pg.test.js` | 5 | Eventos simultâneos, numeração sem colisões/lacunas, cadeia fiscal, repetição idempotente e recuperação após falha/commit. |

Os testes financeiros de fechamento foram ampliados com uma manutenção já reconhecida de **R$ 250**, para que a comparação não dependa apenas de um cenário vazio. Em cada um dos dois escritores, antes e depois da tentativa rejeitada:

| Indicador do DRE empresarial — julho/2026 | Antes | Depois |
| --- | ---: | ---: |
| Receita | R$ 0 | R$ 0 |
| Manutenção reconhecida | R$ 250 | R$ 250 |
| Custo dos serviços | R$ 250 | R$ 250 |
| Resultado líquido | −R$ 250 | −R$ 250 |
| Entradas/saídas de caixa | R$ 0 / R$ 0 | R$ 0 / R$ 0 |

Não houve cancelamento do custo, novo ponto confirmado ou evento de auditoria de uma gravação recusada. Evidências numéricas em centavos: `postgres-dre-equipamento.json` e `postgres-dre-ponto.json`. Os registros brutos da ARP, a organização do orçamento e a codificação JSONB são verificados em suas respectivas camadas; sua execução não representa confirmação de folha ou pagamento.

Na etapa de interface, cada consulta comparou o motor canônico antes/depois sobre o estado local da sessão e preservou os valores da competência novembro/2026. Essa comparação não opera a tela do DRE após cada botão nem representa leitura de produção. O roteiro financeiro separado tem 20 resultados esperados previamente definidos e cobre valores positivos, reconhecimento, pagamentos parciais, conciliação e estorno; terminou com receita de R$ 5.000, custo de R$ 3.000 e resultado de R$ 2.000, sem custo duplicado no pagamento.

## Evidências e limites

| Evidência | Conteúdo |
| --- | --- |
| `a11y-before.json` | Reprodução dos 21 elementos em dez combinações de áreas/tamanho |
| `a11y-after.json` | Dez combinações afetadas sem violações, com DRE preservado |
| `a11y.json` | Varredura final de 130 combinações com resultado axe e comparação do DRE em cada consulta |
| `postgres-tests-final.json` | 16 aprovações, zero falhas e zero pulos; inclui os 15 casos antes pendentes |
| `postgres-dre-*.json` | Comparação financeira sobre os dados persistidos durante os testes concorrentes |
| `postgres-observed.json`, `postgres-disposal.json` | Identificação da instância local e comprovação do descarte |
| `ui-regression.json` | 302 testes de componentes e domínios afetados aprovados, sem pulos |
| `browser-tests*.json`, `keyboard-permissions.json` | 109 cenários distintos aprovados: 97 inicialmente e 12 após corrigir seletores antigos do menu móvel. Os seis casos de equipe foram repetidos com teclado e verificação de ausência de gravações, como subconjunto dessa cobertura. |
| `dre-walkthrough.json` | 20 checkpoints financeiros aprovados |
| `lint.log`, `typecheck.log`, `build-after.log` | Checagens de código, padrão de interface, ajuda/manual, tipos e compilação |
| `screens/` | Imagens das áreas afetadas, em desktop e celular; Equipes desktop e Compras celular inspecionadas visualmente |
| `verification.json`, `verify.mjs` | Conferência automatizada da cobertura, ausência de falhas/pulos PostgreSQL, DRE e remoção efetiva do diretório temporário |

Esta continuação resolve as duas pendências locais solicitadas. O resultado do axe é limitado às regras, dados, estados e navegador executados; não substitui avaliação com leitor de tela nem certifica todos os temas e estados possíveis. Permanecem os limites já registrados para serviços externos reais, dispositivos físicos, outros navegadores, saneamento de dados históricos, alinhamento do documento de design e tamanho dos chunks. Nenhum desses itens foi declarado homologado por esta rodada.
