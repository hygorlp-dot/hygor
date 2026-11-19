# Revisão final local — separação, DRE e publicação

Atualização posterior autorizada em 18/11/2026: o perfil do responsável técnico foi incluído na cópia MRC e no índice de acesso, e a divergência do portal foi identificada como teste dependente do relógio real, com regressão e PDF/e-mail conferidos. Detalhes e estado atual em [Correção local do responsável e portal](CORRECAO-RESPONSAVEL-MRC-PORTAL-LOCAL-20261118.md). As observações abaixo registram a revisão anterior a essa correção; o estado MRC atual é revisão 1. As demais pendências de publicação continuam abertas.

Revisão de 18/11/2026, após a exclusão autorizada da conciliação da ARCD. A integridade dos dados e o DRE da cópia local passaram nas conferências. A publicação ainda tem pendências de migração, acesso, configurações, arquivos e validação do portal.

O trabalho foi somente de leitura sobre os arquivos operacionais e a API de consulta do simulador. Foram gerados relatórios de revisão e executados testes locais. Não houve mudança na cópia operacional, em permissões, usuários, cadastros, arquivos na nuvem, flags de produção, certificados, rotinas remotas ou publicação.

## Estado conferido

| Item | ARCD | MRC |
| --- | --- | --- |
| Obras visíveis | 16, incluindo BASE DE DADOS | I-8 e K1-10 |
| Revisão local | 1, após a limpeza | 0, preservada |
| Contas bancárias operacionais/nativas | 0 / 0 | 0 / 0 |
| Movimentos/extratos ativos | 0 / 0 | 0 / 0 |
| Certificado de isolamento instalado | Não | Não |
| Bases de referência de orçamento na distribuição | 4 | 0 |

Não foram encontradas referências a obras conhecidas da outra empresa na fotografia operacional, linhas nativas com empresa divergente, colisões das chaves primárias inventariadas ou dependências relacionais pendentes. Isso cobre a captura local; restrições e permissões da base atual precisam ser conferidas novamente no corte.

O hash completo da MRC continua igual ao anterior à limpeza. Todas as seções operacionais e tabelas nativas independentes da conciliação da ARCD foram preservadas. A cópia de recuperação confere integralmente com o arquivo ARCD anterior à exclusão. As linhas persistidas do aplicativo e a fotografia operacional produzem o mesmo DRE, sem divergência após reconstruir os dados.

As pastas locais de I-8 e BASE DE DADOS possuem identidades e diretórios distintos. A API recusa consulta de pasta de outra empresa. As duas fotos locais conferem por hash; a referência ativa abre somente com sessão e assinatura corretas, e acessos sem sessão ou com empresa adulterada são recusados. Essas verificações não certificam permissões de nuvem.

## DRE após a limpeza

- Os demonstrativos das 18 obras permanecem iguais nos 12 meses de 2026.
- A mudança no consolidado ARCD ocorreu somente em novembro: retirada da despesa de R$ 800 e melhora do resultado líquido em R$ 800.
- O recebimento de R$ 4.000 removido afeta o caixa; faturamento e receitas reconhecidas permaneceram iguais. A saída pendente de R$ 980 não era pagamento ou custo realizado.
- A entrada realizada de R$ 4.000 e a saída realizada de R$ 800 foram retiradas do caixa da conciliação. Os demais custos, pagamentos, previsões, compromissos e estoques não foram alterados ou recriados.
- O DRE consolidado da MRC não mudou. Seus orçamentos e planejamentos não foram convertidos em custo realizado.

Os resultados líquidos absolutos e a comparação de campos por mês estão na prova privada, sem publicação de dados financeiros detalhados no repositório.

## Pendências antes de publicar

| Pendência | Evidência local | Conclusão necessária |
| --- | --- | --- |
| Responsável técnico da MRC | I-8 e K1-10 referenciam o mesmo engenheiro por ID. O perfil ativo existe na origem, mas não está nos usuários MRC. | Confirmar e ajustar o perfil e as permissões desse responsável na empresa correta, usando o ID existente. Conferir abertura e edição das obras; a lista local de engenheiros é usada nesse fluxo. Não associar por semelhança de nomes. |
| Configurações fiscais e de contato da MRC | Identificação fiscal e contatos próprios estão vazios por decisão de não herdar os da ARCD. | Preencher e conferir os dados e regras próprios antes do uso real. Não inferir impostos ou identificação a partir da ARCD. |
| Bases de orçamento da MRC | A distribuição mantém quatro bases e os catálogos externos na ARCD; a MRC não tem bases cadastradas. `api/references.js` consulta pela empresa atual. | Preparar as bases que a MRC deve usar, mantendo identidades e consultas corretas. Conferir os dois orçamentos existentes e a pesquisa de referências; não liberar acesso ao histórico privado ARCD como atalho. |
| Atualização da origem e aplicação real | A cópia de origem foi capturada às 12h10 de Bahia; o corte do histórico de auditoria é anterior. O plano ainda tem `ready: false`, com `/inventory` e `/files`. | Refazer a conferência atual no corte, comparar alterações posteriores e implementar/testar a execução transacional e idempotente da migração, inclusive restrições globais e políticas de acesso. A simulação em JSON não substitui essa execução. |
| Limpeza na produção | A operação de apagar está no servidor de simulação e na interface condicionada ao modo local. Não há comando correspondente em `api/data.js`. | Caso a opção deva existir no ERP publicado, implementar e testar o comando real com autorização, bloqueios financeiros, revisão de prévia, transação, idempotência, projeções nativas e recuperação. Não transferir o gravador de arquivos da simulação para a produção. A limpeza já feita localmente também precisa ser reconciliada no corte sem apagar registros novos da origem. |
| Pastas OneDrive | A captura mostra I-8 e BASE DE DADOS usando a mesma pasta. Destinos locais são sintéticos; dez documentos da I-8 são candidatos por ID, com conteúdo/ancestralidade ainda não conferidos na nuvem. | Conferir filhos, identidades e permissões atuais; preparar raízes exclusivas; copiar apenas itens comprovados e validar hashes e acessos antes de atualizar referências. Não mover toda a pasta compartilhada nem presumir que a BASE DE DADOS está vazia. |
| Fotos e caminhos privados | A captura contém duas fotos em bucket público; os destinos privados existem apenas localmente. Há também caminhos patrimoniais legados sem o prefixo novo. | Preparar o armazenamento privado real e seu leitor autenticado, conferir as cópias e atualizar os vínculos exatos com controle de concorrência. Conferir a revogação dos links públicos anteriores. Manter a segunda foto sem criar vínculo fictício. Tratar caminhos patrimoniais antes de liberar a leitura por prefixo. |
| Integrações e perfis reais | A simulação usa administrador sintético e não autentica Microsoft, SMTP, WhatsApp, clientes ou aparelhos reais. | Configurar raízes e sessões Microsoft vinculadas à empresa; conferir administradores, engenheiro, portal, fornecedores, ponto/aparelhos e remetentes autorizados. Contas bancárias só devem ser cadastradas com dados confirmados; o texto do extrato não prova um vínculo de conta. |
| Backup e rotinas | O cron de backup não informa empresa. O backup OneDrive existente captura `company_app_data`. | Confirmar cobertura das duas empresas e recuperação da base relacional e dos arquivos, além do JSON operacional. Validar restauração e plano de retorno antes do corte. Conferir também a rotina de verificação do ponto por empresa. |
| Falha no portal | O teste de PDF/e-mail foi reproduzido nesta revisão: saldo de caixa esperado 8.620, retornado 13.620. A divergência já estava registrada antes da separação. | Investigar e resolver a divergência na massa/regra de prestação de contas e repetir a validação do portal. Não alterar a expectativa apenas para liberar o teste. O DRE da cópia real passou nas verificações próprias desta revisão. |
| Ativação e publicação | Não há certificados de isolamento nos estados locais. O `prebuild` existente inclui migrações e operações de infraestrutura. | Revisar o pacote de mudanças e a ordem de implantação; não usar build remoto como teste de migração. Somente após reconciliação e recuperação verificadas, preparar certificados/flags e a publicação consolidada, mediante autorização explícita. |

## Validação desta revisão

Foram aprovadas 37 conferências da cópia atual, incluindo consultas reais ao simulador local para as duas empresas, DRE, pastas e acesso privado da foto. Também passaram 48 testes dirigidos em 12 arquivos, lint, design:check, manual:check, TypeScript e build local por `npx vite build`. O teste específico do portal descrito acima falhou; não foi declarada aprovação da suíte ampla nem prontidão para publicação.

Os testes de regras usam fixtures e provedores simulados; os relatórios de dados usam somente arquivos privados e a API de loopback. A impressão digital dos arquivos operacionais foi comparada novamente após a revisão e permaneceu igual. Não foi executado `npm run build`/prebuild, push, preview da Vercel, migração ou acesso à nuvem.

Prova privada vigente: `C:/dev/marcell-local-review/company-isolation-20261118/final-local-review-20261118-complete.json`. Resumo sem caminhos privados e sem resultado líquido absoluto: `artifacts/company-isolation/final-release-readiness-summary.json`.

Não houve novo fluxo de operador, campo ou comportamento nesta revisão. A ajuda e o manual existentes foram revisados e continuam corretos para a simulação local e para a limpeza; a sincronização passou no `manual:check`. A lista acima descreve trabalho futuro, sem prometer que esses recursos já estejam ativos no ERP publicado.
