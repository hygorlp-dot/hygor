# Entrada e saída com integração automática — 05/11/2026

Implementação local na branch `codex/ponto-duas-batidas-local`, base `2b2b4332f0329ebcc1a20adba96d78b90fa3cc5e`. Preparação inicialmente local; usuário autorizou publicar em 05/11/2026. APK preservado. Sem migração nem operação de teste sobre dados reais.

Regra confirmada pelo usuário: somente entrada e saída; almoço previsto das 12h às 13h; saída prevista às 17h de segunda a quinta e às 16h na sexta. A escala histórica cadastrada continua obrigatória. A saída real não é substituída pela prevista.

O servidor tenta integrar após receber marcações nos dois formatos existentes. Reconsulta fatos persistidos da empresa e grava na transação existente de ponto, com auditoria e proteção da grade. Dois registros sem tipo passam a representar entrada/saída, se completos, confiáveis e sem duplicidade. Quatro registros existentes continuam usando o intervalo real. Nada cria batidas de almoço.

O desconto é a sobreposição do período trabalhado com o intervalo previsto. 07:21–16:55 = 514 minutos; sexta 07:00–16:00 = 480. Jornada encerrada antes do almoço não recebe desconto. A origem e os minutos do intervalo ficam em `pontoReview.scheduledBreak`; cálculos consumidores reconhecem essa origem.

Exceções: vínculo/escala ausentes, data futura, identificação ou relógio não confiável, batidas incompletas/duplicadas, várias obras, ponto/folha/DRE fechados e quinzena arquivada. Dias já integrados ou revisados não são sobrescritos automaticamente quando fonte ou escala mudam: exigem RH. Lançamentos manuais ainda sem conferência podem ser substituídos pelos fatos biométricos, com o anterior na auditoria. Pagamentos não são alterados.

A confirmação de recebimento da batida não depende do sucesso da integração. Falha retorna `integracao.pending`; nova entrega tenta novamente. Não foi criada fila durável. Para dias anteriores, falhas sem reentrega ou lotes excepcionais, RH usa **Sincronizar batidas do app**; no máximo 32 datas por recebimento e 500 dias por transação. A tela de conferência de duas batidas mostra somente entrada/saída e explica o desconto. Exceções continuam exigindo justificativa.

Ajuda e manual atualizados. Validação registrada após execução local; não comprova publicação nem validação de novo APK.

## Evidências locais

- Suíte de regressão: 76 testes em 7 arquivos aprovados (sincronização, conferência, transação PGlite, recebimento legado, duplicidade, horas e custo do ponto).
- Verificação adicional após ajustes: 47 testes em 3 arquivos aprovados, incluindo recebimento formato 2 com falha da integração; inclui reexecuções de testes anteriores.
- Playwright: 6 cenários aprovados, em desktop e celular (dia comum, sexta e duplicidade com tratamento RH). Capturas inspecionadas em `test-results`; sem estouro horizontal no diálogo.
- Lint, design:check, manual:check, typecheck, git diff --check e build Vite local aprovados. Detector Impeccable sem achados no componente.
- A imagem capturada durante a animação foi substituída por captura após seu término; nenhuma alteração na animação do produto.

O auxiliar `.impeccable/design.json` está desatualizado em relação a DESIGN.md, achado preexistente do carregador; não foi regenerado nem alterado o padrão visual.

## Candidato autorizado para publicação

Validação final em 05/11/2026: 85 testes em 8 arquivos e 6 cenários de navegador aprovados; lint, typecheck, manual, arquitetura e ciclos aprovados. Build e limite de bundle aprovados sem aumentar o teto. Cálculo do intervalo consolidado em `src/domains/ponto/timekeeping.js`, com reutilização das regras de entrada/saída. A confirmação do deploy será registrada separadamente após verificação do estado e do alias.
