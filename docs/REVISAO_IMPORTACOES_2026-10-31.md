# Revisão local de importações e inicialização — 31/10/2026

## Causa e correção

A entrada `LegacyApp.jsx` também fornecia paleta, componentes e funções para
as próprias telas que ela carregava. O inventário inicial identificou um grupo
de dez arquivos com dependências estáticas circulares e um grupo de 61 arquivos
ao incluir carregamentos dinâmicos. Isso tornava a leitura de constantes
dependente da ordem de avaliação dos módulos, compatível com o erro
`Cannot access 'C' before initialization`.

Foram extraídas as declarações compartilhadas para 16 módulos responsáveis por
paleta, formatação, controles, arquivos, relatórios e auxiliares dos respectivos
domínios. Os consumidores passaram a importar diretamente esses módulos.
As exportações antigas foram mantidas como compatibilidade, sem duplicar os
objetos, componentes ou motores financeiros. A movimentação preservou os corpos
das funções e as regras existentes.

A importação isolada em desenvolvimento revelou uma segunda falha real:
`jszip/lib/index.js does not provide an export named 'default'`. O resolvedor
de produção estava interceptando o pacote CommonJS também no DEV, antes de sua
conversão pelo otimizador. A resolução modular ficou restrita ao build e o JSZip
foi incluído explicitamente na otimização do DEV. O worker conserva o bundle
compacto anterior, sem propagar a árvore de polyfills do app para seu arquivo.

## Proteção contra regressões

- `node scripts/audit-import-cycles.mjs`: inventário de imports e reexports
  locais, `require` e imports dinâmicos literais, com detecção de componentes
  fortemente conectados. Cobre `src`, `api`, `server` e `apps/ponto-obra/src`.
- `scripts/import-cycles.test.mjs`: integra à suíte a exigência de zero ciclos
  de execução, incluindo carregamentos dinâmicos. Imports exclusivamente de
  tipos não geram arestas de execução.
- `src/legacy/compatibility.test.js`: verifica a identidade das exportações
  antigas com seus novos módulos responsáveis.
- `scripts/verify-cold-initialization.mjs`: cria um contexto de navegador novo
  por importação ou tela. Verifica arquivos-fonte no DEV, chunks executáveis no
  build, todas as 65 abas administrativas em 1440 e 390 pixels e três entradas
  públicas. Workers têm verificação própria por não serem módulos de janela.
- `scripts/verify-worker-initialization.mjs`: importa arquivos sintéticos usando
  os workers reais do SINAPI e ORSE em DEV e build, em sessões separadas.
- `scripts/verify-development-startup.mjs`: valida o endereço local 4198 e força
  a leitura antecipada da paleta na resposta HTTP do teste, sem reverter fontes.

Os testes de interface usam dados sintéticos e interceptação das APIs. Comandos
de gravação são bloqueados e registrados, sem enviar alterações ao backend.

## Evidências e limites

Os relatórios e logs ficam em `artifacts/import-audit/`. O diretório
`source-before` guarda cópias anteriores à movimentação, e
`extraction-written.json` registra os arquivos extraídos. Não foram revertidas
as alterações de outras frentes presentes no checkout compartilhado.

| Verificação | Resultado | Evidência local |
| --- | --- | --- |
| Grafo local de execução | 757 arquivos, 2.155 arestas; zero ciclos estáticos e dinâmicos | `cycles-final.json` |
| Build normal com manifest e mapas locais | Compilado sem erro | `build-final.log` |
| Inicialização no DEV | 760 verificações aprovadas: 627 módulos-fonte e 133 sessões de telas | `cold-dev-all.json` |
| Inicialização no build | 246 verificações aprovadas: 113 chunks e 133 sessões de telas | `cold-build-all.json` |
| Workers SINAPI e ORSE | Quatro cenários aprovados, DEV/build, com parsing real de arquivos sintéticos | `worker.json` |
| Integrações no navegador | Nove testes aprovados, desktop/celular e XLSX/CSV/proteção SHA-512 | `integrations.json` |
| Endereço do incidente, porta 4198 | Leitura antecipada da paleta, navegação e recarga aprovadas em 1440/390 pixels | `4198-final.log` |
| Lint e manual | Sem erros; 88 guias e todas as 65 abas cobertas | `lint-final.log` |
| TypeScript | Sem erros no projeto de qualidade | `typecheck-quality-final.log` |
| Regras de arquitetura | Nenhuma violação em 1.415 módulos e 4.220 dependências | `architecture-final.log` |
| Suíte completa de regressão | 4.354 testes aprovados, zero falhas e 15 ignorados, em 581 arquivos | `unit-clean.json` |
| Referências JS/CSS publicáveis | 1.039 referências conferidas; nenhum arquivo ausente | `assets-final.json` |

**Pendência de desempenho:** o gate de tamanho do bundle reprova o conjunto
atual do checkout: 1.853.033 bytes gzip de JS/CSS, para limite de 1.789.952 bytes
(excesso de 63.081 bytes, aproximadamente 61,6 KiB). A compilação e a inicialização
passam; isso não torna o gate de desempenho aprovado. O limite não foi elevado.
Evidências: `bundle-final.json` e `bundle-final.log`.

**Atualização:** essa pendência foi resolvida na revisão posterior de
[redução do bundle](./REDUCAO_BUNDLE_2026-10-31.md), com 1.786.654 bytes gzip e
o mesmo limite de 1.789.952 bytes. Os valores acima registram a medição anterior.

As primeiras rodadas identificaram testes com mocks e verificações textuais
apontando para a localização antiga dos componentes. Esses testes foram
atualizados para os módulos responsáveis, preservando suas verificações.
A última execução completa terminou com sucesso. O ciclo inicial e a falha
CommonJS foram observados antes das respectivas correções.

Esta revisão verifica inicialização, navegação e integrações locais exercitadas
pelas fixtures. Não equivale a testar todas as combinações de dados reais,
serviços externos ou executar o app nativo em um aparelho físico. O grafo do
app nativo faz parte da auditoria estática e sua lógica faz parte da suíte.

A ajuda contextual e o manual foram revisados. Esta separação técnica não muda
os controles, permissões ou passos operacionais, portanto não exige novas
instruções de uso. O manual foi regenerado e sua sincronização validada, com
88 guias cobrindo as 65 abas.

Nenhum push, pull request ou deployment foi realizado nesta revisão.
