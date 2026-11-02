# Publicação das correções de auditoria — 31/10/2026

Base: produção `afca134e1b39c8f7799e87d0757424590f073791`.
Preparação em worktree isolado, sem substituir o checkout compartilhado.

Entrega: autorização de escrita de arquivos no servidor; proteção dos campos
atuais de remuneração; resolução segura de obra no OneDrive; validação de
respostas e confirmações de salvamento/upload; resposta inválida da consulta
de equipe; permissões de RH na interface; preservação de fotos já enviadas e
bloqueio do fechamento da medição durante upload/confirmação.

Os campos de escala/jornada, Administração Central e demais melhorias já
publicadas foram mantidos. A recuperação de CSS e a galeria já integram a base
de produção e não foram revertidas. O ajuste de gesto CSS é restrito ao puxador;
a implementação local ainda não publicada do Kanban não integra esta entrega.
Modelos auxiliares de rascunho de medição permanecem fora da publicação.

Não há migrações, mudança de variáveis ou credenciais nesta entrega. O comando
de build remoto existente foi preservado. Não são criados previews ou branches
remotos intermediários: a publicação ocorre por um único avanço de `main`.

As evidências da validação do pacote isolado ficam em `artifacts/release/` no
worktree de preparação. Testes, logs, capturas e informações de revisão local
não fazem parte dos arquivos públicos do deploy.

Validação do pacote: 4.131 testes passaram, nenhum falhou; 15 testes que
dependem de PostgreSQL externo ficaram ignorados. Os seis cenários de permissões
em desktop/celular e a verificação de medição em 320, 390 e 1280 px passaram.
Lint, tipos, arquitetura, build e orçamento do bundle passaram sem ampliar limites.
