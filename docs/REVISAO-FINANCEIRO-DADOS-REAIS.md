# Revisão do financeiro com dados reais — 30/10/2026

Repositório: `C:/dev/repositorio-mrc`. Correções locais, preservando as alterações existentes e os dados financeiros da empresa. Sem push, PR, publicação na Vercel ou migração.

## Fonte e proteção dos dados

A sessão do painel nativo não é compartilhada com o navegador de automação. A revisão usou uma leitura técnica autorizada da base configurada no repositório e uma jornada de navegador isolada com esse recorte real em memória. Não foram solicitadas senhas, reutilizados tokens da pessoa nem modificada a autenticação do ambiente em `http://127.0.0.1:4192`.

A leitura reutiliza a decodificação e a mesclagem do ERP: núcleo, domínios separados, ponto por obra, custos arquivados e fatos canônicos. O cliente técnico permite somente GET/HEAD. Nenhum snapshot dos registros, credencial ou planilha com os dados reais foi gravado no repositório. Os CSVs de teste foram lidos em memória a partir do download temporário do navegador, encerrado ao fim da jornada. Os relatórios de evidência contêm contagens e resultados dos testes.

A leitura encontrou 17 obras, 178 medições, 48 despesas da obra, 23 despesas da empresa e 5 pedidos antes dos filtros de situação. Não havia registros em `notasFiscais`. As ausências de documento foram mantidas; pastas gerais da obra não foram tratadas como notas fiscais e nenhum vínculo foi criado automaticamente. Os arquivos de custo arquivado esperados estavam disponíveis.

## Correções

- **Identificação na central e no memorial:** entradas criadas diretamente a partir da ficha documental agora aproveitam o cliente da obra para medições/recebimentos, o fornecedor vinculado ao pedido e o número da parcela ou documento. A busca e a conferência deixam de apresentar contraparte desconhecida quando a informação já está cadastrada. O cliente da obra não é atribuído como fornecedor de uma despesa.
- **Busca consistente:** central documental, memorial e relatórios usam o mesmo texto normalizado para acentos, maiúsculas, espaços e números. Cliente, fornecedor, obra, descrição e documento permanecem no recorte pesquisado; a central inclui explicitamente o número da parcela. O texto original dos registros permanece intacto.
- **Categorias legíveis:** faturamento, compras, aportes e benefícios têm nomes próprios no relatório e nas exportações. Identificadores, classificações e valores não foram alterados.
- **Filtros da previsão no celular:** a regra visual que ocultava os botões da fila Hoje também atingia os campos da previsão de caixa. Os seletores foram restritos à fila identificada pelo seu título, preservando a navegação existente e mantendo horizonte, saldo inicial e atraso de recebimentos disponíveis na previsão.
- **Continuidade:** a jornada real verifica seleção de obra, sete indicadores sem diferença residual, busca documental por cliente/parcela, consulta ao memorial, retorno à central e CSV restrito ao recorte.

O texto da central informa os campos pesquisáveis; o painel de conferência apresenta Cliente / fornecedor e aceita também o nome original do arquivo quando armazenado em `name`.

## Validação

- 185 testes aprovados em 32 arquivos, incluindo financeiro, componentes e política do ambiente de consulta. As falhas de identificação foram reproduzidas antes da correção; os casos de regressão usam exemplos fictícios.
- Oito verificações agrupadas com dados reais, em 1440 e 390 px: sete indicadores com composição completa; filtros da previsão acessíveis; cliente/parcela/busca e retorno documental; relatório/CSV restritos à obra. Sem erros de página e sem alteração da cópia em memória.
- Trinta regressões de navegador com dados fictícios e APIs interceptadas: dez da central de relatórios, dez da conferência com original e dez da continuidade. Incluem exportação CSV/Excel/PDF, paginação, contexto, leitura de PDF/imagem/XML, falhas de arquivo, confirmação explícita da ficha fiscal, retorno entre filtros/memorial/documentos e cenário de previsão preservado. As contagens não somam reruns.
- Lint, tipos e build local aprovados. Permanece o aviso conhecido de chunks grandes.

Os testes de navegação foram adaptados aos seletores de módulos/áreas no celular e à abertura explícita das seções recolhidas, preservando o layout operacional existente.

Evidências: `artifacts/financeiro/revisao-dados-reais.json`, `revisao-real-tests.json`, `revisao-real-tests.log`, `relatorios-browser.json`, `conferencia-original-browser.json`, `continuidade-browser.json`, `previsao-filtros-390.png` e `real-review-build.log`.

## Reprodução e limites

```powershell
node scripts/finance-real-data-audit.mjs
node scripts/finance-real-data-verify.mjs
```

Executar na raiz, com a configuração de servidor já existente em `.env.local` e o ambiente de revisão ativo na porta 4192. A auditoria imprime apenas estrutura, contagens e tipos de pendência. A jornada automatizada intercepta as APIs no próprio navegador; nenhuma confirmação financeira é encaminhada para a base real.

O servidor com login habitual continua em somente consulta. Foi reconfirmado: saúde 200, gravações financeiras desabilitadas e comando operacional recusado com 403. As correções de interface estão disponíveis nessa versão local.

Como não havia notas fiscais cadastradas na leitura, a conferência e edição fiscal com original foram revalidadas com registros fictícios. Não foi certificada a abertura de arquivos privados da Microsoft, cuja configuração local continua necessária. Nenhuma nota, anexo, pagamento, conciliação, apropriação ou previsão foi criada ou alterada na empresa.
