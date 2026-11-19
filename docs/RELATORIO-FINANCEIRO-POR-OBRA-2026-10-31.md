# Financeiro completo por obra · primeira etapa

Implementação local em 31/10/2026. Acesso em **Financeiro → Gestão financeira → Relatórios financeiros → Visão dos relatórios → Financeiro completo por obra**. A central anterior continua disponível no mesmo seletor.

## Consulta

Selecione uma obra e aplique as competências inicial e final. O período aceita até dez anos. Enquanto os campos estão em edição, totais, memoriais e exportações mantêm o último período aplicado. Obra e apresentação seguem o estado de sessão já utilizado pelo financeiro.

Indicadores com memorial: custos reconhecidos, mão de obra própria e componentes, terceiros, receita reconhecida e resultado antes do rateio. A composição mostra categorias, etapas identificáveis e evolução mensal. Custos sem etapa permanecem separados; não há atribuição presumida.

O detalhamento reutiliza o memorial paginado, seus dados de origem, consulta de documentos e retorno à obra. Cada linha do razão entra uma vez, mesmo quando aparece na base de vários meses. Estornos preservam o sinal negativo.

## Mão de obra

O relatório usa o mesmo adaptador do DRE, sem calcular outro salário ou alterar parâmetros de encargos. A mão de obra própria soma as categorias reconhecidas de mão de obra, benefícios, encargos separados quando existentes e rescisões. Terceiros são apresentados separadamente e também há uma referência de mão de obra própria mais terceiros.

A memória mensal mostra mão de obra com encargos, benefícios e a parcela identificável de encargos já incorporada. A parcela incorporada não volta a ser somada. Arquivos históricos podem conservar totais sem abertura individual; a tela informa essa limitação. O relatório não inventa encargos, provisões, documentos ou composição por funcionário que não estejam disponíveis na fonte. A memória sintética do ponto é identificada como cálculo, não como nota fiscal.

## Bases distintas

- Custos e receitas seguem competência, inclusive documento emitido posteriormente.
- Entradas e saídas seguem data efetiva dentro dos meses selecionados; pagamento não vira novo custo.
- Pagamento direto do cliente aparece separado e não é incluído novamente no caixa da empresa.
- A pagar e a receber são posições acumuladas até o último dia da competência final. Podem divergir do custo do período, inclusive por emissão posterior.
- Movimentos do período não são chamados de saldo bancário; não há abertura presumida.
- Fonte é a base atual e seus arquivos de mão de obra carregados pelo ERP. O relatório não substitui snapshots históricos de fechamento.
- Administração central rateada, previsão revisada para concluir e prestação externa ao cliente pertencem às próximas etapas. Nenhum rateio ou acesso externo foi ativado.

## Exportações

CSV, Excel e impressão/PDF usam o mesmo objeto do relatório exibido. Incluem recorte, bases, resumo, categorias, composição mensal, custos, receitas, entradas, saídas, pagamentos diretos e títulos em aberto. Fórmulas em campos textuais são neutralizadas nas planilhas, e textos são escapados no HTML de impressão. O relatório é interno e mantém as permissões existentes da central.

## Validação

Suíte financeira: 306 testes aprovados em 56 arquivos. Casos específicos verificam encargos já incluídos, benefícios, isolamento por obra, documento com emissão posterior à competência, pagamentos diretos, estornos, deduplicação entre meses, rateio multietapa e exportação do mesmo recorte.

Jornadas do novo relatório em 1440 e 390 pixels verificam seleção da obra, memória de cálculo no memorial, treze meses sem duplicar a nota, CSV/PDF, Excel com células numéricas, mudança de obra, retorno de navegação e ausência de gravações. Capturas e valores são fictícios.

Conferência somente de leitura com obras reais CA1-06 e K1-02, agosto a outubro/2026: somas do memorial, categorias e competências conferiram com o total de custos; nenhum evento de outra obra apareceu. Sete leituras da base, zero gravações, zero acessos ao OneDrive, hash da cópia em memória preservado. Evidência privada em `C:/dev/marcell-local-review/relatorio-obra/VALIDACAO.json`.

O servidor local que mantém a sessão do OneDrive não foi reiniciado. Nenhum vínculo, documento ou dado financeiro foi alterado. Não houve push, branch remota, preview ou deployment.

Verificação final de navegador sobre o build estático local na porta 4197: duas jornadas do relatório novo e dez grupos de verificações da central anterior aprovados, sem erros. A porta separada evitou uma falha intermitente de importação do gráfico CubChart no dashboard inicial do servidor de desenvolvimento; o gráfico não foi alterado nesta etapa. A aplicação autenticada permaneceu na porta 4192. A prévia estática foi usada apenas para testes com dados fictícios e encerrada ao final.
