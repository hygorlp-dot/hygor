# Integração local de cd8d029f e preservação da separação

Em 18/11/2026 foi executado `git fetch origin` e depois `git merge --ff-only origin/codex/audit-production-20261115`. A branch local passou de `c6fccb0d` para `cd8d029f`, incluindo o PR #255, sem reset, force push ou novo commit na branch. Nenhum push ou deployment foi feito.

Antes do merge, os diffs de trabalho e índice foram copiados para a área privada da conferência. As alterações rastreadas foram guardadas temporariamente no stash `4daa9c4dfe52f26a73e152a3bcaa73324791ca56`, que foi mantido como recuperação. Não havia arquivos não rastreados colidindo com o remoto. Depois do avanço, o stash foi reaplicado. O índice voltou ao estado original, sem alterações preparadas para commit.

Na checagem final de whitespace, foi removida somente uma linha em branco preexistente no fim de `server/client-portal-runtime.js`; o conteúdo de código permaneceu idêntico. `git diff --check` passou após essa normalização.

Houve conflitos em 11 arquivos, incluindo o manual gerado. Foram combinados os 17 trechos de código/CSS conflitantes, preservando as alterações dos dois lados. O manual foi regenerado a partir de `src/features/help/help-content.js`, sem escolher uma versão inteira do documento. As 100 alterações rastreadas fora dos arquivos modificados pelo remoto permaneceram integralmente iguais ao stash, conferidas pelos blobs do Git.

## Decisões da integração

- Preservados os temas Noite/Cristal, a fonte Inter, os tokens, a hierarquia dos indicadores e a pluralização do remoto.
- Preservados a seleção e o isolamento de empresa, os vínculos técnicos e de arquivos, a proteção do PDF enquanto o DRE carrega, o contexto de obra/período dos atalhos financeiros, a paginação e as áreas recolhíveis locais.
- Mantida a distinção entre entradas/saídas de caixa e resultado por competência. A formatação de percentual incorporada pelas alterações locais passou a usar o helper em português.
- A preparação de pastas continua explícita, com a recuperação de erro do remoto; abrir a área não dispara criação de pastas.
- A revisão visual encontrou o rótulo Empresa escuro no cabeçalho Noite. A correção ficou somente em `src/design-system/themes/noite.css`, com tokens do tema.
- A baseline de UX caiu em três ocorrências de percentual com ponto em Terceirizados e foi reduzida. A baseline do design system não foi ampliada nem regenerada.

Foram lidas e aplicadas `docs/REGRAS-UX-UI.md` e as orientações de impeccable/shadcn. A preferência explícita pela fonte Inter e pelos temas atuais prevalece sobre o histórico antigo do DESIGN.md. O detector Impeccable ainda informa desvios legados nas superfícies grandes; não foi declarado que todo o legado está corrigido. As verificações de UX/design confirmam ausência de aumento das exceções registradas.

## Validação

Passaram lint, regras de UX/UI, design, manual, arquitetura (1.789 módulos e 6.213 dependências), TypeScript e build local com `npx vite build`. Não foi executado `npm run build`/prebuild porque o ciclo de prebuild contém migrações e operações na nuvem. O manual está sincronizado com 145 guias.

Os temas Preciso, Noite e Cristal foram conferidos em 1.440 e 390 px, com Inter como família principal, seleção MRC preservada e sem rolagem horizontal. O rótulo Empresa do Noite foi conferido novamente após a correção, em desktop e celular.

A primeira execução completa teve 5.417 testes aprovados e nove falhas em quatro arquivos. Sete falhas vieram de `matchMedia` ausente no jsdom; o setup passou a oferecer esse contrato de largura/resize. Duas expectativas antigas foram atualizadas: a consulta SQL deve usar `currentCompany()` e o aviso administrativo usa o texto atual, sem alterar sua permissão. Os cinco arquivos de testes envolvidos, incluindo breakpoints, passaram na repetição dirigida: 24 testes.

A rodada final completa aprovou **5.426 testes**, com **15 ignorados**, **zero falhas** e nenhum erro não tratado, em **723 arquivos**. O relatório privado é `tests-full-final.json`. As verificações finais de lint, arquitetura, TypeScript e build local também passaram.

## Preservação financeira e provas

Os arquivos operacionais ARCD/MRC e o pacote anterior de migração continuam iguais por hash. O DRE local foi recalculado depois da integração e continua igual ao pacote aprovado. A comparação da nova captura com a origem anterior também permaneceu igual: o delta de R$ 200 da K1-04 continua identificado, sem ser aplicado à cópia operacional.

O pacote de migração antigo permanece como evidência, com o código da preparação anterior. Como o checkout mudou e a origem contém mudanças de ponto, ele exige regeneração/reconciliação antes do corte real. Não alterar seu manifesto para fingir que foi validado com o novo código.

As provas, diffs, estágios dos conflitos, capturas visuais e relatórios de testes estão na área privada `C:/dev/marcell-local-review/company-isolation-20261118/read-only-review-2026-11-18T20-47-09-767Z/`. O levantamento somente de leitura está em [Conferência do esquema, captura e acessos](CONFERENCIA-ESQUEMA-CAPTURA-ACESSOS-LEITURA-20261118.md).
