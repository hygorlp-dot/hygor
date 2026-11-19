# Publicação de inicialização e bundle — 31/10/2026

- Produção: https://marcellapp.vercel.app/
- Implantação publicada: `dpl_CcvbEaepWrtdAUA1VdCQNJHAvnqh`, READY.
- URL imutável: https://mrc-2pxg6nxhn-hygor-s-projects1.vercel.app/
- Projeto: `mrc`, `prj_t7UJ797nm3uYPRSSTlFWWZc42tn7`.
- Commit local publicado: `5c610d518fd811a0dc5a7cc8327804c1ea7cab31`.
- Branch local: `codex/init-bundle-release-20261031`.
- Checkout consolidado: `C:/dev/releases/init-bundle-20261031`.

Foi criado **um único deployment remoto**, com **um único build remoto**, e
promovido o mesmo resultado sem recompilar. Nenhum preview remoto, push, PR ou
migração de banco foi executado.

## Consolidação e preservação

A base foi a produção publicada `70969adc`, implantação
`dpl_AVwevKHZNbQu5XDZNaAcJAg3GyDH`. Ela já continha a extração dos módulos
compartilhados e a recuperação de falhas de CSS. Essas correções foram mantidas.
O workspace compartilhado, com outras alterações em edição, não foi publicado
em bloco.

A conciliação detectou imports antigos da entrada `LegacyApp` reintroduzidos em
Ponto, RH e Licenciamento. Foram redirecionados para os módulos responsáveis,
sem alterar os corpos dessas telas. Os mocks dos testes acompanham os novos
imports.

O release inclui o adaptador ZIP enxuto, imports seletivos do CSV e UUID,
identidade visual sem perda, entrada lazy restrita à aplicação, cache do DEV
vinculado ao conteúdo dos adaptadores e suas dependências pré-otimizadas.
O dossiê publicado passou a reutilizar o compactador, mantendo arquivos,
manifesto, índice, bloqueio do ZIP final e aviso de dossiê incompleto.

O worker SINAPI participa do grafo do build e compartilha o codec ZIP com o
cliente, preservando uma entrada ES module própria. Prefixos de arquivos JS
foram compactados, mantendo hashes e nomes associados aos limites individuais.
O minificador original e a divisão dos estilos foram preservados.

Foram conferidos **282 arquivos de backend e migrações**, idênticos à produção
anterior. Cabeçalhos, rewrites, cron e configurações das funções também foram
preservados. O comando de build deste release executa auditoria de imports,
Vite e o gate de bundle, sem acionar os scripts de migração do `prebuild`.

## Validação

- Zero ciclos estáticos ou dinâmicos no release; o mesmo gate passou na Vercel.
- Bundle local: **1.788.567 bytes gzip**, para o limite preservado de
  **1.789.952 bytes**. Build remoto: **1.746,47 KiB gzip**, aprovado no gate de
  **1.748 KiB**. Nenhum limite foi elevado ou arquivo excluído da medição.
- 81 testes aprovados em 11 arquivos, incluindo proteção, ZIP, dossiê,
  compatibilidade, recuperação de CSS e regressões de Ponto.
- 243 verificações de inicialização no build, incluindo todas as 65 abas em
  sessões novas de desktop e celular e três entradas públicas.
- 650 imports frios do DEV aprovados após corrigir a descoberta tardia das
  dependências; as 133 sessões de telas do DEV também passaram. A importação
  de planilhas foi repetida com operações reais no DEV após o ajuste.
- Dez integrações aprovadas, desktop/celular e planilhas em DEV/build,
  comparando fórmulas, imagens, comentários, CSV multilinha, formatação
  condicional e SHA-512 com os pacotes originais.
- Workers SINAPI e ORSE iniciados e processando arquivos sintéticos em DEV e
  build. Logo com os mesmos pixels da produção anterior.
- Lint, tipos, arquitetura e referências dos assets aprovados. Ajuda/manual
  preservados: 90 guias cobrem 65 abas; a otimização não muda passos de uso.

Antes da promoção, HTML, JS, CSS e worker responderam HTTP 200. As APIs
`/api/data` e `/api/microsoft/onedrive` rejeitaram chamadas sem sessão com HTTP
401. A proteção Vercel permaneceu habilitada.

Após a promoção, o alias foi confirmado apontando para a implantação acima.
A página pública foi verificada em 1440 e 390 pixels: HTTP 200, título MARCELL,
sem overflow horizontal, erro de JavaScript ou asset JS/CSS ausente. As mesmas
APIs continuaram respondendo HTTP 401 a chamadas sem autenticação.

As verificações autenticadas de fluxos usam dados sintéticos localmente; não
foram gravados registros operacionais em produção. Evidências e logs estão em
`C:/dev/releases/init-bundle-20261031/artifacts/`.
