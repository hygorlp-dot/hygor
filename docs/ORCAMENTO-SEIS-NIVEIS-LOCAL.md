# Etapa 4 — seis níveis do orçamento

Implementação local de 14/11/2026. Mantidos dados e alterações locais, Contratos e cláusulas da minuta, emissão contratual PDF/DOCX desativada e limites dos pacotes. Nenhuma migração ou operação em banco real, push, PR ou deployment.

## Origem e hierarquia

O limite único passa a seis níveis de **etapas**, com base em `id` e `parentId`. Os itens permanecem vinculados por `etapaId`; um serviço no sexto nível pode ter sete partes no código visual, sem constituir uma sétima etapa. Não há outro cadastro de etapa, obra, unidade ou custo.

Criar subnível funciona até o sexto nível. Editar nome e posição move a subárvore inteira, preservando IDs e vínculos, e renumera a apresentação. Ciclo, pai inexistente, IDs repetidos, item sem etapa e profundidade excedida são recusados. A gravação no servidor aplica a mesma regra quando a hierarquia muda. Alterações independentes em legado inválido não reescrevem sua árvore; a conferência do orçamento sinaliza a origem. A leitura tem proteção contra recursão infinita em árvores duplicadas/cíclicas.

Orçamento aprovado continua imutável. Legado inválido não pode ser promovido a aprovado nem adotado como nova linha de base. As permissões de edição, aprovação e escopo de obra existentes não foram ampliadas. A cópia valida a origem, remapeia IDs de pais, itens e cronograma, preservando a estrutura de seis níveis, quantidades e preços conforme a opção existente de cópia.

Em falha de gravação, o formulário permanece aberto. A referência otimista não conserva a alteração recusada quando nenhuma gravação posterior a substituiu; repetir não cria uma segunda etapa. O teste de componente reproduziu a duplicação antes da correção e confirmou uma única etapa depois.

## Importação e saídas

A confirmação das colunas continua obrigatória. Foram adicionadas Numeração da etapa e Nível da etapa; Tipo reconhece Nível/Subnível, Nível 3 até Nível 6 e a taxonomia LOTE/Nível das próprias exportações. Numeração e profundidade declaradas precisam concordar. Pais devem preceder filhos; saltos, repetições, pai divergente e item com numeração de outra etapa bloqueiam a prévia e a aplicação. Não há promoção silenciosa de subetapa para raiz nem associação por semelhança de nome.

O formato antigo de dois níveis sem numeração continua aceito. Itens sem uma etapa declarada mantêm o agrupamento explícito existente “Itens importados”. Os códigos SINAPI/ORSE continuam sendo códigos de referência, separados da numeração hierárquica. Cabeçalhos Descrição/Nome têm prioridade sobre a coluna Item na detecção da descrição, para ler corretamente o layout exportado.

Código localizado reaproveita descrição, unidade e preço da base existente. Fora da base, descrição e unidade vêm da planilha e o preço permanece pendente, sem inventar valor. A prévia mostra as primeiras 50 etapas e avisa quando há mais; a validação percorre todas. Adicionar/substituir e incluir pendências usam Checkbox compartilhado, com teclado e estado de gravação. Substituição continua exigindo conferência dos vínculos operacionais anteriores; não remapeia compras ou tarefas por nome.

Foi corrigido o acesso pela aba Orçamento: seus diálogos de importação estavam limitados ao bloco da aba Insumos. As duas entradas agora compartilham mapeamento e prévia. Falha preserva a prévia e o motivo; Importar não fecha antes do retorno. Ajuda contextual `orc_estrutura`, guia principal e manual foram revisados.

Excel completo, Excel padrão e PDF do **orçamento** percorrem a árvore canônica; a ampliação não altera a emissão desativada dos instrumentos de Contratos. O navegador gerou e releu um Excel padrão real contendo Nível 6 e item com sete partes. As projeções de valores conservam os centavos e o BDI do motor existente. O teste antigo de exportação A2 do Planejamento foi atualizado para verificar o helper `openReportPreview`, já utilizado pela implementação local, sem alterar o relatório.

## DRE, compromissos e medição

Criar, mover, copiar ou importar orçamento modifica previsão; não reconhece receita, custo ou pagamento. O DRE e o caixa continuam dependendo dos fatos financeiros. A medição técnica e o planejamento reutilizam IDs do sexto nível; o custo de uma etapa inclui seus descendentes uma vez. Resumos financeiros continuam por etapa principal, sem criar seis lançamentos pelo mesmo serviço.

Evidências: um item de 2 × R$ 100 no sexto nível soma R$ 200 de custo direto e R$ 220 com BDI de 10%, sem somar novamente os subtotais dos pais. Com R$ 80 de custo reconhecido e R$ 50 de compromisso, a raiz mostra R$ 200 orçados, R$ 80 incorridos e R$ 50 comprometidos uma única vez. Mover a hierarquia e registrar medição técnica não mudam o DRE nem o fluxo de caixa. Revisões manuais de previsão permanecem preservadas e a assinatura da base continua detectando mudanças de hierarquia para reconferência.

## Validação local

- `artifacts/budget-six-regression.log`: 2.078 testes em 231 arquivos, cobrindo orçamento, planejamento, medições, DRE, compras, previsão, estoque, garantia, importações bancárias, Contratos, API e autorização. Inclui gravação real pelo handler com banco simulado, rejeição sem escrita e preservação de versões aprovadas. Tipo e coluna numérica de nível são confrontados mesmo quando a numeração coincide com a coluna divergente.
- `artifacts/budget-six-browser.log`: 32 cenários desktop/celular aprovados, incluindo Contratos e etapas 1–3B. Quatro cenários direcionados foram repetidos depois do ajuste dos checkboxes e para capturas finais, sem somá-los ao total. Conferidos sexto nível, ausência do sétimo, mudança de pai, recarga, ajuda sem perda do formulário, XLSX real, leitura do download, bloqueio de origem divergente e teclado.
- `artifacts/budget-six-cold-build.log`: 208 verificações de inicialização do build sem falhas. Lint/design/manual, tipos e arquitetura em logs próprios; manual sincronizado com 139 guias e 65 abas.
- Builds locais padrão e com configuração de produção; global gzip **1.891.320 / 1.891.328 bytes**, financeiro **190.029 / 208.896**. A folga global final é de apenas **8 bytes**; próximas introduções precisam ser medidas novamente. Nenhum limite, baseline, asset medido, biblioteca ou minificador alterado nesta etapa. Textos e controles redundantes foram consolidados no fluxo existente.
- Detector executado uma vez: 5 avisos de fonte e 67 observações consultivas, em relatórios/estilos legados não introduzidos nesta etapa (`artifacts/budget-six-detector.json`). Não foram criadas exceções ou reparado drift global do DESIGN. Evidências visuais e parecer em `.impeccable/review/orcamento-seis-niveis/`.
- Revisão independente das dez capturas: `ship`, sem correções materiais solicitadas, no escopo visual da extensão. Documentação do sistema preservou DESIGN e sidecar; regras específicas ficaram no contrato da superfície.
- A conferência dos inputs separa cinco scripts locais de revisão de Portal/OneDrive alterados em outro trabalho: não são importados pelo aplicativo nem pela configuração de build e foram preservados. Os demais arquivos originais registrados permaneceram iguais durante os builds finais. O verificador dirigido registra essa distinção, sem sobrescrever o trabalho paralelo.

Todos os dados de teste são sintéticos; a conferência local não substitui homologação com a equipe.
