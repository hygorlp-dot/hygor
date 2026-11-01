# Menu lateral ajustável e consolidação — 01/11/2026

O menu compartilhado pode ser redimensionado no desktop entre 208 e 360 px. A largura inicial é 224 px. Arrastar a borda direita ajusta a área de navegação e a área de trabalho em conjunto, sem animação durante o gesto. Tab e setas permitem ajustar pelo teclado; Shift amplia o passo, Home/End selecionam os limites, Enter ou duplo clique restaura o padrão. Minimizar conserva a largura expandida. A preferência fica neste navegador; não grava registros da empresa. Celular e tablet mantêm a navegação inferior e o menu Mais.

## Consolidação

Checkout de publicação: `C:/dev/releases/marcell-sidebar-20261101`, branch local `codex/sidebar-consolidated-20261101`. Base: produção `e1b56855`, preservando pedido de Compras por texto/print e lotação automática após três dias. Incorporadas as correções locais até `fa75fd14`: desligamento direto, ações nos registros, proteção dos rascunhos, editor de fotos e carregamentos internos.

As alterações não relacionadas do checkout principal foram preservadas. Somente o ajuste do menu e suas instruções foram aplicado também ao checkout principal e à prévia 4253, com cópias anteriores em `artifacts/sidebar-before-20261101`. O checkout principal passou em lint, TypeScript e build local. A publicação usa a consolidação isolada, sem enviar as demais alterações locais.

## Verificação

- Menu: teste de navegador do arraste real por mouse, teclado, limites, recarga, minimizar/expandir, restauração e troca entre 1440, 1100 e 390 px aprovado no build estático.
- ERP consolidada: 199 cenários de navegador aprovados; um cenário exclusivamente móvel ignorado no desktop. Cobertura das 65 abas nos dois tamanhos, editor de fotos, rascunhos, desligamento e carregamentos lentos.
- Compras por conversa: três cenários preservados e aprovados (texto, print, falha de IA e recuperação).
- Código: 54 testes focados iniciais e 109 testes da consolidação aprovados, em rodadas com alguma sobreposição. Não representa toda a suíte do repositório.
- Lint, TypeScript, manual e análise de dependências aprovados: zero violações ou ciclos em 1488 módulos.
- Manual: 99 guias cobrem 65 abas. Revistos os controles e acrescentada a orientação de largura do menu. O guia do pedido por conversa foi encurtado preservando limites, cuidados e recuperação.
- Build de produção e limite JS/CSS aprovados: 1.789.935 bytes gzip para teto de 1.789.952. Prefixos auxiliares de chunks reduzidos de três para duas letras, mantendo hashes e nomes usados por gates específicos. Nenhum recurso retirado da medição e nenhum teto aumentado.
- Emulação Chromium; sem validação em aparelhos físicos ou Safari.

As falhas da primeira rodada no servidor dev decorreram de alterações de configuração reiniciando o servidor durante os testes e de um teste de entrada que intercepta chunks compilados. A revisão completa foi repetida sobre o build estático, com os resultados acima.

APIs, backend, migrações, dependências, agendamentos e roteamento permanecem idênticos à produção de base. A configuração local de publicação executa Vite e o gate de bundle, sem rodar o prebuild que executa migrações. Ela fica nos artefatos locais, preservando a configuração versionada.
