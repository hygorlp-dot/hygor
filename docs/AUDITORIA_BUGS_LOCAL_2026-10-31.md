# Auditoria local de bugs — 31/10/2026

Método: Systematic Debugging (`obra/superpowers`), investigação da causa,
reprodução antes da correção e verificação após a alteração. Skill instalada
em `C:/Users/hygor/.codex/skills/systematic-debugging`.

## Falhas reproduzidas e corrigidas

| Falha | Causa | Resultado após correção |
| --- | --- | --- |
| Equipe nas Obras derrubava a aplicação com resposta HTTP 200 incompleta | O hook publicava qualquer resposta com `ok`, e a tela acessava arrays inexistentes | A resposta é validada; mostra erro recuperável, preserva o último snapshot válido e permite tentar novamente. HTTP 401/403 continua removendo o snapshot. |
| Fotos já enviadas sumiam do formulário se a próxima foto falhasse | O lote inteiro só era anexado depois do último upload | Cada foto confirmada é anexada imediatamente; uma falha posterior preserva as anteriores e permite repetir a foto restante. |
| Modal da medição fechava durante upload/confirmação | Fechar, Escape e Cancelar não verificavam a operação pendente | O fechamento aguarda a operação; Cancelar fica indisponível durante o envio. |

A correção anterior de recuperação de CSS também foi exercitada no navegador:
um arquivo CSS de tela carregada sob demanda foi bloqueado uma vez. A página
recarregou, restaurou a sessão e abriu a tela. O teste unitário confirma que a
mesma falha não provoca recargas repetidas e que armazenamento indisponível
mantém a saída manual.

## Evidências

- `npm run lint`: passou.
- `npx vite build --outDir artifacts/bug-audit/build --logLevel error`: passou.
  Executado diretamente para não acionar scripts `prebuild` de migração.
- Vitest direcionado: **91 testes em 17 arquivos passaram**. Abrange recuperação
  de erros, autenticação, equipe nas obras, regras de medição e pagamento de
  terceiros, retenções e os modelos locais de rascunho/resumo.
- `node scripts/bug-audit-browser.mjs`: **98 aberturas** (49 telas a 1440 px e
  49 a 390 px), sem erros de JavaScript/console, respostas HTTP >=400 ou falhas
  de assets nos fluxos normais. Nenhum transbordamento horizontal foi registrado.
  Inclui injeção de resposta incompleta da equipe e de falha de CSS.
- `node scripts/verify-measurement-mobile.mjs`: passou em **320, 390 e 1280 px**,
  incluindo slider, precisão decimal, gestos de toque sintetizados, galeria
  múltipla, câmera, escolha de contrato, upload parcial e bloqueio de fechamento.
- As reproduções de resposta incompleta, perda da primeira foto e fechamento
  durante upload falharam antes das respectivas correções e passaram depois.

Relatório estruturado: `artifacts/bug-audit/report.json`.
Capturas: `artifacts/bug-audit/app-390.png`, `artifacts/measurement-mobile/`.

## Limites e observações

As APIs foram interceptadas com dados sintéticos e tráfego externo bloqueado.
São testes de renderização, navegação e recuperação no navegador local, não
uma homologação de todas as regras e integrações com o banco/OneDrive reais.
O celular foi emulado no Chromium; não foi usado aparelho físico.

A suíte antiga `erp-navigation.spec.js` foi interrompida após um timeout de
inicialização e uma expectativa desatualizada (`.financial-summary` na entrada
do Financeiro, que atualmente abre Hoje). Esses resultados não foram tratados
como confirmação de defeito de produção nem como aprovação da suíte completa.
A auditoria dedicada usa a navegação do build atual e coleta erros de runtime.

O build inicial avisou sobre chunks maiores que 650 kB. Não impediu a compilação
e não foi tratado como falha funcional corrigida nesta rodada.

Nenhum push, deployment, migração ou gravação em serviço de produção foi feito.
Alterações preexistentes dos demais módulos foram preservadas.
