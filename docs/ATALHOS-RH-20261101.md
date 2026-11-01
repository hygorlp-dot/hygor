# Atalhos do RH — 01/11/2026

Implementação local no checkout `C:/dev/releases/marcell-saas-release-20261101`, branch `codex/sap-operational-theme-20261101`. Sem push, deploy ou migração de banco. A produção não foi alterada.

## Problema e resultado

PayrollReadiness e seu cálculo já existiam, mas não eram montados pela Folha. Por isso, “Organizar pendências do RH” e “Pendências do RH” não estavam disponíveis, e os testes não conseguiam iniciar o percurso.

A Folha da quinzena voltou a oferecer Organizar pendências do RH. Pendências do RH também está em Áreas da folha, disponível para RH e administradores. O painel conduz ao cadastro, Gestão do ponto, fechamento por obra, holerite CLT ou folha por diária e provisões trabalhistas.

- Funcionário e competência permanecem na sessão ao abrir ajuda e navegar entre módulos. Voltar a Folha retoma as pendências.
- Cadastro abre a edição existente do funcionário. A leitura do contexto usa o mesmo adaptador de sessão que produz a seleção.
- Gestão do ponto recebe funcionário, grupo, obra e ciclo. A quinzena de 21 a 05 usa o mês de referência correto, inclusive ao atravessar dezembro/janeiro.
- Fechamento por obra recebe a data e a obra indicadas pela conferência; a restrição de obra do perfil continua sendo respeitada.
- Holerite abre o funcionário e o mês selecionados; provisões reaproveitam o valor salvo ou mostram uma estimativa ainda não salva.
- Trocar de área com edição pendente no holerite ou nas provisões exige confirmar o descarte. Cancelar preserva o preenchimento.
- Os atalhos não salvam cadastro, aprovam folha ou registram pagamentos. Testes bloqueiam escritas e conferem que o conjunto original de dados não foi alterado pela navegação.

O cálculo e os comandos existentes foram preservados. O fechamento da folha permanece sujeito aos bloqueios já existentes; o painel não transforma ausência de registro em falta nem estimativa em pagamento.

## Padrão visual de toda a ERP

O painel usa os componentes compartilhados de botões, campos, indicadores e navegação. Tipografia e espaçamentos consomem a escala central. Impeccable e shadcn orientaram a revisão sem introduzir biblioteca ou tema paralelo.

A inspeção renderizada identificou abas cortadas no desktop. A correção foi feita na receita FlowTabs, para todos os módulos: as abas quebram em linhas. O seletor de áreas no celular foi preservado. A regra de manutenção global está em AGENTS.md, DESIGN.md e docs/PADRAO-INTERFACE.md; não deve ser copiada como exceção visual por tela.

Os ícones foram consolidados no chunk de interface já compartilhado, evitando compressão separada de pequenos arquivos. Prefixos de chunks gerados passaram de oito para seis caracteres; hashes, rotas e nomes preservados continuam válidos. O resultado foi verificado no build compilado, não apenas no servidor de desenvolvimento. O limite do bundle não foi aumentado.

## Ajuda e manual

A fonte `src/features/help/help-content.js` foi revisada em 01/11/2026. A Folha orienta o acesso e o painel seleciona o guia específico `folha_pendencias` com useHelpTopic. O guia explica competência, destinos, retorno, quinzena entre meses e confirmação de descarte. Manual regenerado: 98 guias cobrem 65 abas.

## Verificação

- 538 testes de código aprovados em 69 arquivos de Pessoas, Ponto, Ponto eletrônico, ajuda, fluxo e design system.
- 12 cenários dos atalhos aprovados no desktop e celular, incluindo ajuda, contexto, quinzena entre anos, provisões salvas, rascunhos e exclusão do perfil financeiro.
- 40 cenários de regressão de cadastro, ponto, grupos, holerites, provisões, relatórios e fechamento aprovados.
- 136 verificações de layout aprovadas nas 65 abas, desktop e celular, após a alteração global das abas. Capturas do painel inspecionadas nos dois tamanhos; o teste verifica também que a navegação do desktop não exige rolagem horizontal.
- Lint, TypeScript, checagem do padrão e manual aprovados; auditoria sem ciclos de importação.
- Build local aprovado: JS/CSS 1.747,78 KiB gzip, abaixo do limite de 1.748 KiB.

As verificações de navegador usaram o build local compilado em 4255, com dados sintéticos e API interceptada. A prévia de desenvolvimento continua em http://127.0.0.1:4253/. Evidências em `artifacts/rh-shortcuts/`. Os testes emulam celular e não substituem observação em aparelho físico; não foram feitas operações em dados reais.
