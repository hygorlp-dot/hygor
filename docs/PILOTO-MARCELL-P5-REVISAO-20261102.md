# P5 — Revisão adversa da recuperação

Revisão posterior à entrega `95600c33`, em 02/11/2026. Alterações somente no checkout local `codex/marcell-precise-local-20261101`. Sem push, deploy, migração de servidor ou movimentação financeira real.

## O que a revisão encontrou

| Falha reproduzida | Efeito anterior | Correção |
| --- | --- | --- |
| Nota e pedido com o mesmo identificador | Disputavam a mesma confirmação local, embora fossem registros distintos. | A identidade inclui a classe do documento. Número e texto do mesmo ID são tratados como o mesmo registro. |
| Armazenamento falha durante reenvio | A referência ao comando original era apagada da memória do formulário. | O reenvio é bloqueado e conserva a referência original; não cria outra operação. |
| Obra corrigida depois de salvar um rascunho | A central usava a obra antiga do contexto salvo para decidir acesso e apresentar a informação. | Obra e acesso são obtidos do registro na base atual, tanto para rascunhos quanto para confirmações. |
| Consulta aberta no ambiente de desenvolvimento | O encerramento interno da fila gerava um aviso falso de alterações não salvas. | Desmontagem não publica falha de gravação; respostas tardias de filas encerradas não alteram o estado da interface. |
| Registro ausente na base atual | A central oferecia uma reabertura inválida. | Mostra Registro indisponível, bloqueia a retomada e conserva o trabalho local para revisão de origem/acesso. |

Os testes falharam antes das correções. Logs: `artifacts/p5-review-red.log` e `p5-review-browser-red.log` e `p5-review-dev-red.log`. Não se considera a aprovação anterior da P5 uma prova de ausência de falhas.

## Proteção dos registros anteriores

A atualização do IndexedDB copia os registros antigos para a tabela de trabalho nova, preservando comandos, IDs, versões, chaves idempotentes, campos e comprovantes. A cópia e as etapas do esquema ocorrem na mesma transação de atualização. Foi injetada uma falha na cópia e verificado que o registro original permanece acessível na versão anterior.

A tabela anterior recebe uma chave composta incompatível com a escrita do protocolo antigo. Isso é necessário porque a versão instalada do Dexie aceita abrir uma versão maior e pode recriar uma tabela removida. As duas hipóteses mais simples foram rejeitadas pelos testes; o teste final verifica a falha da escrita antiga antes de qualquer envio. Depois da atualização, as outras abas devem ser recarregadas.

Essa proteção diz respeito à versão anterior do armazenamento da recuperação. **Não é um bloqueio universal de clientes antigos na API nem certificação de compatibilidade de todas as versões já publicadas do ERP.** Rascunhos do mesmo usuário/registro continuam compartilhados entre abas; não se promete edição independente em cada uma. A recuperação depende dos dados locais e não substitui backup.

## Contexto e padrão visual

- A retomada mostra a obra atual para quem tem acesso; mudança de obra ou ausência do registro não habilita um envio inválido. Uma confirmação bloqueada volta a usar a mesma operação quando o acesso ao registro é regularizado.
- O formulário compartilhado de pagamento mostra **Fornecedor** antes de obra, total e saldo. **Não informado** exige conferir a origem; não se infere o fornecedor da nota a partir de um pedido.
- **Registro indisponível** usa a linguagem comum em `src/design-system/copy.js`, nas duas interfaces que apresentam esse estado. Tipografia, cores, botões e espaçamento continuam na base existente.
- A Ajuda e o manual orientam obra atual, indisponibilidade, falha de armazenamento e recarga das outras abas após atualização. Permanecem 104 guias para as 65 abas.

## Carregamento

Os mapas de IDs de navegação foram extraídos para `help-topics.js`. Os textos continuam exclusivamente em `help-content.js`, carregado pelo painel de Ajuda sob demanda. Os módulos operacionais não precisam importar os guias completos só para selecionar seu contexto.

O chunk LegacyApp passou de **1.277.824 para 1.196.921 bytes**, e de **336.712 para 312.449 bytes gzip**. A mudança não foi apresentada como medição de tempo de abertura em aparelho físico.

O conjunto JS/CSS gzip ficou em **1.789.891 bytes**, com teto preservado de **1.789.952**: apenas **61 bytes de margem**. A redução da entrada do módulo é útil, mas **o peso total continua sendo um ponto fraco**. Não houve aumento do orçamento, retirada de assets da medição ou troca da configuração do empacotador.

## Evidências

- 531 testes de código em 48 arquivos de domínio, políticas, persistência, armazenamento e Ajuda; logs `p5-review-unit.log` e `p5-review-green.log`. Após a correção de ciclo de vida da fila, mais 26 testes focados de fila/armazenamento passaram (`p5-review-last-unit.log`), incluindo falhas reais, encerramento e respostas tardias.
- 30 cenários P5 no desktop/celular e 30 repetições adversas a 320 px ou com texto a 200%, com fontes bloqueadas. Incluem mudança de obra, perda/retorno de acesso, registro ausente, mesma identidade na confirmação e atualização de rascunho/comprovante da versão anterior. Logs finais: `p5-review-browser-last.log` e `p5-review-adverse-last.log`.
- O aviso falso foi reproduzido e corrigido também contra o servidor de desenvolvimento em desktop e celular: `p5-review-dev-red.log` e `p5-review-dev-green.log`. As falhas reais de gravação continuam publicando seu estado; a correção técnica não introduz controles nem passos novos na Ajuda.
- O comprovante legado foi recuperado no navegador com nome, valor do formulário e conteúdo binário preservados, sem registrar pagamento.
- 136 verificações gerais das 65 abas; regressão de filas, fichas, navegação, pagamentos e recuperação anterior, e verificações compartilhadas de interface/Ajuda. Contagens e resultados finais nos logs `p5-review-whole.log`, `p5-review-regression.log` e `p5-review-foundation.log`.
- Lint, design, manual, TypeScript, dependências, build direto pelo Vite e orçamento de bundle. Ajuda/manual revisados; as mudanças de armazenamento não introduzem passos de cadastro nem alteram regras financeiras do servidor.

As APIs são interceptadas e os dados são fictícios. A atualização local não foi ensaiada com um acervo volumoso real, quota real de vários aparelhos, Safari, leitor de tela ou banco de produção.

## Avaliação pessimista e posição no roadmap

**8,0/10 para o piloto, em avaliação interna conservadora.** A revisão pesa mais a recuperação da tarefa e a evidência de uso do que a quantidade de testes. Não é uma regressão visual nem uma nota estatística: os defeitos reproduzidos demonstram por que a classificação anterior não deve virar garantia de operação real.

| Etapa | Posição atual |
| --- | --- |
| P0–P4 | Implementadas localmente; evidências históricas nos relatórios respectivos |
| P5 — implementação | Concluída no piloto local |
| P5 — revisão adversa | Correções desta rodada e validação técnica local concluídas |
| P5 — aplicação com operadores | Pendente; roteiro preparado para aplicação posterior, conforme decisão do usuário |
| Meta 9,5 | Aberta; não declarar atingida apenas pela aprovação de testes automatizados |

Pendências que continuam relevantes:

1. Aplicar o roteiro com seis operadores e ao menos 20 tarefas, medindo conclusão sem auxílio, tempo, erros e perda de contexto. Sem participantes disponíveis nesta etapa, nenhum resultado de operador foi inventado.
2. Verificar integração, concorrência entre usuários e compatibilidade de clientes com API/banco de teste antes de publicar; a guarda local não substitui essas verificações.
3. Ensaiar atualização e recuperação em aparelhos reais, com armazenamento restrito e acervo maior; o teste de rollback injetado não mede a experiência de uma quota real esgotada.
4. Recuperação de recebimento antes do envio e formulários financeiros especializados permanecem fora da unificação entregue. Não se considera toda a ERP coberta pelo rascunho de pagamento.
5. Revisar a retomada explícita das falhas terminais da fila geral: preservar o alerta de falha não equivale a oferecer um caminho claro de nova tentativa. Não se declarou esse fluxo resolvido nesta rodada.
6. Continuar reduzindo a carga estrutural do legado antes de expandir o pacote. A margem atual não sustenta crescimento confortável.

Acrescentar ao piloto preparado quatro observações: se o operador identifica a obra atual após uma correção; se entende o bloqueio por acesso/registro ausente; se recupera o comprovante após atualização; e se confere fornecedor antes de confirmar. Montar esses cenários em base de teste, sem corrigir ou remover registros reais apenas para ensaiar.
