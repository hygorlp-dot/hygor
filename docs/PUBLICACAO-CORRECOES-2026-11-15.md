# Publicação consolidada das correções validadas

**Publicação concluída:** versão `c6fccb0`, deployment **READY**, sem erro de alias. Aplicação ativa em **https://erp.marcelleng.com.br/**. Conferência remota aprovou HTML e arquivos de entrada HTTP 200, API sem autenticação protegida, login visível e nenhuma exceção JavaScript em desktop (1440 px) e celular (390 px). Não foi executado fluxo financeiro autenticado em produção.

Autorização explícita do usuário em 15/11/2026: “esta acabando os creditos, publique o que já fo isolucionado”. Essa autorização substitui, somente para esta publicação de software, a orientação anterior de manter tudo local. **Não autoriza corrigir valores documentais por hipótese.**

Versão consolidada: **`c6fccb0de467533efee5d40042dfe5583265a7be`**, referência `codex/audit-production-20261115`, projeto Vercel **mrc** (`prj_t7UJ797nm3uYPRSSTlFWWZc42tn7`), equipe confirmada `team_poBZ5I1rwStzhvD73ar22b7v`. Publicação de produção solicitada pelo plugin conectado da Vercel, com origem Git fixa nessa versão; sem pull request ou merge na main. A CLI estava desconectada e não foi solicitado token ao usuário.

O checkout local foi preservado, incluindo alterações e evidências fora do conjunto publicado. Relatórios financeiros, arquivos de captura, PDFs, dados privados, `.env` e ferramentas locais de conexão/cobrança não foram incluídos no novo commit. A exclusão de `output/`, `PATHFINDER-2026-10-26/` e `NUL` foi acrescida à configuração de envio local, para evitar material de trabalho alheio ao app.

## Verificação antes da publicação

- **5.256 testes aprovados em 683 arquivos**; 15 testes e três arquivos pulados, conforme condições de ambiente das suítes. Não se declara execução dos pulos.
- Lint, nomes, verificações de interface, design, tipos e manual aprovados. Manual local sincronizado: **143 guias / 65 abas**.
- Arquitetura aprovada: **1.714 módulos / 5.789 dependências**, sem violações.
- Build local por Vite e verificação de ciclos aprovados. **1.818.217 bytes gzip**, limite mantido em **1.891.328**, margem **73.111 bytes**, zero violações.
- [Conferência CA1-13 e R1-16](CA1-13-E-ENTRADA-R1-16-2026-11-15.md): DRE e caixa iguais em quatro etapas, **36 competências e 648 projeções por obra por etapa**; memoriais e composição do DRE conferidos. Zero novos lançamentos financeiros. W1-22 permanece documental.

O hook de push habitual chama `npm run build`, cujo prebuild executa migrações financeiras remotas. Por isso, os gates foram executados explicitamente, com **`npx vite build`** em lugar desse prebuild, e o push foi feito sem repetir o hook. O comando de build enviado à Vercel também usa Vite diretamente e não executa migrações. O commit contém marcadores de pulo de CI/publicação automática, para evitar builds intermediários; o deployment de produção foi solicitado explicitamente pelo plugin.

## Publicação e conferência remota

Deployment concluído: **`dpl_CTfMWabiAPG7VaRLhibp6j9euPMv`**, endereço `https://mrc-na7fi66ru-hygor-s-projects1.vercel.app`, versão Git confirmada pela Vercel. Alias principal **https://erp.marcelleng.com.br/** confirmado na lista de produção, juntamente com os demais aliases do projeto. Resultado, horários e sondagens registrados em `artifacts/centavos-entrada-20261115/publication-verification.json`; imagens nos arquivos `production-1440.png` e `production-390.png`. O build remoto utilizou o comando Vite solicitado e concluiu dentro do orçamento gzip.

Permanecem documentais: W1-22, centavos/cronologia CA1-13, composição/cronologia R1-16, origem/obrigação PC-0003, associações dos seis recebimentos legados, R$ 7.160 e aporte B2-04. Publicar o software não importa as cópias financeiras locais nem homologa fechamentos. Os detalhes e o roadmap estão nos relatórios locais correspondentes.
