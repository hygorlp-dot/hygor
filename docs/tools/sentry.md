# Sentry

## Problema

Correlacionar erros de frontend e API sem depender de relatos manuais.

## Alternativas

Logs da hospedagem e erro local mostrado ao operador.

## Versão analisada, licença e compatibilidade

`@sentry/react` 10.68.0, MIT, compatível com React 18. A documentação oficial
exige configuração de PII e tratamento de source maps. A versão foi avaliada,
mas não foi incluída nas dependências do ARCD.

## Bundle e segurança

Runtime adicional. O risco LGPD é alto: não enviar PIN, senha, token, CPF, PIX,
salário, extrato, documentos ou dataset completo.

## POC e testes

Enquanto não há telemetria externa, o `ErrorBoundary` usa diagnóstico local:
referência estável, mensagem limitada e redação de token, senha, PIN, CPF e
e-mail. O conteúdo só pode ser copiado pelo próprio operador; não há envio de
dados, DSN nem tráfego adicional.

Somente após decisão de DPA, retenção, região e responsável; testar `beforeSend`
com sanitização e correlation ID antes de qualquer DSN real.

## Riscos, decisão e rollback

**Adiar a integração externa.** Sem decisão de privacidade. O diagnóstico local
é o fallback aprovado nesta etapa; rollback remove o helper e o botão de cópia.
Uma futura integração deve remover SDK e variáveis de build para reverter.
