# Consolidação do financeiro — MARCELL

A revisão posterior com leitura da base real e correções de identificação, busca e categorias está em [REVISAO-FINANCEIRO-DADOS-REAIS.md](./REVISAO-FINANCEIRO-DADOS-REAIS.md).

Revisão de 30/10/2026 em `C:/dev/repositorio-mrc`. Implementação e validação locais, preservando o trabalho anterior e as alterações dos demais módulos. Nenhum push, PR, deployment, migração ou gravação em banco de produção.

## Fluxos integrados

| Área | Integração conferida |
|---|---|
| Hoje e indicadores | Obra, saldos parciais, títulos sem data válida, competência versus caixa, sete indicadores e composição no memorial |
| Previsão de caixa | Vencimentos válidos, horizonte, saldo hipotético, atraso de recebimento, vencidos opcionais e origem de cada valor |
| Conciliação | Conta e motivo de divergência, limpeza de seleção ao mudar o recorte, categoria, vínculo, competência e prevenção de segunda despesa ao conciliar folha paga |
| Documentos e ficha fiscal | Competência, busca, situação e seleção preservadas; memorial → documento → ficha → retorno; original PDF, imagem e XML, erros de leitura e gravação somente após confirmar |
| Recorrências e importações | Prévia, cancelamento, duplicidade, linha inválida, atualização da base e comando de confirmação; recorrência mensal, extrato e XML fiscal |
| Relatórios | Resultado por competência, caixa realizado e títulos por vencimento; filtros, agrupamento, memorial líquido, CSV, Excel e impressão no mesmo recorte; exportação além da página visível |
| Custos por obra e etapa | Orçado, comprometido, recebido físico, incorrido, pago e cliente direto; apropriação assistida, versões, premissas, revisão do custo restante e reconferência após mudança da base |
| DRE e fechamento | Memorial anual e mensal, competência fechada, documento e obra de origem; pendências documentais e financeiras; restrição do fechamento por perfil |

Administrador e financeiro foram exercitados nas jornadas integradas; desktop de 1440 px e celular de 390 px nos fluxos responsivos. A navegação entre filtros, memorial e documentos preserva o contexto nos cenários verificados.

## Correções desta consolidação

### Documento reconhecido em toda a conferência

A central documental e o memorial não reconheciam uma referência relativa de arquivo do provedor que o leitor do original já aceitava. Além disso, havia diferença de tratamento de URLs com credenciais. O critério foi reunido em `src/domains/financeiro/document-links.js`, consumido pelo registro de pendências, memorial e prévia. A conferência agora orienta o usuário quando existem anexos cadastrados, mas nenhum link disponível para abrir. Apenas a rota relativa de arquivo já existente no ERP é aceita; as demais referências precisam ser HTTP/HTTPS válidas, sem credenciais embutidas.

### Vencimento inválido permanece para conferência

Datas antigas como `2026-02-30` passavam pela checagem de formato e podiam ser deslocadas pelo calendário JavaScript para outro dia. A posição de títulos agora usa uma validação de calendário compartilhada e deixa esses títulos na fila sem vencimento válido. A data original permanece nos dados do memorial, marcada como inválida. Hoje, previsão e relatório passam a consumir a mesma posição enriquecida; não há alteração automática dos lançamentos. O relatório inclui esses saldos somente quando o usuário inclui os títulos sem vencimento.

As duas falhas foram reproduzidas com testes que falharam antes da correção. Foram acrescentadas regressões para o registro documental, link do memorial, central de conferência, fila Hoje, previsão e relatório/exportação.

## Reprodução local

### Revisão com os dados reais e login habitual

```powershell
node scripts/finance-real-data-preview.mjs
```

Acessar `http://127.0.0.1:4192` e entrar com o e-mail e a senha habituais da empresa. O frontend e a API executam localmente, reutilizando a autenticação e a leitura do ERP, com as credenciais de servidor já existentes em `.env.local`. Nenhuma chave forte é enviada ao navegador. A leitura acessa a base Supabase da empresa; não é uma cópia fictícia nem um ambiente offline.

Esse processo é de **revisão em consulta**: comandos financeiros, salvamentos, cadastros, conciliação, uploads, fechamento e migrations estão bloqueados. Há uma segunda trava para gravações indiretas na API REST do banco, inclusive atualização automática de índices. Apenas os contadores normais de segurança da autenticação podem ser registrados. Presença da revisão é tratada localmente. O processo não usa conexão SQL direta nem proxy para funções da Vercel e não altera arquivos de configuração ou a implantação publicada.

Verificado nesta preparação: base da empresa encontrada; tela de login carregada; estado público de autenticação respondeu 200 sem solicitar configuração inicial; acesso sem sessão respondeu 401; tentativa de comando respondeu 403. As duas regressões da política de consulta passaram. A autenticação final é feita pelo próprio usuário na tela, sem informar senha no chat.

Integrações Microsoft exigem suas configurações no servidor local; sem elas, a ficha mantém os links originais dos documentos e informa a indisponibilidade do leitor protegido. A porta 4185 continua sendo a demonstração com dados fictícios e não aceita o login real.

### Validação automatizada com dados fictícios

O build direto do Vite evita os hooks de migração do `npm run build` deste repositório:

```powershell
npx vite build --outDir artifacts/financeiro/consolidation-build
npx vite preview --host 127.0.0.1 --port 4191 --strictPort --outDir artifacts/financeiro/consolidation-build
```

Em outro terminal:

```powershell
node scripts/finance-consolidation-verify.mjs http://127.0.0.1:4191
```

O comando executa, em sequência, seis suítes de jornadas e os testes Playwright de DRE/conciliação. Aceita somente servidor HTTP local; cada cenário usa dados fictícios e interceptação das APIs. O relatório é gravado em `artifacts/financeiro/consolidacao-browser.json`, com logs separados. A configuração Playwright aceita `FINANCE_REVIEW_BASE_URL` para usar o build estático sem abrir outro servidor de desenvolvimento. O comportamento anterior na porta 4185 permanece disponível quando a variável não é definida.

Bateria de domínio, componentes e servidor:

```powershell
npx vitest run src/domains/financeiro src/domains/dre src/domains/conciliacao src/features/financeiro src/domains/compras/budget-tracking.test.js src/domains/sync/operational-commands.test.js server/dre-memorial.test.js server/dre-projection.test.js server/operational-command-policy.test.js server/operational-command-authorization.test.js server/operational-command-persistence.test.js --maxWorkers=2 --reporter=json --outputFile=artifacts/financeiro/consolidacao-tests.json
npm run lint
npm run typecheck
```

## Resultado da validação

| Verificação | Resultado confirmado |
|---|---|
| Domínios, componentes e servidor | 659 testes aprovados em 59 arquivos |
| Jornadas integradas | 18 verificações aprovadas |
| Continuidade entre filtros, memorial e documentos | 10 verificações aprovadas |
| Original ao lado da ficha fiscal | 10 verificações aprovadas |
| Prévias e duplicidades | 6 verificações aprovadas |
| Relatórios e exportações | 10 verificações aprovadas |
| Apropriação e previsão por etapa | 8 verificações aprovadas |
| DRE anual, mensal e fechado; conciliação | 14 testes Playwright aprovados, sem falhas, instabilidade ou testes pulados |
| Lint, tipos e build estático | Aprovados; permanece o aviso de chunks grandes |

As jornadas somam **62 verificações**, além de **14 testes de DRE/conciliação**, totalizando 76 verificações de navegador. Os 659 testes de domínio/componentes/servidor são uma contagem separada, sem somar reruns de subconjuntos. As seis regressões novas estão incluídas nesses 659.

Na primeira execução integrada, os seis cenários de DRE ainda esperavam a observação operacional visível antes de abrir Dados completos do lançamento. Os testes foram atualizados para percorrer essa expansão, mantendo as verificações de observação, data, documento, obra, largura e Escape, e acrescentando o arquivo protegido. A execução completa seguinte foi aprovada, sem excluir cenários nem habilitar retries.

Evidências finais:

- `artifacts/financeiro/consolidacao-tests.json` e `consolidacao-tests.log`.
- `artifacts/financeiro/consolidacao-browser.json`: `ok: true`, com as seis suítes e estatísticas Playwright.
- `artifacts/financeiro/consolidacao-dre-conciliacao.log` e logs individuais das jornadas.
- `artifacts/financeiro/consolidacao-build.log`.
- Capturas específicas das jornadas em `artifacts/financeiro/`, além das capturas de memorial do Playwright em `test-results/`.

O servidor estático temporário de validação foi encerrado ao final; os serviços locais que já existiam foram preservados. O build permanece disponível para revisão local.

## Comparação com a Vobi

Revisitada a documentação oficial de [Orçado x Realizado](https://ajuda.vobi.com.br/pt-br/articles/8837723-como-utilizar-o-relatorio-orcado-x-realizado-para-o-sucesso-de-suas-obras) e [Extrato financeiro](https://ajuda.vobi.com.br/pt-br/articles/8632130-extrato-financeiro-na-vobi). A revisão do MARCELL conferiu a relação entre lançamentos e orçamento, a visibilidade de itens sem apropriação, o acesso às origens e a continuidade dos filtros. No extrato, a distinção entre pago e conciliado orientou a conferência de contas, vínculos e saldos parciais.

A tentativa de nova leitura da Vobi pelo navegador de automação não carregou a tela autenticada. As conclusões desta rodada são documentais, complementadas pelas observações anteriores; não representam uma nova varredura autenticada de todas as telas da Vobi.

## Limites da validação

- Testes com dados fictícios e APIs interceptadas; operações de conciliação aplicadas ao handler real em memória. Não houve certificação de integrações bancárias, Microsoft ou banco de dados em produção.
- Saldo inicial da previsão é hipótese informada pelo usuário. Recebimentos previstos não são garantidos, e recebido físico não é entrada de caixa.
- Compras e quantidades recebidas refletem o cadastro atual, sem reconstrução histórica dos recebimentos físicos.
- Apropriação assistida atende notas, despesas da obra e medições de terceiros. Outras origens calculadas continuam exigindo conferência em seus cadastros. Pagamentos multietapas sem identificação do rateio permanecem explícitos em Sem apropriação.
- Previsão revisada exige a mesma data de corte e base conferida; mudanças restauram a referência automática e preservam o histórico. A estimativa automática não substitui avaliação física dos serviços restantes.
- Relatórios consultam a base atual; snapshots imutáveis continuam no DRE mensal/anual. Alertas documentais não substituem conferência fiscal.
- O build mantém o aviso anterior de chunks maiores que 650 kB; esta consolidação não altera a arquitetura de carregamento do aplicativo.
