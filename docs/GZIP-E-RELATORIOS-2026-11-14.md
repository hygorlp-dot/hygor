# Continuação do roadmap — gzip e fontes dos relatórios

Execução automática autorizada em 14/11/2026. Todo o trabalho permaneceu local, sem push, PR, deployment ou migração remota. Evidências: `artifacts/gzip-20261114/`. Continuação do [relatório de desempenho e design](PERFORMANCE-E-DESIGN-2026-11-14.md).

## Resultado

**O excesso de 25.630 bytes foi eliminado sem aumentar nenhum limite e com redução adicional da carga inicial.**

| Medição JS/CSS | Antes | Final |
| --- | ---: | ---: |
| Total gzip | 1.916.958 bytes | **1.809.052 bytes** |
| Limite vigente | 1.891.328 bytes | 1.891.328 bytes |
| Situação | 25.630 bytes acima | **82.276 bytes de margem** |
| Maior chunk JavaScript sem compressão | 575.714 bytes | 575.714 bytes |
| Chunk do legado | aproximadamente 536 kB | aproximadamente 536 kB |

Economia total: **107.906 bytes gzip**, cerca de 5,6%. A configuração normal foi usada nas duas compilações, com mapas ocultos. Não houve mudança de minificador, nomes de arquivos, grupos de chunks, compressão do medidor, limites ou baseline de estilos para obter a aprovação. Nenhum chunk voltou a ultrapassar o aviso de 650 kB; os limites individuais e de mídia também passaram.

## Origem do peso e solução adotada

As fontes Nimbus Sans Regular e Bold estavam nos arquivos públicos usados pela interface e também embutidas em base64 no módulo JavaScript de relatórios. Os pares são idênticos em bytes:

| Fonte | SHA-256 das cópias pública e de referência |
| --- | --- |
| Regular | `8e1412613978949b22066236e3d92f902ee1ddb1b1a8e129b8117f3dffb55a11` |
| Bold | `88a5a190b279efa3fde1de0a6fb23f01d96a92bdae325330b5bf884cf5901b99` |

O módulo `src/reports/report-fonts.js` reaproveita os arquivos públicos, prepara os dados uma vez e os guarda em memória e, quando permitido, no cache persistente do navegador. O ERP prepara as fontes em segundo plano após o acesso. Isso não bloqueia a navegação ou o login. As cópias em `src/reports/assets/` permanecem como referência para conferir identidade; deixaram de ser embutidas no JavaScript.

Na janela **Identidade do relatório**, **Gerar relatório** só é habilitado após preparar as fontes e carregar a imagem escolhida. A confirmação continua abrindo a janela diretamente no clique, preservando a permissão de popup. Falha mostra o motivo e **Tentar carregar novamente**, conserva a marca selecionada e não abre documento incompleto. Cancelar continua preservando a consulta.

Construtores síncronos de relatórios podem montar um modelo enquanto o preparo está pendente. A etapa final em `report-preview.js` exige as fontes prontas, completa os endereços temporários somente no estilo próprio do relatório e incorpora os dois arquivos como `data:font/woff2;base64`. Textos de usuário, valores, tabelas, competência, identidade e papel permanecem preservados. Os documentos entregues não dependem de URLs de fonte; os HTMLs salvos foram reabertos sem rede.

Não houve substituição de família, corte, glifo, licença ou desenho da fonte. Os bytes incorporados nos documentos finais foram comparados aos arquivos originais por SHA-256.

## Preservação do ganho inicial

As dezesseis entradas comparadas usam contextos novos do Chromium, em 1440 e 390 px. Além do JS/CSS, a medição passou a contabilizar as fontes WOFF2 solicitadas. Assim, a aprovação não depende apenas de retirar bytes da categoria medida pelo orçamento.

| Entrada móvel | JS/CSS gzip antes → final | JS/CSS gzip + WOFF2 antes → final | Redução incluindo fontes |
| --- | ---: | ---: | ---: |
| Login | 752.718 → 644.322 | 1.003.158 → 894.762 | 10,8% |
| Início | 757.854 → 649.456 | 1.008.294 → 953.300 | 5,5% |
| Financeiro | 900.985 → 792.589 | 1.151.425 → 1.096.433 | 4,8% |
| DRE da obra | 902.253 → 793.857 | 1.152.693 → 1.097.701 | 4,8% |
| DRE da empresa | 901.639 → 793.243 | 1.152.079 → 1.097.087 | 4,8% |
| Ponto geral | 810.621 → 702.221 | 1.061.061 → 1.006.065 | 5,2% |
| Relatórios | 902.039 → 793.642 | 1.152.479 → 1.097.486 | 4,8% |
| Obras | 808.245 → 699.846 | 1.058.685 → 1.003.690 | 5,2% |

Valores em bytes. A coluna combinada soma gzip calculado dos JS/CSS solicitados aos bytes dos arquivos WOFF2 únicos solicitados, já comprimidos nesse formato. Não mede tráfego HTTP real, cabeçalhos, imagens, vídeo, tempo de produção ou desempenho de aparelho físico. Mesmo incluindo a fonte Bold preparada após entrar no ERP, o resultado combinado caiu nas dezesseis amostras. O JS/CSS inicial do login móvel caiu mais 14,4% em relação à etapa anterior.

## DRE e fluxo das informações

| Etapa | Conferência | Efeito observado |
| --- | --- | --- |
| Referência antes da alteração | Dezesseis consultas; NF de controle aprovada, R$ 1.234,56, novembro/2026, sem pagamento | Motor canônico: custo R$ 1.234,56 e resultado −R$ 1.234,56; receita e caixa zero |
| Reaproveitamento das fontes | Mesmas dezesseis consultas no build final; comparação monetária antes/depois | Mesmos valores, zero gravações financeiras ou operacionais e zero erros JavaScript |
| Preparo, cancelamento e geração | Seis cenários de geração desktop/celular: demora, cache sem rede e falha com nova tentativa | DRE preservado antes/depois; cancelamento não abriu popup; tentativa recusada não gravou fatos |
| Documento final | Tabelas e rótulos comparados integralmente aos relatórios do build anterior; fonte incorporada conferida por hash | Custo gerencial de R$ 2.034,56 preservado no relatório; nenhum novo lançamento |
| Regressão dos motores | Roteiro de vinte etapas repetido antes e depois, com valores esperados independentes | Final: receita R$ 5.000, custo R$ 3.000, resultado R$ 2.000; pagamento sem custo duplicado |

A projeção gerencial da empresa acrescenta R$ 800 de mão de obra do motor de ponto ao controle da NF, totalizando R$ 2.034,56. Essa composição já existia na referência e foi mantida separada do ledger canônico de R$ 1.234,56. Não foi alterada regra financeira para forçar igualdade entre motores. Persistem os cuidados de conciliar origem, competência, memorial e fechamento; gerar relatório não reconhece receita, custo ou pagamento.

As únicas gravações novas são de arquivos de fonte no cache local do navegador. Não criam cadastros, títulos, movimentos de estoque, custos, pagamentos ou eventos financeiros. Os testes usam dados sintéticos e APIs isoladas; não operam produção. O PostgreSQL descartável da etapa anterior continuou removido e não precisou ser reaberto para esta alteração de recursos.

## Testes e revisão

- **1.055 testes selecionados aprovados**, sem falhas ou pulos: relatórios, ponto/folha, finanças, DRE, interface, ajuda, workflow e empacotamento. Incluem identidade exata das fontes, requisição compartilhada, cache indisponível, erro HTTP, arquivo inválido, nova tentativa e conclusão de um modelo ainda pendente sem modificar textos de usuário.
- **133 cenários de navegador aprovados**, zero falhas e um pulo condicional de orientação no desktop. Cobertura financeira e operacional preservada no build final.
- **Um teste adicional de relatório A4 aprovado**, exercitando o renderizador pelo código-fonte. A primeira tentativa esgotou o tempo na abertura do ERP pelo servidor de desenvolvimento, antes de chegar ao preparo de fontes; o teste agora usa uma página HTML isolada para esse renderizador. Isso não foi apresentado como correção ou medição do tempo de inicialização do servidor de desenvolvimento.
- **216 verificações de inicialização aprovadas:** 83 imports isolados, 130 consultas de abas em desktop/celular e três entradas públicas.
- **Dezesseis amostras finais com axe sem violações**, sem transbordamento global e com DRE preservado; comparadas a dezesseis referências anteriores.
- **Seis cenários específicos de relatório aprovados** em desktop/celular: carregamento lento com confirmação bloqueada, cancelamento, documento autossuficiente salvo, preparo em módulo novo usando cache sem requisição de fonte, falha de rede sem cache e nova tentativa preservando ARCD. Os seis documentos foram gerados em PDF; dois HTMLs foram reabertos em contextos totalmente sem rede. As fontes foram carregadas e os valores continuaram iguais.
- A janela de identidade foi verificada com axe nas seis confirmações e em quatro estados adicionais de espera/falha, em desktop/celular. Capturas de carregamento no desktop, confirmação no celular e falha no celular foram inspecionadas visualmente.
- As medições de contraste aguardam o término das animações finitas, com movimento reduzido. Uma leitura durante o fade inicial havia sinalizado contraste transitório; foi preservada em `report-axe-during-animation-*.json`. As seis leituras finais da página inteira e as dez verificações do diálogo não encontraram violações.
- `lint`, `typecheck`, `design:check` e ajuda/manual passaram. O manual foi regenerado com revisão de 14/11/2026 e **142 guias para 65 abas**. A ajuda explica o preparo de fontes, o cache, a nova tentativa e a manutenção dos filtros.
- Os mapas do build final foram conferidos contra os cinco arquivos de execução/ajuda alterados: correspondem ao conteúdo atual do checkout.

Evidências principais: `bundle-before.json`, `bundle-final.json`, `browser-before.json`, `browser-final.json`, `unit-tests.json`, `browser-tests-final.json`, `final/cold-build-all.json`, `report-browser-before.json`, `report-browser-final.json`, `standalone-*.html`, `report-*.pdf`, `dre-before.json`, `dre-walkthrough.json` e `verification.json`. Os logs de tentativas e seletores corrigidos ficam separados; não foram somados como cenários novos.

## Alternativas descartadas e pendências restantes

As experiências ficaram somente em `artifacts/`: Terser (1.930.509 bytes gzip), regroupamento por tamanho mínimo (1.916.958), migração experimental de utilitários para ESM (1.917.600 na variante integral), JSX clássico (1.909.148) e compartilhamento de literais por módulo/chunk (1.913.118 / 1.914.253). Nenhuma substituiu a configuração do aplicativo ou acrescentou dependência ao seu pacote. O reaproveitamento de recursos idênticos resolveu a causa concreta sem manter essas reescritas.

Foram consultadas as documentações oficiais de [minificação do Vite](https://vite.dev/config/build-options.html#build-minify), [opções do Terser](https://terser.org/docs/options/) e [divisão de código do Rolldown](https://rolldown.rs/in-depth/manual-code-splitting). A escolha final se baseou nas compilações e nos testes locais, não em uma estimativa da documentação.

**P1 do total gzip: resolvida nesta continuação.** A herança tipográfica e a sincronização de planos antigos foram corrigidas na [continuação de 15/11](TIPOGRAFIA-E-PLANOS-LEGADOS-2026-11-15.md), com o DRE preservado. O total atual é 1.811.185 bytes gzip, margem de 80.143, com limite inalterado; os números anteriores deste documento permanecem históricos. Continuam pendentes o saneamento de registros históricos ambíguos e as homologações externas.

Sem conexão e sem fontes previamente guardadas, a geração exige nova tentativa após reconectar. Armazenamento privado ou cheio pode impedir o cache persistente, mas o preparo em memória continua disponível com rede. O documento já gerado permanece independente dessa condição. A checagem automatizada de acessibilidade não certifica todos os estados, navegadores ou leitores de tela.
