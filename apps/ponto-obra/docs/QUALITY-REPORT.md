# Relatório de qualidade: rodada de evolução do Ponto de Obra

Gerado em 20/10/2026, ao fim da 3ª e última passada do loop
AUDIT → TEST → SCORE → POLISH. As notas vêm do scorecard objetivo
(`scripts/mobile-quality-score.mjs`, método em `QUALITY-SCORECARD.md`), não de
avaliação subjetiva. O histórico das passadas está em `quality/passadas.json`.

## Identificação

| | |
|---|---|
| SHA inicial (main) | `f3b4555` |
| SHA da passada final | `74414bc` (branch `claude/optimistic-wozniak-n1idcy`, PR #62) |
| appVersion | 1.1.0 |
| versionCode | atribuído pela EAS no build (`appVersionSource: remote`, `autoIncrement` nos perfis `piloto` e `producao`); aparece no Diagnóstico |
| Versão do software REP | 0.2.0-tecnica (não registrada) |
| Expo / React Native | 57.0.30 / 0.86.3 |
| Bundle Android | 8,4 MB, com os 2 modelos `.tflite` |
| Prebuild | aprovado: SQLCipher, `allowBackup=false`, permissões, autolinking, 1 atividade exportada (MAIN/LAUNCHER) |

## Notas por categoria (scorecard)

| Categoria | main (passada 1) | passada 2 | final (passada 3) | teto atual |
|---|---:|---:|---:|---|
| Robustez Android | 8,7 | 9,3 | **9,3** | 9,3 até haver 3 aparelhos aprovados na matriz |
| Operação offline * | 8,5 | 10 | **10** | |
| Integridade * | 9,3 | 10 | **10** | |
| Segurança local * | 9,2 | 10 | **10** | |
| Sincronização | 10 | 10 | **10** | |
| Multiobra | 6,0 | 10 | **10** | |
| Reconhecimento facial | 3,6 | 8,7 | **8,7** | 8,7 até haver medição FAR/FRR em campo |
| UI/UX trabalhador | 0 | 9,0 | **9,0** | 9,0 até validação visual em aparelho |
| UI/UX encarregado | 0 | 9,0 | **9,0** | idem |
| Acessibilidade * | 0 | 10 | **10** | |
| Governança de release | 3,3 | 10 | **10** | |
| Diagnóstico | 5,0 | 10 | **10** | |
| Arquitetura REP-P (técnica) * | 10 | 10 | **10** | |
| CI / testes * | 8,0 | 10 | **10** | |
| **Geral** | **5,8** | **9,7** | **9,7** | |

\* categoria crítica: regressão contra `quality/baseline.json` bloqueia a CI.

Notas 0 na main significam **sem evidência automatizada**, não que a interface
não existisse. A main também não tinha os testes e documentos que os gates
pedem. A passada 3 não subiu a nota: o restante depende de evidência física.

### Contra as metas da auditoria

| Item da auditoria | Antes | Meta | Situação |
|---|---:|---:|---|
| UI trabalhador | 6,4 | ≥ 9,0 | 9,0 no scorecard (teto: falta validação em aparelho) |
| UI encarregado | 6,2 | ≥ 9,0 | 9,0 (idem) |
| Release | 7,5 | ≥ 9,0 | 10 |
| Facial | 8,0 | ≥ 8,7 | 8,7 (teto: falta medição de campo) |
| Diagnóstico | 8,8 | ≥ 9,2 | 10 |
| Android | 9,0 | ≥ 9,3 | 9,3 (teto: matriz sem aparelho aprovado) |
| Segurança | 9,2 | ≥ 9,4 | 10 (P2 de `FLAG_SECURE` documentado) |
| Sincronização | 9,2 | ≥ 9,4 | 10 |
| Multiobra | 9,3 | ≥ 9,5 | 10 |
| Offline | 9,4 | ≥ 9,5 | 10 |
| Integridade | 9,5 | ≥ 9,6 | 10 |
| CI | 9,6 | ≥ 9,7 | 10 |
| Arquitetura REP-P | 8,8 | ≥ 9,2 | 10 nos gates técnicos |
| REP-P formal | 4,5 | (teto) | sem mudança: INPI, AFD, CAdES, PAdES e atestado pendentes, nada iniciado |

As escalas não são a mesma régua: a auditoria foi qualitativa e o scorecard
conta gates objetivos. Onde o scorecard dá 10, quer dizer "todos os gates
automatizáveis passam", não "perfeito em campo".

## Gates e achados

- **Bloqueios na passada final: 0. Regressões: 0.**
- Impeccable (rodada 3): **P0 = 0, P1 = 0.** P1 corrigidos: cópia "nesta obra" contradizia o funcionário global; hora no fuso do aparelho. P2 corrigidos: tela Funcionários; versões e build no Diagnóstico. P3 corrigidos: versão REP redundante; parênteses aninhados. Pendentes: P2 validação em aparelho e `FLAG_SECURE`; P3 cancelar reconhecimento em andamento e câmera alta no tablet.
- Bugs achados e corrigidos nesta rodada:
  - release-check passava `EXPO_OFFLINE=""`, que a CLI recusa e quebrava bundle e prebuild na CI;
  - 8 pacotes um patch atrás do SDK 57, o que quebrava o `expo-doctor` também na main;
  - o scorecard só casava o título do `it` e ignorava o `describe`.

## Testes

| Escopo | Resultado |
|---|---|
| Ponto de Obra: app, domínio, servidor e migrations (release-check) | 305 passando, 5 pulados (concorrência em Postgres real, que roda no job próprio) |
| Raiz completa (vitest) | 2.493 passando, 5 pulados; lint ✔ |
| Migration 018 em PGlite | 8 testes: banco novo, 016→017→018 com dados, sobreposição, versão, auditoria, cancelamento, permissões, reversão |
| ARP em Postgres real (CI `rep-p-arp-postgres`) | verde |
| Robustez física (`robustez-fisica.test.js`) | 9 testes: banco reaberto, timeout, 500/200, rede no meio do lote, GPS, câmera |
| Matriz de hora (`matriz-hora.test.js`) | 6 cenários |
| Facial sintético | FAR 0 / FRR 0 nos cenários favorável e obra; FRR 35% no adverso; gêmeos sem margem: FAR 15% (por isso a margem existe) |
| Visual | 30 cenas × 3 tamanhos, 0 estouro, 0 alvo < 44 (harness web, não aparelho) |

## Performance

Não há medição em aparelho físico. As métricas de cold start, carga dos
modelos, identificação e batida já são coletadas no app (Diagnóstico →
Desempenho), mas os valores precisam vir da matriz de dispositivos. O único
número medido é o tamanho do bundle: 8,4 MB.

## CI

- `mobile-ponto-obra`: release-check `--ci` + artifact `mobile-quality-report`. **Verde** em `74414bc`.
- `migration-contracts` (com a 018), `rep-p-arp-postgres`, `browser-critical-flows`: verdes.
- `financial-and-security`: vermelho só no passo `npm audit` da raiz. Já falha na main desde 05/10; a correção exige `tailwindcss@4` e deve ir em PR próprio.

## Pendências

**Físicas (sem elas os tetos não sobem):**
- 3 aparelhos aprovados na [matriz](device-matrix.md) pelo [checklist](checklist-aparelho.md);
- medição de FAR/FRR em campo com rostos reais ([calibracao-facial.md](calibracao-facial.md));
- validação visual no Android: Plex, safe area, fonte grande, sol, TalkBack;
- testes de anti-spoof com foto impressa e tela, registrados sem imagem.

**Técnicas:** `FLAG_SECURE` (P2); limpeza de bancos arquivados (P3); cifra da foto da batida antes do envio (P3).

**Normativas e jurídicas (não iniciadas):** AFD + CAdES, comprovante PAdES, registro no INPI, atestado técnico ([REP-P-PREPARATORIO.md](../../../docs/REP-P-PREPARATORIO.md)); decisão sobre `exigirVerificacao` ([REP-P-TEMPO-CONFIAVEL.md](../../../docs/REP-P-TEMPO-CONFIAVEL.md)); termo de consentimento citar a biometria em todos os aparelhos da empresa ([privacidade-e-retencao.md](privacidade-e-retencao.md)).
