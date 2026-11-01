# Desligamento com acesso direto — 01/11/2026

Entrega local isolada em `C:/dev/releases/marcell-dismissal-local-20261101`, branch `codex/rh-direct-dismissal-20261101`, a partir de `23057ef1`. Sem push ou deploy. A prévia desta entrega é http://127.0.0.1:4257/, com os dados fictícios de `piloto@local.test` / `piloto-local`.

## O que estava dificultando

O usuário precisava abrir os detalhes da pessoa, ou abrir sua ficha, para encontrar Registrar desligamento. A presença de Ficha e Editar na mesma linha também deixava o destino do nome diferente do padrão recém-adotado na Gestão do ponto.

## Caminho entregue

Em Equipes, o funcionário ativo apresenta Desligar diretamente na linha/cartão, sem expandir Detalhes. O botão abre o formulário existente: informar Último dia trabalhado e Tipo de desligamento e usar Confirmar desligamento. Abrir ou cancelar não grava nada.

Agendamentos mostram Rever saída e reaproveitam data, tipo e observações. Desligados mostram Ver saída, que abre o cadastro com o resumo no início. As ações trabalhistas continuam disponíveis somente para RH e administradores. Engenharia mantém consulta, sem Desligar ou Rever saída.

O nome passa a abrir o cadastro para RH/administradores; outros perfis consultam o PDF. Ficha e Editar deixaram de disputar o mesmo espaço na linha. O PDF permanece dentro do cadastro em Ficha em PDF. Detalhes tem seu acionador próprio e conserva o acesso às demais consultas e ações já existentes.

A mesma navegação pelo nome foi aplicada no Ponto por obra. Data e obra usam o estado de sessão comum para preservar o recorte no retorno. Não foram reduzidos alvos de toque nem criadas variantes locais de botão. Os controles, estados e ícones existentes foram reutilizados; a inspeção visual corrigiu a referência ao ícone de expansão para uma chave suportada.

Cálculos, permissões de servidor, último dia inclusivo, histórico, ponto e pagamentos não foram reformulados. O caminho registra o desligamento no cadastro; não cria automaticamente cálculo de rescisão ou pagamento. Falha de gravação mantém o diálogo e o preenchimento para conferência e nova tentativa.

## Validação

- 538 testes aprovados em 69 arquivos de Pessoas, Ponto, ajuda, fluxo e design system.
- 20 cenários direcionados aprovados no desktop e celular: acesso direto, cancelamento, confirmação, agendamento, falha, acesso pelo nome, retorno com data e separação de perfis RH/admin/Engenharia.
- 52 cenários de regressão de cadastro, holerites, provisões, fechamento e atalhos do RH aprovados. Os testes passaram a abrir a ficha pelo nome, mantendo as verificações de campos, valores e persistência.
- 136 verificações de layout nas 65 abas aprovadas no build compilado em 4256. Capturas da linha/cartão com Desligar foram inspecionadas em 1440×1000 e 390×844.
- Lint, TypeScript, padrão e manual aprovados. Auditoria de importações sem ciclos.
- Build dentro do limite existente de 1.748 KiB gzip, sem aumentar o orçamento.

A API foi interceptada com dados sintéticos. Cancelamento não emitiu comando; confirmação aplicou o mesmo comando de funcionário do app; ponto e pagamentos permaneceram iguais. A captura de celular é emulação, não observação em aparelho físico.

## Ajuda, padrão e isolamento

Ajuda e manual atualizados na fonte única, com revisão em 01/11/2026: 98 guias cobrem 65 abas. O guia Equipes agora começa pelo botão Desligar e diferencia confirmação, agendamento e consulta.

Impeccable e shadcn orientaram a revisão. A mudança reutiliza RecordAction, Btn, o diálogo e os tokens existentes. Não há um tema ou controle visual exclusivo para este fluxo.

Durante a execução surgiram alterações independentes de Compras no checkout compartilhado. Elas não foram revertidas nem incluídas nesta entrega. O código de RH foi copiado para este worktree; a ajuda foi reconstruída da base com apenas os ajustes desta tarefa; os testes e o build foram repetidos isoladamente. A prévia em 4253 continua pertencendo ao checkout compartilhado. Evidências próprias estão em `artifacts/dismissal-direct/` deste worktree.

Os demais achados do rastreio de interface permanecem no relatório anterior. R05 (nome/ficha em Equipes) foi tratado; R06 recebeu o acesso pelo nome no Ponto por obra, mas sua reorganização dos sete controles de situação continua pendente.
