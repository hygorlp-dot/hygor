# Operação no celular e investigação da Frota em 18/11/2026

## Fluxos

- **Comunicação.** A busca continua consultando toda a fila. A primeira página no celular mostra até seis tarefas. Prioridades por engenheiro abrem em **Prioridades da equipe**.
- **Ponto por obra.** As obras que precisam de conferência abrem em **Obras com ponto pendente**. As marcações coletivas abrem em **Ações em lote**, junto da explicação do alcance. A busca e a paginação de até seis pessoas não restringem o lote.
- **Folha.** No celular, a busca da quinzena vem antes do vínculo com o DRE e dos detalhes secundários. Os totais abrem em **Indicadores da área**, e a lista mostra até seis pessoas por página. Os alertas da quinzena e o fechamento continuam acessíveis.
- **Homologação.** **Ver diferenças desta projeção** reúne os campos do mesmo identificador de projeção do DRE. O filtro mostra obra, competência e período. Projeções de quinzena e de mês completo são tratadas separadamente. **Limpar filtro de projeção** retorna às demais diferenças do grupo.

## Frota

O cálculo reconstruía os eventos de indisponibilidade em chamadas sucessivas por dia e equipamento, incluindo telas que não exibiam o resumo mensal. A tela agora reutiliza eventos indexados por equipamento e calcula o pico mensal apenas quando exibe o indicador.

Em um ensaio de 24 equipamentos, 1.200 locações fictícias e 30 dias, o mesmo cálculo levou 1.090 ms pela rota anterior e 91 ms com eventos indexados, com totais idênticos para todos os dias. O teste de navegador percorreu três saídas da Frota para Comercial e retornou pela Central de locações, sem erro de página ou gravação. A instabilidade observada na aba nativa não foi reproduzida localmente, inclusive no build anterior com o mesmo cenário. A origem do incidente permanece sem confirmação.

## Origem, DRE e validação

A Comunicação continua lendo as pendências de Conferência. Ponto e Folha consultam os mesmos registros de origem, e a busca não muda os totais nem a base dos lotes. A Homologação agrupa a leitura pela referência existente, sem corrigir diferenças, executar carga ou registrar conclusão. A otimização da Frota preserva a disponibilidade produzida pelos mesmos eventos. Essas alterações não geram previsão, compromisso, entrada de estoque, custo reconhecido, pagamento ou novo lançamento no DRE.

A validação local usou dados fictícios e APIs interceptadas. Passaram 19 cenários de navegador no build, distribuídos entre 320, 390 e 1440 px, e 26 testes unitários. Lint, tipos, manual, padrão de interface, análise de ciclos e orçamento do bundle passaram. A ajuda contextual e o manual foram atualizados. Nenhuma versão foi publicada.
