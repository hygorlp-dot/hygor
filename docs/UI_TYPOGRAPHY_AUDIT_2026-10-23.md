# Auditoria de tipografia e componentes — executivo claro

## Escopo e critérios

Refinamento da identidade aprovada em DESIGN.md. Auditoria no Chromium em 1440 × 950 e 390 × 950: 45 destinos da navegação, mais os modais de obra, funcionário e locação em cada largura (96 estados). APIs interceptadas com dados isolados; nenhum cadastro ou pagamento de teste enviado ao banco real.

Inspeção de estilos computados em títulos, campos, botões, rótulos, células, parágrafos, textos auxiliares e legendas SVG. Critérios: família IBM Plex, texto mínimo de 12 px, pesos até 600 e ausência de transbordamento horizontal da página. Tabelas extensas conservam rolagem dentro de seus contêineres. Inspeção visual adicional dos formulários e das páginas financeiras nas duas larguras.

## Divergências corrigidas

- Fornecedores e Ajustes ainda usavam Inter em campos isolados.
- Legendas de gráficos, contadores do ponto e elementos `small` herdavam tamanhos inferiores a 12 px.
- Títulos do modal legado variavam entre 16 px no desktop e 19,5 px no celular; agora usam 20 px e peso 600.
- A página Compras reduzia o título no celular. Cadastros apresentava título de página como título de cartão.
- Estilos locais e condicionais usavam pesos 700–900 e tamanhos fora da escala. Os componentes passam a consumir os mesmos tokens por função.
- Valores financeiros de folha, conciliação, terceiros e locações alternavam entre famílias; agora usam IBM Plex Sans com algarismos tabulares.
- Campos em celular mantêm 16 px e área de toque apropriada; a grade de orçamento mantém densidade no desktop com texto de controle de 14 px.
- Nomes na grade do ponto deixam de disputar largura com Ficha/Limpar. As ações de movimentação de terceiros permitem quebra de linha e altura automática no celular, sem cortar o texto.

Resultado da varredura final: 96 estados sem família divergente, texto abaixo de 12 px, peso superior a 600 ou transbordamento da página nos elementos inspecionados. Isso cobre os estados acessíveis no conjunto de dados de teste, sem afirmar que todos os possíveis conteúdos de produção foram reproduzidos.

## Exceções deliberadas

Identificadores como CPF, PIX, patrimônio e NSR podem usar IBM Plex Mono. O modo TV conserva títulos maiores para leitura à distância. O aplicativo de ponto em campo mantém seu design próprio. HTML de relatórios exportados preserva a fonte portátil e a paginação existente; os avisos `overused-font` do detector sobre Arial nesses documentos não representam deriva na interface.

## Regressão e preservação

Teste de navegador em desktop e celular verifica o título de Compras, família/tamanho dos campos de Fornecedores, título e campos do modal de obra e texto auxiliar/valor líquido da folha. O teste de densidade do orçamento mantém a proteção de altura de linha e tamanho de toque. A suíte existente cobre permissões, compras, conciliação, DRE anual, locações, cobrança e ponto.

Alterações restritas a apresentação e testes: nenhuma mudança de API, política de acesso, esquema ou regra de cálculo. Conferência de pagamentos e permissões é feita por leitura e comparação antes/depois do release; o movimento de R$ 7.160 continua pendente de confirmação da composição do aporte.
