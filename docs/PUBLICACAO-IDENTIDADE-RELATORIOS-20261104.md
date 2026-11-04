# Publicação da identidade dos relatórios — 04/11/2026

- Produção: https://marcellapp.vercel.app
- Fonte consolidada: `e3992bcb`, branch local `codex/report-identity-release-20261104`.
- Deployment promovido: `dpl_7sEuQuGQpxekbmYBuC6NwZnTt4n3` (READY).
- Preservadas as alterações da produção até `b930aedc` (#245), incluindo o contexto da obra no Orçamento, nos cabeçalhos e nos relatórios mensais.

Antes da impressão/PDF, o usuário escolhe MARCELL ou ARCD e confere a logomarca. A imagem é incorporada ao cabeçalho e à marca-d’água. Cancelar mantém a consulta; CSV, planilhas, anexos e ZIP seguem seus fluxos existentes. Ajuda contextual e manual atualizados, com 117 guias para 65 abas.

## Validação

- Consolidação inicial: 187 testes em 51 arquivos aprovados.
- Após ajustes finais: 26 testes de relatórios e ajuda aprovados.
- Navegador: escolha das duas marcas no desktop/celular aprovada; rodada final com 16 testes de contexto da obra, Orçamento e PDF aprovada.
- Lint, design:check, manual:check e TypeScript aprovados; auditoria sem ciclos.
- Compilação direta Vite e orçamento do bundle aprovados. Prefixos dos chunks compactados, mantendo hashes e limites; nenhum teto aumentado por esta alteração.
- Snapshot produzido por git archive, incluindo os arquivos de referência usados em execução, sem dados locais ou arquivos de ambiente.
- A primeira compilação preparada não foi promovida: a produção recebeu #245 durante o trabalho. O pacote final incorpora essa alteração.
- Após promoção, domínio principal, JavaScript, fonte e logomarca ARCD responderam HTTP 200. O alias principal resolveu para o deployment final.
- Não houve push, pull request, migração de banco ou gravação de dados operacionais na produção.

O histórico de commits e os logs de verificação permanecem no checkout local. Os testes de interação usam dados sintéticos; a publicação foi conferida por leitura, sem gerar operações reais.
