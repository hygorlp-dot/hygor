# Implantação da conferência de orçamentos

Revisão em 19/11/2026. A FABEJA R01 é o caso de validação. O motor atual reproduz os R$ 2.000.359,36 e o arredondamento por serviço de suas 305 linhas. Esse total é parcial.

| Etapa | Entrega | Critério de aceite | Estado |
|---|---|---|---|
| 1 | Conferência por item. Reaproveitar a lista navegável e a composição gravada no item. | Identificar 26 preços pendentes, 139 quantitativos zerados e a câmera de R$ 583,51 ante R$ 889,92. | Primeiro recorte local |
| 2 | Revisar pendências por etapa. Incluir filtros, exclusão justificada e indicação de total parcial na tela, no PDF e no Excel. | Itens a medir e a cotar ficam localizáveis. A exclusão tem motivo e identificação. Os três formatos exibem o mesmo total em centavos. | Implementada e validada localmente |
| 3 | Conferir Excel antes de aplicar. Preservar valores originais, comparar o recálculo e a referência selecionada. | A prévia explica diferenças de preço, BDI e arredondamento, aponta os campos faltantes e permite sair sem aplicar. | Implementada e validada localmente |
| 4 | Comparar revisões por item. Usar a identidade rastreável e mostrar mudanças de quantidade, preço, BDI e escopo. | A soma das diferenças explica a variação total. Identidade ambígua fica para conferência. A versão aprovada permanece íntegra. | Implementada e validada localmente |
| 5 | Validar com Engenharia em cópia local e preparar publicação. | Repetir o caso FABEJA, conferir permissões e ajuda, exportar e validar os temas Preciso e Noite em desktop e celular. Publicação depende de solicitação explícita. | Aceite local da Engenharia aprovado |

## Origem e impacto no DRE

A primeira etapa lê quantidade, preço e composição do próprio item. A composição gravada pode ser histórica. Sua soma é uma evidência para revisão e não atualiza o orçamento automaticamente. Notas em texto livre não fornecem parcelas calculáveis. A competência, a obra e os vínculos existentes continuam como referência nas próximas etapas. Usar `calculateBudget` para conferir totais e manter a precisão do motor.

O caminho desta entrega é `OrcamentoView` → `auditWholeBudget` → painel de conferência. A consulta não chama `save-sections`, grava dados ou cria evento financeiro. A previsão do orçamento de controle só muda pelo fluxo existente de aprovação. Compromisso de compra, entrada física em estoque, custo reconhecido e pagamento conservam seus fluxos e fontes. Na homologação, a projeção realizada deve ser idêntica antes e depois de consultar a auditoria.

O piloto inclui apenas dados locais. O arquivo Excel é evidência, e a ligação entre suas linhas e itens persistidos exige o fluxo de importação e conferência da etapa 3.

## Validação local de 19/11/2026

- O caso FABEJA foi convertido em memória a partir da auditoria do Excel. `auditWholeBudget` apresentou 26 preços pendentes e 139 quantidades zeradas. Na linha 28, comparou R$ 583,51 com R$ 889,92. `calculateBudget` manteve R$ 2.000.359,36. O objeto de entrada ficou idêntico após a consulta.
- Vitest executou 22 testes em quatro arquivos: `budget-workflow`, `composition-search`, `calculations` e `OrcamentoView.workflow`.
- `npm run validate:local` passou com lint, design, manual, arquitetura, tipos e build. A ajuda foi revisada e o manual regenerado com `npm run manual:generate`.
- Chromium, com API simulada e build servido localmente, abriu a ocorrência de preço pendente e destacou a linha correspondente nos temas Preciso e Noite, a 1440 e 390 px. A consulta não gerou chamadas de gravação. A primeira tentativa, pelo servidor de desenvolvimento, excedeu o tempo de carregamento. A verificação foi concluída com o build local.
- A conferência da composição foi verificada no domínio com as parcelas da FABEJA. A validação não incluiu importação Excel pelo app, alteração de uma versão aprovada ou comparação do DRE com dados de produção.

## Etapa 2

Na conferência, o filtro por etapa abrange os subníveis. A medir indica quantidade pendente ou inválida. A cotar indica quantidade positiva e preço pendente ou inválido. O contador de total parcial segue essas duas situações, excluídas as decisões de escopo válidas. O aviso em tela e nas exportações usa a mesma apuração. A Curva ABC conserva seu total de custo direto.

Em rascunhos, a exclusão exige item pendente de valor zero, motivo, pessoa identificada e data. Ela preserva a linha e seus campos de origem. O PDF identifica a decisão na linha e o Excel a inclui na aba Fora do escopo. A reinclusão retira a decisão e devolve o serviço à lista. A decisão se aplica aos dados conferidos da linha. Mudanças de identidade, etapa, descrição, unidade, quantidade ou preço podem reabrir a pendência. Cópia de outra obra ou de pavimento requer nova decisão. A revisão da mesma obra preserva a decisão quando a linha continua correspondente.

A gravação usa o fluxo de orçamento existente. A API valida autoria da nova exclusão no mesmo caminho que protege as versões aprovadas. A alteração não modifica os valores do motor, o orçamento de controle em vigor, compromissos, estoque, custo reconhecido ou pagamentos. A comparação local da projeção do DRE antes e depois do fluxo foi idêntica.

- `npm run validate:local` passou. O manual foi regenerado e verificado. Sete arquivos de testes de domínio, interface e autorização passaram, com 57 testes.
- `output/fabeja/validar-etapa2.mjs` abriu a aplicação compilada em Chromium com API simulada. Os dados partiram das 305 linhas reais extraídas do Excel, sem importar a planilha para o ambiente ativo. A busca por tipo e etapa funcionou nos temas Preciso e Noite a 1440 e 390 px. As capturas foram salvas junto ao PDF de teste.
- A exclusão de teste da laje do térreo exigiu motivo. Depois do recarregamento, o registro manteve responsável, data e justificativa e o aviso mostrou 139 a medir e 25 a cotar. Reincluir devolveu o indicador a 26. As 305 linhas e os R$ 2.000.359,36 foram preservados. O teste usou API simulada com as validações reais de autorização de orçamento.
- O PDF foi impresso em 20 páginas e seu texto confirmou aviso na abertura, total e justificativa. Os arquivos Excel completo e padrão foram baixados e reabertos com total de R$ 2.000.359,36. Ambos e o Excel ABC trouxeram o aviso e a aba de exclusões.
- As capturas do tema Noite mostram contraste baixo em superfícies legadas da planilha abaixo do painel. Os novos filtros, o aviso e as ações ficaram legíveis. Não houve validação com dados de produção.

## Etapa 3

A prévia usa a primeira aba e mantém os valores de origem em memória até a confirmação. Confere quantidade, custo unitário sem BDI, BDI, preço unitário com BDI e total informado por linha. O recálculo original e o valor para importação usam o motor de centavos do MARCELL. Campo ausente ou inválido fica indicado na comparação. A escala do BDI numérico pode ser revista no mapeamento. A soma de origem usa somente serviços e informa seu alcance quando há valores ausentes.

O preço para o orçamento vem das referências vinculadas consultadas por código e fonte, ou do catálogo local disponível quando não há referência vinculada. Composições próprias continuam disponíveis pelo catálogo da empresa. A consulta usa o endpoint existente, com variantes de competência, UF, unidade e preço preservadas para detectar ambiguidades. Divergência de unidade impede aplicar o preço. Um serviço pode entrar pendente, com o campo sem valor zerado, se o operador incluir essas linhas. A prévia mostra esse efeito antes de confirmar.

A FABEJA traz um título numerado `7.4` depois do subnível `7.3`. A importação localiza explicitamente a etapa-pai `7` para esse título. A associação dos serviços segue a validação da etapa numerada anterior. Os valores do rodapé não viram serviços ou etapas.

A origem é o arquivo lido no navegador e as referências cadastradas. A consulta da prévia não grava dados. Uma importação confirmada atualiza a previsão da versão editável pelo salvamento já existente. Nenhum caminho novo registra compromisso, estoque, custo reconhecido ou pagamento. A aprovação da versão de controle continua no fluxo próprio.

No Excel original da FABEJA R01, a leitura local encontrou 305 serviços, 55 etapas, 139 quantidades zeradas e 26 serviços com quantidade positiva e custo zero. As linhas originais e seu recálculo com o motor somaram R$ 2.000.359,36. O BDI sem formatação estava gravado como 0,2212 e foi interpretado como 22,12% após conferência da relação entre os preços. O caso da fôrma da sapata usa referência simulada de R$ 205,00 para validar a comparação com R$ 203,73 no Excel. Esse preço é dado do teste.

- `npm run validate:local` passou. Foram 46 testes em cinco arquivos, cobrindo mapeamento, hierarquia, fluxo de orçamento, variantes na API de referências e leitura de formatos Excel. A ajuda foi revisada e `npm run manual:generate` atualizou o manual.
- `output/fabeja/validar-etapa3.mjs` abriu o arquivo original pelo navegador no build local. Conferiu diferenças, dados faltantes e cancelamento nos temas Preciso e Noite a 1440 e 390 px. O arquivo original foi comparado byte a byte ao final. As capturas foram salvas em `output/fabeja/validacao-etapa3`.
- A consulta às bases e o salvamento usaram API simulada no teste de navegador. A confirmação com pendências desmarcadas gravou somente um serviço na simulação, com referência de R$ 205,00 e total com BDI de R$ 25.659,22 para esse serviço. O DRE simulado permaneceu idêntico. Não foi verificada a vigência de preços em produção. O build local emitiu os avisos conhecidos de `fs` no ExcelJS e concluiu com sucesso.

## Etapa 4

Em **Dados e versões → Comparar revisões**, as duas seleções são limitadas às versões disponíveis da mesma obra com ancestral confirmado pelo vínculo `revisionOf`. Os serviços correspondentes usam o ID preservado na revisão, sem associação por descrição ou código. IDs ausentes ou repetidos aparecem em **Identidade a conferir**. A diferença líquida desse grupo permanece explícita na reconciliação.

O comparador usa `calculateItem` para obter totais em centavos. Nos serviços correspondentes, aplica primeiro a quantidade, depois o preço e por último o BDI efetivo. Isso atribui as interações a quem entra mais tarde no cálculo. O total líquido de inclusões, retiradas, exclusões justificadas, reinclusões e mudanças de unidade, código ou fonte entra em escopo. Mudanças de descrição ou etapa são sinalizadas, com efeito de zero quando não há diferença financeira. Títulos hierárquicos ficam fora da soma. O painel indica quando uma versão tem total parcial.

A origem são as revisões já carregadas no ERP e seus vínculos. A tela funciona em consulta, sem gravar, aprovar, atualizar referências, trocar a linha de base de controle ou afetar compromisso, estoque, custo reconhecido ou pagamento. A abertura e o uso do comparador no teste de navegador não geraram gravações. A versão aprovada e o DRE simulado foram comparados antes e depois.

| Conferência da FABEJA | Resultado |
|---|---:|
| Versão de referência com os 305 serviços do Excel | R$ 2.000.359,36 |
| Revisão simulada a partir da mesma versão | R$ 1.956.506,14 |
| Quantidade | +R$ 560,65 |
| Preço | +R$ 158,96 |
| BDI | +R$ 383,43 |
| Escopo | −R$ 44.956,26 |
| Variação líquida | **−R$ 43.853,22** |

- O cenário parte do levantamento real e simula seis mudanças, incluindo uma exclusão de valor zero. Não trata os arquivos exportados em separado como revisões vinculadas. Uma conta independente em Decimal reproduziu os quatro impactos, e o comparador reconciliou as linhas e os totais em centavos.
- `npm run validate:local` passou. Foram 65 testes direcionados em cinco arquivos, incluindo comparador, motor, hierarquia, fluxo do orçamento e autorização. A ajuda foi atualizada e `npm run manual:generate` regenerou o manual. O build concluiu com avisos conhecidos do ExcelJS sobre `fs`.
- `output/fabeja/validar-etapa4.mjs` abriu o build em Chromium com API simulada. Conferiu as versões selecionáveis, os filtros, a inversão do sentido da comparação, a ausência de gravações, a versão aprovada e o DRE nos temas Preciso e Noite a 1440 e 390 px. As capturas estão em `output/fabeja/validacao-etapa4`.

## Etapa 5 · homologação técnica local

| Conferência | Resultado na FABEJA R01 |
|---|---|
| Planilha e importação | 305 serviços, 139 a medir, 26 a cotar e R$ 2.000.359,36 de total parcial. A câmera tem custo informado de R$ 583,51 e composição de R$ 889,92. A prévia reproduz o total do Excel e separa o impacto da referência de teste. |
| Exclusão e reinclusão | A exclusão de teste exigiu motivo, registrou responsável e persistiu ao recarregar. Ao excluir, restaram 25 serviços a cotar. Ao reincluir, voltaram a 26. O total e as 305 linhas foram preservados. |
| Exportações | O PDF de 20 páginas foi reaberto e conferido. O aviso aparece na primeira página, com total parcial de R$ 2.000.359,36 e justificativa na linha excluída. Excel completo e padrão mantêm o mesmo total. A Curva ABC mantém R$ 1.638.027,61 de custo direto. Os três arquivos Excel incluem o aviso e a aba Fora do escopo. |
| Revisões e DRE | A revisão simulada chegou a R$ 1.956.506,14. Os quatro impactos reconciliam a variação de −R$ 43.853,22. Consultar a comparação preservou a versão aprovada e gerou zero gravações. A projeção simulada do DRE permaneceu idêntica também após os fluxos de importação e exclusão. O orçamento continua sendo previsão, sem registrar compromisso, estoque, custo reconhecido ou pagamento. |
| Permissões | No handler local, Engenharia restrita grava na própria obra mesmo quando a empresa tem outros orçamentos. Alterar, mover ou remover orçamento de outra obra retorna 403. Financeiro e Engenharia sem acesso à aba recebem 403 na gravação. Os testes de política também cobrem aprovação por administrador e proteção da versão aprovada. |
| Ajuda e interface | Ajuda do orçamento, da importação e das revisões aberta nos temas MARCELL Preciso e Noite a 1440 e 390 px, preservando filtros e versões. O índice do manual lista os dois guias internos para quem tem acesso à aba. O manual gerado cobre as 65 abas. O detector Impeccable retornou zero achados no arquivo de ajuda alterado. A planilha legada conserva contraste baixo em trechos do tema Noite. |

### Evidências e limites

- `npm run validate:local` passou em lint, design, manual, arquitetura, tipos e build. Um build anterior falhou por importações duplicadas em outras áreas, removidas em trabalho paralelo no checkout. O build final manteve os avisos conhecidos de `fs` no ExcelJS.
- Vitest executou 437 testes direcionados em 53 arquivos, incluindo Orçamento, Ajuda, autorização, projeção de dados, isolamento de empresas, API de referências e leitura de planilhas. Sete testes de integração SQL do arquivo `server/orcamentos-linha-propria.pg.test.js` ficaram pendentes por falta de PostgreSQL descartável. A validação da API usou o handler real com persistência simulada. A suíte completa fica para o candidato consolidado à publicação.
- Os roteiros `output/fabeja/validar-etapa2.mjs`, `validar-etapa3.mjs` e `validar-etapa4.mjs` foram executados com `FABEJA_ETAPA5=1` e `FABEJA_LOCAL_URL` apontando para o build em `http://127.0.0.1:4195`. As capturas, planilhas e PDF estão em `output/fabeja/validacao-etapa5`. O Excel original foi verificado byte a byte após o teste. Os dados vieram do Excel e da auditoria local. A referência de catálogo, a segunda revisão e a persistência no navegador foram simuladas.
- A correção de permissão acompanha o caminho `OrcamentoView` → `save-sections` → `api/data.js` → `server/section-authorizations.js` → linha `__orcamentos`. O servidor usa os registros da transação antes e depois da mudança para validar a obra de origem e de destino. A correção usa a estrutura existente, sem migration nova, e preserva o motor do DRE.

### Checklist de publicação

1. Usar a branch local `codex/orcamento-fabeja-aceite-20261119` como candidato. Ela reúne as etapas de Orçamento, seus testes e o manual regenerado sobre a base local `2f2c59d0`. Nos arquivos compartilhados, foram incorporados os trechos de gravação de orçamento, referências e ajuda. A planilha original e as evidências ficam na máquina.
2. Confirmar o aceite da Engenharia na cópia local usando o roteiro abaixo. Repetir as verificações se o código, a base local ou o arquivo da FABEJA mudar antes da publicação.
3. Após autorização explícita, seguir o fluxo de publicação do ERP e conferir os gates vigentes do banco, inclusive o fechamento de acesso público. Registrar o commit e a versão anterior. Após a publicação, verificar abertura de Orçamento, Ajuda e exportação em uma obra autorizada e o recorte por perfil. Guardar a confirmação de gravação para um rascunho de teste autorizado.
4. Interromper a liberação se houver acesso a outra obra, falha de gravação no rascunho autorizado, mudança em versão aprovada ou divergência entre tela e exportações. Se a versão já estiver em produção, retomar a última versão estável pelo fluxo do ERP e preservar os registros e o histórico para investigação.

### Validação do candidato consolidado

- Os sete testes de `server/orcamentos-linha-propria.pg.test.js` passaram com PostgreSQL 16.14 em um contêiner descartável, em loopback e com dados em memória. Foi usada apenas a base `fabeja_teste`, criada para os testes. As verificações incluíram gravações simultâneas, leitura das duas linhas, imutabilidade da versão aprovada e recusa de envio completo para orçamento já separado. O contêiner foi encerrado depois da execução.
- `npm run lint`, `npm run architecture:check`, `npm run typecheck` e `node node_modules/vite/bin/vite.js build` passaram no checkout isolado. O manual conferiu 145 guias e 65 abas. Os 433 testes direcionados a Orçamento, Ajuda e APIs relacionadas passaram no candidato final.
- A suíte geral executada durante a consolidação passou em 5.343 testes, pulou 15 e falhou em 16. Uma suíte também falhou ao iniciar. As mesmas falhas foram reproduzidas na base `2f2c59d0` original, em oito arquivos do Financeiro, Portal do Cliente, Folha e Ponto. O candidato final inclui o trecho do cliente que solicita variantes de referência, conferido nos testes direcionados e no navegador. A rodada posterior corrigiu essas falhas, conforme o registro abaixo.
- Os três roteiros da FABEJA passaram no build final com `FABEJA_ETAPA5=1`, nos temas Preciso e Noite a 1440 e 390 px. As 16 capturas, o PDF de 20 páginas e os três arquivos Excel estão em `playwright-report/fabeja/validacao-etapa5` neste checkout. O PDF foi reaberto para conferir o aviso na primeira página, o valor e a justificativa. A exclusão, a importação confirmada e a revisão simulada preservaram o DRE do cenário. Os testes de interface usaram a API simulada e o Excel original conferido byte a byte.

### Correção das falhas da suíte geral

- Reproduzi as 16 falhas de teste e a suíte que não iniciava. O jsdom agora fornece `matchMedia` para as suítes que exercitam o layout. O teste da prévia de PDF simula também o endereço do worker, que o Vite recusava na instalação compartilhada. A asserção de somente leitura no painel financeiro acompanha o texto vigente e conserva as verificações de que o painel não oferece comandos de escrita.
- O teste de extrato do Portal do Cliente fixa a consulta em 14/11/2026 para conferir o saldo antes do aporte de 18/11. O cenário de Ponto de Obra reaproveita o adaptador de fotos em memória com o handler e a persistência de testes. Assim, os testes de sincronização e de fotografia continuam verificando o fluxo sem depender de credenciais nem gravar no OneDrive. As oito suítes afetadas passaram com 82 testes.
- A validação de lint, manual, arquitetura, tipos e build local passou. Em PostgreSQL 16.14 descartável, a rodada com os quatro arquivos que usam `PONTO_PG_URL` passou em 16 testes. Inclui os sete de Orçamento, concorrência da ARP e do fechamento da DRE e gravação de JSONB. O contêiner foi encerrado após os testes.
- `npm test -- --reporter=dot --maxWorkers=8` concluiu com código 0, 700 arquivos aprovados e 5.361 testes aprovados. Os 15 testes que o comando padrão pula sem `PONTO_PG_URL` foram aprovados na rodada PostgreSQL acima. As duas execuções cobrem os 5.376 testes do candidato, sem falhas.
- A FABEJA foi revalidada em Chromium com a API simulada e o Excel original, em Preciso e Noite a 1440 e 390 px. Foram conferidos os 305 serviços, o total parcial de R$ 2.000.359,36, os filtros e a ajuda, as exportações, a prévia de importação e a reconciliação de −R$ 43.853,22 na revisão simulada. A projeção do DRE da cópia ficou igual. Os três arquivos Excel foram reabertos pelos roteiros e o texto do PDF de 20 páginas foi conferido no arquivo salvo. Evidências em `playwright-report/fabeja/revalidacao`.
- A revisão de ajuda e manual confirmou que os ajustes de teste dispensam atualização nas instruções ao operador. O escopo técnico desta rodada é o ambiente de testes, com efeito zero na projeção do DRE da FABEJA.

### Roteiro de aceite da Engenharia

Use o checkout `C:/dev/releases/orcamento-fabeja-aceite-20261119`. Os três roteiros abrem o build no Chromium como Engenharia local. Cada janela começa com sua própria cópia em memória. O navegador limita as requisições ao endereço local e a API de teste intercepta consultas e gravações. Fechar a janela encerra a cópia. A planilha original permanece na pasta Downloads.

Com o build local pronto, deixe `node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 4196 --strictPort` aberto. Em outro terminal, no mesmo checkout, execute o roteiro da etapa desejada. Repita para as demais etapas.

```powershell
$env:FABEJA_LOCAL_URL = 'http://127.0.0.1:4196'
$env:FABEJA_ETAPA5 = '1'
$env:FABEJA_ACEITE = '1'
node playwright-report/fabeja/validar-etapa2.mjs
node playwright-report/fabeja/validar-etapa3.mjs
node playwright-report/fabeja/validar-etapa4.mjs
```

- **Conferência e exportação.** Em Análises e ferramentas, abra Conferência do orçamento inteiro. Confirme os contadores da FABEJA. Use A cotar e a etapa `4 SUPRAESTRUTURA (TÉRREO)`. Na cópia, exclua o serviço pendente com motivo de teste, confira o total parcial no PDF e nos modelos de Excel e reinclua o serviço. A quantidade a cotar volta de 25 a 26.
- **Prévia do Excel.** Abra Ferramentas do orçamento → Importar planilha, selecione o Excel original da FABEJA R01 e confirme as colunas. Busque `96532` em Filtrar conferência → Divergências. Confira R$ 203,73 no Excel e R$ 205,00 na referência simulada. O total informado e o recalculado com BDI reproduzem R$ 2.000.359,36. Confira Dados faltantes e use Cancelar para voltar.
- **Comparar revisões.** Abra Dados e versões → Comparar revisões. Escolha V1 aprovada e V2 rascunho. Confira se quantidade, preço, BDI e escopo chegam a −R$ 43.853,22. Abra Ajuda e confirme que o filtro e as versões continuam selecionados ao fechar.

Registre o aceite da Engenharia com data, responsável, versão validada e observações sobre pendências, preços de referência e interpretação do total parcial. A referência e a segunda revisão deste roteiro são dados de teste. O contraste baixo em partes da planilha legada no tema Noite está registrado na captura de conferência.

### Registro do aceite acompanhado

Sessão local de 19/11/2026, candidato `47c5efc7`. FABEJA R01 aberta no Chromium com perfil Engenharia local e API simulada. Foram usadas a planilha original e as cópias de teste descritas no roteiro. A validação automatizada anterior continua disponível em `playwright-report/fabeja/revalidacao`.

| Etapa com a Engenharia | Resultado confirmado |
|---|---|
| Abertura e conferência inicial | Confirmadas na sessão. Total parcial de R$ 2.000.359,36, 139 serviços a medir e 26 a cotar. |
| Exclusão, reinclusão e exportações | Confirmadas na sessão. A exclusão com motivo reduziu a cotação para 25, o PDF e os dois modelos de Excel exibiram R$ 2.000.359,36 e a reinclusão devolveu o contador a 26. |
| Prévia do Excel | Confirmada na sessão. O serviço 96532 exibiu R$ 203,73 no Excel e R$ 205,00 na referência simulada. Os totais original e recalculado de R$ 2.000.359,36 e o filtro de dados faltantes foram conferidos. O usuário cancelou a prévia. |
| Comparação de revisões e ajuda | Confirmadas na sessão. A revisão simulada apresentou variação de −R$ 43.853,22. O filtro Preço e as versões V1 e V2 continuaram selecionados após fechar a Ajuda. |

**Decisão registrada:** aprovado para aceite local em 19/11/2026, com confirmação do solicitante nesta sessão.

A FABEJA segue indicada como orçamento parcial. O preço de referência e a revisão V2 pertencem aos cenários de teste. O contraste baixo nas áreas legadas do tema Noite segue como observação técnica. A aprovação se refere à cópia local do candidato.
