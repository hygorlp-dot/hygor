# AFD, AEJ, comprovante e auditoria — preparação local

Atualização posterior no mesmo dia: a emissão condicionada de PAdES/CAdES,
o worker privado e a consulta de prontidão foram adicionados. Consulte
[PONTO-ASSINATURA-INPI-20261105.md](./PONTO-ASSINATURA-INPI-20261105.md).
As limitações abaixo descrevem a primeira etapa; não há conformidade global,
registro no INPI ou serviço de assinatura real ativado em produção.

Data: 05/11/2026. Base local: a9b575d0. Branch exclusivamente local:
codex/ponto-fiscal-local-20261105, checkout C:/dev/releases/ponto-fiscal-local-20261105.
Não houve push, PR, build remoto, deploy, migração ou conexão ao banco de produção.
Esta etapa não declara conformidade REP-P nem substitui o registro oficial vigente.

## O que foi implementado

- AFD versão 004: codificação ISO-8859-1, CRLF, posições fixas, registros
  administrativos 2/4/5/6 e marcações REP-P 7, trailer, CRC-16/KERMIT e hash
  específico do leiaute. O vetor oficial 123456789 gera CRC 2189.
- AEJ versão 002: registros 01 a 08 e 99, referências entre REP, vínculo,
  horário e marcação; justificativa e responsável para tratamentos; matrícula
  eSocial em múltiplos vínculos; ausências e banco de horas somente explícitos.
- Comprovante de conferência em PDF, com identidade MARCELL e fonte local,
  empregador, trabalhador, NSR existente, local, fuso, instante original e
  rastreabilidade. O hash do AFD é calculado quando os dados necessários
  existem; o hash interno da ARP não é apresentado como hash oficial.
- Auditoria das cadeias locais, colunas materiais versus payload original,
  cadeia fiscal, NSRs, duplicidades, escopo e topos dos contadores.
- Leitor paginado e somente de leitura das tabelas existentes. Páginas
  limitadas pelo servidor não são confundidas com fim da consulta. O leitor
  compara contadores, aparelhos, estabelecimento e legados ao final.
- Ação interna ponto-fiscal, autenticada e restrita a RH/admin com acesso
  à aba. RH limitado a uma obra não recebe a cadeia global do estabelecimento.
  Não há nova permissão, acesso anônimo ou token de aparelho habilitado.
- Ferramenta offline ponto:fiscal:local para gerar e inspecionar documentos
  a partir de um snapshot JSON. Não carrega .env nem abre conexão de banco.

## Leiautes consultados

Publicados em 31/07/2026 no portal oficial do MTE:

- [AFD](https://www.gov.br/trabalho-e-emprego/pt-br/assuntos/inspecao-do-trabalho/fiscalizacao-do-trabalho/leiaute-do-arquivo-fonte-de-dados-afd.pdf)
  — versão 004. SHA256 do PDF consultado:
  0e7d6c5a967c8e7b211b17e5930a25f26db4db3155a7ed36eac94561bf537cbd.
- [AEJ](https://www.gov.br/trabalho-e-emprego/pt-br/assuntos/inspecao-do-trabalho/fiscalizacao-do-trabalho/leiaute-do-arquivo-eletronico-de-jornada-aej.pdf)
  — versão 002. SHA256 do PDF consultado:
  e1ff56a62f01411a91020633ecf0f68f746f61cbcab55dd9a7d2ec99c71af5dc.
- [Portaria compilada em 21/07/2026](https://www.gov.br/trabalho-e-emprego/pt-br/assuntos/legislacao/portarias-1/portarias-vigentes-3/WORDPortarian671de8denovembrode2021compilada21.07.2026.pdf):
  arts. 74, 79–89, 91 e Anexo IX.

As posições do AFD são preenchidas da esquerda para a direita, com espaços
nas posições não utilizadas, conforme a regra geral do leiaute consultado.
Não se trunca texto, substitui caractere ou inventa inscrição para caber.
Os segundos 00 no TXT atendem ao tipo DH do leiaute; o instante material
original, incluindo segundos e milissegundos, permanece intocado no snapshot
e na rastreabilidade do comprovante. No PDF, a hora visível mantém os segundos reais.

## Semântica do período e das cadeias

AFD: seleção pela data de gravação na ARP, com NSRs originais e cálculo a
partir da cadeia completa. Registros anteriores necessários ao encadeamento
participam do cálculo, sem renumeração. O manifesto registra a âncora anterior
ao período; o validador não reinicia a cadeia como se fosse um arquivo novo.
AEJ: seleção pela data local das marcações, com tratamento explícito.
As duas seleções podem diferir em captura offline enviada posteriormente.

O hash interno fiscal já armazenado continua exatamente como estava. O hash
do leiaute AFD é uma saída derivada, distinta e identificada como tal.
No encadeamento das marcações tipo 7 utiliza-se o hash da marcação anterior.
Os codecs dos demais tipos não criam NSR nem transformam logs administrativos
sem numeração fiscal em registros históricos válidos. Arquivos mistos de
marcações e eventos administrativos são bloqueados nesta etapa: sua cadeia
precisa ser validada contra um histórico administrativo fiscal real, que a
ARP atual não fornece. Não se escolhe uma interpretação por suposição.
A regularização do histórico administrativo exige revisão própria antes de
qualquer liberação oficial; não se deve declarar completude sem evidência.

## Reaproveitamento do RH

O adaptador tratamentoDoPontoExistente usa o cadastro, a escala histórica e
a conferência do RH, sem alterar nenhum deles. Só converte automaticamente:

1. Dia com quatro batidas de tipos explícitos.
2. Conferência com responsável, data e assinatura de origem ainda compatível.
3. Horários da grade iguais às originais e nenhuma indicação de ajuste.
4. CPF compatível com a batida original.

Batidas sem tipo, intervalos sem marcação, grade manual resumida, alteração
do RH, faltas ou conferência desatualizada exigem tratamento por evento.
Não se presume a correspondência de cada ajuste, nem se cria batida de almoço.
Uma ausência de registro não é convertida automaticamente em falta.
Ausências e banco de horas têm contrato explícito e precisam de confirmação.
O adaptador não reconstrói automaticamente quinzenas arquivadas nesta etapa:
é necessário fornecer sua fonte preservada e o tratamento correspondente.

## Bloqueios e pendências reais

O APK18 não grava explicitamente o indicador online/offline exigido no
registro tipo 7. A ausência gera MODO_CAPTURA_NAO_REGISTRADO; não é deduzida
do atraso de recebimento, da fonte de hora ou do relógio do aparelho.
O APK18 não foi modificado para contornar isso.

Também permanecem pendentes: INPI e identificação formal, dados fiscais
completos, histórico administrativo com evidência e NSR, certificado e
integração de assinatura ICP-Brasil (CAdES detached para TXT e PAdES para PDF).
Os antigos registros sem NSR fiscal não são convertidos automaticamente.
Uma informação inexistente não é substituída por zeros, número fictício
ou dado da lotação atual do funcionário.

Todos os artefatos são rascunhos não assinados. O marcador obrigatório do TXT
indica o arquivo P7S esperado, mas não cria esse arquivo nem afirma assinatura.
Validação estrutural não é validação de certificado nem declaração de conformidade.
Uma saída reprovada não é liberada pela ação de exportação.

Não foi criado portal de autoatendimento do trabalhador nem distribuição
automática após cada batida/consulta das últimas 48h. O PDF local pode ser
conferido pelo RH, mas não cumpre sozinho essa obrigação. Não houve alteração
na tela do aparelho, no pareamento, na câmera ou na sincronização do APK18.
Não foram adicionados botões operacionais ao ERP nesta fase local.

## Uso local

Preparar um snapshot JSON com versao, companyId, estabelecimento, contador,
dispositivos, eventos, registros, obras, legados, employees e config. O leitor
capturarSnapshotFiscal usa as tabelas existentes, scoping por empresa e
estabelecimento; não aceita dados fiscais enviados arbitrariamente no body.
As estruturas exatas estão nos módulos fiscal e no fixture exclusivamente
de teste. Nunca usar o fixture como cadastro, carga ou lançamento em produção.

    npm run ponto:fiscal:local -- --entrada CAMINHO_SNAPSHOT.json --saida PASTA_NOVA --tipo auditoria

    npm run ponto:fiscal:local -- --entrada CAMINHO_SNAPSHOT.json --saida OUTRA_PASTA --tipo afd --de 2026-11-01 --ate 2026-11-30

    npm run ponto:fiscal:local -- --entrada CAMINHO_SNAPSHOT.json --saida OUTRA_PASTA --tipo aej --de 2026-11-01 --ate 2026-11-30

    npm run ponto:fiscal:local -- --entrada CAMINHO_SNAPSHOT.json --saida OUTRA_PASTA --tipo comprovante --de 2026-11-01 --ate 2026-11-30 --evento ID_REAL_DA_BATIDA

Cada execução escreve auditoria-integridade.json antes de gerar o documento.
O manifesto registra SHA256 do snapshot e da saída, status de assinatura e
somenteLeitura. Arquivos existentes não são sobrescritos. A auditoria com
integridade reprovada termina com código 2; falha na exportação termina com
código 1 e não repara o dado de origem.

Configuração fiscal é injetada no servidor por lerConfigFiscal. O valor padrão
é nulo, bloqueando a exportação onde faltam informações reais. Não se incluiu
segredo, certificado ou caminho de chave do APK como configuração fiscal.

A ação interna tem body com tipo (auditoria, afd, aej ou comprovante),
estabelecimentoId e, na geração, de/ate; comprovante usa eventId.
Auditoria devolve códigos e referências, sem payload biométrico ou CPF.
AFD/AEJ devolvem bytes em base64 e manifesto; comprovante devolve HTML de
rascunho. A ferramenta local produz o PDF com Chromium e a identidade
compartilhada de relatórios, fontes e logomarca embutidas.

## Exemplos e evidências locais

Os exemplos em output/ponto-fiscal usam apenas dados sintéticos de teste,
identificados dessa forma. Nenhum funcionário fictício foi criado no ERP
ou no banco. O arquivo tmp/ponto-fiscal/snapshot-sintetico.json é um fixture
offline, nunca uma consulta ou alteração de produção.

Comprovante final: output/ponto-fiscal/comprovante-final/comprovante-rascunho.pdf.
AFD e AEJ de exemplo: subpastas afd e aej. Os manifests e auditorias ficam ao lado.
Os PDFs foram renderizados com Poppler e inspecionados visualmente: uma página A4,
sem cortes e com indicação explícita de rascunho.

Validação registrada em C:/Users/hygor/ponto-fiscal-final-tests.log,
ponto-fiscal-lint.log, ponto-fiscal-architecture.log e ponto-fiscal-build.log.
Resultado final: 341 testes direcionados aprovados, cinco ignorados em uma
suíte de PostgreSQL externo. Três verificações adicionais do CLI passaram:
informação de captura ausente bloqueia saída; integridade reprovada retorna
código 2; arquivo existente não é sobrescrito. Lint, design:check,
manual:check, arquitetura (sem violações), sintaxe Node e git diff --check
aprovados. Build Vite concluído com sucesso.
Os testes de PostgreSQL externo dependem de infraestrutura não configurada
nesta execução local; não se afirma validação desse ambiente.
O build foi npx vite build, sem executar o prebuild que contém migrações.

APK18 preservado: SHA256
c44704a3be2cd3a98f82f9a09009ad68a7b3bc1251a9dde4bba113ac30a64e51.
Não houve consulta ou mutação de pagamentos reais, ajustes de batidas,
migrações, reset de sequência, push ou deploy. A identificação REP-P do
produto permanece não conforme enquanto os requisitos não forem comprovados.
