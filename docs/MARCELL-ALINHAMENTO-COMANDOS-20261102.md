# Alinhamento da barra de comandos — 02/11/2026

Correção local sobre a base compartilhada de Compras e Financeiro, sem deploy.

Causa reproduzida: o seletor de obra mantinha uma regra legada de mínimo 43 px em src/index.css. A altura intrínseca dos outros controles variava: busca 39 px, visualização 38 px e botões entre 36 e 36,9 px. Alinhar somente a borda inferior não alinhava o topo dos controles nem seus rótulos.

A regra legada foi removida. WorkspaceCommandBar usa a altura da densidade e padding vertical que não a aumenta. Os rótulos compartilham o intervalo da base e os indicadores textuais alinham pela linha de base. Não foi alterado nenhum fluxo, cálculo ou dado.

Validação:

- O teste ampliado falhou antes da correção e passou depois: compara altura, topo e rótulos, além da borda inferior.
- Compacta no desktop: controles da barra com 36 px, com topo e rótulos alinhados em Compras e Financeiro.
- Confortável e Espaçosa: quatro verificações de Compras/Financeiro passaram com 44 e 48 px, respectivamente.
- Cinco áreas em 1440, 390 e 320 px: 15 inspeções passaram, sem estouro horizontal; controles de toque com pelo menos 44 px.
- Quatro cenários de alinhamento/cabeçalho e 16 jornadas de fila/ficha passaram; oito testes da ajuda passaram. Build, orçamento, design:check e manual:check passaram. Nenhuma exceção de design foi acrescentada.
- Ajuda revisada e manual regenerado: 105 guias para 65 abas. A correção é visual; os nomes, permissões e resultados dos comandos continuam iguais.

Pacote final: 1788785 bytes gzip, abaixo do limite de 1.789.952.

Evidências: artifacts/alignment-before.log, alignment-after.log, alignment-red.log, alignment-green.log, alignment-layout-final.log, alignment-flows-final.log, alignment-matrix.log, alignment-comfortable.log e alignment-spacious.log. Capturas em artifacts/alignment/ e artifacts/alignment-matrix/; a imagem toolbar.png mostra o trecho corrigido.
