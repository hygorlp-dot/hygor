# Aceite operacional de RH, ponto e pagamentos

Atualizado em 25/10/2026. Este documento responde às perguntas finais de Hygor e inclui a ficha individual do operário. O resultado de cada execução e de cada publicação fica em `RH-PONTO-STATUS.md`; capacidade implementada não equivale a teste físico concluído.

O candidato está no [PR #120](https://github.com/hygorlp-dot/hygor/pull/120), com frontend completo publicado em homologação e consulta real aprovada em computador e tela de celular. Os resultados e seus limites estão na [evidência consolidada da entrega](evidencias/homologacao-2026-10-25.json).

## Fluxo de trabalho

1. **Cadastrar a pessoa.** Escolher para cada funcionário diária, com seu valor, ou CLT mensal, com seu salário. Informar jornada, obra e vigência. Diária e salário são campos independentes; informar um salário não muda automaticamente um cadastro diário. O vínculo contratual permanece separado da forma de remuneração.
2. **Completar a ficha.** Conferir dados pessoais, documentos, ASO, treinamentos e EPIs. Os arquivos ficam no prontuário privado.
3. **Receber e conferir o ponto.** O APK registra as marcações, mantém a fila local e envia ao servidor. O RH/engenharia resolve as pendências antes de importar para o ponto usado no cálculo.
4. **Preparar a quinzena.** Manter os cortes 06–20 e 21–05. Conferir diárias, novos adiantamentos efetivamente pagos e a preparação CLT pertinente. Adiantamentos antigos mantêm suas parcelas e datas, sem exigir baixa retroativa.
5. **Aprovar a obrigação.** A aprovação gera o título financeiro. Para CLT por diária, a apuração mensal exige valores e memória identificada; não existe salário mensal inventado por diária × 26.
6. **Registrar o pagamento.** A baixa financeira informa valor, data, origem e movimento bancário. É possível pagar em partes e acompanhar o saldo. Reenviar a mesma operação não cria outra baixa.
7. **Conferir o mês.** Revisar o fechamento, os comprovantes, o saldo a pagar e as reservas gerenciais. Pagamentos não repetem no custo da DRE o valor já apropriado pelo ponto.

O pagamento quinzenal organiza o caixa. Ele não elimina o fechamento mensal da folha CLT. O app registra o pagamento realizado; não faz uma transferência bancária por conta própria.

## Diária preservada e escolha por funcionário

**O sistema por diária continua em uso e será mantido íntegro.** Um funcionário pode receber por diária enquanto outro recebe CLT mensal, inclusive na mesma quinzena. Cadastros antigos sem vínculo informado não são convertidos em CLT. As mudanças de modalidade e de valores têm vigência e histórico; os pagamentos e fechamentos anteriores são preservados.

No cadastro mensal, o campo **Diária de referência para custeio** é usado no custo do ponto; o salário mensal define o holerite. Não há conversão automática da diária em salário. A combinação de vínculo CLT com remuneração diária continua disponível quando explicitamente definida, com sua memória de apuração própria; ela não é inferida para quem já recebe pela diária comum.

A regressão de [preservação da diária](PRESERVACAO_DIARIA.md) conferiu um líquido diário de R$ 900,00 e uma parcela CLT mensal de R$ 700,00 aprovados na mesma quinzena, sem mudar o histórico pago. Também conferiu os valores independentes no editor e a montagem das exportações PDF/Excel. O lote focal teve 59 testes aprovados em oito arquivos.

## Ficha individual do operário

Entrada pela **Equipe**, na ação da ficha do funcionário. A ficha reúne os dados canônicos existentes, sem criar outro cadastro, outro ponto ou outro razão financeiro.

| Seção | O que o operador encontra |
| --- | --- |
| Resumo e pendências | Itens do cadastro para conferir, documentos ausentes/vencidos, reserva ainda não apurada, adiantamentos a pagar e avisos de engenharia em aberto. |
| Dados | Cadastro pessoal e profissional, vínculo, remuneração, jornada, obra e contato de emergência. A edição reutiliza o cadastro existente. |
| Documentos e fotos | Foto do funcionário, identificação, endereço, contrato, CTPS/registro, dependentes, ASO, treinamentos, EPIs, atestados, férias, holerites e desligamento. |
| Ponto | Consulta por mês, situação do dia, horários, obra, origem e conferência das batidas recebidas. Períodos arquivados podem ser consultados sem restaurar a quinzena; antes de carregar, a tela informa que o dado está em arquivo. |
| Pagamentos | Títulos, valor aprovado, baixas, saldo e histórico financeiro; acesso à folha e às provisões. |
| Histórico | Alterações disponíveis do cadastro, vigências contratuais e salariais, documentos e referências aos avisos. |
| Engenharia | Orientações e ocorrências com obra, autor, data, situação e providências registradas. |

Os documentos aceitam PDF, JPEG e PNG, até 3 MB por arquivo, conforme a política do prontuário. A leitura usa acesso autenticado e URL temporária. Arquivar um documento preserva o histórico e o motivo.

Atestados e documentos pessoais ficam restritos ao RH e administrador. Engenharia recebe dados profissionais e registros operacionais dentro do escopo autorizado. Os avisos são internos ao app web; esta entrega não inclui disparo por WhatsApp, e-mail ou notificação push.

Um arquivo disponível ainda precisa ser conferido pelo RH. O checklist orienta a operação; ele não declara que todos os documentos possíveis de qualquer contrato foram validados. Anexar um PDF de ASO também não altera automaticamente a validade informada no cadastro.

Os 16 documentos sintéticos foram enviados ao prontuário remoto, oito por funcionário. O relatório `.tools/homologacao-seed-report.json` confirma upload e download verificados para os 16 arquivos, com conferência SHA256 após abertura autorizada. Isso comprova a presença e a recuperação dos anexos da simulação; não certifica o conteúdo de documentos reais de admissão. Além dos testes locais descritos em `FICHA_DO_OPERARIO.md`, a ficha passou na consulta real pelo navegador, com login, listagem privada, download do PDF e pagamentos visíveis em computador e tela de celular.

## Respostas às perguntas de aceite

| Pergunta | Resposta verificável e limite |
| --- | --- |
| O RH consegue organizar os pagamentos de CLT e de quem recebe por diária? | Sim, com escolha por funcionário e coexistência na mesma quinzena, preservando o caminho diário existente. O fluxo cobre cadastro, ponto, preparação, aprovação, título, pagamento parcial, saldo e histórico. CLT por diária explícito exige apuração identificada. A liberação para operação real depende dos dados e regras reais da empresa e dos critérios finais ainda pendentes. |
| É possível deixar o valor provisionado? | Há cálculo e registro de reserva gerencial, com pendência quando falta apuração. Para CLT por diária, base, incidências, responsável e memória precisam ser informados. Isso não separa dinheiro em conta bancária nem cria automaticamente uma provisão contábil. |
| Os pagamentos quinzenais ficam registrados? | Novos adiantamentos geram obrigação; a baixa efetiva altera o caixa e libera a compensação conforme as datas. O ensaio remoto aprovou R$ 1.920,00 de adiantamentos fictícios, com baixas parciais, saldo final zero e reenvio sem duplicação. Os registros antigos mantêm o tratamento legado. |
| Web e APK usam o mesmo fluxo? | O navegador real passou na consulta de cadastro, documentos e pagamentos nas duas telas. O APK 7 foi compilado, assinado, conferido e disponibilizado, apontando para a API isolada usada pela gestão; os contratos de identificação, vigência, sincronização e idempotência foram testados. O emulador falhou antes de instalar o app. Instalação, pareamento, fila no aparelho, atualização, câmera, GPS e biometria continuam pendentes no Android estável. |
| A DRE registra automaticamente? | O ponto alimenta o custeio operacional da obra. A API real de homologação confirmou R$ 270,00 de custo antes e depois de R$ 1.920,00 de saídas de caixa simuladas, sem duplicar o custo. Isso não representa automaticamente todos os encargos patronais, provisões contábeis e ajustes da folha oficial. |
| Toda a documentação pessoal pode ser registrada? | O prontuário oferece as categorias operacionais listadas acima, anexos privados e histórico. A completude real depende de o RH enviar e conferir os documentos aplicáveis a cada pessoa, função e contrato. |
| As pendências aparecem? | A ficha e o prontuário mostram cadastro incompleto, documentos a conferir, vencimento, emissão futura, ASO sem validade, avisos abertos e obrigações pendentes. Falha de consulta é apresentada como falha, sem transformar erro em prontuário vazio. |
| A construtora está organizada? | O fluxo de RH/ponto/financeiro foi organizado e tem ensaios reproduzíveis. Isso não comprova, por si, cadastro real completo, quitação bancária, cumprimento de obrigações ou organização de todos os outros setores. |
| Todo o código é útil? | Não há evidência para declarar 100%. A análise estática encontrou candidatos de limpeza e falsos positivos; a avaliação e os limites estão abaixo. |

## DRE, caixa e provisões: o que foi comprovado

O ensaio remoto concluído em 25/10/2026 persistiu adiantamentos fictícios de R$ 1.320,00 para Fulano e R$ 600,00 para Siclano. Cada título teve uma baixa parcial e outra pelo restante. Os reenvios não duplicaram os quatro movimentos, e o saldo desses títulos ficou zerado. A emissão/pagamento foi registrada em 20/10; outubro permaneceu aberto e o relógio não foi alterado.

| Medida no ambiente de teste | Valor e significado |
| --- | --- |
| Custo operacional da DRE | **R$ 270,00**, originados do ponto; não aumentou quando os adiantamentos foram baixados. |
| Saídas de caixa | **R$ 1.920,00**, registradas por quatro baixas sobre o extrato sintético. |
| Saldo de caixa | **−R$ 1.920,00**, pois o cenário não tem entradas. |
| Saldo a pagar desses adiantamentos | **R$ 0,00**, após as quatro baixas. Isso não declara a folha mensal paga ou encerrada. |
| Reserva gerencial | Estimativa/apuração identificada para planejamento. Não é dinheiro separado em banco nem lançamento contábil automático. |

As consultas reais de DRE da obra e da empresa retornaram esses valores, pela fonte `canonical_ledger`, sem questões reportadas. A evidência está em `.tools/homologacao-adiantamentos-report.json` e `.tools/homologacao-dre-report.json`; o segundo relatório informa `engineEnforced: false`. O aceite cobre os valores e a separação entre custo e caixa nessas consultas, sem declarar um motor fiscal obrigatório ou provisões contábeis completas. Nenhuma transferência bancária real foi feita.

## Consulta real pela gestão publicada

O ensaio remoto de leitura passou em **74,359 segundos**, entre **21:38:38 e 21:39:52 UTC de 25/10/2026**, no frontend do commit `012604ac698a8fcd14c2c0f65f5b2e9128661ea5`. Foram conferidos computador, 1440 × 1000, e tela de celular, 390 × 844, com login real e respostas reais da API.

Nas duas telas, Fulano e Siclano tiveram as sete abas conferidas. O cadastro mostrou salário mensal de R$ 3.300,00 e referência de custeio de R$ 150,00 para Fulano; diária de R$ 120,00 para Siclano, sem conversão em salário mensal. A massa fictícia mantém vínculo CLT explícito nos dois; a preservação do funcionário diário antigo continua coberta pela regressão própria. O editor foi somente consultado, sem salvar alterações.

O prontuário listou oito documentos por pessoa. Quatro downloads privados foram acionados pela tela, um PDF de cada pessoa em cada contexto, e tiveram seu SHA256 conferido; os arquivos temporários foram apagados. Os pagamentos mostraram R$ 1.320,00 e R$ 600,00 pagos, duas baixas por título e saldo zero. Os hashes de cadastro, ponto e financeiro ficaram iguais antes e depois, sem tentativa de mutação.

O relatório `.tools/homologacao-web-report.json` terminou aprovado, sem erros JavaScript, de console ou HTTP, e sem falhas inesperadas de requisição. Os quatro cancelamentos de navegação associados ao início dos downloads são esperados e estão identificados no relatório. As duas tentativas anteriores pararam antes do login por configuração de rede/CA do runner; a correção ficou restrita ao proxy e à confiança do processo temporário de testes, mantendo TLS ativo e sem alteração do app. Não foram gerados screenshots pessoais, vídeos ou traces. Essa prova é do web e não do APK instalado em Android.

## Uso do código e limpeza

Foi executada a ferramenta Knip com a configuração já existente no repositório. O levantamento inicial encontrou quatro arquivos e 108 exportações sem consumo detectado, além das dependências `motion` e `tailwindcss`.

- Os quatro arquivos são entradas reais do fluxo de homologação, acionadas por CLI e pelo empacotador. A configuração atual só declara `scripts/*.mjs` como entrada, por isso perde os scripts da subpasta.
- `tailwindcss` é usado nos imports de `src/index.css` e na configuração de CSS. Sua indicação é um falso positivo.
- `motion` não teve import encontrado no código web analisado; é candidato a remoção em uma limpeza isolada, com build e revisão do lockfile.
- As 108 indicações são exportações, não 108 funções comprovadamente mortas. Há usos internos, testes de integração fora do escopo, constantes públicas e arquivos compartilhados com o mobile.
- A análise atual não cobre integralmente o aplicativo Android. Não houve remoção em massa de código nem atualização de dependências nesta entrega.

O gerador de publicação passou a usar o manifesto do build atual. No checkpoint medido, isso retirou **54 arquivos compilados antigos** do pacote enviado, reduzindo-o de 169 para 115 arquivos e de 13.975.768 para 9.898.323 bytes. É limpeza do artefato de publicação; não significa exclusão de 54 arquivos-fonte úteis.

## Evidências e próximos critérios

As provas têm escopos diferentes e devem continuar identificadas:

- `SIMULACAO_COMPLETA_FULANO_SICLANO.md`: ciclo local completo com API real e Postgres local, marcações, folha, pagamentos, DRE e auditoria; relógio e captura física controlados no teste.
- `FICHA_DO_OPERARIO.md`: sete seções, privacidade, avisos auditados, consulta ao ponto arquivado e provas locais de API e navegador.
- `PRESERVACAO_DIARIA.md`: convivência diária/CLT mensal, valores independentes, vigências, adiantamentos antigos, histórico e relatórios.
- `REVISAO_PROVISOES_PRONTUARIO.md`: falhas reproduzidas, correções e limites das reservas/documentos/indicadores.
- `ENSAIO_REMOTO_ADIANTAMENTOS.md`: roteiro e resultado do ensaio financeiro isolado, sem transferência real.
- `HOMOLOGACAO-VERCEL-SUPABASE.md`: ambiente, isolamento, implantação e verificações de acesso.
- `apps/ponto-obra/docs/BUILD-LOCAL-HOMOLOGACAO.md`: compilação, assinatura, identidade das fontes e verificação do APK.
- `RH-PONTO-STATUS.md`: situação final da execução, testes e pendências reais de aceite.

Na rodada final, encerrada às 21:15:55 UTC de 25/10/2026, foram **3.113 testes aprovados, nenhuma falha e 13 ignorados, de 3.126 testes; 423 arquivos aprovados e dois ignorados, em 433,47 segundos**, com `success: true` e saída zero em `.tools/validation-delivery/tests-exit.json` e `tests.json`. Os lotes de NTP e das rotas auxiliares tiveram 58 e 32 testes aprovados, respectivamente; seus resultados estão descritos em `HOMOLOGACAO-VERCEL-SUPABASE.md`. Os registros `lint.log`, `architecture.log` e `typecheck.log` confirmam os demais gates. **O build Vite final passou em 3,00 segundos**, com saída zero em `build-exit.json`. Os 16 documentos remotos e a consulta real da gestão também têm os relatórios de aprovação descritos acima.

As fontes do APK 7 foram reconferidas: 63 arquivos, sem alterações, com hash de fontes `316884caba0bca7dc1676f0ce3322e0e40fcbdd41aad1d17fcc3a072781b1dc7`. A publicação final do frontend e o ensaio do navegador remoto estão aprovados. **Permanece pendente o teste físico do APK**; build, assinatura e navegação web não comprovam instalação, pareamento ou captura no aparelho.

A validação para a obra precisa usar o Android da equipe e dados reais conferidos pelo responsável. A simulação não deve ser migrada para o cadastro operacional. A declaração formal do registrador de ponto permanece a que está no código; não é alterada por este relatório.
