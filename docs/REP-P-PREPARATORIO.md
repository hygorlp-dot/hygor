# REP-P - preparatório para a formalização (sem INPI, sem declarar conformidade)

Mapa do que a formalização do REP-P (Portaria MTP 671/2021) vai pedir e do que
o ARCD Ponto de Obra **já tem de base técnica**. É preparação: nada aqui é
declaração de conformidade, o registro no INPI **não** foi iniciado e o AFD
**não** foi implementado. `situacaoRepP()` continua `conforme: false` mesmo com
todos os campos preenchidos (teste "INPI pendente: ... nunca se declara
conforme nesta fase").

Os requisitos abaixo seguem a leitura técnica da equipe e **devem ser
conferidos no texto oficial vigente** e com o responsável jurídico.

| requisito | base técnica que já existe | evidência automatizada | o que falta (não iniciado) |
|---|---|---|---|
| NSR sequencial por estabelecimento, sem lacuna | ARP no servidor (migration 017, `ponto_arp_registrar`) | `arp-migration.pglite.test.js`, `arp-concorrencia.pg.test.js` (Postgres real na CI) | - |
| Registro inalterável | `ponto_arp_registros` append-only (UPDATE/DELETE/TRUNCATE bloqueados) | "UPDATE, DELETE e TRUNCATE bloqueados" | - |
| Hash encadeado | hash fiscal por estabelecimento (SQL = JS) + cadeia local por aparelho | "hash fiscal calculado no SQL é o MESMO do JavaScript" | - |
| Hora rastreável à HLB | fonte de hora + medição NTP.br + referência monotônica no aparelho | `matriz-hora.test.js`, `tempo.test.js` | medição em produção estável; decisão sobre `exigirVerificacao` (REP-P-TEMPO-CONFIAVEL.md) |
| Identificação do empregador/estabelecimento | `ponto_estabelecimentos` (CNPJ/CPF, CNO, CAEPF, CEI, fuso) | `rep-p-dominio.test.js` | inscrições reais cadastradas pela empresa |
| AFD (arquivo fonte de dados) | leitura em ordem de NSR (`registrosEmOrdemDeNsr`) | - | leiaute oficial, geração, hash e assinatura **CAdES** (Fase 2) |
| Comprovante ao trabalhador | comprovante na tela (hora, obra, situação do envio) | `apresentacao.test.js` | comprovante oficial em PDF com assinatura **PAdES** (Fase 2) |
| Identificação do programa | `REP_P` com `nomeOficial`, `desenvolvedor`, `versao` técnica separada da versão do app; ambas no Diagnóstico | "versões de release separadas" | nome oficial, desenvolvedor, **registro no INPI** após congelar a versão final |
| Atestado Técnico e Termo de Responsabilidade | - | - | emissão pelo desenvolvedor depois do INPI |
| Separação tratamento × registro | apropriação por obra (018) fora da ARP, auditada | `apropriacao-migration.pglite.test.js` | tela de tratamento no ARCD |

## Contratos que não podem regredir

O scorecard (`apps/ponto-obra/scripts/mobile-quality-score.mjs`, categoria
"Arquitetura REP-P (técnica)", crítica) falha a CI se:
- algum gate de NSR, atomicidade ou append-only que passava deixar de passar;
- qualquer tela passar a dizer "REP-P conforme" ou "conforme a Portaria";
- `situacaoRepP` deixar de devolver `conforme: false`.

## Ordem sugerida (para decisão, não iniciada)

1. Congelar a versão técnica e definir nome oficial e desenvolvedor.
2. AFD + CAdES e comprovante PAdES (Fase 2), com certificado ICP-Brasil.
3. Registro no INPI da versão congelada.
4. Atestado Técnico e Termo de Responsabilidade.

Cada passo depende de decisão do responsável; nenhum é disparado
automaticamente por esta rodada.
