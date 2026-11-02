# Nove testes legados — diagnóstico e correções

Revisão em 02/11/2026. Implementação local no checkout `C:/dev/releases/marcell-precise-local-20261101`, a partir de df8a8351. Sem push, deploy, migração ou ensaio em produção.

## Resultado

Nove falhas reproduzidas em quatro arquivos: oito expectativas desatualizadas e um problema real. Os 28 testes desses arquivos passam. Nenhum teste foi ignorado, removido ou convertido em verificação sem conteúdo.

| Arquivo | Falhas | Diagnóstico e tratamento |
| --- | --- | --- |
| LegacyApp.dre-wiring.test.js | 1 | O pagamento migrou para PaymentDialog. A verificação acompanha o componente canônico, o comando e a autoria, conferindo que Compras e Financeiro entregam o usuário autenticado e o dispatcher. Demais verificações de auditoria preservadas. |
| LegacyApp.modal-focus.test.jsx | 3 | Duas consultas antigas buscavam no container React elementos agora renderizados em portais no body. Corrigidas as consultas, o terceiro caso revelou perda real de foco no fechamento simultâneo do editor e da confirmação. Corrigido no lifecycle compartilhado. |
| LegacyApp.purchase-workflow-fixes.test.js | 2 | O recebimento usa trava síncrona por ref, mais forte que aguardar o próximo render. O pagamento foi unificado; adiantamento é classificado pelo servidor, sem exigir flag do formulário. As verificações acompanham os contratos atuais. |
| LegacyApp.third-party-measurement-link.test.jsx | 3 | Os diálogos de seleção, orientação e boletim usam portais. Consultas atualizadas preservando escolha do contrato da obra, explicação sem contratos e abertura do boletim. |

## Falha real e prevenção

Após corrigir somente as consultas dos testes de foco e medição, nove testes passaram e o retorno à miniatura continuou falhando. Isso isolou o problema do aplicativo antes da correção. Ao fechar duas camadas juntas, o acionador imediato da confirmação já havia sido removido. O código recorria ao painel inteiro.

O lifecycle compartilhado agora conserva a cadeia de abertura e procura o acionador conectado pertencente à camada ainda aberta. Aplica-se ao Modal, Dialog e Drawer existentes, sem estilos locais. Bloqueio de rolagem, Escape apenas na camada superior e foco inicial continuam verificados. A navegação do teclado volta à miniatura quando ela continua disponível.

Também foram acrescentados testes executáveis de recebimento: dois cliques no mesmo ciclo disparam somente uma confirmação, o botão permanece bloqueado durante o envio e uma recusa ou falha libera uma nova tentativa. A classificação de adiantamento foi conferida no comando de domínio com motivo e sem flag adiantamento, como faz o formulário compartilhado. O servidor continua sendo responsável pela classificação.

## Validação

- Reprodução inicial: 9 falhas e 19 testes passando nos quatro arquivos.
- Após as correções: 28/28 testes legados passam, incluídos na execução ampliada.
- Execução ampliada de legado, sistema de design, Financeiro, Compras, recuperação e Ajuda: 856 testes passando em 148 arquivos.
- Navegador automatizado: 54 jornadas passando em desktop 1440 × 1000 e celular 390 × 844. Cobertura inclui fotos e descarte, retorno de foco dentro da pendência, fichas, filas de Compras/Financeiro, Conciliação e RH.
- Capturas do editor nos dois tamanhos inspecionadas: controles e ações preservados. A imagem cinza é a evidência fictícia da fixture, não uma falha de carregamento.
- Lint, tipos, arquitetura, manual e build direto do Vite aprovados. Sem aumentar a baseline de exceções de design.
- JS/CSS: 1.789.071 bytes gzip, dentro do teto de 1.789.952. O build ainda emite o aviso existente de chunks grandes.
- Ajuda contextual de Conferência atualizada para explicar o retorno do foco; manual regenerado, com 105 guias para 65 abas. As adequações técnicas dos testes não introduzem novas ações ao operador.

Evidências locais em artifacts/: legacy-nine-before.log, legacy-portals-repro.log, legacy-nine-after.log, legacy-nine-expanded.log, legacy-nine-final-unit.log, legacy-nine-browser.log, legacy-nine-lint.log, legacy-nine-typecheck.log, legacy-nine-architecture.log, legacy-nine-build.log e legacy-nine-bundle.json. Capturas em legacy-nine-browser/.

## Posição e limites

Pendência dos nove testes legados encerrada. O padrão MARCELL de textos, botões e espaçamentos foi preservado. A validação usa dados fictícios e APIs interceptadas, sem confirmar operações reais. Não equivale a homologação com operadores ou aparelho físico; o piloto humano anteriormente adiado continua pendente. Não se afirma que toda a suíte do repositório foi executada: o escopo e os totais estão registrados acima.
