# Publicação SaaS, Ponto e Folha — 01/11/2026

- Produção: https://marcellapp.vercel.app/
- Implantação: `dpl_BZGPFqwvTeBW2qy6NT4PxpTW5UKv`, READY.
- URL imutável: https://mrc-l886c2q7w-hygor-s-projects1.vercel.app/
- Projeto: `mrc`, `prj_t7UJ797nm3uYPRSSTlFWWZc42tn7`, equipe `team_poBZ5I1rwStzhvD73ar22b7v`.
- Commit de código publicado: `6b3ebaa580f8bbe3a1281cb08cea48e971758dcc`.
- Branch local: `codex/marcell-saas-release-20261101`.
- Checkout: `C:/dev/releases/marcell-saas-release-20261101`.

## Consolidação

Baseada na produção vigente `5c610d51`, implantação `dpl_CcvbEaepWrtdAUA1VdCQNJHAvnqh`, preservando a inicialização segura, o carregamento de CSS, os adaptadores de planilhas/ZIP e os workers. Foram incorporados os quatro commits da revisão local de temas, alinhamento e navegação, comparação visual e separação de grupos de Ponto/Folha. O workspace compartilhado, com outras alterações em andamento, não foi publicado em bloco.

O tema padrão é MARCELL Claro; nenhuma proposta do estudo foi escolhida automaticamente. A página de comparação permanece local e `prototypes/` foi excluído do envio. O release inclui as abas Pessoal de obra, Administrativo e Todos, com engenheiros e mestres no Administrativo, conforme confirmação do usuário. Ajuda e manual contêm 96 guias para 65 abas.

Backend, APIs, migrações, cron e regras de roteamento são idênticos à base publicada. Não houve migração de banco, push, PR ou criação de preview remoto. Foi feita uma única implantação de produção, inicialmente sem atribuir o domínio principal, e promovido o mesmo resultado sem recompilar.

## Empacotamento e validação

O primeiro build consolidado excedeu o limite preservado de JS/CSS em 2.487 bytes. Agrupar as primitivas compartilhadas da interface em um chunk comum reduziu importações repetidas e a sobrecarga de compressão, sem alterar componentes ou regras de negócio. Nenhum limite foi elevado nem arquivo retirado da medição.

- JS/CSS local: 1.781.971 bytes gzip, abaixo do teto de 1.789.952 bytes.
- Auditoria de imports: zero ciclos estáticos ou dinâmicos.
- 84 testes aprovados em 20 arquivos, incluindo temas, navegação, ajuda, folha, fechamento, agrupamento e recuperação de CSS/ZIP.
- 187 cenários de navegador aprovados no build consolidado: todas as 65 abas em desktop/celular, navegação, permissões, temas, condições adversas e separação de Ponto/Folha. Um cenário exclusivamente móvel é ignorado no projeto desktop.
- Lint, TypeScript, sincronização do manual, diff e build com gate de bundle aprovados.

Antes da promoção, HTML, JavaScript e CSS responderam HTTP 200 na implantação preparada. APIs de dados e OneDrive recusaram POST sem sessão com HTTP 401, mantendo a proteção da aplicação.

Após a promoção, o alias `marcellapp.vercel.app` foi confirmado apontando para a implantação acima. Duas verificações públicas em 1440 e 390 pixels passaram: login HTTP 200, título MARCELL, sem overflow horizontal, erro JavaScript ou asset JS/CSS/fonte ausente. As mesmas APIs continuaram respondendo HTTP 401 sem autenticação. O build da Vercel ficou READY e a proteção da implantação permaneceu habilitada.

Fluxos autenticados foram exercitados localmente com dados sintéticos; não foram fechadas folhas, gravados registros operacionais ou realizados pagamentos em produção. Evidências e logs em `artifacts/release-saas`. O servidor temporário de validação 4252 foi encerrado; a prévia local 4250 permanece disponível.

## Referência para recuperação

Implantação anterior preservada: `dpl_CcvbEaepWrtdAUA1VdCQNJHAvnqh`, https://mrc-2pxg6nxhn-hygor-s-projects1.vercel.app/. Nenhum rollback foi necessário ou executado.
