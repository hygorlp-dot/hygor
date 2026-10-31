# Contexto entre módulos e compras do planejamento

Implementação local de 31/10/2026, conforme as três prioridades aprovadas após a [comparação com o Vobi](REFINAMENTO-VISUAL-E-FLUXOS-VOBI.md).

## Contexto durante a sessão

Orçamento, Planejamento, Compras, Financeiro e DREs conservam suas seleções de trabalho durante a navegação. Busca, filtros, áreas internas, orçamento aberto, memória de cálculo, competência e zoom são mantidos conforme o módulo. A posição de rolagem também é restaurada. A tela interna da obra conserva seu grupo e módulo; a navegação móvel volta à última tela daquele módulo, incluindo a obra aberta.

Atalhos entre módulos levam a obra e, quando disponível, a competência de origem. Um botão “Voltar a…” permite retornar ao contexto anterior. O destino continua sujeito às abas autorizadas; o vínculo fixo do usuário com sua obra prevalece sobre o recorte transmitido.

O estado de apresentação fica em memória, separado dos dados operacionais. Recarregar ou encerrar a sessão não promete recuperar esses filtros. A troca de usuário limpa o contexto. Formulários financeiros e comandos pendentes não são gravados por esse mecanismo.

Implementação: `src/features/workflow/workspace-session.jsx`, contexto de workflow e navegação central em `src/LegacyApp.jsx`.

## Próxima ação perto do registro

O cabeçalho da análise de cada cotação apresenta “Decidir e gerar pedidos” junto ao código e ao contexto da compra. A ação abre a revisão existente, respeitando o perfil e a situação da cotação. A mesma ação permanece ao final da análise para consultas longas. Abrir a revisão não aprova nem emite pedidos.

O comparativo usa uma coluna de conteúdo que pode encolher; tabelas mantêm rolagem própria. O botão de decisão cabe na largura de 320 px, sem exigir rolagem horizontal do painel inteiro.

## Planejamento → necessidade → solicitação

No Planejamento, “Materiais e compras” abre o contexto da etapa. O mesmo acesso aparece ao consultar uma atividade. O painel apresenta os materiais vinculados, o total de referência da etapa, estoque livre na obra e pedidos com entrega pendente. Ao abrir pelo botão, o foco e a rolagem vão para o painel.

“Preparar solicitação em Compras” leva os materiais, obra, apropriações e primeira data de necessidade da etapa para o formulário existente. O formulário mantém visíveis sua origem e os quantitativos de referência.

As quantidades de compra exigem confirmação: o orçamento representa a etapa inteira, enquanto estoque e pedidos podem atender outras etapas. Nenhuma alocação é inferida nem descontada automaticamente. A solicitação só é enviada depois de preencher as quantidades e formalizar pelo comando existente.

Regras de vínculo:

- Associação por identidade do material ou código cadastral único; sem correspondência por semelhança de descrição.
- Unidade incompatível, material inativo e linha sem detalhamento ficam sinalizados. Somente os materiais confirmados entram no formulário; a exclusão de linhas pendentes é informada no painel e na origem da solicitação.
- O orçamento e a tarefa são novamente consultados ao abrir Compras. Uma origem com orçamento substituído exige revisão.
- Orçamentos em rascunho continuam preliminares; essa navegação não os aprova nem muda sua utilização no DRE.
- A origem guarda plano, tarefa, etapa, orçamento e data. Trocar a obra do formulário remove esse vínculo e as apropriações incompatíveis.
- Uma solicitação já vinculada à etapa é oferecida para consulta, evitando preparar outra inadvertidamente. O formulário normal de Compras continua disponível para demandas adicionais.

Foi corrigido também o quantitativo de um material diretamente vinculado ao item do orçamento: o coeficiente é 1; a quantidade do item não deve ser multiplicada por ela mesma. Composições analíticas mantêm seus próprios coeficientes.

## Evidências

- 109 testes relevantes aprovados: contexto de sessão e isolamento entre obras, demanda por identidade/unidade, rascunhos, pedidos existentes, solicitações e seus comandos, orçamento, cotações, workflow e DRE.
- Fluxos completos no navegador em 1440, 390 e 320 px, com revisão de quantidades, gravação simulada pelo comando real, volta ao cronograma e reabertura da solicitação vinculada.
- Preservação verificada de busca em Compras, Documentos no Financeiro, Memória de Cálculo no Orçamento, zoom e rolagem real no Planejamento; troca entre duas obras e retorno à tela interna da obra pela navegação móvel.
- 47 rotas operacionais percorridas em desktop e celular, em 102 capturas incluindo os quatro módulos principais. Sem erros JavaScript, extravasamento horizontal da página ou títulos principais ausentes.
- Lint, TypeScript e build Vite local aprovados. O aviso de tamanho dos chunks permanece.
- Detector Impeccable sem ocorrências nos novos componentes e no tema operacional.

Artefatos: `artifacts/workflow-priorities/` e `artifacts/rebranding-app/workflow-regression/`. Os testes de navegador usam dados fictícios e APIs isoladas. Não verificam integrações de produção.

## Revisar localmente

http://127.0.0.1:4198 · `piloto@local.test` · senha `piloto-local`.

Abra Planejamento → Materiais e compras → Estrutura → Preparar solicitação em Compras. Confira a data, a quantidade de referência e a volta à origem. A prévia possui exemplos fictícios; as alterações ficam no processo local.

Nenhum push, PR, deploy ou migração de banco foi executado.
