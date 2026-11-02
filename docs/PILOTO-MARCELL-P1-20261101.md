# Piloto MARCELL — P1: fundação visual

Data local: 01/11/2026. Checkout: `C:/dev/releases/marcell-precise-local-20261101`, branch local `codex/marcell-precise-local-20261101`. Base: publicação `963e5a39`, com documentação em `abc6d185`. Prévia com dados fictícios: http://127.0.0.1:4260/ (`piloto@local.test`, senha `piloto-local`). Tudo local, sem push, PR ou deploy. O checkout principal e a prévia anterior 4253 foram preservados.

## Resultado

- O tema `marcell` passa a se chamar MARCELL Preciso: lateral azul-marinho, conteúdo claro, azul para ações, dourado na marca. O código da logo é preservado, incluindo a versão adequada ao fundo escuro.
- Novos navegadores começam em MARCELL Preciso / Compacta. Preferências válidas já salvas são conservadas; Alterar aparência permite escolher a direção ou Restaurar padrão.
- IBM Plex Sans é a família operacional dos três temas. Pesos regulares 400, médio 500 e semibold 600 são arquivos locais oficiais da IBM, com licença e hashes em `public/fonts/ibm-plex`. Não há dependência de uma CDN de fontes. A escala compartilhada continua 24 px para página, 18 px para seção e 14 px para leitura de dados/controles, com números tabulares.
- Densidade reduz espaçamento, sem reduzir a fonte das tabelas. A área de toque dos controles móveis continua com mínimo de 44 px. Campos e botões conservam componentes e estados existentes.
- Exceções de fonte em títulos, cabeçalho e trechos legados do CSS foram conectadas ao token comum. Impressão e Modo TV preservam seus papéis próprios; o token de impressão tem prioridade explícita no CSS de print.
- O foco da navegação tem cor própria adequada ao fundo escuro. Ícones das áreas herdam a cor legível da navegação, evitando dourado decorativo e ícones apagados por cores antigas.
- Corrigido o seletor do rodapé da lateral: a alça ajustável adicionada anteriormente faz com que o rodapé deixe de ser o último filho. `last-of-type` mantém superfície e textos do rodapé no tema certo, inclusive após redimensionar.

## Crítica e correção

A primeira leitura do resultado encontrou títulos/cabeçalho com fonte antiga e o rodapé branco sobre a lateral escura. A correção foi na base compartilhada, sem versões por módulo. O teste novo supôs inicialmente que a Ajuda fosse um diálogo; a inspeção do componente confirmou seu painel complementar com popover. O teste passou a conferir a semântica real, sem mudar a Ajuda para satisfazer a suposição.

O scan tipográfico do Impeccable encontrou nove avisos legados, contra onze na base, sem novos avisos. Os remanescentes são dimensões já existentes em superfícies como entrada, fornecedor e TV; não foram ocultados, nem foi aumentada a baseline. A decisão da fonte veio da entrevista e da avaliação das funções tipográficas, antes do scan.

## Validação final

- 136 cenários no navegador aprovados: todas as 65 abas no desktop e celular, mais alinhamento de Compras, Planejamento e densidades. Rodada final executada após definir Compacta como padrão.
- Seis cenários específicos aprovados: tema, fonte carregada, identidade, controles móveis, troca de densidade preservando consulta e dados, Ajuda e retorno, Compras e Financeiro; seleção de tema conservada após recarga.
- 36 testes de código aprovados em sete arquivos para temas, Ajuda e navegação. O contrato de contraste foi ampliado para conferir o foco sobre o fundo da lateral e seus quatro testes passaram novamente.
- Quatro cenários adicionais: Compras e Financeiro em 320 px com carregamento de fontes bloqueado; ambos com texto a 200% em 1440 px. Sem overflow horizontal da página, com conteúdo e comandos disponíveis. `artifacts/stress.json` registra as condições.
- Lint, TypeScript, manual sincronizado e build aprovados. JS/CSS gzip final: 1.789.923 bytes; teto preservado: 1.789.952. Fontes locais somam 196.820 bytes antes de compressão/transporte e estão fora da métrica existente de JS/CSS, como os demais arquivos públicos de fonte. Nenhum arquivo foi retirado da medição.
- Ajuda de aparência atualizada e manual regenerado: 99 guias, cobertura das 65 abas.
- Evidências em `artifacts/foundation-browser`, `artifacts/whole-erp`, logs finais, scan e screenshots. Testes em Chromium com viewports emulados; não houve ensaio em aparelho físico nem Safari. Não se declara resultado de uso por operadores reais.

## Roadmap do piloto

| Etapa | Situação | Escopo |
| --- | --- | --- |
| P0 — pesquisa e decisões | Concluída | Referências, fluxos de construção, hierarquia, contrato de linguagem e critérios |
| P1 — fundação compartilhada | Concluída localmente | Paleta, fonte, densidade, navegação, estados e documentação |
| P2 — gestão à vista | Concluída localmente | Tabela/Kanban com mesmo recorte; Financeiro separado por direção e prazo, incluindo Depois e Sem vencimento |
| P3 — ficha e ação | Concluída localmente | Consulta lateral, ações curtas e retorno ao contexto; edição extensa em página própria |
| P4 — exceções e linguagem | Concluída localmente | Parciais, adiantamentos, permissões, falhas e escrita de negócio |
| P5 — revisão do piloto | Técnica local concluída; operadores pendentes | Jornadas completas, acessibilidade, desempenho, Ajuda/manual e avaliação final |

Avaliação visual interna provisória: 8,5/10. A fundação ganhou coerência e leitura; a meta 9,5 depende das jornadas de P2–P5 e de evidência de uso, não apenas de capturas de tela. Esta nota é uma apreciação de design, não uma medição com operadores.

P1 não altera transições de Compras, cálculos do Financeiro ou regras de permissão. A redução da complexidade do fluxo permanece explicitamente no roadmap. Como o bundle está próximo do teto, qualquer implementação subsequente precisa manter o gate e obter economia real de código/empacotamento quando necessário, sem aumentar o limite.

Atualização do roadmap em 01/11/2026: P2 concluída localmente; consultar `PILOTO-MARCELL-P2-20261101.md`. P3 foi concluída posteriormente; P4 é a próxima etapa. Ver `PILOTO-MARCELL-P3-20261101.md`.

Atualização acumulada em 01/11/2026: P4 concluída no piloto local; P5 é a próxima etapa. Ver `PILOTO-MARCELL-P4-20261101.md` para a avaliação conservadora 7,8/10 e os riscos ainda abertos.

Atualização em 02/11/2026: P5 implementada e validada tecnicamente em ambiente local. Aplicação com operadores preparada e ainda pendente. Nota crítica atual: 8,3/10. Ver [P5 e roteiro de 20 tarefas](PILOTO-MARCELL-P5-20261102.md). A meta 9,5 continua aberta; sem deploy.

Revisão adversa posterior em 02/11/2026: correções locais de identidade, memória e contexto; aplicação com operadores continua pendente. Avaliação crítica atual: **8,0/10**. Ver [revisão adversa da P5](PILOTO-MARCELL-P5-REVISAO-20261102.md). Sem deploy.

Continuação em 02/11/2026: retomada explícita da fila geral e proteção da resolução de conflitos concluídas no piloto local. Nota conservadora mantida em **8,0/10**. Persistência geral após recarga e aplicação com operadores continuam pendentes. Ver [retomada da fila e próximos passos](PILOTO-MARCELL-P5-FILA-20261102.md). Sem deploy.
