# Publicação — fotos do ponto no OneDrive

Data: 12/11/2026.

- Produção: https://marcellapp.vercel.app/
- Implantação: `dpl_Grd7TmNgQhPYPz8QtEP1x4kTG6WR`, READY.
- URL imutável: https://mrc-e7ax8z2ti-hygor-s-projects1.vercel.app/
- Commit local: `c80354ea7fa69a13b45e53f8c07724500b130f23`.
- Release: `C:/dev/releases/ponto-fotos-onedrive-20261112`.
- Pacote enviado e evidências remotas: `C:/dev/releases/ponto-fotos-onedrive-upload-20261112`.

Um único deploy e build remoto, seguido da promoção do mesmo artefato, sem recompilar. Nenhum push, PR, migração, mudança de plano ou envio de foto real foi realizado.

A fonte publicada anteriormente (`dpl_6XxNiyEwRKK4Zuy2hV26YEnBDfou`) foi comparada por SHA-1 e preservada, incluindo as melhorias fiscais, comprovantes, captura e relatórios. A consolidação foi feita em diretório separado; alterações do checkout principal foram mantidas. A ajuda conserva as orientações operacionais da produção e acrescenta o novo armazenamento.

As novas fotos de batidas e cadastro facial são destinadas ao OneDrive central, na pasta Ponto de Obra. Fotos anteriores permanecem no bucket privado ponto-obra do Supabase; nenhuma foi apagada ou movida. Reenvio verifica o conteúdo existente e falha de envio mantém a foto pendente no aparelho.

## Validação

- 101 testes locais do conjunto consolidado aprovados, incluindo servidor, fila do aparelho, cadastro facial, fotos antigas e painel da equipe.
- Lint, tipos, arquitetura, ajuda/manual e auditoria de ciclos aprovados. Zero ciclos em 873 fontes.
- Pacote exato de publicação validado localmente: 1.908.687 bytes gzip, teto vigente de 1.908.736 preservado. Arquivos de teste excluídos da publicação não participam da varredura de CSS desse pacote.
- Build remoto aprovado: total JS/CSS gzip reportado em 1.863,95 KiB, dentro do teto de 1.864 KiB. Build remoto em 22 segundos.
- Antes da promoção: HTML e sete assets iniciais HTTP 200; envio de foto sem token do aparelho HTTP 401.
- Depois da promoção: alias confirmado e nenhuma falha de mapeamento. Sessões novas em 1440 e 390 pixels passaram sem erro JavaScript, asset JS/CSS ausente ou overflow horizontal. APIs de foto e OneDrive recusam acesso sem identificação com HTTP 401.

## Restrição externa ainda presente

A consulta genérica aos dados retorna HTTP 500. Os logs da implantação confirmam `exceed_egress_quota` do Supabase, a mesma restrição já identificada antes da mudança. O bloqueio não foi removido por este deploy.

O aplicativo continua dependendo do Supabase para autenticação, registros e a sessão central Microsoft. Portanto, é necessário liberar a restrição para retomar os fluxos autenticados e o envio real de novas fotos; fotos antigas também dependem da disponibilidade do Storage. Os testes locais usam serviços externos simulados, sem provar escrita real na conta Microsoft bloqueada por essa dependência. Nenhum dado operacional foi gravado durante a checagem de produção.

Evidências em `artifacts/photos-*`, `artifacts/deploy-*` e `artifacts/production-check.json` no diretório do pacote enviado.
