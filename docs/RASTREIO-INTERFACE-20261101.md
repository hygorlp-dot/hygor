# Rastreio de problemas semelhantes — 01/11/2026

Auditoria local do commit `41c373b2`, no checkout `C:/dev/releases/marcell-saas-release-20261101`. Não houve alteração no app, gravação em dados reais, push ou deploy. Ajuda e manual foram consultados; não foram modificados porque nenhum fluxo foi alterado nesta etapa.

## Escopo e evidências

- 65 telas abertas no build compilado local em 1440×1000 e 390×1000: 130 entradas verificadas. Tema MARCELL Operacional e perfil administrador sintético.
- Nenhum erro JavaScript ou overflow horizontal da página foi observado nessas entradas. Isso não certifica todos os diálogos, permissões ou operações do ERP.
- Oito reproduções direcionadas, desktop/celular, confirmaram os comportamentos de Rescisão, Equipes, Licenciamento e editor de fotos. Esses testes comprovam a existência dos achados; não significam que esses comportamentos estejam aprovados.
- Busca estrutural em JSX encontrou 61 candidatos a nomes/identificadores em botões e 20 controles com Limpar. Não são 81 defeitos. Seletores, calendário, ações com nome do registro e limpeza de filtros/seleção têm funções legítimas.
- O detector Impeccable registrou 34 avisos primários e 1.114 orientações. Sua leitura de fonte é heurística: fontes aprovadas, cores de documentos/impressão, gráficos e amostras de anotação exigem revisão contextual. Esses números não foram convertidos em quantidade de defeitos.

Evidências em `artifacts/similar-ui-audit/`: JSON de medidas por tela, candidatos de código, detector, capturas e reproduções. API interceptada; a foto de teste é um SVG cinza sintético. Emulação de celular e mouse não substituem uso em aparelho físico ou teste de gestos com toque.

## Prioridades confirmadas

### R01 — P1: seletores de cor sem cor no editor de fotos

Local: `src/domains/qualidade/components/ConferenciaView.jsx:193`.

Os cinco botões de cor aparecem com o mesmo fundo branco. Os valores medidos nos dois tamanhos foram `rgb(255, 255, 255)` para vermelho, dourado, azul, branco e preto. Nenhum informa seleção por aria-pressed. Clicar seleciona uma cor internamente, mas a interface não comunica qual foi escolhida.

Impacto: o operador precisa adivinhar a cor antes de desenhar. É uma exceção funcional que foi tratada como botão de comando genérico.

Correção recomendada: uma receita compartilhada para amostra de cor, com nome legível, amostra visível, seleção e foco. A cor da anotação é conteúdo do desenho; não deve ser substituída pela cor genérica do tema. Preservar os valores usados no canvas. Comando sugerido: `$impeccable harden`.

### R02 — P1: 17 botões de edição sem nome acessível no Licenciamento

Local: `src/domains/licenciamento/components/LicenciamentoView.jsx:147`.

O botão com lápis é gerado para cada exigência, sem texto, title ou aria-label. Playwright confirmou 17 botões com nome acessível vazio, tanto no desktop quanto no celular, no procedimento sintético usado. O contexto dos controles é Anexar documento; o callback abre a edição da exigência.

Impacto: leitor de tela não identifica o que será editado, e a ação visual não nomeia o registro.

Correção recomendada: nome como Editar exigência: [documento], tooltip e tamanho de ícone compartilhado. Resolver na receita do controle, não copiar 17 correções independentes. Comando: `$impeccable harden`.

### R03 — P1: editor de fotos fora da infraestrutura de diálogos

Local: `src/domains/qualidade/components/ConferenciaView.jsx:188`.

O editor usa divs fixas com overlay próprio. Ao pressionar Escape com foco na paleta, ele permaneceu aberto. A árvore acessível não apresentou role dialog para o editor. O código não reaproveita o controle de foco do Modal compartilhado.

Impacto: fechar e navegar pelo teclado difere do restante da ERP. O fundo desfocado não resolve semântica nem foco.

Correção recomendada: reutilizar a infraestrutura vigente de diálogo, foco, Escape, bloqueio do fundo e visualViewport, preservando canvas, zoom e anotação. Não criar um segundo sistema de modal. Comando: `$impeccable harden`.

### R04 — P2: Limpar apaga rascunhos sem confirmação ou recuperação

Locais: `src/domains/rh/components/RescisaoView.jsx:451` e `src/domains/qualidade/components/ConferenciaView.jsx:193`.

Na Rescisão, preencher Nome completo e clicar Limpar retorna o campo a vazio sem confirmação. Nenhuma gravação foi feita: perde-se o preenchimento, não um registro salvo. No editor de fotos, após desenhar, Limpar remove as anotações; Desfazer fica indisponível, não permitindo recuperar a limpeza. Também não houve confirmação nem gravação.

Correção recomendada: rótulos específicos — Limpar cálculo e Limpar anotações — e proteção quando existir rascunho, por confirmação ou restauração. Não aplicar confirmação à limpeza de filtros e não excluir controles úteis indiscriminadamente. Comando: `$impeccable harden`.

### R05 — P2: Equipes mantém três significados concorrentes para abrir a pessoa

Local: `src/domains/rh/components/EquipeView.jsx:440` e `:453`.

O nome expande a linha. Ficha gera PDF. Editar abre o cadastro, onde agora existe também Ficha em PDF. A reprodução confirmou a expansão e a ausência de diálogo ao clicar no nome.

Impacto: o operador encontra um comportamento diferente da Gestão do ponto, recém-simplificada. Ficha não é um botão sem função; seu nome é que não diferencia o PDF do cadastro.

Correção recomendada: nome como acesso principal ao cadastro/ficha conforme permissão, detalhes rápidos com acionador próprio se necessários, e PDF identificado explicitamente. Reduzir a repetição sem retirar acesso útil. Comando: `$impeccable distill`.

### R06 — P2: Ponto por obra ainda concentra sete ações por pessoa

Local: `src/LegacyApp.jsx:6606`.

O nome é um parágrafo sem acesso à ficha. Cada cartão expõe Presente, Meio dia, Falta, Férias, Atestado, Folga e Mais opções. Com os mesmos dados, os cartões mediram 199 px no desktop e 237 px no celular. A Gestão do ponto ficou em 58/81 px por linha; são tarefas diferentes, portanto a comparação indica densidade, não exige alturas idênticas.

Correção recomendada: aplicar o acesso pelo nome já usado no ponto geral; manter estados frequentes visíveis e agrupar exceções nas opções adicionais. Conservar alvos de toque e a velocidade do apontamento. Comando: `$impeccable distill`.

### R07 — P2: Equipamentos repete uma barra de cinco comandos em cada cartão

Local: `src/domains/equipamentos/components/EquipamentosView.jsx:949` e `:994`.

Cada equipamento apresenta Editar, Locar, Transferir, Manutenção e Excluir. Os cartões mediram 258 px no desktop e 379 px no celular. O nome do equipamento é texto; o acesso ao cadastro depende de Editar.

Impacto: o celular comporta poucos itens e o operador percorre várias ações repetidas antes de chegar ao próximo equipamento. Os cinco comandos têm funções distintas, portanto não devem ser simplesmente apagados.

Correção recomendada: nome abrindo a ficha, ação principal contextual e ações secundárias agrupadas; considerar lista compacta para operação recorrente. Preservar imagem e identificação quando ajudarem a distinguir os ativos. Comando: `$impeccable layout`.

### R08 — P2: estados de carregamento internos não seguem a entrada padronizada

Local exemplificativo: `src/LegacyApp.jsx:14760` e `:14761`.

A entrada principal foi corrigida. Diversas áreas internas ainda usam divs arcd-page-loading com textos isolados, como Carregando folha e Carregando rescisão; há também fallbacks vazios. Esses exemplos não usam a mesma semântica de status do Spinner compartilhado.

Correção recomendada: receita comum de espera para transições visíveis, com indicação acessível e atraso para evitar flash. Não inserir overlay em toda consulta de fundo, nem interromper uma tela útil enquanto um gráfico complementar carrega. Comando: `$impeccable polish`.

## Candidatos que exigem mais contexto

- Terceirizados: `toggleActive`, em `src/domains/terceirizados/components/TerceirosView.jsx:324`, alterna active e envia atualização; a ação fica entre vários comandos do contrato. A cena inicial não tinha contratos, então o fluxo não foi reproduzido. Conferir vínculo com obra, motivo e efeitos de inativação antes de redesenhar.
- Projetos e Arquivos: há nomes usando Button variant link. A presença de Button na fonte não prova peso visual indevido; várias ações estão corretas e sem duplicação. Migrar apenas quando a inspeção da composição demonstrar ganho.
- Avisos de nomes de fonte no detector: o padrão de fonte aprovado do projeto prevalece. Não trocar tipografia só para zerar uma regra heurística.

## Avaliação técnica do recorte

| Dimensão | 0–4 | Evidência principal |
|---|---:|---|
| Acessibilidade | 2 | Nomes ausentes no Licenciamento e editor fora do diálogo comum. Contraste integral não foi medido. |
| Desempenho | 3 | Build existente dentro do limite: 1.747,88 KiB gzip. Rede real e tempo até interação não foram medidos. |
| Temas | 2 | Há base comum; amostras de cor perderam sua representação ao usar aparência genérica. |
| Responsividade | 3 | 130 entradas sem overflow de página; repetição e altura ainda pesam no celular. |
| Integridade da implementação | 2 | Mesmo significado de registro/ação recebe composições diferentes. |
| Total indicativo | 12/20 | Recorte técnico com trabalho relevante pendente; não é nota global de design nem certificação WCAG. |

Não foi reproduzido bloqueio P0 nas entradas e percursos examinados. Os controles comuns, o retorno de contexto já implantado e a ausência de overflow de página devem ser preservados.

## Ordem de correção

1. `$impeccable harden`: R01–R03, paleta funcional, edição identificada e diálogo acessível.
2. `$impeccable harden`: R04, proteção dos rascunhos sem alterar os registros salvos.
3. `$impeccable distill`: R05–R06, acesso consistente à ficha e menos comandos por pessoa.
4. `$impeccable layout`: R07, densidade operacional de Equipamentos.
5. `$impeccable polish`: R08 e verificação final dos estados, temas, teclado e celular.

Os itens podem ser tratados em conjunto ou em outra ordem. Repetir `$impeccable audit` após as correções, incluindo os percursos afetados. Qualquer implementação deverá atualizar ajuda/manual e as receitas compartilhadas, mantendo as preferências do projeto.

## Atualização — acesso direto em Pessoas

R05 foi tratado na entrega `docs/DESLIGAMENTO-DIRETO-20261101.md`: o nome abre a ficha e Desligar fica na lista, sem expandir detalhes. R06 recebeu o acesso à ficha pelo nome no Ponto por obra; a reorganização dos demais controles do cartão continua pendente. Os outros achados não foram marcados como corrigidos.
