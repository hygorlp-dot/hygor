# Exportação analítica das composições próprias

Revisão: 26/11/2026. Implementação e validação locais; sem publicação.

## Resultado e origem

Os comandos existentes **Exportar em Excel** e **Exportar em PDF**, na área
Composições próprias, preparam fichas por ocorrência do item da versão aberta.
Ocorrências com o mesmo código podem ter memórias diferentes e não são fundidas.
A memória do item tem prioridade sobre a definição gravada na versão. O catálogo
atual da empresa não substitui essas memórias.

Cada ficha identifica item, código, descrição, unidade, quantidade, origem e
memória de preços. Apresenta coeficiente, custo unitário, custo parcial, soma dos
componentes, custo utilizado e diferença. Auxiliares aparecem em seções próprias,
com caminhos e coeficientes acumulados. A soma usa apenas os filhos diretos;
os níveis auxiliares explicam o custo do pai, sem somar custos novamente.

O Excel possui Composições, Fichas e Componentes. Usa o adaptador ExcelJS já
existente, com valores numéricos, códigos como texto, formatos monetários e
quebra de descrição. O PDF conserva a identidade MARCELL, Nimbus Sans e A4
paisagem. Fichas seguintes começam em nova página; cabeçalhos de tabela repetem
e auxiliares pequenos permanecem com seu fechamento.

## Consulta e limites

O navegador usa `detalharComposicoesReferencia` de `src/api.js` e a ação existente
`composition-details` de `api/references.js`, com escopo de empresa. Não há
acesso direto do navegador ao Supabase, nova rota ou escrita de dados. A resposta
identifica a fonte do pai, a base e a disponibilidade de preço separadamente da
fonte do componente; ausência de preço não é apresentada como zero comprovado.

O analítico oficial é consultado nas bases vinculadas e pode não corresponder à
data ou preço congelado. Diferenças ficam visíveis, sem substituição do custo.
Há avisos de analítico/preço ausente, consulta indisponível, referência ambígua,
ciclo e limite de expansão. A API existente percorre até 12 níveis remotos; a
expansão local limita caminhos a 20 para interromper ciclos e profundidade excessiva.

Uma parcela adaptada sem memória própria (por exemplo, saldo após deduzir a
argamassa) não é aberta como se fosse a composição oficial integral. O auditor
recebe o valor gravado e o aviso de memória faltante. Não é possível reconstruir
com segurança uma dedução não documentada apenas pelo código oficial.

## Impacto no DRE

Orçamento representa previsão. As funções de exportação apenas leem a versão
e consultam referências; não chamam `update`, comandos de persistência, compras,
estoque, reconhecimento de custo ou pagamentos. Os testes preservam o objeto de
origem e conferem que auxiliares não entram duas vezes no fechamento. Não há
efeito no resultado realizado, alteração do motor financeiro ou da projeção DRE.

## Verificação local

- `npm run validate:local`: aprovado, incluindo lint, design/manual, arquitetura,
  tipos e compilação local. Avisos de `fs` externalizado no ExcelJS apareceram no
  build; não impediram a compilação.
- Vitest: 42 testes aprovados em seis arquivos: exportação das composições,
  wiring do PDF do orçamento, identidade MARCELL, fontes, diálogo de identidade
  e API de referências. O teste do detalhamento inicialmente falhou com a saída
  anterior, sem custo parcial e sem fichas.
- O teste de XLSX grava e reabre os bytes para conferir abas, códigos textuais,
  formatos, custos numéricos, larguras e contribuição acumulada.
- Prévia com dados fictícios renderizada em 1440 e 390 px: sem transbordamento
  horizontal do documento; a tabela extensa rola dentro da região focável.
- Impressão Chromium: duas fichas em duas páginas A4 paisagem. O primeiro ensaio
  revelou subtotal órfão; a versão conferida mantém o fechamento com o auxiliar.
  Evidências em `output/own-compositions-export/`, com script reproduzível.
- Crítica visual: agrupamento, identificação, fechamento e recuperação de dados
  ausentes melhoraram em relação à lista geral anterior. O relatório é sempre
  claro, independentemente do tema; não houve revisão das outras telas do ERP.
- Detector Impeccable: nenhum achado no construtor do relatório; 66 advisories
  no arquivo legado OrcamentoView. Nenhuma baseline foi ampliada nesta tarefa.
- Ajuda revisada em `src/features/help/help-content.js` e manual regenerado com
  149 guias. Não há comando novo, cadastro, permissão ou fato financeiro novo.

Limites: não foi executada exportação autenticada no site publicado nem a suíte
integral do ERP. Dados fictícios verificam o formato; os avisos continuam exigindo
conferência das memórias reais antes da entrega ao auditor. Alterações locais de
outras tarefas foram preservadas. Não houve push, PR, migração ou deployment.

## Preparação isolada da publicação

Publicação autorizada em 26/11/2026. Base preservada: commit de produção
`4983a0021c82b4b6884f3f6b8265d68e759cb36b`, projeto Vercel `mrc`.
O pacote isolado conserva a ajuda da produção, com 147 guias, acrescentando
somente a orientação da exportação. Os 42 testes específicos e validate:local
também passaram nessa base. A suíte integral é registrada separadamente no
relatório da publicação; este registro inicial não comprova seu resultado.

O comparativo do mesmo build mostrou 1.904.674 bytes gzip na base e 1.908.566
na versão com o detalhamento, aumento de 3.892 bytes. O usuário autorizou
explicitamente ajustar o limite total em 4 KiB e publicar. O limite passa de
1.905.664 para 1.909.760 bytes; os limites por chunk, mídia e baselines de
interface permanecem iguais. Ensaios de compactação foram descartados;
o leitor CSV nativo do ExcelJS e a configuração de chunks foram preservados.
