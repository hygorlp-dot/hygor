# Indicadores contábeis — entrega local

Revisão: **02/11/2026**. Continuação da fase 3 de `ROADMAP-INDICADORES-FINANCEIROS-20261102.md`. Sem publicação, push, PR ou migração. Implementação isolada em `C:/dev/releases/previsoes-gerenciais-local-20261101`; não sobrescrever a consolidação atual de `C:/dev/repositorio-mrc` ao integrar.

## Acesso e operação

Financeiro → Mais áreas → Previsões gerenciais → Indicadores contábeis. No celular, usar Áreas do financeiro e Consulta de previsões. Selecionar **Todas as obras e empresa**. A base completa é da empresa, disponível apenas a administrador ou financeiro ativo com acesso geral, sem restrição por obra. A projeção do servidor omite as bases dos demais perfis; não é apenas um bloqueio visual.

Três seções: **Resumo contábil**, **Bases e conferência** e **Memória contábil**. O resumo oferece onze índices, com valores, numeradores, denominadores e fórmulas. A memória apresenta balanço de conferência, DRE do período e todas as contas, mantendo código, classificação e linha do CSV. Importação e conferência são gravações explícitas; consultas, ajuda e exportações não criam lançamentos.

## Documento e revisões

CSV UTF-8 com ponto e vírgula, até 512 KB e 2.000 contas analíticas. Cabeçalho:

```csv
codigo;conta;grupo;saldo_inicial;debitos;creditos;saldo_final
```

Valores de entrada em reais no padrão brasileiro, por exemplo `1.234,56`. Saldo devedor positivo, credor negativo; movimentos de débito e crédito não negativos. Zero explícito, sem totais nem contas sintéticas duplicando as analíticas. Códigos únicos; campos com ponto e vírgula e aspas aceitam o escape CSV usual. O modelo e os 18 grupos estão disponíveis na tela. Classificar por natureza e prazo, mantendo contas redutoras e seus sinais.

Usar balancete **antes dos lançamentos de encerramento do resultado**, referente a até doze meses completos já encerrados. Informar entidade, documento e justificativa. Importar registra rascunho. Conferir exige integridade aritmética, cobertura integral declarada, classificação verificada e explicação das diferenças ou falta de comparação com o ERP. Cada importação no mesmo período gera outra revisão; aprovar uma revisão não altera nem apaga as anteriores. Uma revisão antiga não pode ser conferida depois de uma posterior já conferida.

Comandos `BASE_CONTABIL_IMPORTADA` e `BASE_CONTABIL_CONFERIDA`, com perfil/escopo autenticados no servidor, relógio do servidor, versão esperada e recibo idempotente. A lista `accountingBases` fica no armazenamento existente da empresa; não há tabela, migração ou serviço novo. Os três caminhos de gravação genérica do snapshot rejeitam reescrever esse histórico. Autor, data, origem, justificativa e comparação são preservados. O CSV é normalizado em contas; o binário original não é arquivado neste fluxo.

## Conferência e cálculos

- Por conta: saldo final = inicial + débitos − créditos, em centavos inteiros seguros.
- Totais iniciais e finais: soma dos saldos assinados igual a zero; débitos totais iguais a créditos totais.
- Natureza dos grupos: ativos e passivos agregados não podem ter natureza invertida. Contas redutoras individuais continuam permitidas.
- Balanço: ativo = passivo exigível + patrimônio líquido. PL para os índices = contas de PL + resultado acumulado ainda não encerrado. Isso inclui eventual resultado anterior em aberto e evita somar o lucro duas vezes.
- DRE: movimentos do período, não os saldos acumulados das contas de resultado. Receita líquida = receita bruta − deduções; resultado financeiro, outros resultados, tributos, depreciação e amortização permanecem identificados.
- Denominador não positivo, estrutura inválida, limite numérico excedido ou rascunho: índice indisponível com motivo. Numerador negativo legítimo permite prejuízo e retorno negativo. Ausência de base não vira zero.

| Família | Indicador | Cálculo |
| --- | --- | --- |
| Rentabilidade | Margem bruta | Lucro bruto / receita líquida |
| Rentabilidade | Margem líquida | Lucro líquido do período / receita líquida |
| Rentabilidade | ROA sobre ativo final | Lucro líquido do período / ativo total final |
| Rentabilidade | ROE sobre PL final | Lucro líquido do período / patrimônio líquido final |
| Liquidez | Corrente | Ativo circulante / passivo circulante |
| Liquidez | Seca restrita | (Caixa e equivalentes livres + recebíveis financeiros de curto prazo) / passivo circulante |
| Liquidez | Imediata | Caixa e equivalentes livres / passivo circulante |
| Liquidez | Geral | (Ativo circulante + realizável a longo prazo) / (passivo circulante + não circulante) |
| Endividamento | Capital de terceiros / ativo | (Passivo circulante + não circulante) / ativo total |
| Endividamento | Capital de terceiros / PL | (Passivo circulante + não circulante) / patrimônio líquido |
| Endividamento | Composição | Passivo circulante / passivo exigível total |

ROA/ROE usam **saldos finais**, explicitamente, conforme a variante adotada. Nenhum índice é anualizado e não existem limites universais presumidos de empresa saudável. Não comparar retornos de períodos de durações diferentes sem analisar o método. Os títulos do ERP, os compromissos e o caixa de treze semanas não representam um balanço completo.

Referências metodológicas: [FGV — fórmulas dos indicadores](https://ead4.fgv.br/producao/avaliacao/administracao_financeira_avaliacao_desempenho_empresarial/base_rede/pag/3_6_3.html), [B3 — famílias de indicadores financeiros](https://borainvestir.b3.com.br/glossario/indice-financeiro/) e [CPC 26 — apresentação das demonstrações](https://www.cpc.org.br/CPC/Documentos-Emitidos/Pronunciamentos/Pronunciamento?Id=57). A escolha de liquidez seca restrita e de saldos finais é expressa; o app não declara conformidade integral a normas contábeis. A conferência interna não substitui auditoria, parecer ou demonstrações publicadas.

## Comparação operacional e exportações

O resultado do razão canônico do ERP é selecionado pelas competências do período completo da base. A tela compara com o lucro/prejuízo contábil, preservando valor, número de eventos, pendências, diferença, justificativa e identidade dos eventos usados. Não ajusta valores para forçar igualdade. A comparação precisa ser refeita se o ERP mudar antes da conferência; mudanças posteriores geram aviso, preservando o retrato registrado. O recorte de referência não reconstrói o conhecimento histórico da empresa.

CSV possui oito seções: Base, Indicadores, Contas, Grupos, Pendências, Balanço, DRE e Conciliação. Valores monetários são em reais, proporções em escala zero a um; números exportados usam ponto decimal, seguindo o exportador canônico. Isso difere do formato brasileiro de entrada do balancete. PDF usa a marca, fontes e apresentação comum MARCELL, com os mesmos cálculos e a memória das contas. Nomes e textos importados são escapados no HTML; o exportador CSV comum neutraliza fórmulas de planilha.

## Demonstração independente

`http://127.0.0.1:4248/`, perfil `piloto@local.test`, senha de teste `piloto-local`. Variáveis `MARCELL_ACCOUNTING_DEMO=1`, `MARCELL_EXECUTIVE_DEMO=1`, `MARCELL_DAILY_PORT=4248`; executar `node scripts/daily-production-preview.mjs`. Dados são fictícios e mantidos somente na memória desse processo; reiniciar descarta novas revisões de teste. Os testes automatizados usam outra porta, 4247. A demonstração anterior de SPI em 4242 é preservada.

Base de outubro/2026 com 18 contas: ativo R$ 220.000, passivo exigível R$ 100.000, PL R$ 120.000, receita líquida R$ 90.000 e lucro R$ 20.000. Margens bruta 44,44% e líquida 22,22%; ROA 9,09%; ROE 16,67%; liquidez corrente 3,1, seca restrita 2,5, imediata 0,9 e geral 1,65; capital de terceiros/ativo 45,45%, /PL 83,33% e composição 50%. Valores ilustrativos da empresa, sem rateio à Residencial Alameda.

## Continuação do roadmap

Próximas dependências: vinculação conferida de planos de contas para reduzir classificação manual; histórico comparativo com períodos homogêneos; importadores contábeis com contratos de cobertura; índices de atividade com estoques/compras/vendas e bases médias compatíveis. Segurança, qualidade e validação retrospectiva continuam nas fases 4 e 5. Não introduzir indicadores cuja base esteja ausente.

## Validação

Evidências registradas ao final desta entrega em `artifacts/accounting-*.log`, `artifacts/accounting-design.json` e `artifacts/accounting/`. Verificar resultados finais dos comandos antes de concluir. Ajuda `fin_previsoes_accounting` e `fin_previsoes_accounting_base`, junto ao guia pai, integrada ao manual gerado.

**Integração futura:** a API publicada mais recente conserva a apropriação automática do ponto; o arquivo `api/data.js` deste checkout isolado tem uma base anterior dessa integração. Transportar somente as adições contábeis sobre a API vigente ao consolidar uma publicação futura, preservando as funções de ponto já em produção. Nenhuma publicação foi executada nesta entrega.

### Resultado conferido — 02/11/2026

- **322 testes aprovados em 13 arquivos**, incluindo cálculos, períodos, centavos, sinais, prejuízo, denominadores, autorização de comandos, projeção por perfil, histórico, idempotência, ajuda e regressões de planejamento/relatório executivo. `artifacts/accounting-tests.log`.
- **7 cenários contábeis + 4 regressões do relatório executivo aprovados**. Desktop 1440/1470, tablet 768 e celular 390 px; importação, confirmação, revisão preservada, arquivo divergente bloqueado, financeiro geral, restrição por obra, referência sem base, contexto da ajuda, CSV/PDF e ausência de overflow da página. A demonstração contábil de teste responde aos comandos com o mesmo patch de seções projetadas do servidor, validando a adoção do retorno pelo cliente. `artifacts/accounting-e2e.log` e `artifacts/accounting-executive-regression.log`.
- **Lint, tipos, manual e build Vite direto aprovados**, sem executar prebuild/migrações. Manual com **108 guias cobrindo 65 abas**. Auditoria de importações sem ciclos em 818 arquivos. Logs `accounting-lint`, `accounting-types`, `accounting-manual`, `accounting-build` e `accounting-cycles`.
- Bundle final **1.880.598 bytes gzip**; teto agregado ajustado de 1825 para 1838 KiB exclusivamente pelo código/ajuda desta funcionalidade. Limites de chunks e mídia preservados. Nenhuma alteração na baseline de exceções de design. `artifacts/accounting-bundle.log` e `bundle-metrics.json`.
- Detector Impeccable sem achados nos dois componentes revisados. Revisão visual independente encontrou compressão em tablet; orientação repetida removida e quebra textual ajustada na receita compartilhada, mantendo a rolagem interna. Recapturas conferidas: dois achados resolvidos, parecer **ship** para a extensão e os estados revisados. PDF de quatro páginas renderizado e inspecionado integralmente; valores, origem e memória preservados.
- Documenter conferiu padrões, controles, fontes do sistema e capturas, sem gravar tokens ou regras novas. Deriva pré-existente: DESIGN.md do checkout isolado registra Inter/Source Sans 3; a consolidação atual em repositorio-mrc registra IBM Plex Sans. Sidecars iguais. A extensão não cria família própria nem altera a base visual; ao consolidar, integrar os componentes sobre a base vigente, sem transportar os tokens ou DESIGN antigos.
- Os perfis, saldos, contas e justificativas da demonstração são fictícios. Nenhuma base real de contabilidade foi importada e nenhum dado de produção foi alterado.
