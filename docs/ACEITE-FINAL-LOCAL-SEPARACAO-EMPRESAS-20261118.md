# Aceite final local da separação ARCD/MRC

> Após este aceite, o usuário autorizou a etapa na nuvem. Consulte o [registro de implantação em andamento](IMPLANTACAO-EMPRESAS-NUVEM-20261118-ANDAMENTO.md). As restrições de autorização descritas abaixo registram o momento do aceite local; não devem ser reapresentadas como uma nova solicitação de permissão.

Conferência final: 18/11/2026. **Preparação e validação locais concluídas; implantação na nuvem não executada nem certificada.** A autorização vigente continua sendo trabalhar localmente, sem publicar ou alterar serviços hospedados. Nesta etapa também não houve conexão com a nuvem, login, renovação de credencial, medição NTP ou mensagem externa.

## Entrega consolidada

- Pacote: `C:/dev/marcell-local-review/company-isolation-20261118/cutover-package-integrated-k104-v2/`.
- Identidade: `09a01ff953711d6608f45fe40cf7d02d46a2b125d0b8aefd0365bd65715693fd`.
- Dossiê final: `C:/dev/marcell-local-review/company-isolation-20261118/final-acceptance/`.
- Aceite: `final-acceptance/acceptance.json`; manifesto de integridade: `final-acceptance/delivery-files.json`.
- Resumo sem dados pessoais no repositório: `artifacts/company-isolation/final-local-acceptance-summary.json`.

O dossiê reúne as provas finais, o relatório da suíte completa, ferramentas do ensaio e cópias do catálogo, funções e metadados utilizados. Os pacotes e as provas anteriores continuam preservados. O código integrado do checkout coincide com os 1.992 arquivos de runtime copiados no pacote; nenhuma atualização remota ou publicação foi feita para produzir esta entrega.

## Dados e resultado financeiro preservados

A MRC conserva I-8 e K1-10 e o responsável técnico existente nas duas obras, sem alteração dos bytes da cópia autorizada. As outras 16 obras permanecem na ARCD. Não existe sobreposição de IDs de obras. A ARCD está na revisão 2 e a MRC na revisão 1.

A limpeza da ARCD continua removendo somente os três movimentos sem conta e os valores comprovadamente gerados pela conciliação, sem restaurá-los ou apagar os lançamentos preexistentes. A reconciliação da K1-04 mantém o custo de novembro R$ 200 menor e o resultado líquido consolidado R$ 200 maior; não cria um lançamento compensatório nem um pagamento. O efeito anterior de R$ 800 não foi aplicado novamente.

As 240 combinações de obra/consolidado e mês coincidem com o DRE esperado. Fotos, auditoria de arquivos e referências das pastas locais foram preservadas. As duas empresas continuam sem contas bancárias operacionais/nativas cadastradas na cópia, sem inferência a partir de descrições de extrato.

Os cinco registros legados de `app_data`, `app_data_import_backups` e `user_app_data` foram revisados por identidade e hash. Contêm estados históricos de ponto e cadastro; não são importados sobre as fontes operacionais atuais. Todos permanecem integralmente na imagem anterior privada. As referências de obras não resolvidas não foram associadas por nome parecido. Os dois usuários históricos de `user_app_data` não têm confirmação de existência de Auth nesta captura.

As 46 medições globais do relógio do servidor permanecem intactas, sem divisão ou duplicação por empresa. A manutenção do pacote e os novos ensaios não criaram custo reconhecido, compromisso, estoque ou movimento de caixa.

## Verificações finais

| Verificação executada | Resultado |
| --- | --- |
| `npm test -- --maxWorkers=4 --reporter=json --outputFile=…/final-acceptance/vitest.json` | 724 arquivos; 5.432 testes aprovados, 15 ignorados e zero falhas. |
| `npm run validate:local` | Lint, UX/design/manual, arquitetura, tipos e build local aprovados. Não executa o prebuild com migrations. |
| Integridade do pacote, código, cópias e estados | 4.172 comparações aprovadas, incluindo os quatro arquivos externos e os 152 arquivos copiados. |
| Catálogo público com proteções capturadas | 24 verificações aprovadas; aplicação, repetição e recuperação com DRE preservado. |
| Ensaios anteriores do mesmo pacote | 16 verificações transacionais, 14 com tipos capturados e 27 de reconciliação/preservação aprovadas. |

O ensaio final reproduziu 76 tabelas, 748 colunas, 288 restrições, 156 índices, 25 gatilhos, 68 funções, quatro políticas e cinco sequências públicas. Foram exercitadas as 59 FKs, sendo as duas FKs de Auth verificadas apenas contra uma relação local mínima de identidades. Os quatro IDs com prova de existência e os dois IDs históricos usados como referências estruturais locais **não equivalem a usuários provisionados ou autenticados**.

Foram reproduzidas as permissões capturadas das funções. `anon` e `authenticated` não obtiveram acesso às tabelas, sequências ou funções `SECURITY DEFINER` públicas. As permissões preexistentes de auxiliares não privilegiados da extensão e dos gatilhos foram preservadas; não foram tratadas como autorização para acesso aos dados. Nenhuma permissão foi concedida na nuvem.

Os binários são os do PGlite instalado. Auth completo, Storage, OneDrive/OAuth, herança real de papéis e uma captura transacional única de produção não são certificados pelo ensaio local. Os arquivos externos foram verificados integralmente, sem fingir que foram carregados como tabelas nativas completas neste espelho.

## Recuperação final: base nova, com proteções originais

O catálogo completo revelou que a recuperação genérica com todos os gatilhos já ativos é recusada pelas proteções dos contadores do ponto. A recusa foi testada com reversão integral e sem dados parciais. As versões anteriores do espelho, sem esses gatilhos, não comprovavam essa condição.

O procedimento local validado é uma **restauração em base nova e isolada**:

1. Criar o esquema vazio com tipos, chaves, restrições, defaults, sequências e índices conferidos.
2. Carregar a imagem limpa e separada e seu recibo, sem usar o histórico misto como base operacional.
3. Criar as funções, gatilhos, políticas e permissões originais capturadas.
4. Conferir os dados, as 240 projeções de DRE, a repetição e a recusa de alteração de registros imutáveis.
5. Só considerar a troca de destino depois da certificação real do backup e da autorização de implantação.

Nenhum gatilho foi desligado, relaxado ou alterado em uma base operacional. Não houve mudança nas regras da ARP, NSR, hashes ou marcações protegidas. O teste de imutabilidade da evidência de hora confirmou que as proteções estavam ativas após restaurar.

Os SQLs `apply.blocked.sql` e `recover-clean.blocked.sql` continuam bloqueados para uso real. O segundo é parte da carga em destino novo; não constitui um executor de restauração sobre um banco operacional com os gatilhos já ativos. Não basta remover o bloqueio para implantar. A primeira tentativa do ensaio completo detectou identidades históricas não cobertas pela captura de Auth; outras tentativas corrigiram a reprodução local dos nomes de políticas e das verificações de privilégios. Todas as provas das tentativas foram preservadas; o resultado final é `catalog-final-attempt-6/validation.json`.

## Etapa externa que permanece fora da autorização local

Para concluir no ERP publicado, é necessário executar uma rodada autorizada na nuvem, nesta ordem:

1. Conferir a captura no corte definitivo, concorrência, identidades e configuração fiscal/bases de orçamento da MRC. Resolver as duas referências históricas de Auth sem criar usuários por inferência.
2. Certificar backup/restauração e a destinação privada da auditoria e dos cinco registros legados no esquema real.
3. Criar/conferir destinos OneDrive exclusivos de I-8 e BASE DE DADOS e as permissões efetivas por empresa.
4. Aplicar o acesso privado das duas fotos e testar que os links públicos anteriores deixaram de entregar os arquivos.
5. Validar autenticação, troca de empresa, integrações, arquivos e DRE com usuários reais de cada empresa.
6. Preparar o pacote definitivo desse corte e realizar uma única publicação consolidada, com conferência após implantação.

Essas ações não foram executadas porque alterariam o ambiente hospedado ou exigiriam sua certificação. O aceite local não as marca como concluídas. Não houve push, PR ou build/deployment da Vercel nesta entrega.

## Ajuda e continuidade

A revisão da ajuda concluiu que esta rodada modifica somente evidências e procedimentos de manutenção local, sem mudar os controles do operador. O manual segue sincronizado: 145 guias para 65 abas. Não foi criada uma instrução de tela que prometa uma migração já publicada.

Este é o registro final da etapa local. [A reconciliação e a evolução do pacote](RECONCILIACAO-K104-PACOTE-INTEGRADO-LOCAL-20261118.md) conservam o histórico técnico. Qualquer implantação deve partir das evidências e dos bloqueios acima, sem repetir a limpeza ou usar uma captura antiga para sobrescrever dados posteriores.
