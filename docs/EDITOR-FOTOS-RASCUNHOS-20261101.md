# Editor de fotos e proteção de rascunhos — 01/11/2026

Entrega local a partir de `20f45520`, na branch `codex/rh-direct-dismissal-20261101`, checkout `C:/dev/releases/marcell-dismissal-local-20261101`. Sem push, migração, deploy ou gravação em serviços reais.

## Editor de fotos

- Substituído o overlay próprio pelo Modal compartilhado: título acessível, contenção do foco, Escape, bloqueio da navegação de fundo e adaptação à área visível.
- Cores visíveis e nomeadas por ColorSwatch, na base comum de controles. A amostra é conteúdo da anotação; moldura, dimensões, foco e seleção obedecem ao tema. Foram preservados os cinco valores anteriores.
- Ferramentas e zoom pode ser recolhido. Em telas estreitas ou baixas, começa fechado para dar espaço à imagem. Ferramentas, cores e zoom informam a seleção. A imagem mantém a proporção e Ajustar considera a largura e a altura disponíveis. Ampliações rolam dentro do editor.
- Limpar anotações mantém um passo no histórico de edição: Desfazer recupera todas as marcações removidas. Desfazer também continua removendo a última marcação individual.
- Fechar ou Escape com anotações ou legenda alterada abre a confirmação comum. Continuar editando e Escape na confirmação preservam o rascunho. Descartar alterações fecha somente o editor.
- Durante o envio, ferramentas e legenda ficam indisponíveis e a saída é protegida. Uma falha conserva as marcações e permite tentar novamente; salvar mantém o original separado da cópia.
- No editor aberto dentro de Editar pendência, a cópia enviada é adicionada ao formulário. Salvar achado ainda é necessário para confirmar o vínculo da pendência.
- Os dois carregamentos de foto usam Modal e Spinner comuns. Cancelar o carregamento impede reabrir a foto quando a resposta atrasada chega.

A migração revelou um problema no Modal comum: fechar editor e confirmação juntos podia substituir o foco já restaurado à miniatura pelo foco do painel. A correção preserva o elemento focado de um diálogo sobrevivente. Vale para todos os consumidores da base; os demais modos de fechar continuam iguais.

## Rescisão

Limpar foi renomeado para Limpar cálculo. Preenchimento e cálculo reaberto de uma rescisão cancelada exigem confirmação; Continuar editando ou Escape conservam os dados. Confirmar limpa o formulário, sem comando de exclusão e sem alterar o histórico. Sem preenchimento, não há confirmação desnecessária. A limpeza fica indisponível durante uma gravação.

O diálogo é UnsavedChangesPrompt, já utilizado pelos fluxos financeiros e de compras. Foram adicionados textos opcionais para nomear a limpeza, preservando as mensagens padrão dos demais consumidores. O guardião de rascunho existente também protege a recarga; os dados não são salvos como preferência.

## Ajuda, manual e padrão

Atualizados os guias Conferência e Rescisão, com data de revisão 01/11/2026, e regenerado `docs/MANUAL_DO_APP.md`: 98 guias cobrem 65 abas. A revisão inclui o passo Salvar achado quando a foto estiver dentro de um formulário.

Foram consolidados 11 campos de orientações antigas que eram sobrescritos na inicialização. A comparação em profundidade confirmou que os outros 96 guias mantêm o conteúdo anterior. Também foram removidas duas entradas de exemplo que eram sobrescritas ou não eram usadas. Isso evita carregar instruções antigas e mantém o bundle dentro do teto existente.

## Verificação concluída

- 22 cenários de navegador: 1440×1000, 390×844, 320×568 e 844×390. Incluem leitura sem permissão de edição, cores reais calculadas, seleção, zoom, foco, ausência de overflow da página, limpeza/desfazer por comparação dos pixels, legenda preservada, descarte, falha e nova tentativa de envio, original preservado, carregamento cancelado, editor dentro da pendência, rescisão reaberta e foto vertical.
- 20 cenários de regressão do funcionário, incluindo cadastro, desligamento e confirmações, passaram após a alteração do Modal comum.
- 63 testes de código em 11 arquivos: Modal, guardião de rascunho, comandos/fluxo de Conferência, cálculo/comandos de Rescisão e controles comuns. O novo caso do Modal comprova o retorno à miniatura ao fechar dois diálogos juntos.
- Lint, TypeScript, design:check, manual:check e diff sem erros; grafo sem ciclos.
- Build direto por Vite, sem executar migrações do prebuild. Bundle: 1.789.843 bytes gzip (1.747,89 KiB), abaixo do teto de 1.789.952 bytes; nenhum limite foi ampliado.

Os testes de envio usam a API interceptada e a aplicação real do comando em dados fictícios. Não foram enviados arquivos ao OneDrive real. Emulação de celular não substitui um aparelho físico nem avaliação com operadores.

## Prévia local

http://127.0.0.1:4257/ — `piloto@local.test` / `piloto-local`.

Em Conferência, abra CONF-900 e a Foto de demonstração local para experimentar as ferramentas, a limpeza e o descarte. São dados fictícios em memória; a demonstração desaparece se o servidor for reiniciado. O envio externo permanece desconectado nessa prévia.

A checagem da prévia detectou um runtime React duplicado no cache compartilhado entre checkouts com node_modules por junction. O servidor de revisão passou a usar cache próprio em artifacts/vite-local-preview e deduplicar React/React DOM, sem alterar configuração de produção nem outros servidores. Os dados em memória foram preservados durante o reinício. Login, CONF-900, abertura do editor e fechamento por Escape foram verificados no navegador sem interceptar a API local, sem erros de React.

Logs/capturas em `artifacts/dismissal-direct/photo-*`. Artefatos de teste e dados da demonstração não fazem parte do commit.
