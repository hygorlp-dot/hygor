# RH, ponto e pagamentos — implantação por obra

Contexto oficial recebido em 25/10/2026. [Acompanhamento único](RH-PONTO-STATUS.md).
Posição em 26/10/2026: **D6 parcialmente validado; D7 condicionado** ao percurso autenticado no Android, à conferência do RH e ao aceite operacional documentado.

## Objetivo e decisões

Obra piloto confirmada: **K1-10**. Responsável pelo celular e conferência: **Hygor**. Disponibilidade do Android físico a confirmar; teste físico pendente. Entregar uma operação inicial utilizável para a nova obra em até sete dias de trabalho. Manter pagamentos quinzenais, pessoas por diária e mensalistas CLT na mesma rotina. Vínculo, remuneração e custo da obra são conceitos separados. Diária não significa autônomo; salário mensal não é diária × 26.

Preservar cortes atuais 06–20 e 21–05 até validação operacional. Separar corte, competência mensal e data de pagamento. Não presumir parcelas iguais ou adiantamento de 50%. Usar valores vigentes, dias/frações aprovados, eventos e adiantamentos identificados, compensados uma única vez. Períodos pagos e versões aprovadas permanecem preservados; diferença posterior exige ajuste com motivo/autor.

Estados distintos: salvo no aparelho → aguardando envio → recebido no servidor → dia conferido → fechamento aprovado → pagamento confirmado → conciliado. Falta de sincronização nunca vira falta. Recibo não prova pagamento/assinatura. Preservar marcações e obra de captura; conferir apropriação sem duplicar remuneração. Financeiro, conciliação e DRE existentes são a fonte; não criar segunda obrigação ou saída.

## Primeira semana — entregas e critérios planejados

As janelas descrevem o plano original; a posição comprovada está registrada abaixo. Elas não representam percentuais de conclusão.

| Janela | Entrega e critério |
|---|---|
| D1 | Canonizar contexto; corrigir retroatividade no cadastro geral, avos/base rescisória, atraso, biometria e hora confiável. |
| D2 | Cadastro por modalidade; verificar pareamento, autorização biométrica, persistência local e sincronização; iniciar build Android. |
| D3 | Lista de registros recebidos/pendências no web, justificativas e apropriação; evitar redigitação de batidas. |
| D4 | Preparar quinzena mista, preservando competência CLT, parcelas informadas e composição por funcionário. |
| D5 | Aprovar fechamento e encaminhar ao financeiro existente, com saldo, pagamento parcial e conciliação idempotentes. |
| D6 | Verificar fluxo completo, aparelho físico e contingência; roteiro curto. Sem aparelho, entregar build quando possível e registrar pendência física. |
| D7 | Candidato para operação assistida da nova obra, com responsável, suporte e pendências explícitas. |

### Posição atual e limites de D6

**D6 está parcialmente validado.** Os marcos D1–D5 têm implementação e ensaios
documentados em seus respectivos checkpoints; isso não declara concluído o
histórico de operação real. Sete mensagens visíveis foram corrigidas, com
33 testes focais aprovados. A alteração de layout entrou no APK 10, mas foi
reprovada no ensaio com teclado. O APK 11, fonte `832c440`, tem gates locais
e build conferidos, atualização interna reconciliada e recusa MARCELL
confirmada. A largura das oito casas passou; o aceite visual integral é
inconclusivo.

Os gates locais gerais terminaram com **3.155 testes aprovados, 13 ignorados
e nenhuma falha**, em 427 arquivos aprovados e dois ignorados. Lint,
arquitetura, TypeScript, build web e diff-check terminaram com código zero;
1.420 fontes permaneceram estáveis. O código está publicado na
[PR #121](https://github.com/hygorlp-dot/hygor/pull/121), commit
`64c8b7b52b256e0d83847bbdf84cbe6dc9f13936`. O Edge de homologação v9 está
ACTIVE, com 12/12 arquivos remotos iguais ao payload revisado. O frontend
Vercel está READY no mesmo commit em https://ponto-homologacao.vercel.app.
Os identificadores completos ficam no acompanhamento único. Não houve
promoção para produção.

O CI remoto de `64c8b7b` não foi repetido (`[skip ci]`), por restrição de custo
e sem cota de artefatos confirmada. Os gates acima são locais, registrados e
vinculados a `64c8b7b`. A fonte `832c440` tem um lote próprio, descrito abaixo;
a suíte geral de 3.155 testes não foi repetida para ela.
Não há nova nota de scorecard mobile nesta rodada. A consulta pública da API
retornou HTTP 200 e houve smoke de login em desktop; viewport mobile web e
consulta autenticada não foram executados nesta rodada.

O APK 9 mantém sua prova histórica de atualização 8→9, abertura e recusa
pública de código inexistente; não comprova pareamento válido, captura ou fila
pendente. O APK 10 teve a segunda tentativa de build aprovada às 14:47:41 UTC
e conferência final às 14:48:56 UTC, com fonte `64c8b7b`, manifesto estável e
árvore limpa. São 61.200.534 bytes, somente x86_64, com nova chave. O artefato
não foi distribuído. Foi instalado às 15:25:27 UTC como app novo sobre uma
cópia descartável do SO do clone 9 offline. O APK 9 foi removido somente da
cópia, a ausência do pacote foi comprovada e a instalação ocorreu sem `-r`.
Não foi upgrade 9→10 nem execução em Android virgem.

A sonda pública confirmou HTTP 200/TLS padrão. No app, um código sintético
foi enviado uma vez às 15:33:25 UTC e recebeu a recusa real MARCELL. As
consultas SQL de 15:30:15 e 15:35:06 UTC mantiveram um dispositivo, um
pareamento usado e código ausente. O app permaneceu não pareado.

**O layout do APK 10 foi reprovado:** teclado cobre o botão, swipe não revela
a ação e a linha das oito células está cortada nas extremidades. Sem teclado,
o erro é legível, mas o botão fica fora da área inicial; o alcance por rolagem
complementar não foi estabelecido. Esse resultado do APK 10 permanece
reprovado, independentemente da aprovação técnica do build seguinte.

O APK 11 usa o commit `832c440fe7f8227407699011b357474a98e9b717`. Seus gates
locais terminaram às 15:52:40 UTC, com **401 testes aprovados, cinco ignorados
e nenhuma falha**, em 42 arquivos aprovados e um ignorado. Cobrem todo o app
mobile e os domínios/servidor de ponto eletrônico; lint, arquitetura,
TypeScript, build Vite e diff-check também passaram, com 1.421 fontes estáveis.

O build do APK 11 terminou às 16:07:15 UTC e foi conferido às 16:09:16 UTC:
61.200.638 bytes, x86_64, 69 fontes móveis estáveis e checkout limpo ao final.
O ZIP de recursos e os CRCs das 947 entradas foram aprovados. O certificado
é o mesmo do APK 10 e diferente dos APKs 8/9. A atualização interna 10→11
teve timeout do cliente após 180 s e foi reconciliada sem repetição, por
PackageManager versão 11 e SHA instalado às 16:30:15 UTC. firstInstallTime e
dataDir foram preservados; não houve prova de fila ou sessão pareada.

Uma única tentativa sintética, às 16:45:08.773 UTC, exibiu a recusa MARCELL
às 16:45:34.882 UTC. SQL antes/depois manteve ambiente homologacao, código
ausente, um dispositivo e um pareamento usado, sem afirmar imutabilidade
de toda a base. A sonda Java HTTP 200 foi uma verificação separada.

**As oito casas passaram em largura; o gate visual integral é inconclusivo.**
A rolagem com IME deslocou o conteúdo, mas o alcance completo da mensagem e
do botão não foi demonstrado. Na captura 03, ambos estavam fora do viewport
inicial e não houve novo gesto. A causa não foi determinada. Não se conclui
corte persistente nem aprovação visual completa. A limpeza às 16:47:58 UTC
terminou sem erros, com AVD/relay parados e 28 hashes protegidos iguais.

Uma segunda rodada no mesmo APK 11, sem recompilar ou reinstalar, completou
o boot entre 16:58:17.142 e 17:01:32.263 UTC e confirmou a versão pelo
PackageManager. A reconferência de integridade foi interrompida por timeout:
40 segundos no `sha256sum` Android e 60 segundos na leitura integral via ADB,
registrados às 17:03:01.125 e 17:06:11.918 UTC, respectivamente. A causa da
lentidão não foi determinada. Não houve configuração de rede, interação
de UI ou outro envio sintético. O total do APK 11 permanece em uma tentativa;
as provas da primeira rodada continuam válidas. O gate visual não foi
resolvido. A limpeza final da segunda rodada terminou às 17:08:27.645 UTC,
sem erros, com cópia/monitor parados e 28 hashes protegidos iguais. O relay
nunca foi iniciado; a limpeza de proxy, CA e reverse da primeira rodada
permaneceu preservada.

O APK não foi distribuído. Edge/web continuam em `64c8b7b`; o commit documental
posterior não altera a fonte de nenhum APK. A nota automática 9,7 é histórica,
sem nova nota desta rodada. **PR #121 permanece aberta, sem merge até demonstrar
o gate visual; PR #120 permanece draft. D6 parcial e D7 não liberado.**

A tentativa anterior em AVD virgem falhou antes de instalar o app; sua limpeza
registrou zero erros e 28 hashes originais iguais. A limpeza do clone usado
no APK 10 terminou às 15:42:23 UTC: proxy restaurado, reverse/CA removidos,
AVD/relay parados, zero erros e 28 hashes protegidos iguais. Cópia e assinatura
do ensaio foram preservadas offline. O ANR inicial era
do System UI e recebeu “Aguardar” uma vez; não há avaliação de desempenho.

A chave antiga não foi recuperada nesta sessão. O certificado do APK 10 difere do APK 9;
esse build não comprova upgrade da linhagem 8/9 nem migração de pareamento,
histórico ou fila. Os artefatos e dados antigos permanecem preservados.
Os hashes e o escopo estão na [evidência atual](evidencias/d6-fechamento-2026-10-26.json).
APK 10 e frontend publicado permanecem vinculados a `64c8b7b`; o APK 11
compilado corresponde a `832c440`. A documentação posterior não recompila
nem altera essas fontes.

A disponibilidade do Android físico precisa ser confirmada. O acesso legítimo
do operador é necessário para gerar o pareamento e realizar a conferência RH.
O PIN autorizado é exigido nos fluxos pertinentes, como cadastro biométrico,
e não em cada marcação. O contrato `exigirVerificacao: false` foi preservado.
O percurso autenticado está pendente por falta de acesso legítimo. Nesta
rodada, nenhuma credencial foi redefinida, nenhuma validação de autenticação
foi removida e nenhum dado de pareamento foi editado diretamente.

O roteiro separa o lote de 20 capturas para persistência/reenvio da prova de
duas ou quatro batidas por pessoa/dia para conferência RH. Vinte batidas da
mesma pessoa no mesmo dia não serão tratadas como jornada importável. A
situação de outubro e os adiantamentos sintéticos pertencem ao ensaio
financeiro histórico; esta rodada não os reconfirmou por nova consulta nem
executou fechamento remoto. Uma continuidade autorizada deverá reconferir
e reaproveitar os mesmos IDs, sem repetir obrigações, pagamentos ou
compensações. Uma apuração mensal local com relógio controlado terá esse
escopo explícito; não será declarada operação mensal real.

**D7 continua condicionado** à conclusão e ao registro do percurso autenticado,
da conferência RH, da contingência e do aceite operacional. Build, gates e
implantação de homologação permitem avançar tecnicamente, mas não registram
essas etapas como concluídas. A disponibilidade e o teste do aparelho físico
continuam como pendências. A ampliação de uso mantém o critério de duas
quinzenas consecutivas e um fechamento mensal reais acompanhados.

Uma lista de pendências e uma ação principal por tela. Manter identidade MARCELL, componentes e navegação; detalhes/fórmulas sob demanda. Casos fora das regras validadas recebem apuração identificada da contabilidade, nunca estimativa apresentada como definitiva.

## Sequência restante

1. Regras, saldos e correções críticas.
2. Cadastro único e rotina simples.
3. Mobile e ponto integrado.
4. Documentos e rotinas de RH.
5. Fechamento quinzenal e competência mensal.
6. Financeiro, contabilidade e custo por obra.
7. Conclusão formal do registrador.
8. Piloto contínuo.
9. Expansão e estabilização.

Depois da primeira semana: portal completo, documentos/férias/afastamentos mais automáticos, escalas/banco de horas se adotados, férias/13º/rescisão completos, banco automático, indicadores, polimento e expansão. Eventos reais continuam tratados por responsável mesmo sem automação.

## Critérios e estados de liberação

Demonstrar com dados de teste: diária e CLT juntos; corte entre meses; valor com vigência; offline/reinício/reenvio sem duplicar; recebimento tardio após fechamento; transferência de obra; adiantamento único; pagamento parcial; repetição idempotente; retroatividade bloqueada/revisada; perfis; totais fechamento/obrigações/pagamentos; recuperação e contingência.

Separar **pronto para operação assistida**, **piloto em acompanhamento** e **validado para operação ampliada**. A última exige duas quinzenas consecutivas e um fechamento mensal reais acompanhados. Testes não substituem esse histórico. O app é candidato controlado enquanto os requisitos oficiais do REP-P não estiverem comprovados; preservar meio oficial definido pela empresa e rótulo atual em rep-p.js.

## Reaproveitamento

Equipe, histórico, employee commands e versões; attendance-engine e fechamentos; Ponto de Obra Android/SQLite cifrado/fila; ARP e apropriação; Folha/Holerites/Provisões; adiantamentos; razão financeiro, conciliação e DRE; prontuário privado; relatórios MARCELL e testes existentes. Auditoria anterior: [RH](AUDITORIA_RH.md). Limites da folha: [Holerite CLT](HOLERITE_CLT_CARUARU.md).
