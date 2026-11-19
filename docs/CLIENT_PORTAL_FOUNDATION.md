# Portal do cliente MARCELL — implementação local

Revisão: 14/11/2026. Trabalho mantido no checkout local, sem push, PR, deployment, DNS ou migração no banco de produção.

## Entrada e domínio

- Endereço público preparado: `https://portaldocliente.marcelleng.com.br/`.
- O hostname exato abre o portal em vez do ERP. A raiz serve a tela de login; uma sessão válida permite retomar a obra vinculada.
- No domínio do ERP e no ambiente local, a entrada continua em `/cliente`.
- O domínio ainda precisa ser associado à hospedagem e receber a configuração DNS correspondente, depois da autorização de publicação. Nenhuma configuração pública foi feita nesta entrega.
- O portal exige sessão individual; parâmetros de token compartilhado não contornam seu login. O portal legado continua separado por compatibilidade.

## Experiência implementada

| Área | Origem e comportamento |
| --- | --- |
| Início | Posição do contrato, percentual acumulado, quinzena a pagar, mão de obra até a consulta e avanço físico |
| Diário da obra | Todos os RDOs concluídos e liberados, por dia; relatos, clima, serviços e fotos do registro; sem limite silencioso de 12 diários/24 fotos |
| Avanço físico | Medição técnica confirmada pela regra oficial do ERP; depois medição percentual de cobrança; sem ambas, cronograma ponderado |
| Gastos por categoria | Mesmo razão e motor de custos do ERP; custo reconhecido e pagamento separados; mão de obra e benefícios agregados sem funcionários ou salários individuais |
| Caixa da obra | Aportes, despesas e saldo atuais do caixa físico/operacional da obra; não é saldo bancário da empresa |
| Previsto e realizado | Orçamento de controle aprovado e custos por etapa; valores sem vínculo continuam em Sem apropriação; base ausente não vira zero |
| Compras e notas fiscais | Todos os pedidos ativos realizados; itens, unidades e entregas; notas vinculadas por ID e anexos autorizados |
| Documentos, contrato e conta | Consultas complementares existentes, documentos avulsos, decisões informativas e troca de senha |

As abas compartilham o padrão MARCELL, os controles e os tokens existentes. Desktop usa a navegação compartilhada; celular usa o seletor das mesmas áreas. URLs, recarga e Voltar do navegador preservam o destino. A Ajuda contextual usa a fonte única `src/features/help/help-content.js`; o manual foi regenerado.

## Login e senha pela administração

Em **Central do Administrador → Acessos de clientes**, escolher a obra, informar e-mail, telefone opcional, perfil e senha. Após salvar, Copiar convite do cliente permite copiar as credenciais transitórias. Não há envio automático de e-mail nem cadastro público.

O mesmo e-mail representa uma conta entre obras. Redefinir a senha encerra todas as sessões dessa conta. Revogar acesso encerra o vínculo da obra escolhida e as sessões; o servidor revalida cada acesso. Senha é armazenada por hash scrypt; sessão usa cookie HttpOnly com duração de 12 horas e Secure em produção. Falhas de autenticação usam resposta genérica e limitação de tentativas em memória da instância. A senha do convite não é persistida como preferência do navegador.

A liberação de conteúdo permanece em **Obra → Portal do cliente**. Ativar, selecionar Diários e fotos e as áreas desejadas, aguardar o salvamento, usar Atualizar dados publicados, conferir e confirmar. Criar login não publica dados automaticamente. Desativar acesso arquiva a publicação; reativar exige publicar novamente.

A política publicada autoriza consultas atuais de diários, caixa, categorias, orçamento por etapa, compras, notas e posição do contrato. Resumo institucional e documentos avulsos continuam editoriais. As permissões do usuário também são exigidas em todas as consultas e na abertura de originais.

## Contrato e mão de obra

- Percentual acumulado: última medição percentual emitida da obra até a competência/data da consulta, sem rascunhos e cancelamentos.
- Valor correspondente: contrato vigente × percentual acumulado. É uma referência explícita, não uma nova cobrança.
- Quinzena a pagar: saldo das parcelas emitidas para o primeiro vencimento em aberto, descontados os recebimentos até a consulta. A tela mostra vencimento e valores emitidos/recebidos. Não se deduz cobrança a partir de uma foto, do avanço físico ou do custo da equipe. Datas de vencimento vêm das medições do contrato, sem presumir os ciclos do RH.
- Mão de obra própria e benefícios: mesmo motor do ERP, com os dias limitados à data atual em America/Bahia. Inclui encargos, provisões e feriados conforme as regras existentes; presenças futuras não são antecipadas. Esse corte é opcional e exclusivo da leitura do portal: os cálculos mensais existentes do DRE não foram alterados.

## Rastreabilidade e impacto no DRE

`client-portal-source.js` reconstrói, somente no servidor, o núcleo, as linhas de domínio, o ponto por obra e os arquivos históricos pelas mesmas funções existentes. A leitura não compacta nem migra dados. `buildAccumulatedWorkLedger` reaproveita o motor do DRE e os eventos canônicos; `workStageCosts` fornece a apropriação por etapa e a baseline de controle. Ausência de histórico ou de classificação suficiente impede apresentar um realizado completo.

| Fato | Tratamento no portal | Efeito adicional no resultado realizado |
| --- | --- | --- |
| Orçamento | Previsão aprovada, por etapa | Nenhum |
| Pedido | Compromisso e andamento da compra | Nenhum |
| Recebimento físico | Quantidade entregue/estoque | Nenhum |
| Nota/medição/ponto | Custo reconhecido pelo motor existente | Nenhum: apenas consulta o mesmo custo |
| Pagamento | Baixa e saída registradas, separadas do custo | Nenhum: não reconhece custo outra vez |
| Aporte | Recurso disponibilizado ao caixa | Nenhum: não vira receita por esta leitura |
| Publicação, acesso, senha e auditoria | Tabelas exclusivas do portal | Nenhum |

A evidência é o uso dos seletores existentes e a ausência de gravação financeira nas funções do portal. Os testes usam uma compra de R$ 1.000, nota da mesma compra e pagamento/espelho do caixa: o custo permanece R$ 1.000 e o pagamento R$ 600, sem duplicar. Outra despesa de R$ 200 totaliza custo reconhecido de R$ 1.200. Um aporte adicional altera somente o saldo do caixa.

A projeção enviada ao cliente permite campos explicitamente listados. Não entrega razão bruto, salário individual, CPF, PIX, banco, margem, comentários internos, credenciais nem referências privadas do OneDrive. Notas usam o vínculo `pedidoId`, nunca aproximação por fornecedor/valor. Fotos usam o ID do diário de origem. Os originais protegidos são resolvidos no servidor após conferir sessão, perfil, obra e registro; o cliente não escolhe drive/item arbitrários. URLs com protocolos executáveis são descartadas.

## Migrações e publicação posterior

1. Conferir se `migrations/005_client_portal_foundation.up.sql` já foi homologada/aplicada.
2. Homologar e aplicar `migrations/20261114125534_client_portal_atomic_publication.up.sql` no momento autorizado.
3. A segunda migração adiciona funções invoker restritas a service_role, com publicação, provisionamento, revogação e auditoria atômicos; a troca de senha revoga as sessões na mesma transação. Não altera tabelas financeiras.
4. Associar o domínio à hospedagem, configurar o DNS indicado pelo provedor e conferir o certificado. Não presumir um registro DNS sem consultar a configuração real naquele momento.
5. Cadastrar os acessos reais e liberar as obras, conferindo cada perfil antes de compartilhar.

## Validação local e como reproduzir

- `npx vitest run api/client.test.js server/client-portal-*.test.js src/client-portal/tests` (no PowerShell, prefira listar os arquivos ou passar os caminhos individuais).
- `npx playwright test --config playwright.client-portal.config.mjs`: quatro testes completos com APIs reais e PostgreSQL em memória; desktop 1440×1000, celular 390×844 gestão administrativa e troca de senha. Sem chamadas ao banco de produção.
- `npm run lint`, `npx tsc --noEmit -p tsconfig.quality.json`, `npx vite build`, `npm run manual:check`.
- Detector Impeccable nos componentes revisados: nenhuma ocorrência. Baseline do design não foi aumentada.
- Build mantém os avisos existentes de ExcelJS/fs e chunk do LegacyApp; não usa o prebuild com migrações.

Para revisão visual, executar `node scripts/client-portal-local-server.mjs` e abrir `http://127.0.0.1:4197/cliente`. Cenário inteiramente fictício: `cliente@example.test` / `ClienteLocal1234`. A gestão administrativa pode ser revisada em `http://127.0.0.1:4197/__portal_review_admin`; é uma rota exclusiva desse servidor de teste, não integra o produto publicado. Reiniciar o servidor reinicia o banco em memória.

Capturas da execução do Playwright ficam em `artifacts/client-portal-overview-1440.png`, `artifacts/client-portal-overview-390.png` e nas capturas de compras. Os diários do cenário usam a marca como imagem de teste, sem simular fotografias reais de uma obra.

Figma: foi criado o arquivo `https://www.figma.com/design/RCWVCafXMdM8Y7npav85rc`, mas o limite de chamadas do plano Starter bloqueou a busca de componentes antes do desenho. O arquivo permanece sem as telas. A implementação e a revisão visual local seguiram Impeccable, shadcn e o padrão MARCELL; não se declara uma entrega de design no Figma.


## Ajustes após a crítica visual — 14/11/2026

A abertura destaca avanço físico, fase, previsão e atualização, com Ver diário e fotos. A posição contratual e os custos permanecem na sequência; o percentual contratual é explicado separadamente do avanço físico. Navegação agrupada em Evolução da obra e Custos e compras, preservando abas e permissões.

A galeria usa imagens inteiras com contenção, uma coluna no celular e miniaturas limitadas no computador. O diálogo compartilhado recebeu a opção media, com largura definida na fundação comum e acesso ao original. Diários e compras indicam Abrir/Recolher; o relato não se repete no cabeçalho. O grupo de notas avulsas aparece somente quando possui registros. Etapa ainda não informada apresenta o identificador unassigned, sem mudar o código ou o nome persistido da etapa. Textos auxiliares usam a escala comum; a marca existente identifica o cabeçalho.

Impacto no DRE: nenhum. As alterações são de apresentação, navegação e ajuda; não alteram fontes, projeções, valores, vínculos, custos, pagamentos ou permissões. Nenhum dado financeiro é gravado por esses controles. A indicação de etapa usa o identificador da origem, sem inferência por nomes semelhantes.


Validação deste ajuste: cinco cenários Playwright aprovados, com navegação em 1440×1000 e 390×844, cadastro/revogação e troca de senha, além de imagens verticais (600×1200) e horizontais (1600×900) em 390, 768 e 1440 px. Os desenhos geométricos são apenas instrumentos do teste de proporção, não fotografias de obra. As capturas da prévia mantêm a marca como imagem demonstrativa. Doze testes unitários do portal aprovados; lint, design:check, manual:check, TypeScript e build local aprovados. O detector estático Impeccable retornou zero ocorrências; revisão visual conferiu início e diário no computador e celular. Avisos existentes do build sobre ExcelJS/fs e chunk grande permanecem. Sem publicação ou migração remota.
