# Instruções do projeto

## Alterações de interface

Antes de qualquer alteração na interface, consulte e aplique em conjunto as skills **impeccable** e **shadcn**, respeitando os padrões existentes do projeto.

- Leia as instruções da skill `impeccable` antes de planejar ou implementar a alteração.
- Consulte também a skill `shadcn`, quando disponível. Se ela não estiver instalada, consulte a documentação oficial do shadcn/ui e a configuração local em `components.json` antes de implementar.
- Use as orientações de ambas em conjunto para criar, modificar ou revisar componentes, páginas, estilos, layouts e interações.

Além de `impeccable` e `shadcn`, consulte e aplique as skills abaixo quando forem relevantes à alteração de interface, antes de planejar ou implementar:

- **Figma:** use as skills correspondentes ao trabalho quando houver designs, arquivos, componentes, tokens ou referências do Figma, ou quando for necessário criar, sincronizar ou implementar designs via Figma MCP. Respeite os pré-requisitos das skills para cada ferramenta do MCP.
- **Material 3:** consulte `material-design-3-expert` quando a interface adotar ou precisar ser revisada segundo Material Design 3, incluindo cores, tipografia, componentes, layouts adaptativos, estados e movimento.
- **Expo:** consulte as skills pertinentes do plugin Expo quando a alteração envolver interfaces Expo/React Native, navegação, componentes nativos ou adaptação da experiência entre web, Android e iOS.

Combine as orientações relevantes com `impeccable` e `shadcn`, preservando a arquitetura e o sistema de design existentes. A consulta a essas skills não implica migrar a interface para Material 3, Expo ou outra biblioteca sem que isso faça parte do escopo solicitado.

Esta regra se aplica a todo o projeto, inclusive aos subdiretórios.

## Padrão obrigatório para novas interfaces

- Toda nova introdução no ERP deve obedecer a `docs/PADRAO-INTERFACE.md`, além de `DESIGN.md`. Esta exigência inclui textos, botões, dimensões, espaçamentos, componentes, telas e fluxos.
- Ajustar a escala comum em `src/design-system/foundations.js`, diferenças de tema em `themes/themeRegistry.js`, densidade e espaçamento nos tokens existentes. Reutilizar padrões e controles compartilhados; não criar estilos próprios para contornar a base.
- Linguagem genérica compartilhada usa `src/design-system/copy.js`; textos específicos pertencem ao domínio. Não alterar dados, códigos ou status persistidos como se fossem rótulos visuais.
- Mudanças de linguagem visual devem ser feitas na base compartilhada e valer para toda a ERP: textos genéricos, botões, campos, tipografia, cores e espaçamentos não recebem versões próprias por módulo. Composições específicas podem organizar o fluxo, sempre consumindo a mesma base. Verificar os efeitos em telas representativas no desktop e celular.
- Executar `npm run design:check`, também integrado ao lint. Não aumentar nem regenerar `scripts/design-system-baseline.json` para liberar novas exceções. O legado registrado não autoriza repetir seus desvios.
- Revisão visual e de interação em desktop/celular continua obrigatória; a checagem automática é parcial. Exceções novas exigem justificativa e aprovação explícita do usuário.

## Ajuda contextual e manual obrigatório

- Toda alteração no app deve incluir revisão da ajuda e do manual. Quando mudar um fluxo, botão, filtro, regra, permissão ou resultado apresentado ao usuário, atualize a orientação correspondente na mesma alteração.
- A fonte única é `src/features/help/help-content.js`. Escreva em português simples para quem nunca usou um ERP: finalidade, o que preparar, passos em ordem, resultado esperado e cuidados. Use os nomes reais dos controles; explique siglas e não prometa funções que a tela não oferece.
- Toda aba deve ter um guia específico e manter o botão Ajuda no cabeçalho compartilhado. Novas áreas internas com fluxo próprio precisam selecionar sua ajuda contextual com `useHelpTopic` e ter seu guia incluído no manual.
- Após revisar o conteúdo, atualize a data de revisão e execute `npm run manual:generate`. Inclua `docs/MANUAL_DO_APP.md` na alteração. `npm run manual:check`, também incluído no lint, verifica cobertura de abas e sincronização do arquivo com a ajuda.
- O verificador não substitui revisão humana do conteúdo: registre na validação quando uma mudança técnica não exigir alteração de instruções ao usuário.
- Preserve o contexto, os filtros e os dados ao abrir a ajuda; navegar no manual não deve gravar registros nem abrir telas operacionais automaticamente. O índice do app deve respeitar as áreas de acesso do usuário.
