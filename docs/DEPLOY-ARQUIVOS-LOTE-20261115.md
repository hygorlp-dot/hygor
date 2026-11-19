# Deploy: envio de arquivos em lote

Data: 15/11/2026.

- Producao: https://marcellapp.vercel.app/
- Implantacao READY: `dpl_55aoLKcgg4PwsCsqKMj5xG4YoPzS`.
- URL imutavel: https://mrc-da99qzol8-hygor-s-projects1.vercel.app/
- Commit local: `dad428bc97de2f1bc3b9153e6106196bebb93947`.
- Base preservada: `cd584b1d1871cfac0f59d9071bec0be7f4230233`, implantacao `dpl_3R2AxxuaZiqgLvkRNaxcbQ17SbcE`.
- Checkout: C:/dev/releases/arquivos-lote-20261115.
- Espelho publicado: C:/dev/releases/arquivos-lote-upload-20261115.

## Escopo

Arrastar de 2 a 20 arquivos para a pasta abre uma conferencia unica. No celular ou teclado, Adicionar arquivos e Selecionar arquivos permitem selecionar varios. Enviar arquivos envia para o OneDrive e registra um unico lote. Cada arquivo mantem limite de 3 MiB, nome como titulo e revisao R01. O envio individual e Nova revisao continuam disponiveis.

Permissoes de obra/pasta e regras de documento sao reutilizadas. IDs proprios, validacao atomica da central e chave idempotente impedem gravacoes parciais e duplicatas em novas tentativas. Documentos e revisoes existentes nao sao substituidos. A retomada reaproveita uploads confirmados nesta sessao; cancelar nao apaga arquivos ja enviados ao OneDrive. A fila nao sobrevive ao fechamento/recarregamento, conforme ajuda atualizada.

Somente seis arquivos existentes e o novo BatchFileForm.jsx mudaram no manifesto de 1.329 fontes. API, integracoes anteriores e demais fontes da producao foram mantidas byte a byte. Outras alteracoes locais no checkout principal nao foram sobrescritas nem publicadas. Ajuda e manual foram revisados; o manual fica no checkout e e excluido do pacote pela regra vigente.

## Otimizacao e validacao

O usuario recusou elevar o teto. Todos os limites permaneceram inalterados. A folha compartilhada de estilos reduz repeticao de compressao e dispensa CSS separado por rota; modelo/permissoes documentais foram isolados sem efeitos de inicializacao. Nenhuma dependencia foi adicionada. Experimentos descartados nao entraram no manifesto.

- Build local: 1.897.414 bytes JS/CSS gzip, teto 1.908.736 bytes; folga 11.322 bytes. Limites individuais aprovados.
- Build remoto: 1.852,94 KiB, mesmo total arredondado do local; gate aprovado.
- 49 testes passaram. Lint, tipos, design e manual (117 guias/65 abas) passaram; arquitetura sem violacoes em 1.635 modulos.
- 75 chunks iniciaram em sessoes novas, sem falhas. SINAPI e ORSE processaram dados sinteticos em DEV e build, sem erros.
- Navegador 1440/390 px: arraste e selecao multipla, falha simulada no segundo upload, retomada, um unico comando e persistencia apos recarregar; documento anterior preservado. Capturas revisadas visualmente.
- Uma implantacao e um build remoto (23 segundos), via conector Vercel autenticado. Nenhum push, PR ou preview intermediario.
- Alias principal confirmado na nova implantacao. Checagem publica: HTTP 200 e titulo MARCELL em desktop/celular, sem overflow, pageerror ou JS/CSS ausente. Endpoints de dados e OneDrive recusaram chamadas sem autenticacao com HTTP 401.

Os fluxos autenticados usam arquivos e armazenamento sinteticos localmente. Nao foi realizado upload operacional real em producao; capacidade, credenciais e gravacao real no OneDrive nao sao comprovadas por esses testes. Nao houve migracao nem alteracao de plano ou permissao real.

## DRE

Sem efeito no resultado realizado. O lote modifica a central documental e recibos de auditoria. Testes comparam os demais dados. Nao cria previsao, compromisso, estoque fisico, custo reconhecido ou pagamento e nao duplica custo ao anexar documentos.

Evidencias no checkout: artifacts/final-tests.log, final-lint.log, final-types.log, final-cycles.log, final-browser.log, final-workers.log, release-cold-chunks.json, remote-build-events.json, production-check.json e files-batch-390.png / files-batch-1440.png. Manifesto e relatorio final de bundle ficam em artifacts do espelho publicado.

## Validacao real e correcao complementar

Dois TXT tecnicos (138 bytes cada) foram enviados pela sessao real do app para K1-10, pasta logica CONTRATO. Os dois apareceram fisicamente no OneDrive em App/K1-10/03 - Documentos/Central de arquivos. A central rejeitou inicialmente o registro com Chave idempotente operacional invalida: o prefixo files-batch: usava dois-pontos, recusado pelo contrato da API. Os testes anteriores de navegador usavam adaptador local que nao verificava esse contrato; essa lacuna foi reproduzida por teste vermelho e corrigida.

A interface agora gera files-batch- seguido de UUID. A API normaliza somente o formato historico exato desse comando para a mesma chave canonica, preservando as permissoes, o validador e a retomada de sessoes antigas sem repetir uploads. Outros comandos ou chaves malformadas nao recebem compatibilidade. O navegador de teste agora verifica explicitamente o contrato real da chave; o adaptador local tambem aplica o validador. 92 testes de arquivos, permissoes, escopo e acesso OneDrive passaram; lint, tipos e auditoria de ciclos passaram. Build continua dentro do teto. Ajuda e manual revisados: correcao interna sem alteracao das instrucoes de uso ou impacto no DRE.

O lote original permanece aberto para confirmar somente os registros, reaproveitando os arquivos ja enviados. Resultado da retomada real sera registrado apos a publicacao corretiva.

### Resultado real confirmado

Correcao publicada em `dpl_E2zjXgo97vAbAHpPaJMsPCzpCoQd`, READY, https://mrc-vtc445vlh-hygor-s-projects1.vercel.app/, commit `edb6b3c69b413ffb2483e872d82d503b143408ce`. Foi necessario um deploy corretivo adicional apos a falha real; build remoto de 23 segundos e gate 1.852,94 KiB aprovado, sem aumentar limites. Somente API, politica operacional e tela de arquivos mudaram em relacao ao primeiro deploy do lote.

A tentativa original foi repetida na mesma tela, preservando os uploads confirmados. Alteracao salva apareceu, com 2 documentos na central e 25 vinculos dos modulos. Apos recarregar e selecionar K1-10/CONTRATO, ambos os documentos permaneceram, cada um com R01 e uma revisao. Todos os documentos lista 27: os dois testes e os mesmos 25 vinculos anteriores, com nomes/tamanhos/revisoes apresentados preservados. O historico mostra uma unica entrada Lote criado: 2 documentos, em 15/11/2026 10:59:09 (Bahia), alem da criacao anterior de CONTRATO.

No OneDrive, a pasta App/K1-10/03 - Documentos/Central de arquivos foi recarregada apos a retomada e manteve exatamente dois arquivos de 138 bytes, com os mesmos nomes remotos de antes da nova tentativa:

- aecf4edc-ea9d-466b-8afa-ab6dea762192-VALIDACAO-LOTE-20261115-7c92-A.txt
- 7a47df1a-bccd-4ca3-83d4-c1e7181dc641-VALIDACAO-LOTE-20261115-7c92-B.txt

Ambos foram abertos pelo visualizador autenticado do app e o texto correto A/B foi lido de volta. Nenhuma duplicata foi observada na central, no historico ou nessa pasta do OneDrive. Nao foram excluidos arquivos, alteradas permissoes ou atualizados documentos antigos. Os dois TXT de teste foram mantidos como evidencia identificada. O teste nao representa prova universal de idempotencia para toda situacao de rede; a retomada real observada e os testes automatizados cobrem os casos descritos.

Verificacao publica apos a correcao: desktop/celular HTTP 200, sem pageerror, JS/CSS ausente ou overflow; endpoints protegidos retornaram 401 sem sessao. Capturas e textos de evidencia: C:/dev/repositorio-mrc/artifacts/onedrive-lote-real-20261115 (central.jpg, onedrive.jpg, after-documents.txt, history.txt, readback-B.txt). A tentativa opcional de baixar o ZIP do OneDrive pela ferramenta expirou; nao se afirma checksum do download. A leitura autenticada dos dois TXT foi confirmada.

A mesma correcao pontual foi aplicada ao checkout principal, preservando suas demais alteracoes locais. Nenhum novo build/deploy foi iniciado para isso. Ajuda e manual continuam sincronizados; o fluxo de uso nao mudou.

## Limpeza autorizada dos dois testes - 15/11/2026

Por solicitacao explicita do usuario, removidos somente os documentos 9bf62e0e-506b-4bf8-8ed1-8bba5e484550 (VALIDACAO-LOTE-20261115-7c92-A.txt) e 45b23960-899f-43f3-8a92-1eb968c67b63 (B.txt), de K1-10/CONTRATO. Como a central nao oferece exclusao, a limpeza foi aplicada via conector Supabase com comparacao atomica de versao temporal e hash do estado original, evitando sobrescrever atualizacoes concorrentes. Conferidos previamente IDs, nomes, pasta, tamanho 138 bytes e itemId OneDrive de cada revisao. Comparacao estrutural confirmou que todos os demais dados, outras centrais, pastas e historico anterior foram preservados; a versao da central passou de 2 para 3 e o historico recebeu o registro de limpeza.

No OneDrive, selecionados pelos nomes completos e enviados para a lixeira somente aecf4edc-ea9d-466b-8afa-ab6dea762192-VALIDACAO-LOTE-20261115-7c92-A.txt e 7a47df1a-bccd-4ca3-83d4-c1e7181dc641-VALIDACAO-LOTE-20261115-7c92-B.txt. A lixeira nao foi esvaziada. A pasta Central de arquivos confirmou Esta pasta esta vazia.

Apos recarregar o app, a central voltou a zero documentos proprios e os mesmos 25 vinculos anteriores. Comparacao textual exata dos nomes, tamanhos e revisoes dos documentos anteriores passou; os dois nomes de teste estao ausentes. Evidencias: artifacts/onedrive-lote-real-20261115/cleanup-plan.json, cleanup-after-documents.txt, cleanup-central.jpg e cleanup-onedrive.jpg. Backup restrito aos dois registros removidos mantido localmente para recuperacao. Snapshots temporarios completos descartados apos a verificacao. Nenhum deploy ou mudanca de codigo, permissao, financeiro ou DRE foi necessario.
