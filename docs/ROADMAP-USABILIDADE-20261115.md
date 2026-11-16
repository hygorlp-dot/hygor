# Roadmap de usabilidade — iniciado em 15/11/2026

Fonte: [reauditoria da versão publicada](C:/dev/repositorio-mrc/docs/REAUDITORIA-OPERADOR-PUBLICADO-20261115.md). A nota de 7,1 é histórica da versão auditada; não foi substituída por uma nota presumida após alterações locais.

## Etapa 1 — Contraste e orientação dos bloqueios

**Implementada, validada e publicada.** Deploy `dpl_Dkh3utSTR1P71kU59BZskqgdvtvf`, versão `e297fbe5c62c532af71ffa53eadf15af8aa0a29e`, em https://erp.marcelleng.com.br/. Publicação autorizada posteriormente pelo usuário com “deploy”. Conferência e limites em [registro da publicação](C:/dev/repositorio-mrc/docs/DEPLOY-ROADMAP-USABILIDADE-20261115.md).

- **U01:** removida a regra antiga de hover de `.arcd-btn`, que usava `--btn-hover` e `--btn-hover-border` sem definição. Ela sobrescrevia o contrato compartilhado com `!important`, deixando o fundo transparente e o texto branco. O defeito foi reproduzido tanto no DEV quanto no build; no celular, o hover pode continuar ativo após o toque. Os botões passam a consumir os estados já existentes do componente compartilhado, sem nova paleta ou estilo específico de Leads.
- **Acessibilidade encontrada na validação:** o cabeçalho de Comercial era declarado como componente dentro da função de renderização. Ele era remontado ao abrir o editor, desconectando o botão que deveria recuperar o foco. A declaração foi movida para o escopo do módulo; cancelar o cadastro volta o foco a Novo lead.
- **U02:** os bloqueios do fechamento agora apresentam motivo em português, diferença monetária quando aplicável, responsável pela conferência, orientação e consulta da origem quando o identificador está disponível. O código permanece em Diagnóstico para suporte, usando o disclosure compartilhado com foco e alvo de toque.
- A consulta da origem reutiliza o registro documental existente por tipo, identificador e obra compatível. Pode alcançar um documento de outra competência. Não associa registros por nome ou valor e informa quando não há origem individual disponível.
- O memorial mostra o valor original do documento, separado da diferença do bloqueio. Avisos agregados explicam que podem resumir os mesmos problemas; o operador é orientado a não somá-los ou compensá-los com outro custo/pagamento.
- Ajuda de Financeiro · Fechamento revisada e manual regenerado. A data de revisão permanece 15/11/2026, a mesma desta entrega. O cadastro de lead conserva seus passos; sua ajuda não requer novo procedimento.

### Origem das informações e efeito no DRE

`validateFinancialReconciliation` continua sendo a fonte dos bloqueios; nenhuma validação ou equação foi removida. A apresentação usa `documentRegister` e seus vínculos existentes para consultar a origem. Diferenças de diagnóstico não se tornam eventos do razão.

Esta etapa não cria previsão, compromisso, estoque, custo reconhecido, liquidação ou recebimento. Não modifica saldos, valores, permissões ou documentos. O fechamento permanece bloqueado quando o motor informa inconsistências. As diferenças reais apontadas na auditoria ainda precisam de investigação na origem; melhorar a orientação não as corrige automaticamente.

### Validação realizada

| Verificação | Resultado |
|---|---|
| Unitários de bloqueios, componente, contrato compartilhado de botões e razão financeiro | **41 testes aprovados**, em quatro arquivos |
| Navegador DEV | **10 cenários aprovados**, sessões novas, 390 e 1440 px |
| Navegador build final | **10 cenários aprovados**, sessões novas, 390 e 1440 px |
| Contraste de Novo lead | Quatro temas: MARCELL Preciso, Operacional, Claro e Vidro; hover após transição, razão calculada ≥ 4,5:1 |
| Interação | Abrir lead com teclado, cancelar e recuperar foco; consultar origem do bloqueio, fechar memorial e preservar competência/foco |
| Segurança da validação | Dados fictícios e APIs interceptadas localmente; nenhuma gravação de negócio nos cenários |
| Revisão visual | Screenshots do build no celular e desktop; cabeçalho, ação principal, alertas, diagnóstico e ausência de overflow da página |
| Qualidade | Lint, design:check, manual:check e typecheck aprovados; sem ampliar a baseline |
| Build | `npx vite build --outDir artifacts/roadmap-usabilidade-etapa1/dist` aprovado; prebuild/migrações não executados |
| Bundle final | **1.819.470 bytes gzip**, abaixo do teto vigente de **1.891.328 bytes**, sem violações individuais ou aumento de limites |

Na implementação local, houve um primeiro build necessário para reproduzir o defeito com a apresentação empacotada e um build final após a correção. Após a autorização posterior de publicação, houve um único build de produção concluído na Vercel, sem migrações. A tentativa automática gerada pelo push foi cancelada no Ignored Build Step, antes da compilação do app.

Os testes encontraram a perda de foco antes da correção; os dez cenários passaram depois dela. A primeira captura DEV de Leads após fechar o modal foi descartada por registrar a animação antes da pintura final. As capturas do build foram feitas com animações desativadas e inspecionadas.

Arquivos de implementação:

- `src/LegacyApp.jsx`: remoção da sobrescrita antiga de hover.
- `src/domains/comercial/components/ComercialView.jsx`: estabilidade do cabeçalho e retorno de foco.
- `src/features/financeiro/closing-blockers.js`: apresentação dos bloqueios e resolução exata de origem.
- `src/features/financeiro/ClosingPending.jsx`: alertas e consulta usando componentes compartilhados.
- `src/features/help/help-content.js` e `docs/MANUAL_DO_APP.md`: orientação ao operador.
- `src/features/financeiro/closing-blockers.test.js`, `ClosingPending.test.jsx` e `e2e/roadmap-usability.spec.js`: regressões.

Os demais arquivos modificados previamente no checkout foram preservados. O manual já continha alterações anteriores; foi regenerado da fonte vigente, sem restaurar uma versão antiga. Métricas e builds desta etapa foram escritos em artifacts, sem sobrescrever `dist` ou `bundle-metrics.json` existentes.

Evidências e configuração de teste: `artifacts/roadmap-usabilidade-etapa1/`. Para repetir os cenários com a prévia DEV isolada aberta na porta 4390, executar `npx playwright test --config artifacts/roadmap-usabilidade-etapa1/playwright.config.mjs`. Para testar o build final servido na porta 4391, definir `ROADMAP_URL=http://127.0.0.1:4391` e `ROADMAP_MODE=build` antes do mesmo comando. A prévia do build fica em `artifacts/roadmap-usabilidade-etapa1/preview.mjs`; todas as APIs terminam localmente, com dados fictícios e gravações de negócio bloqueadas.

![Novo lead após correção, no celular](C:/dev/repositorio-mrc/artifacts/roadmap-usabilidade-etapa1/leads-build-marcell-390.png)

![Bloqueio financeiro explicado, com diagnóstico aberto pelo teste](C:/dev/repositorio-mrc/artifacts/roadmap-usabilidade-etapa1/fechamento-build-390.png)

## Etapa 2 — Consistência de contexto e leitura financeira

**Implementada e validada localmente em 16/11/2026. Sem publicação.** U03 e U04. Relatório: [Contexto da obra e indicadores financeiros](USABILIDADE-ETAPA2-CONTEXTO-FINANCEIRO-20261116.md).

O Caixa acompanha a obra em foco e não substitui obras sem caixa ativado. O painel explicita competência, movimento de caixa e escopo consolidado; seus atalhos financeiros levam o mês selecionado ao DRE. Filas de carteira e ranking identificam seu recorte, e cobranças mostram o saldo restante. Validação: 67 testes unitários, 10 cenários DEV e 20 no build, em 390 e 1440 px; ajuda/manual sincronizados, sem aumento dos limites de bundle ou da baseline visual. As divergências contábeis históricas continuam na etapa 5.

1. Rastrear cada indicador até a origem; explicitar faturado/reconhecido, recebido, pago e saldo de caixa.
2. Conferir as diferenças de contagem e recorte entre painéis, filas e DRE; não alterar cálculos para fazer rótulos coincidirem.
3. Revisar a propagação da obra entre cabeçalho e seletores internos. Escopo de carteira inteira precisa ser explícito; operações precisam repetir a obra antes da confirmação.

Aceite: mesma obra/competência na passagem entre telas, ou exceção claramente identificada; valores explicados por memorial e comparação de bases equivalentes. Revisar ajuda e manual, com evidências no celular e desktop.

## Etapa 3 — Continuidade comercial e tarefas entre setores

**Pendente.** U05 e U08.

1. Tratar a aba Contratos vazia com orientação específica e acesso à central, usando vínculos explícitos.
2. Conferir aprovação SC-0005 versus Minhas aprovações e as definições dos contadores comerciais.
3. Aproximar aviso, registro de origem, responsável, prazo e próxima ação. Conversa não substitui aprovação formal.

Aceite: o operador consegue identificar a próxima ação e chegar ao registro correto sem pesquisar novamente ou associar registros por semelhança.

## Etapa 4 — Operação no celular

**Pendente.** U06 e U09.

1. Priorizar pendências e busca nas listas longas; reduzir filtros que precedem a tarefa.
2. Rever Pipeline e oferecer alternativa ao arraste sem depender do mouse.
3. Simplificar a precisão visual dos percentuais, preservando a precisão financeira persistida.
4. Substituir instruções técnicas de RH por orientação operacional existente.

Aceite: tarefas representativas com toque, teclado, nomes longos, vazio/erro e ampliação de texto. Não basta reduzir a altura da página ou passar a checagem automática.

## Etapa 5 — Integridade e transações

**Pendente.** U07 e divergências da auditoria.

1. Conferir unidades e conversões na origem dos pedidos; não inferir fator de conversão por nome.
2. Investigar recebimentos excedentes, vínculos de estoque, divergências de homologação e filas antigas.
3. Em base de teste autorizada, executar as jornadas completas: comercial → contrato → obra; compra → entrega → fiscal → pagamento → conciliação; ponto → folha → DRE; terceirizado → aprovação → pagamento.
4. Comprovar permissões de perfis restritos, histórico, idempotência e unicidade do custo reconhecido. Pagamento não pode criar outro custo pelo mesmo fato.

Aceite: reconciliação por origem antes/depois, negativos de permissão no servidor e ausência de duplicação de custo. Nenhuma correção automática em produção faz parte da autorização atual.

## Etapa 6 — Recuperação e nova avaliação

**Pendente.** U10 e limites da primeira auditoria.

Testar troca de publicação com sessão antiga e rascunho, rede lenta/offline, documentos legados/OneDrive, aparelho físico e rodada desktop mais ampla. Repetir as tarefas e os critérios da auditoria, registrando as notas obtidas. A meta 9,5 só será declarada se a evidência a sustentar.
