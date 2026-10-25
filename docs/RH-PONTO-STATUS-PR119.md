# RH e ponto — acompanhamento

Atualizado em 25/10/2026. [Roadmap oficial](RH-PONTO-ROADMAP.md).

Branch: `codex/rh-ponto-week-one`. Base: `c7d4e777e7263b823bd2ce60797346ea69bca402` (#118, edição acessível e reaproveitamento). Referência da auditoria: `23d6ed5d3b88cf25cf999184ed62cc3074b9f9d5`, sem retorno do código.

Candidato de código: `5e96e4be4e77964f9c1c34ad3b4ccd322405b039`; segurança móvel independente em `cff3f2858ee1725d00dac64afe97c6b7acc1d46e`. Entregues às sessões Android e Testes para reconciliação/aceite independente. Nenhum desses commits foi promovido a produção nesta execução.

[PR #119](https://github.com/hygorlp-dot/hygor/pull/119), em rascunho para aceite. Checks GitHub em execução; preview automático do projeto mrc não é a API isolada de homologação e não deve receber dados fictícios.

## Concluído antes deste recorte

- #115/#116/#117: mensal CLT, adiantamentos, provisões, simulação/admissão, ponto importado, escolha com vigência, custos separados e prontuário privado.
- #118: salvar sempre visível, zeros preservados, perfil reaproveitado, erro sem perder campos e versão de abertura. 2.850 testes locais; 24 fluxos desktop/celular; checks do PR verdes. Publicada: produção c7d4e77, quatro testes de edição/reaproveitamento na versão publicada aprovados.
- Auditoria de leitura: 210 pagamentos, 925 movimentos bancários, 56 vínculos e nove perfis preservados; 12 meses do DRE sem divergências. R$ 7.160 pendentes.

## Implementado nesta execução; candidato em validação

- Cadastro: valores e jornada com vigência, motivo, autor e histórico; valores antigos continuam disponíveis por data. Edição pessoal não exige reajuste. Proteção retroativa também no salvamento geral.
- Cálculos: 13º por mês civil com 15 dias; salário mensal CLT na base rescisória; tolerância de atraso. Rescisão automática é prévia; registro final exige apuração identificada da contabilidade.
- Biometria: PIN autorizado no servidor, limite persistente de tentativas no servidor e no aparelho. Referência de hora ausente/vencida não aparece como confiável.
- Ponto recebido: fila de pendências, apropriação e importação revisada ao ponto existente sem redigitar horários. Originais preservados. Dia incompleto, múltiplas obras, hora não confiável e períodos fechados exigem tratamento específico.
- Quinzena mista: diária por dias conferidos/valor vigente; CLT por holerite mensal e parcela informada. Aprovação cria título no financeiro atual; não paga nem duplica custo no DRE. Adiantamentos, títulos legados e saldos parciais protegidos contra duplicação.

## Evidências disponíveis

- Build web, lint, TypeScript e fronteiras arquiteturais aprovados. Logs: `C:/tmp/rh-weekone-{build,lint,types,architecture}-release.log`.
- Rescisão/atraso: 56 testes focais. Mobile após corrigir fechamento dos bancos de teste: 324 testes aprovados, cinco ignorados; Expo Doctor 21/21; bundle Hermes aprovado (`rh-mobile-lifecycle-tests.log`).
- Quinzena, conciliação/adiantamentos: 74 testes focais aprovados; snapshot de aprovação e ponte móvel: 29 testes de API/comando aprovados, incluindo concorrência (`rh-mixed-race-final.log`). Testes de navegador: **28/28** desktop/celular (`rh-weekone-browser-release.log`).
- Consulta de preservação em 25/10/2026: 210 pagamentos, 925 bancos, 56 vínculos e nove perfis preservados; 12 meses DRE sem divergência, R$ 7.160 continuam pendentes (`rh-weekone-preservation-{finance,permissions,dre}.log`). Somente leitura.
- Validação integrada completa ainda em curso; não considerar estes testes focais como liberação final.
- A publicação da branch executa o gate obrigatório (lint, arquitetura, suíte geral e build); log `C:/tmp/rh-weekone-prepush.log`. O resultado dos checks do PR e o aceite independente complementam as evidências acima. Não equivalem a teste em Android físico.
- Gate obrigatório concluído verde no candidato: **2.958 testes aprovados, 13 ignorados, 399 arquivos aprovados e dois ignorados**, lint/arquitetura/build aprovados. TypeScript separado aprovado. Aceite independente da sessão Testes: 76 cenários distintos; parte do encadeamento financeiro foi em memória após leitura SQL real, sem alegar ensaio completo API→persistência financeira ou teste físico.
- Android nativo EAS concluído: [build 3150aa14](https://expo.dev/accounts/hygorf/projects/ponto-obra/builds/3150aa14-fe38-4074-a00e-b6b8582f8290), versão 1.1.0/código 4. [APK piloto](https://expo.dev/artifacts/eas/ibd9YPUuFwcBDKp0a0EnHDLiWq0fqsLSmbqEFVVS8yM.apk). API de **produção** `pontosarcd.vercel.app/api/data`: não inserir pessoas ou batidas fictícias. Gerado da árvore em trabalho; SHA incorporado c7d4e77 é o HEAD anterior, não uma certificação do commit integrado final. Não instalado/testado fisicamente.
- Esse APK não substitui o candidato de homologação. Na sessão Android, usuário preservou A1–A5 (13/10/2026 19:21 UTC), sem custos novos, merge/main ou produção por essa autorização. Supabase isolado `ukkzpttnbyylkyujzwnv` foi criado/verificado pela sessão Android e consultado pela sessão Testes; não foi criado por esta frente. Usuário decidiu **manter deploy Vercel de homologação pendente, sem custo**. URL isolada e dois APKs correspondentes ainda não entregues. Não usar o APK de produção para contornar essa decisão.

## Pendente / configuração necessária

- Obra piloto **K1-10**; **Hygor** responsável pelo celular e conferência. Usuário confirmou Android disponível; instalação e teste físico ainda não executados. Conferir calendário, jornada/regra coletiva e prática das parcelas CLT, sem presumir 50%.
- Leitura da produção encontrou K1-10 cadastrada, sem funcionários ativos com lotação fixa nela. Não foram feitas transferências. A equipe real continua a definir; lotação fixa não impede captura global conforme a arquitetura existente.
- Concluir validação integrada de parcela, saldo, comprovante, conciliação, repetição e captura→ponto web. Confirmar comportamento das pendências de múltiplas obras sem transformar apropriações em salários duplicados.
- Teste físico Android e definição do meio oficial enquanto REP-P tiver pendências formais. Não há evidência de aparelho conectado nesta execução.
- Documentação formal do registrador, responsáveis e acompanhamento real de duas quinzenas/um mês. Não declarar operação ampliada.

## Próximo passo exato

1. Encerrar controles gerais e disponibilizar o candidato identificado/PR à sessão Testes; manter roadmap/acompanhamento aqui e aceite independente na branch de Testes.
2. Reconciliar candidato Android e ambiente isolado dentro da decisão de custo do usuário. Não substituir homologação por produção. Depois executar ensaio integrado com persistência isolada.
3. Com o APK correto e Hygor no aparelho disponível, executar roteiro físico abaixo; só então avaliar liberação assistida K1-10. Publicação do candidato depende dessa liberação, sem confundir build aprovado com operação pronta.

## Cadastros de teste autorizados

Em 25/10/2026, ao perguntar pela equipe, o usuário respondeu: “Por enquanto crie Fulano e Siclano..”. Criados **somente** no projeto isolado `ukkzpttnbyylkyujzwnv`, após conferir `arcd_ambiente.ambiente = homologacao`, em transação idempotente que preserva dados existentes:

- Obra de teste `piloto-k110`, nome K1-10; funcionários `piloto-k110-fulano` (Fulano) e `piloto-k110-siclano` (Siclano).
- Ambos com `testData` e `cadastroPendente`; sem data de início, modalidade escolhida, salários/diárias, CPF, PIX ou documentos inventados. Não aptos ao fechamento da folha até completar os dados necessários.
- Leitura posterior confirmou dois cadastros, nenhum evento de ponto e nenhum título, pagamento ou movimento financeiro. Produção não recebeu esses nomes.
- São preparação de dados de homologação; ainda não acessíveis pelo aplicativo, porque a API isolada continua pendente. Não representam equipe real definida nem ensaio de admissão concluído.

## Roteiro físico K1-10

1. Confirmar responsável, equipe real, jornada e meio oficial de ponto. Aguardar APK de homologação autorizado com API isolada válida; conferir endereço antes de parear. Não usar o APK de produção para ensaios fictícios.
2. Parear o aparelho. Cadastrar biometria com PIN do responsável; conferir bloqueio após tentativas incorretas, inclusive após reiniciar.
3. Capturar marcação real permitida sem rede; verificar “salvo no aparelho/aguardando envio”. Fechar e reiniciar o aparelho; confirmar a fila preservada.
4. Restabelecer rede. Conferir recebimento e reenvio sem duplicar. Verificar contingências câmera/GPS/reconhecimento e aviso de hora não confiável.
5. No web, conferir origem e apropriação. Importar dia completo com classificação explícita; fechar o ponto. Batida tardia continua pendente, sem sobrescrever dia/folha fechados.
6. Preparar diária e parcela CLT, conferir composição com contabilidade e aprovar. Registrar pagamento real somente pelo procedimento financeiro autorizado; conferir saldo parcial e conciliação. Recibo não realiza baixa.

## Registro oficial

`rep-p.js` continua não conforme. A [orientação oficial do MTE](https://www.gov.br/trabalho-e-emprego/pt-br/assuntos/inspecao-do-trabalho/fiscalizacao-do-trabalho/rep) e suas [perguntas e respostas](https://www.gov.br/trabalho-e-emprego/pt-br/assuntos/inspecao-do-trabalho/fiscalizacao-do-trabalho/Perguntas%20e%20Respostas%20REP) exigem comprovações próprias (incluindo INPI, atestado/termo, arquivos e assinaturas aplicáveis). O APK funcional não comprova essas obrigações; manter o meio oficial da empresa enquanto pendentes.

Nenhum pagamento real será executado nesta implantação. Alterações remotas desta frente foram consultas e os dois cadastros de teste expressamente autorizados, somente em homologação; cenários financeiros usam testes isolados.
