# Carregamentos internos compartilhados — 01/11/2026

Entrega local a partir de `eb97faa6`, na branch `codex/rh-direct-dismissal-20261101`, checkout `C:/dev/releases/marcell-dismissal-local-20261101`. Sem push, deploy, migração ou gravação em serviços reais. Prévia: http://127.0.0.1:4257/ (`piloto@local.test` / `piloto-local`).

## Receita comum

LoadingState é a receita de espera para áreas da ERP. Usa o Spinner já existente, os tokens de espaçamento/tipografia/cor e um atraso de 200 ms para o indicador e o anúncio. A moldura aparece imediatamente para manter a espera identificável pelos consumidores; não há porcentagem nem prazo de conclusão inventado.

O campo label recebe o assunto, como compras ou documento. O componente centraliza o texto Carregando [assunto]…. O temporizador é cancelado ao desmontar. Há um único status acessível por espera, sem marcar esse próprio status como ocupado e suprimir seu anúncio. Movimento reduzido continua atendido pelo Spinner comum.

O antigo LoadingState de FeedbackState passou a encaminhar para a mesma receita. Foram preservados os textos fornecidos por title e description. A ponte legacy/ui também expõe o componente para as telas antigas, sem duplicar implementação. A tabela compartilhada usa essa receita e mantém seus filtros e paginação.

## Escopo aplicado

Inventário de JSX antes/depois em `artifacts/dismissal-direct/loading-before.json` e `loading-after.json`:

- 73 usos de LoadingState em 21 arquivos operacionais.
- 57 dos 65 limites de carregamento sob demanda usam a receita, inclusive módulos principais e áreas internas da obra.
- As 16 consultas locais restantes cobrem tabelas, documentos/XML/PDF, pastas, bases de preços, consulta financeira administrativa, equipamento de referência, endereço e recursos do ponto.
- Ajuda usa somente o Spinner no cabeçalho compacto, mantendo o botão acionável para cancelar a abertura sem ocupar a tela com outra mensagem.

Áreas abrangidas: Compras, Financeiro/Conciliação, Folha/Rescisão, Equipes/Ponto, Obras, Orçamento, Planejamento, Equipamentos, Licenciamento, Arquivos, Comercial, Administração, relatórios e leitores de documentos.

O menu Mais do celular agora apresenta o diálogo comum durante a espera, com indicador, Escape e Fechar menu. O recebimento iniciado por Chegou na obra também possui confirmação fechável enquanto seu editor é preparado. Cancelar não grava nem reabre a área quando o código termina de chegar. O editor de fornecedor mantém sua moldura de diálogo.

A espera de um gráfico permanece dentro da área do gráfico. Resumo, filtros e ações continuam disponíveis. Leitores de PDF indicam a preparação junto ao documento; erros e a ação de tentar novamente continuam no fluxo existente. Nenhuma espera foi convertida em overlay global de consulta de fundo.

## Esperas preservadas com intenção

Os oito limites que não usam LoadingState não são oito falhas remanescentes:

1. Três rotas públicas (cliente, resposta de cotação e aceite de fornecedor) ficam fora do recorte interno desta entrega.
2. O status passivo de sessão/cronômetro de Projetos não representa uma ação aguardada e continua sem aviso transitório.
3. A imagem decorativa do login e o espaço reservado à navegação móvel mantêm suas molduras, sem anunciar conteúdo decorativo.
4. A entrada principal mantém a marca e o indicador já padronizados, com o mesmo atraso curto.
5. Ajuda usa o indicador compacto compartilhado descrito acima.

Os esqueletos de Banco de horas e Locações, as mensagens de última consulta/offline e os indicadores de ações em botões foram preservados. Eles têm contexto próprio e não devem substituir um relatório útil por uma nova tela de espera.

## Ajuda e manual

Revisada a orientação compartilhada Carregamento de telas: aguardar sem repetir ações, distinguir carregamento de confirmação de gravação e usar o fechamento disponível no diálogo. Os passos operacionais de cada módulo permanecem iguais; a alteração de apresentação não cria novos comandos ou regras.

Data de revisão 01/11/2026. `manual:generate` executado; 98 guias cobrem as 65 abas. O manual foi incluído na alteração.

## Validação

- 15 cenários de navegador aprovados em 1440×1000 e 390×844. O caso de menu móvel é omitido no desktop porque a barra não existe nesse tamanho.
- Os cenários aceitam URLs do servidor de desenvolvimento e chunks compilados, sem exigir build para o Playwright normal. Um caso de Compras também passou contra a prévia de desenvolvimento.
- Atrasos reais de download simulados nos chunks compilados: Folha, Rescisão, Compras, Planejamento, gráfico secundário, Ajuda, menu Mais e recebimento dentro da obra. Conferidos desaparecimento do indicador, cancelamento, foco, contexto, filtros e ausência de comandos de gravação nos cenários.
- 136 verificações de navegação/layout: catálogo de 65 telas nos dois tamanhos e verificações adicionais do cabeçalho/Compras, com tema MARCELL Operacional.
- 35 testes de código em 10 arquivos: atraso/limpeza do temporizador, anúncio único, compatibilidade dos textos, erro e nova tentativa do leitor, navegação móvel e tabela/padrões compartilhados.
- Lint, TypeScript, design:check, manual:check e diff sem erros. Grafo de importação sem ciclos.
- Build direto por Vite, sem prebuild de migrações. Bundle: 1.789.807 bytes gzip (1.747,86 KiB), dentro do teto existente de 1.789.952 bytes, sem ampliar limites.
- Prévia 4257 verificada no navegador em modo celular: login, Compras, Ajuda e Mais módulos, sem interceptar a API local e sem erros JavaScript.

As capturas de espera em módulo, gráfico, menu e recebimento foram inspecionadas. Os testes usam dados fictícios e API interceptada, salvo a checagem explícita da prévia local. O Planejamento mantém sua exportação automática de etapas do orçamento; o cenário que verifica ausência de gravações usa um plano sem orçamento para isolar a espera, sem modificar essa regra preexistente. Emulação não substitui uso em aparelho físico.

Evidências em `artifacts/dismissal-direct/loading-*`; não são incluídas no commit. Não foi executada a suíte inteira do repositório; os números acima correspondem às execuções concluídas.
