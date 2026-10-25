# Simulação completa de Fulano e Siclano

## Resultado

O ensaio local passou em **25/10/2026**, no arquivo `src/integration/simulacao-completa.test.js`.

O teste percorreu o cadastro, o ponto do celular, a conferência do RH, os adiantamentos, a folha, a baixa financeira e o desligamento. A API gravou e recarregou dados em um PostgreSQL em memória, com PGlite. As migrations do ponto, da ARP, da auditoria e do financeiro foram executadas de verdade.

**Esta evidência é local.** Não comprova execução na Vercel, no banco remoto, em um APK instalado ou em um aparelho físico. O relógio do teste avançou até novembro. Isso não significa que outubro foi fechado antecipadamente no ambiente real.

Comando executado:

```sh
npx vitest run src/integration/simulacao-completa.test.js --reporter=verbose
```

Resultado: **1 teste passou**, com 13,19 segundos de execução do cenário. O teste contém as verificações do percurso completo descritas abaixo.

## Pessoas e valores de teste

Os cadastros reaproveitam os IDs da massa anterior. Todos os nomes, documentos, referências contábeis e pagamentos deste ensaio são fictícios.

| Informação | Fulano | Siclano |
|---|---|---|
| ID | `piloto-k110-fulano` | `piloto-k110-siclano` |
| Função | Pedreiro / profissional | Servente / ajudante |
| Admissão | 01/10/2026 | 06/10/2026 |
| Vínculo informado | CLT | CLT |
| Remuneração | Mensal, R$ 3.300,00 | Diária, R$ 120,00 |
| Referência de custo do ponto | R$ 150,00 por dia | R$ 120,00 por dia |
| Dias com presença em outubro | 21 | 18 |
| Dias adicionais capturados em novembro | 3 | 3 |
| Adiantamento pago em 20/10 | R$ 1.320,00 | R$ 600,00 |
| Proventos na memória de outubro | R$ 3.300,00 | R$ 2.705,00 |
| INSS informado na memória fictícia | R$ 284,60 | R$ 213,29 |
| IRRF informado na memória fictícia | R$ 0,00 | R$ 0,00 |
| Saldo de outubro | **R$ 1.695,40** | **R$ 1.891,71** |

Os tributos são valores explícitos de uma memória independente de teste. Não representam validação fiscal. O teste não calcula salário mensal multiplicando a diária por 26.

A memória de Siclano contém R$ 2.160,00 de diárias trabalhadas, R$ 360,00 de descansos, R$ 120,00 de feriado e R$ 65,00 de cesta. O FGTS informado nessa memória é R$ 211,20, sem desconto no líquido. Esses critérios são premissas fictícias identificadas no próprio demonstrativo.

## Percurso verificado

| Etapa | Resultado observado |
|---|---|
| Cadastro | Os placeholders foram preenchidos por `EMPLOYEE_SAVED` na API. Vínculo e remuneração ficaram separados; Siclano permaneceu sem salário mensal inventado. |
| Permissões | Financeiro não conseguiu salvar o cadastro de RH. O encarregado não conseguiu confirmar baixas bancárias. |
| Celular | A lógica real de `terminal.js` criou quatro eventos por jornada. Foram **180 eventos**, com **180 NSRs únicos** atribuídos pela função real da ARP no banco local. |
| Sem internet | A jornada offline ficou na fila e foi enviada quando a conexão de teste voltou. |
| Resposta perdida | O servidor recebeu um lote, a resposta foi perdida e o aparelho reenviou. O número de eventos não aumentou no reenvio. |
| Conferência | O RH salvou as apropriações pela rota real do ponto. A API importou os horários consultando os eventos e as versões no banco, sob bloqueio transacional. |
| Mudança de obra | Dias integrais na Obra B foram apropriados e importados para a Obra B. A obra de captura permaneceu preservada na origem. |
| Fechamento do ponto | Os dias foram fechados pela API antes da preparação dos demonstrativos. |
| Adiantamento | Em 20/10, salvar criou uma obrigação. Antes da baixa, o desconto elegível foi zero. Depois da baixa bancária simulada, o valor pago ficou disponível para compensação. |
| Folha de outubro | Os demonstrativos foram preparados somente depois do fim de outubro. Fulano usou a folha mensal existente; Siclano usou rubricas e memória manual identificada. |
| Conferência da memória | O servidor registrou autor, data, referência e responsável. Fonte alterada, ponto reaberto, rubrica incompleta ou tributo em branco impedem a conclusão. |
| Aprovação | Cada pessoa gerou uma obrigação CLT. O reenvio da aprovação não duplicou títulos. |
| Pagamento parcial | Foram pagos R$ 900,00 de cada saldo. Os títulos ficaram parciais com o restante explícito. |
| Quitação | Foram pagos os saldos de R$ 795,40 e R$ 991,71. Os títulos ficaram pagos, com saldo zero. |
| Reenvio da baixa | A mesma chave de comando retornou a baixa anterior, sem inserir outra liquidação. |
| Caixa | Adiantamentos e saldos somaram **R$ 5.507,11** de saídas. As contas a pagar da folha ficaram zeradas. |
| Custo e DRE | Aprovar e pagar não aumentou novamente o custo do ponto. Os custos de outubro por obra permaneceram iguais antes e depois das baixas. |
| Auditoria | Os eventos de cadastro, importação, aprovação e conciliação foram persistidos com o ator. Uma tentativa de apagar a auditoria foi recusada pelo trigger append-only. |
| Documentos | O HTML dos demonstrativos foi gerado com a identificação da simulação e com a informação de que o demonstrativo não comprova pagamento. |
| Competência seguinte | Novembro iniciou com rascunho próprio, sem copiar a confirmação de outubro. O mês incompleto permaneceu pendente. |
| Desligamento | Siclano foi desligado em 06/11. Uma rescisão fictícia de R$ 350,00 foi registrada com apuração identificada. Essa rescisão **não foi paga** neste ensaio. |
| Catálogo do celular | Em 07/11, após nova sincronização, Siclano já não apareceu no catálogo ativo. Os eventos e NSRs anteriores permaneceram iguais. |
| Histórico | O desligamento de novembro não invalidou a origem do demonstrativo de outubro. |

O pagamento do dia 20 ocorre por adiantamento. O app recusa transformar uma competência mensal ainda em andamento em fechamento final, mesmo se alguém preencher dados futuros.

## Dia em duas obras

A variação de 19/10 foi testada em uma **cópia isolada do banco**. Uma parte da jornada de Siclano foi apropriada à Obra A e outra à Obra B.

A importação retornou pendência de rateio. Os dois intervalos foram preservados. Não foi criada uma segunda presença, não houve ponto canônico para esse dia e nenhum título ou pagamento foi alterado.

O percurso principal usa uma obra por dia. O tratamento completo de rateio do mesmo dia entre várias obras ainda precisa de implementação identificada. Essa pendência não foi escondida para aprovar a competência.

## O que foi real e o que foi controlado no teste

| Parte | Como foi executada |
|---|---|
| Banco | PGlite isolado, com SQL e migrations reais. |
| API de gestão | Handler real de `api/data.js`, incluindo autorização por papel e persistência transacional. |
| Ponto eletrônico | Handler real, sincronização real do app, geração real dos eventos e função SQL real da ARP. |
| Driver | Adaptador mínimo da interface Postgres.js para o PGlite. Consultas, transações, bloqueios e triggers foram executados; não foram substituídos por respostas prontas. |
| Supabase Auth | Dublê de teste devolvendo IDs de usuários fictícios. Não houve login remoto. |
| Relógio/NTP | Fonte controlada de teste. Não houve medição contra o NTP.br. |
| Celular físico e biometria | Armazenamento do aparelho em memória e identificação sintética. O teste não valida câmera, reconhecimento facial, GPS físico, reinício Android nem instalação de APK. |
| Banco financeiro | Extratos sintéticos importados pelos comandos oficiais. Nenhuma transferência real. |
| Apuração fiscal | Memórias fictícias identificadas. Nenhuma transmissão fiscal ou validação contábil de trabalhador real. |

`FINANCIAL_ENGINE_ENFORCE=true` foi usado no ensaio local, com as funções SQL financeiras disponíveis. A folha reaproveita o caminho operacional existente: títulos, liquidações e saldos ficam no JSON transacional auditado e alimentam o ledger/DRE da aplicação. O teste não afirma que a folha ganhou uma segunda projeção em `financial_titles` e `settlements`.

## Regressões descobertas e corrigidas

O ensaio expôs duas falhas na API antes de passar:

1. Um token sem e-mail podia ser associado ao primeiro usuário também sem e-mail. A comparação agora exige e-mail não vazio para esse fallback. O token do Financeiro passou a receber a recusa esperada ao tentar salvar cadastro de RH.
2. Salvar holerite com origem de ponto perdia os registros armazenados nas linhas por obra durante a reconstrução transacional. O salvamento agora recarrega e protege as mesmas fontes necessárias à conferência, na ordem de bloqueio já usada pela folha mista.

Também há regressões específicas para vínculo separado, cadastro legado, primeiro preenchimento sem admissão anterior, memória incompleta, auditoria forjada, origem alterada, reajuste futuro, desligamento futuro, competência seguinte e fechamento mensal antecipado. As guardas tiveram provas de falha antes e passagem após a correção nos testes focais correspondentes.

Verificações adicionais executadas neste checkpoint:

- `npm run lint`: passou.
- `npm run architecture:check`: passou, sem violações, com 992 módulos e 2.631 dependências examinadas.
- Testes focais de RH, folha e componentes: passaram nos checkpoints registrados da implementação.
- Navegador: os dois projetos foram executados; resultado detalhado abaixo, incluindo a falha inicial e sua repetição.

## Verificação das telas no navegador

Foram executados os projetos `clt-desktop` e `clt-mobile`, em Chromium gratuito, com um único worker. As larguras principais foram 1.440 × 1.000 e 390 × 844. O teste do botão Salvar no cadastro legado também usou alturas menores.

```sh
PLAYWRIGHT_BROWSERS_PATH=/workspace/scratch/148e5b60e3bc/playwright-browsers npx playwright test --project=clt-desktop --project=clt-mobile --workers=1
```

**Primeira execução: 29 testes passaram e 1 falhou, em 4,6 minutos.** Todos os 15 casos de computador passaram. Em celular, houve uma falha de navegação no caso já existente de cadastro incompleto: o cabeçalho interceptou o clique em “Definir diária ou CLT pelo ponto” e a tela voltou ao Dashboard. O caso não chegou à edição do cadastro.

O mesmo caso foi repetido isoladamente, sem mudança no código:

```sh
PLAYWRIGHT_BROWSERS_PATH=/workspace/scratch/148e5b60e3bc/playwright-browsers npx playwright test --project=clt-mobile --workers=1 --grep 'pelo ponto: cadastro incompleto' --output=/workspace/scratch/148e5b60e3bc/clt-mobile-retry
```

**Repetição: 1 teste passou**, com 8,9 segundos no cenário e 12,1 segundos de execução total. A falha inicial não foi reproduzida nessa repetição; não há diagnóstico conclusivo de sua causa. O trace, o vídeo e a captura da primeira falha foram preservados em `test-results/clt-payslips-pelo-ponto-ca-ce088-bre-a-edição-do-funcionário-clt-mobile/`.

Os cenários cobrem folha mensal, cadastro e vigências, provisões, simulação de custo, importação do ponto, campos protegidos, preparação em lote, prontuário, quinzena, persistência, recibos e PDF. Há verificações de largura da página e da visibilidade do botão Salvar no cadastro legado.

O cenário novo de **CLT por diária passou no computador e no celular**, respectivamente em 17,5 e 12,4 segundos. Ele verifica que:

- O RH define o vínculo CLT com vigência e motivo, mantendo remuneração diária e salário mensal zero.
- INSS e FGTS começam em branco; a ausência de apuração não é tratada como tributo zero.
- Os 21 dias do ponto fechado são importados e ficam protegidos contra edição direta.
- Uma memória incompleta pode ser salva como rascunho, com `calculated: null`, sem liberar o PDF.
- A memória só é concluída depois de informar rubricas, referências, incidências, responsável, tributos e conferência.
- O servidor registra a auditoria da memória, e o PDF traz a referência de teste e a informação de que não comprova pagamento.
- Salvar e exportar o demonstrativo não cria título nem baixa financeira.

Essa suíte visual usa uma massa própria de setembro, com API interceptada pelo teste e aplicação real dos comandos de domínio. O caso por diária contém proventos fictícios de R$ 3.000,00, INSS informado de R$ 250,00 e líquido de R$ 2.750,00. Esses valores não substituem a simulação principal de outubro. **A prova de API e SQL reais é o ensaio de integração descrito antes; a prova visual não usa banco remoto nem aparelho Android.**

Capturas e PDFs de referência estão em:

- `test-results/clt-payslips-CLT-por-diári-e7204-cada-origem-conferida-e-PDF-clt-desktop/holerite-clt-diaria.png` e `holerite-clt-diaria.pdf`.
- `test-results/clt-payslips-CLT-por-diári-e7204-cada-origem-conferida-e-PDF-clt-mobile/holerite-clt-diaria.png` e `holerite-clt-diaria.pdf`.

O CDN do Playwright não forneceu o ZIP neste ambiente. O Chromium 151.0.7922.34 foi obtido da distribuição oficial Chrome for Testing do Google, na mesma versão esperada pelo Playwright, com o MD5 do arquivo conferido. O FFmpeg 1011 veio do fallback oficial da Microsoft. Não houve instalação de pacote pago nem mudança nas dependências do projeto.

## Referências do repositório

- Cenário completo: `src/integration/simulacao-completa.test.js`.
- Massa reutilizável: `scripts/simulacao/fulano-siclano.mjs`.
- Memória CLT por diária: `src/domains/ponto/manual-daily-clt.test.js`.
- Vínculo separado e cadastro legado: `src/domains/rh/employment-relationship.test.js`.
- Origem e histórico do ponto: `src/domains/ponto/clt-attendance.test.js`.
- Formulário mensal e por diária: `src/domains/ponto/components/CltPayslips.manual-daily.test.jsx`.
- Percursos de navegador: `e2e/clt-payslips.spec.js`.

As verificações finais da branch e a publicação remota são etapas separadas. Este documento não substitui o teste em um Android físico nem autoriza fechar períodos futuros em produção.
