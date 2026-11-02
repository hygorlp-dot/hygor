# Migração do legado — Obras, Orçamento, Planejamento e Pessoas

Entrega local de 01/11/2026 no checkout `C:/dev/releases/marcell-saas-release-20261101`, branch `codex/sap-operational-theme-20261101`. Prévia: http://127.0.0.1:4253/. Sem push, deploy ou migração de banco.

## Escopo e padrão

Obras e detalhes da obra, contratos/aditivos, diário, orçamento e memória de cálculo, planejamento, equipes, ponto geral e por obra, folha, holerites, provisões, rescisões, indicadores, ponto eletrônico, banco de horas e terceiros receberam controles e tokens comuns. Foram incluídos os apoios de Projetos, Arquivos, Conferência e Licenciamento necessários a esses fluxos.

Impeccable e shadcn orientaram a composição e a inspeção. A arquitetura e os componentes existentes foram preservados, sem instalar outra biblioteca. Comandos usam Button; registros, indicadores e situações da tabela usam RecordAction. Input, SelectControl, TextareaControl e ChoiceControl substituem controles próprios, conservando referências, eventos, validações e rótulos.

A baseline diminuiu em 2.797 ocorrências diretas. Não há achados diretos do verificador nos arquivos operacionais migrados dos domínios acima, excluindo TV; no arquivo principal, a migração se limita às funções das áreas indicadas. O verificador não interpreta todo CSS, estilos indiretos ou semântica. Ainda existe legado em outras áreas: isto não representa adesão integral de todo o ERP.

## Ajustes de composição e interação

- Tipografia, peso, entrelinha e espaçamentos usam a escala central; cores de apresentação passam a papéis do tema. Os dados e as fórmulas não foram reescritos.
- A grade do orçamento consome `--arcd-sheet-*` em foundations.js. Descrições longas crescem; Escape descarta a edição ainda não confirmada. Comandos conservam o alvo comum e, no celular, a grade tem rolagem interna.
- O botão de mais ações da etapa usa o tamanho de ícone compartilhado. O desenho não fica comprimido pelo padding de um botão de texto; o menu foi aberto pelo teste no desktop e celular.
- Situações do ponto mantêm preenchimento semântico e texto inverso. Presente, Meio dia e Falta não viram botões genéricos. A troca de obra e os estados de indisponibilidade conservam suas ações.
- A busca de Obras tem uma única borda no campo e deixa de permanecer fixa sobre o conteúdo no celular.
- Arquivos do diário, importações, câmera/galeria, conferência e prontuário usam seletores acionáveis por teclado. FilePicker aceita `inputProps`, conservando captura de câmera, múltiplos arquivos, rótulos e reinicialização.
- Engenheiros e mestres continuam no Administrativo. Trocar o grupo de consulta não altera lotação nem histórico. Cálculos, permissões, comandos e resultados financeiros foram preservados.

Impressão e modo TV permanecem com receitas próprias; não devem ser copiados como padrão de uma nova tela operacional. Emulação de celular não substitui teste em aparelho real.

## Ajuda e manual

A fonte `src/features/help/help-content.js` foi revisada em 01/11/2026. O guia de interface explica importação de planilha/PDF, seleção de áudio/anexo/câmera no diário, prontuário e edição de descrições do orçamento. Os nomes usados correspondem aos controles. Escolher um arquivo não é apresentado como confirmação automática.

Manual regenerado da fonte única: 97 guias cobrem 65 abas. Mudanças apenas visuais de espaçamento, foco e ícone não mudam os passos da operação; isso foi considerado na revisão humana. A ajuda continua preservando grupo, filtros e contexto.

## Verificação local

- 1.112 testes passaram em 141 arquivos dos domínios envolvidos, design system, ajuda e fluxo.
- 136 verificações de layout passaram nas 65 abas, desktop e celular, incluindo alinhamento do cabeçalho, reflow e ausência de overflow da página. As capturas das áreas migradas foram inspecionadas; busca de Obras e menu do orçamento foram corrigidos nessa revisão.
- 2 cenários adicionais de separação Administrativo/Pessoal de obra passaram após atualizar os nomes das abas no teste antigo, conservando as verificações de lotação e histórico.
- 84 cenários de fluxo passaram em desktop e celular: orçamento/PDF/aprovação, projetos/cronômetro/revisões, grupos e ajuda, cadastro, prontuário, holerites, provisões, simulação, fechamento e relatórios; também regressões das receitas comuns em Financeiro/Compras.
- 14 cenários de Arquivos passaram no simulador próprio: upload, histórico, ZIP incompleto, permissões, PDF, comparação, acesso negado e reenvio.
- 2 cenários da conferência de batidas passaram no ambiente específico da página isolada.
- A edição longa/Escape e o menu do orçamento foram repetidos após o refinamento do ícone: 2 cenários aprovados.
- Lint, TypeScript e checagem do manual/padrão aprovados. Build local via `npx vite build`; JS/CSS 1.747,80 KiB gzip, abaixo do teto de 1.748 KiB, sem aumentar o limite.

A primeira execução ampla misturou cenários que exigiam servidores diferentes. Arquivos e conferência foram executados novamente nos ambientes corretos. Testes antigos de Projetos ainda pressupunham a lista, embora o padrão atual seja Kanban; passaram após selecionar explicitamente a lista, sem retirar as verificações de persistência, permissões e cronômetro.

Os testes antigos de RH em `e2e/rh-readiness.spec.js` procuram “Organizar pendências do RH”/“Pendências do RH”, controles ausentes na versão anterior e nesta entrega. A ausência foi reproduzida no commit-base f3e16e62, em checkout isolado. Esses testes não entram na contagem aprovada; revisar sua finalidade ou restabelecer o recurso exige uma decisão de fluxo separada. Não foram marcados como aprovados nem removidos. A conferência atual da folha e seus bloqueios permanecem cobertos pelos cenários aprovados.

Evidências locais: `artifacts/workforce-migration/`, incluindo logs de testes, build, orçamento de bundle, comparação com a base e capturas. Artefatos de teste não fazem parte do código publicado.

## Atualização — pendência do RH resolvida

Os atalhos e sua ligação com os registros foram restabelecidos na entrega local descrita em `docs/ATALHOS-RH-20261101.md`. Os testes de RH anteriormente pendentes agora passaram no desktop e celular, com cobertura adicional de retorno, competência e rascunhos. O diagnóstico acima permanece como registro do estado anterior.
