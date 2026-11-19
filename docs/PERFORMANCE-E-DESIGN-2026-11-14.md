# Continuação do roadmap — chunks e DESIGN.md

**Continuação de 15/11/2026:** as duas pendências de tipografia e inicialização de planos foram concluídas localmente, com DRE preservado. [Evidências e limites](TIPOGRAFIA-E-PLANOS-LEGADOS-2026-11-15.md). Total gzip atual: 1.811.185 bytes, margem de 80.143 para o limite inalterado. As medições desta rodada de chunks permanecem históricas.

**Atualização posterior:** o excesso de 25.630 bytes registrado nesta etapa foi eliminado na [continuação de gzip e relatórios](GZIP-E-RELATORIOS-2026-11-14.md). O total passou a 1.809.052 bytes, com limite preservado e ganho adicional na carga inicial, inclusive contando fontes. As medições abaixo permanecem como histórico desta etapa anterior.

Execução local em 14/11/2026, autorizada para continuar automaticamente o [roadmap](ROADMAP-SOLUCOES-E-VALIDACAO-DRE-2026-11-14.md). Evidências: `artifacts/performance-design-20261114/`. Sem push, PR, publicação na Vercel ou migração remota.

## Resultado e critérios de aceite

| Pendência | Resultado |
| --- | --- |
| Chunk grande do legado | Reduzido de 1.223.319 para 536.186 bytes, redução de 56,2%. A compilação final não emite o aviso de chunks acima de 650 kB. |
| Carregamento inicial | Menos JS/CSS solicitado em sessões novas: cerca de 19,7% menos gzip estimado no login móvel e 19,6% no início. |
| Orçamento total de desempenho | **Reprovado, continua pendente.** Total de 1.916.958 bytes gzip para limite de 1.891.328; excesso de 25.630 bytes. Nenhum limite foi ampliado. |
| Alinhamento do DESIGN.md | Atualizado com o contrato vigente, suas fontes de verdade e diferenças ainda existentes no legado. Histórico identificado explicitamente. |
| Contraste adicional no login | Dois textos do rodapé tinham razão 4,18:1. Passaram a usar a cor secundária do tema; as duas larguras passaram no axe após a correção. |
| DRE | Sem alteração dos valores nos cenários antes/depois; roteiro financeiro de 20 etapas aprovado novamente. |

O orçamento total já falhava antes desta continuação: 1.900.796 bytes gzip, 9.468 acima do limite. A divisão recupera carga inicial e tamanho do maior chunk, mas aumenta o total gzip em 16.162 bytes, cerca de 0,85%, pela compressão separada dos arquivos. Isso é uma troca mensurada, não uma aprovação integral de desempenho. Todos os limites individuais de chunks e mídia passaram; o limite agregado permanece reprovado.

## Implementação e duplicidades

`scripts/legacy-screen-chunks.mjs`, registrado em `vite.config.mjs`, separa quinze telas existentes em dois módulos carregados sob demanda: financeiro/gerencial e operação/configuração. Usa a árvore sintática do TypeScript para resolver referências e respeitar escopos; dependências comuns ficam em um módulo compartilhado, preservando instâncias únicas e exportações públicas. Referências ausentes, dependências cruzadas inesperadas e contratos públicos incompatíveis interrompem a compilação.

A separação acontece no build. Os corpos das telas continuam na fonte original, integralmente examinada pelo verificador de design; não há segunda cópia de JSX para manter nem novos estilos locais. O SHA-256 de `src/LegacyApp.jsx` permaneceu igual à fotografia do início desta etapa (`5ABDF19B996798F5EDAC2BAC3D9B9B497F048ADCFA4C16859DB63DD137D15444`). O arquivo já continha alterações anteriores desta auditoria, que foram preservadas. A baseline de exceções não foi alterada.

Foram comparadas divisões mais fragmentadas, um agrupamento único e carregamento tardio de componentes já separados. As alternativas não reduziram melhor o total comprimido e foram descartadas. Também foi rejeitado agrupar os módulos virtuais por `manualChunks`, pois a cadeia de dependências reunia novamente código demais. Permanecem dois grupos, com aproximadamente 384 kB e 201 kB de JavaScript sem compressão, além do shell e dos módulos compartilhados. A inspeção dos mapas não identificou duplicação de bibliotecas entre os chunks examinados; isso não prova ausência de repetição conceitual entre módulos de negócio.

## Medição de navegação

Cada caso abriu um contexto novo do Chromium, em 1440 ou 390 px, com APIs locais isoladas e tráfego externo bloqueado. Foram comparados dezesseis casos antes e dezesseis no build final, incluindo login, início, Financeiro, DRE da obra, DRE da empresa, Ponto geral, Relatórios e Obras.

| Entrada móvel | Gzip estimado antes | Gzip estimado final | Redução |
| --- | ---: | ---: | ---: |
| Login | 937.522 bytes | 753.155 bytes | 19,7% |
| Início | 942.656 bytes | 758.358 bytes | 19,6% |
| Financeiro | 939.955 bytes | 901.654 bytes | 4,1% |
| DRE da obra | 941.218 bytes | 902.992 bytes | 4,1% |
| DRE da empresa | 940.606 bytes | 902.344 bytes | 4,1% |
| Ponto geral | 942.327 bytes | 811.194 bytes | 13,9% |
| Relatórios | 941.005 bytes | 902.740 bytes | 4,1% |
| Obras | 939.955 bytes | 808.785 bytes | 14,0% |

Esses valores somam os arquivos JS/CSS efetivamente solicitados e calculam seu gzip localmente. Não representam compressão HTTP medida na rede, fontes, imagens, vídeo, consumo em aparelho físico ou tempo de produção. O build de testes final contém comentários de referência aos mapas; sua soma gzip é 1.919.965 bytes. O orçamento acima usa a configuração normal do projeto, com mapas ocultos, equivalente à medição inicial, em `measured/build`. Os comentários de mapa explicam essa diferença de medição; nenhum orçamento foi recalculado com uma regra mais permissiva.

## DESIGN.md e revisão visual

Foram aplicadas as orientações de Impeccable e shadcn, preservando os componentes e o contrato MARCELL. O documento registra MARCELL Preciso como tema padrão, densidade Compacta, os quatro temas disponíveis, cores semânticas, dimensões, alturas por densidade e fontes centrais. As referências históricas a 72, Inter e Source Sans 3 estão identificadas como decisões anteriores, sem instruir uma migração da interface.

A inspeção no navegador confirmou IBM Plex Sans em cabeçalhos e controles compartilhados, título de página de 24 px/peso 600 e controles compactos de 36 px nas amostras. Há Nimbus Sans herdada no `body` de áreas legadas e peso 500 em títulos de diálogos/legado. Essas diferenças foram documentadas; o alinhamento documental não as apresenta como uniformização já concluída. A consolidação futura deve ocorrer na base compartilhada, com revisão de todas as superfícies afetadas.

Financeiro desktop e celular e login celular foram inspecionados visualmente. Não houve transbordamento global nas dezesseis amostras finais. O axe não encontrou violações nas dezesseis combinações finais, incluindo o login após o ajuste de contraste. A rodada anterior de 130 combinações continua sendo evidência histórica: ela não foi somada a essa cobertura nem substitui avaliação com leitor de tela.

## DRE em cada etapa

1. **Referência anterior:** cada sessão recebeu a mesma NF de controle, ID `perf-control`, de R$ 1.234,56, aprovada em novembro/2026, sem pagamentos. Registrados custo, receita e resultado do motor canônico e os campos monetários da projeção gerencial da empresa.
2. **Divisão do código:** os dezesseis casos intermediários compararam esses valores antes/depois, sem erro JavaScript nem requisição de gravação. A abertura tardia de uma tela não reconheceu novo custo, receita ou pagamento.
3. **Documento de design:** a alteração descreve tokens e hierarquia; não modifica cadastros, vínculos, unidades, competência, permissões ou cálculos. As mesmas projeções foram preservadas na navegação.
4. **Contraste e build final:** os dezesseis casos finais repetiram a conferência, sem gravações ou alteração dos valores. O ajuste de cor não possui efeito no resultado realizado.
5. **Regressão financeira:** repetido o roteiro de vinte fatos controlados, de orçamento/compromisso até reconhecimento, pagamento parcial, conciliação e estorno. Resultado final: receita R$ 5.000, custo R$ 3.000, resultado R$ 2.000. O pagamento não duplicou o custo; outra obra e outra competência permaneceram preservadas.

No controle de navegação, o motor canônico registrou receita R$ 0, custo R$ 1.234,56 e resultado −R$ 1.234,56; a projeção gerencial da empresa registrou CSP R$ 2.034,56 e resultado −R$ 2.034,56. A diferença de R$ 800 já existia antes e vem do cálculo suplementar de mão de obra (`laborTotal`, eventos `ponto`) na projeção gerencial, em `server/dre-projection.js` e `src/domains/dre/calculations.js`. Os dois resultados foram preservados separadamente: igualdade antes/depois não significa igualdade entre motores com bases diferentes. A homologação do fechamento deve conciliar essa composição com o memorial; esta otimização não alterou a regra para forçar igualdade numérica.

O roteiro de vinte etapas testa a projeção com fatos controlados; não corresponde a vinte gravações reais pela interface ou nova execução PostgreSQL. O PostgreSQL descartável já havia sido encerrado e removido na continuação anterior.

## Validação e rastreabilidade

- 622 testes selecionados aprovados, sem falhas ou pulos: compilação/divisão de código, finanças, DRE, design system, ajuda e workflow. Incluem cinco testes do novo separador, repetidos no final.
- 216 verificações do build final aprovadas: 83 imports isolados sem inicializar o aplicativo, 130 consultas das 65 abas em desktop/celular e três entradas públicas. Nenhuma falha de inicialização circular observada.
- A rodada final de navegador terminou com **133 casos aprovados, zero falhas e um pulo condicional de orientação no desktop**. Cobre DRE mensal/anual/memorial, conciliação, continuidade de documentos, folha, previsões, equipes, carregamento lento, temas, carimbo de obra e fluxos de compra. O resultado consolidado está em `verification.json`; as cinco repetições do carimbo não foram somadas como novos cenários.
- As primeiras rodadas localizaram testes que decidiam entre controles desktop/celular antes de a navegação estar carregada. As esperas agora observam o controle real, sem pausas arbitrárias ou redução das verificações financeiras.
- O teste do carimbo usava um plano antigo sem `budgetVersionId` e uma API que devolvia dados antigos após salvar. A sincronização automática podia abrir recuperação de edição e bloquear corretamente o atalho de busca. A fixture agora começa com os vínculos de versão existentes, por ID exato; a API simulada aplica deltas e confere os dois resultados financeiros a cada gravação. O caso passou em cinco repetições consecutivas. O cenário de migração de planos antigos durante a preparação do armazenamento permanece distinto desse teste de navegação.
- `lint`, `typecheck`, `design:check`, ajuda e manual verificados. Manual gerado com revisão de 14/11/2026: 141 guias para 65 abas. As mudanças de empacotamento, documentação e contraste não alteram os passos operacionais; não foi acrescentada instrução artificial ao usuário.

Arquivos de evidência: `bundle-before.json`, `bundle-measured.json`, `browser-before.json`, `browser-after.json`, `browser-final.json`, `final/cold-build-all.json`, `unit-tests.json`, `split-unit-final.json`, `browser-tests-final.json`, `browser-stamp-five.json`, `dre-walkthrough.json` e logs associados. As tentativas com falha foram preservadas em JSON/logs separados; retentativas não devem ser somadas como novos cenários distintos.

## Próximas pendências, em ordem

1. **P1 — total gzip: resolvida na continuação.** O reaproveitamento das fontes públicas eliminou a cópia base64 no JavaScript, preservando a incorporação no documento final. Total de 1.809.052 bytes para limite de 1.891.328; imports isolados e jornadas financeiras aprovados. Evidências e carga inicial incluindo fontes no relatório de gzip e relatórios.
2. **P2 — herança tipográfica: resolvida localmente em 15/11.** O corpo legado consome os tokens compartilhados. Fonte carregada e estilos computados conferidos nos quatro temas, desktop/celular; impressão e portal preservados, sem efeito no DRE. Veja [tipografia e planos antigos](TIPOGRAFIA-E-PLANOS-LEGADOS-2026-11-15.md).
3. **P2 — inicialização e migração de planos: resolvida localmente em 15/11.** Vinte cenários específicos cobrem leitura tardia, edição protegida, erro de armazenamento, conflito de versão, resposta perdida, ambiguidades e perfil de consulta. A sincronização aguarda a prontidão e preserva os dados; a edição de planos ambíguos fica bloqueada para conferência. Evidências e limites no mesmo relatório; saneamento histórico continua pendente.
4. **Homologações anteriores:** serviços externos e dispositivos reais, outros navegadores, dados históricos e conciliação dos fechamentos/memoriais. Não foram declarados homologados nesta etapa.

A automação introduzida é de compilação e validação local. Nenhuma automação financeira autônoma, envio externo ou publicação foi habilitada.
