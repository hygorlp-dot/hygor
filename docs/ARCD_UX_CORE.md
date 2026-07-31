# ARCD UX Core

## Princípios

- Uma ação principal por contexto; ações secundárias não competem visualmente.
- Dourado ARCD identifica ação primária; sucesso, alerta e erro têm significado próprio.
- Estados vazios, carregamento e erro são explícitos.
- Teclado, foco visível, rótulos e mensagens de erro fazem parte do componente.
- Nenhuma camada de UX altera regra financeira, contrato de API, permissão ou persistência.

## Fundação disponível

- `src/design-system/tokens`: cores, espaçamento, tipografia, raios, sombras e movimento.
- `src/design-system/primitives`: campos, botão, badge, dialog, drawer e spinner.
- `src/design-system/patterns`: estrutura de módulo, cabeçalho, feedback, status e confirmação.
- `src/design-system/data`: tabela local com busca, ordenação, paginação e cartões mobile.
- `src/edit-engine`: editor orientado a schema, validação, estados e adaptadores legados.

## Uso e rollback

Cada módulo migra por flag local em `src/config/features.js`. O fluxo legado é mantido enquanto a flag estiver desligada. O piloto atual é `newSupplierEditor`; ele carrega sob demanda e mantém `ModalFornecedor` como fallback.

## Adaptadores

Um adaptador sempre faz `toLegacy(values, original)` e preserva propriedades desconhecidas do registro original. O editor nunca grava diretamente no blob, API ou Supabase; o módulo continua dono de sua função de salvamento.

## Critérios antes de ativar uma flag

1. criação, edição, cancelamento e permissões caracterizados;
2. todos os campos e automações do editor anterior cobertos;
3. preservação de campos legados comprovada;
4. testes, lint, build e bundle aprovados;
5. desktop, tablet e mobile validados manualmente;
6. rollback para o editor legado imediato.

## Situação do piloto de Fornecedores

O editor paralelo já cobre os campos de texto, endereço e categorias. A flag permanece desligada porque a busca automática de CNPJ na Receita e a busca de CEP (ViaCEP) do editor legado ainda não foram migradas. Não habilitar a flag antes de essa equivalência e a validação manual serem concluídas.
