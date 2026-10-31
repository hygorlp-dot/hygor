# Auditoria profunda local — 31/10/2026

## Resultado

Auditoria do estado local do ERP e da lógica compartilhada com o Ponto de Obra,
com investigação da causa, reprodução antes das correções e revalidação.
Nenhum push, deployment, migração ou gravação em serviço de produção foi feito.
Alterações preexistentes foram preservadas; o estado inicial está registrado em
`artifacts/deep-audit/baseline.patch` e `baseline-status.txt`.

**Resultado consolidado:** 4.146 testes unitários/de integração aprovados,
zero falhas, 15 pulados; 158 cenários distintos de navegador aprovados e um
caso pulado por não se aplicar ao desktop. O consolidado de navegador usa o
último resultado de cada cenário/perfil de execução: não soma retentativas como
se fossem novos testes. Evidência: `artifacts/deep-audit/summary.json`.

## Correções desta rodada

| ID | Prioridade | Causa reproduzida | Correção e verificação |
| --- | --- | --- | --- |
| SEC-01 | Alta | A projeção de funcionários removia os campos antigos de remuneração, mas deixava salário mensal, contrato MEI, holerites, histórico remuneratório e instruções de pagamento nos dados de Engenharia/Financeiro. | Remove os campos atuais fora de RH/admin. Mantém o cadastro completo para os perfis autorizados e os títulos financeiros necessários para pagamento. Testes de projeção e permissões passaram. |
| SEC-02 | Alta | Visualizador conseguia chamar diretamente upload/criação de pastas no OneDrive; o upload operacional também não exigia perfil de escrita. | Valida o perfil no servidor antes de operações Microsoft. Mantém os perfis operacionais, o escopo por obra e o chat corporativo. Testes verificam ausência de chamadas de escrita quando negado. |
| DOC-01 | Alta | Nome/ID de obra inválido caía em outra obra do mesmo drive; um drive compartilhado identificava arbitrariamente a primeira obra. | ID explícito é respeitado; nome inválido ou drive ambíguo falha fechado. Testes de resolução e do handler confirmam 403 sem gravar na obra errada. |
| SYNC-01 | Alta | `saveDataDetailed` aceitava HTTP 200 com `{}` ou `{ok:false}` como salvamento bem-sucedido. | Exige confirmação explícita de sucesso. Não avança a versão do servidor quando a gravação não foi confirmada. |
| INT-01 | Média | Erros ao ler JSON eram convertidos em objeto vazio; rotas autenticadas e OneDrive podiam reportar sucesso com corpo ilegível ou formato inválido. | Resposta inválida retorna falha controlada. Não repete gravações automaticamente; a mensagem orienta confirmar o resultado antes de reenviar. |
| DOC-02 | Média | Upload HTTP 200 sem URL/identificação do arquivo podia virar evidência anexada sem arquivo utilizável. | Upload simples, arquivo pequeno e conclusão do upload em partes validam a identificação recebida. Galeria/câmera e falha parcial continuaram passando no navegador. |
| MOB-01 | Média | A regra geral do tema `touch-action: manipulation` vencia a regra do puxador do Kanban e interrompia o arraste por toque. | Ajuste de especificidade preserva `touch-action: none` apenas no puxador. Teste sintetiza o gesto de toque e verifica a mudança de coluna. |
| UX-01 | Média | Engenharia via Editar/Cadastrar/Desligar/Arquivar e adiantamentos na Equipe, embora o servidor reserve essas mutações a RH/admin. Valores ocultos também apareciam como diária zero. | Interface acompanha a autorização existente; a consulta continua disponível e informa a restrição dos dados trabalhistas. Testes de navegador cobrem Engenharia, RH e admin em desktop e celular. |

As correções anteriores de CSS carregado sob demanda, resposta incompleta da
Equipe nas Obras, preservação de fotos após upload parcial e bloqueio de
fechamento durante upload também foram exercitadas. Não foram contadas como
novos achados desta rodada.

## Fluxos e fronteiras examinados

| Área | Evidência local |
| --- | --- |
| Acesso e permissões | Login por e-mail/PIN, respostas inválidas, renovação de sessão, rate limiting, usuário inativo, projeção por obra, proteção de dados de funcionários, matriz de autorização por comando e navegação por perfil. |
| Obras/orçamento/planejamento | Aprovação e adoção de baseline, versão imutável, exportação de orçamento em PDF, cronograma A2, curva ABC, referências e quantitativos. |
| Compras/estoque | Solicitação → cotação → pedido, retorno de fornecedor e revisão por Compras, recebimento parcial, estoque e saldo, condições comerciais, compra direta pelo cliente, apropriação e orçamento, exportação Excel e preservação de formulário após falha. |
| Medição | Acesso sem Planejamento, escolha de contrato, slider e entrada decimal, galeria múltipla, câmera separada, upload com falha parcial, envio de comando e regras de aprovação/pagamento. |
| Financeiro/DRE | Competência versus caixa, obrigações versus baixa, retenções, notas vinculadas e prevenção de duplicidade, leitura de fechamento, memorial, documentos e exportações. |
| Conciliação | PIX, categorização de entrada/saída, competência distinta da data, vínculo com folha paga, composição parcial, falha/retentativa e desfazer sem alterar pagamentos indevidamente. |
| RH/folha | Diária/CLT/MEI, vigência, adiantamentos, holerite, provisões e simulação sem lançamento, prontuário privado, fechamento/reabertura da quinzena e projeção agregada para Financeiro. |
| Projetos | Cronômetro, duas abas concorrentes, chave idempotente após falha, acesso por obra, ordenação e arraste por toque. |
| Comercial/administração | Renderização/navegação, acesso comercial personalizado, CRM e comandos/políticas de domínio nas suítes existentes. Não representa cobertura de toda combinação possível de operação comercial. |
| Integrações e persistência | Handlers de API, Supabase simulado, SQL real local com PGlite, armazenamento SQLite de testes, OneDrive/Graph por contrato simulado, IA com respostas simuladas, documentos/PDF e planilhas reais gerados localmente. |

A suíte final contém 541 arquivos: 538 passaram e três suítes de PostgreSQL
ficaram puladas. Entre os testes aprovados estão 195 do app Ponto de Obra,
173 em `src/integration`, 1.095 em `server` e 2.299 em `src/domains`.

## Comandos e evidências finais

- `npx vitest run --maxWorkers=4 --reporter=default --reporter=json --outputFile=artifacts/deep-audit/vitest-verified.json`: **4.146 passaram, zero falhas**.
- Playwright com `playwright.deep-audit.config.js`: execução ampla, seguida de revalidação dirigida dos casos corrigidos. **158 cenários distintos passaram**, um pulado por ser de paisagem mobile e estar no projeto desktop. Os relatórios utilizados constam em `summary.json`.
- `node scripts/verify-measurement-mobile.mjs`: **passou em 320, 390 e 1280 px**, incluindo gestos e falhas de envio.
- `npm run lint`: passou (`lint-verified.log`).
- `npm run typecheck`: passou (`typecheck-verified.log`). Essa configuração cobre somente os dois módulos TypeScript listados em `tsconfig.quality.json`, não toda a base JavaScript.
- `npm run architecture:check`: passou, **1.285 módulos / 3.584 dependências**, sem violações (`architecture-verified.log`).
- `npx vite build --outDir artifacts/deep-audit/build --logLevel error`: passou (`build-verified.log`). Executado diretamente para não acionar `prebuild` com migrações externas.
- Teste CSS também confirmado isoladamente com `node --test scripts/local-css-source.test.mjs` (`css-node-verified.log`).

Foram corrigidas expectativas antigas de testes para a navegação responsiva,
menus recolhidos e tokens da identidade atual. As verificações de persistência,
permissão, valores e ausência de alterações financeiras foram preservadas.
O teste CSS novo usava apenas `node:test`; agora também é coletado por Vitest,
sem perder a execução isolada no Node.

## Limites e pendências explícitas

1. **PostgreSQL com múltiplas sessões:** 15 casos dependem de `PONTO_PG_URL`.
   Não há servidor descartável configurado neste ambiente. São dois testes de
   fechamento, um de jsonb, sete de orçamento em linha própria e cinco da ARP.
   Os testes SQL locais com PGlite passaram, mas não substituem essa prova de
   concorrência em PostgreSQL real.
2. **Serviços externos reais:** não houve envio de arquivo à conta real do
   OneDrive, autenticação real no provedor, chamadas de IA com cobrança nem
   gravações no Supabase de produção. Os contratos e handlers foram testados
   localmente; disponibilidade e credenciais externas não estão homologadas.
3. **Android físico:** não havia ADB nem dependências do projeto Expo instaladas.
   Não foi gerado APK, bundle Android ou prebuild. O scorecard estático em
   `artifacts/deep-audit/native-quality/` registra esses passos como não
   verificados; sua saída não aprova uma release nativa. O aviso de regressão
   de atividade exportada decorre de falta de evidência de prebuild nesta
   rodada, não de uma alteração confirmada no Manifest.
4. **Biometria/câmera/gestos em campo:** os testes de lógica, persistência e
   sincronização do app passaram, mas não medem precisão facial com pessoas
   reais nem substituem teste de câmera e galeria em aparelho físico. O mobile
   web foi emulado no Chromium; Safari/iOS e hardware Android não foram usados.
5. **Rascunho de medição:** os modelos locais de rascunho, resumo e painel
   financeiro presentes no workspace têm testes, mas a integração dessa etapa
   à tela não está concluída. Esta auditoria não apresenta esses testes de
   modelo como comprovação de autosalvamento no fluxo real.

O resultado é uma auditoria local ampla com investigação dos problemas
reproduzidos, não uma garantia de ausência de qualquer bug ou homologação de
produção. As correções permanecem exclusivamente no workspace.
