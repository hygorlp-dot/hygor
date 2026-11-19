# Colunas das tabelas financeiras — etapa 3A

Etapa 3A concluída e validada localmente em 14/11/2026. Fluxo funcional e orçamentos de tamanho aprovados, sem publicação.

## Alcance

O botão Colunas permite mostrar ou ocultar campos opcionais em Hoje (visualização Tabela), contratos de terceiros, cobertura dos materiais e garantias técnicas. Custos por etapa usa Colunas dos custos por etapa. Documentos e Pagamentos mantêm as fichas operacionais existentes; Kanban não muda.

Identificação, avisos, situação e ações essenciais permanecem disponíveis. Incorrido e Custo final estimado são obrigatórios em custos por etapa. A seleção usa o diálogo, botões, checkboxes, foco e espaçamento compartilhados. No celular, o diálogo permite rolar até os controles; consultas DataTable continuam em cartões.

## Origem, persistência e permissões

Não foi criado cadastro financeiro. A tabela recebe os registros, valores, unidades, vínculos e etapas já resolvidos pelas consultas existentes. Preferências guardam somente identificadores de colunas ocultas, na chave local `mrc-columns:v1:` seguida da empresa (companyId ou CNPJ), usuário autenticado e lista. A mesma lista usa a preferência entre as obras autorizadas. Empresas, usuários e listas possuem chaves distintas.

Sem empresa identificada ou com armazenamento bloqueado/inválido, aparece o aviso de uso apenas nesta sessão. Restaurar colunas padrão remove a preferência, quando permitido pelo navegador. Colunas removidas são ignoradas; novas colunas aparecem por padrão. Campos obrigatórios continuam visíveis mesmo se a preferência for adulterada. Nenhuma lista pode ficar sem campos visíveis.

Não há novo comando, endpoint, tabela, migração ou permissão. A preferência não amplia a projeção de dados nem autoriza operações. Busca, ordenação, página, filtros e seleção não são regravados pelo seletor. Fichas, memórias e exportações continuam com os dados completos do recorte autorizado; a preferência visual não filtra a exportação.

## Impacto no DRE

Nenhum efeito em resultado realizado, previsão, compromisso, estoque físico, custo reconhecido ou pagamento. A preferência atua após a seleção dos dados, exclusivamente na apresentação. O cenário de navegador compara o estado financeiro e o DRE antes e depois da personalização, verifica zero comandos gravados e exercita a recarga. Ocultar valor não elimina o fato da origem, dos totais ou da memória. As fases 1B, 1C e 2 permanecem no mesmo fluxo canônico.

## Correção do pacote global

A pendência anterior de 9.118 bytes foi reproduzida no checkout atual, preservando as alterações locais. Na comparação final com o adaptador desligado, o excesso era de 10.554 bytes. O código distribuído de Recharts e de sua biblioteca de escalas repetia auxiliares do Babel em muitos arquivos. `scripts/shared-chart-helpers.mjs` passa a compartilhar essas funções durante o build, com a mesma versão instalada da biblioteca. Nenhuma alteração de layout, dado ou regra financeira foi necessária.

O adaptador usa uma lista restrita de auxiliares, normaliza apenas formatação e nomes locais com o Oxc já utilizado pelo Vite e identifica cada função junto de suas dependências. Variantes continuam separadas. Captura de estado do módulo ou reatribuição externa impede a extração; ciclos inesperados causam erro explícito. O código operacional dos gráficos não é reescrito. O plugin atua somente no build e mantém os mapas das chamadas originais. Rolldown 1.2.15, já instalado pelo Vite, ficou declarado explicitamente como dependência de desenvolvimento; não houve atualização de bibliotecas do app.

| Medida | Bytes gzip JS/CSS |
| --- | ---: |
| Comparação final com adaptador desligado | 1.901.882 |
| Build corrigido | 1.890.078 |
| Limite global preservado | 1.891.328 |
| Redução efetiva | 11.804 |
| Margem global | 1.250 |
| Pacote financeiro / limite | 190.442 / 208.896 |

O build padrão, o build isolado validado no navegador e a configuração de produção compilada localmente passam. Os 104 assets JS/CSS do build padrão são idênticos aos do build isolado. Não foram modificados minificador global, limites, medição, baseline, fontes, logomarca ou funcionalidades para obter a redução.

## Validação final

- 1.576 testes em 171 arquivos aprovados, incluindo preferências, financeiro, DRE, terceiros, Contratos, sincronização, autorização, persistência e relatórios. Sete testes do adaptador verificam funções reais, símbolos, descritores, herança, iteração, variantes, dependências e guardas. A comparação com a biblioteca original produz SVG idêntico para linhas, barras, áreas e pizza.
- 24 cenários de navegador aprovados no build otimizado em desktop e celular. Incluem colunas, recarga, restauração, ajuda, Contratos, emissão contratual desativada, vínculos, estoque, garantias e conservação do DRE. APIs e dados simulados; nenhuma operação em banco real.
- 208 verificações de inicialização aprovadas no build: 75 imports de pacotes em sessões novas e 133 telas/entradas públicas. Mais 133 telas aprovadas em desenvolvimento, onde o plugin não atua. O diagnóstico de desenvolvimento registra avisos React de chaves duplicadas no shell existente; sem exceção de execução ou cenário reprovado. A otimização não altera esse shell.
- Lint, design, manual, TypeScript e arquitetura aprovados. Ajuda contextual revisada sem mudança dos passos: esta correção é somente técnica. Manual regenerado e sincronizado, com 137 guias cobrindo 65 abas.
- A interface da 3A conserva o parecer independente `ship` anterior, restrito à interface (`artifacts/financial-columns-review.md`). Novas capturas do fluxo otimizado em desktop/celular foram conferidas. Esta correção não altera componentes ou estilos; a pendência técnica global daquele parecer foi encerrada pelas medições acima.

Evidências finais: `artifacts/3a-bundle-*.log`, `artifacts/3a-bundle/`, `bundle-metrics.json`. O adaptador de auditoria aceita `--directory=` para isolar suas evidências, mantendo o comportamento padrão anterior.

Tudo permanece local. Contratos e suas cláusulas foram preservados; emissão PDF/DOCX continua desativada. Sem push, PR, deployment, migração, mensagem, upload ou operação real nesta tarefa.
