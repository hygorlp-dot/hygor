# REP-P — Tempo confiável e Hora Legal Brasileira

## O que a norma pede (a conferir no texto oficial)

Fontes secundárias sobre a Portaria MTP 671/2021 (Anexo IX, cujos requisitos
técnicos teriam passado para os anexos da Portaria MTE 1.486) dizem que o
REP-P deve manter relógio sincronizado com a **Hora Legal Brasileira (HLB)**
disseminada pelo **Observatório Nacional (ON)**, com variação de **até 30
segundos**. Esse valor está em `TOLERANCIA_HLB_MS`
(`server/ponto-eletronico/tempo/fonte-hora.js`) e **precisa ser conferido no
texto oficial vigente** antes da homologação.

## Como a HLB chega ao servidor

O ON não oferece API HTTP de hora. A disseminação pública na internet é feita
pelo **NTP.br** (NIC.br), por acordo com o ON: os servidores stratum 1
`a.st1.ntp.br`, `b.st1.ntp.br`, `c.st1.ntp.br` e `d.st1.ntp.br` são
sincronizados com relógios atômicos de responsabilidade do Observatório
Nacional, rastreados ao UTC.
(<https://www.ntp.br/conteudo/estrutura/>, <https://ntp.br/faq/>)

Arquitetura adotada, que é tecnicamente defensável e **não declara
conformidade**:

```
NTP.br stratum 1 (ON, relógio atômico)
        │  SNTP (UDP 123) - medição, não ajuste
        ▼
ponto-tempo-verificar (cron diário + admin)  ──►  ponto_tempo_verificacoes
        │                                         (offset, atraso, incerteza,
        │                                          estrato, servidor, quando)
        ▼
fonte de hora oficial (TimeAuthority)
  hora = relógio do host (Vercel/AWS, já sincronizado por NTP do provedor)
  evidência = última medição boa + política de tolerância
        │
        ├─► ARP: gravadoEm e evidencia_hora de cada registro fiscal
        └─► aparelho: referência de hora na sincronização (ponto-sincronizar)
```

- A fonte de hora **não ajusta** relógio nenhum (o servidor não controla o
  relógio do host). Ela **mede** o desvio do host contra a HLB e anexa a
  medição como evidência.
- O cliente SNTP (`tempo/ntp.js`) segue a RFC 4330. Ele consulta os quatro
  servidores e fica com a medição de menor atraso. Incerteza = dispersão raiz
  do servidor + metade do atraso de ida e volta.
- **A validar em produção:** se as funções da Vercel permitem UDP de saída.
  Se não permitirem, a medição é gravada com `ok = false` e o erro, e a
  evidência continua dizendo `host` / `nao_verificada`. Nada é inventado.
  Alternativa nesse caso (Fase 2): medir a partir de um ponto que tenha UDP
  (rotina externa/worker) e gravar pela mesma ação.

## Política de tolerância (`POLITICA_PADRAO`)

| Situação | `status` | `confiavel` |
|---|---|---|
| medição recente, desvio + incerteza ≤ 1 s (meta interna) | `verificada` | sim |
| medição recente, ≤ 30 s (tolerância citada) | `dentro_da_tolerancia` | sim |
| medição recente, > 30 s | `fora_da_tolerancia` | **não** |
| última medição boa com mais de 30 h | `verificacao_vencida` | conforme `exigirVerificacao` |
| nenhuma medição | `nao_verificada` | conforme `exigirVerificacao` |

`exigirVerificacao` começa `false`, para não piorar o comportamento atual
enquanto a medição em produção não é validada. Ligar essa opção (e decidir a
meta) **REQUER DECISÃO DO RESPONSÁVEL** na homologação. Com ela ligada, sem
medição válida, a referência entregue aos aparelhos sai com
`fonteConfiavel = false` e as batidas saem com `horaConfiavel = false`, mas
**continuam sendo registradas**.

## Validades e verificação diária (valores centralizados)

| Constante | Onde | Valor | Por quê |
|---|---|---|---|
| `IDADE_MAXIMA_REFERENCIA_MS` (TIME_AUTHORITY_REFERENCE_MAX_AGE) | `src/domains/ponto-eletronico/relogio.js` | 7 dias | Validade da referência **no aparelho**. O relógio monotônico do Android deriva pouco (ordem de segundos por semana), bem abaixo dos 30 s citados, e a obra pode passar alguns dias sem internet sem perder a confiabilidade. Depois disso a batida continua sendo registrada, mas sai com `horaConfiavel = false`. A confirmar na homologação. |
| `FRACAO_AVISO_VENCIMENTO` | idem | 0,8 | A partir de 80% da validade (~5,6 dias), o diagnóstico mostra "próxima do vencimento". |
| `VALIDADE_VERIFICACAO_MS` | `server/ponto-eletronico/tempo/fonte-hora.js` | 30 h | Validade da **medição NTP** do servidor. A rotina mede uma vez por dia e, no plano atual da Vercel, pode atrasar dentro da hora; 30 h cobrem esse atraso sem deixar a evidência vencer. |
| `TOLERANCIA_HLB_MS` / `META_INTERNA_MS` | idem | 30 s / 1 s | Tolerância citada para o REP-P (a conferir) e meta interna. |

Verificação diária (`ponto-tempo-verificar`, `vercel.json`, 09:00 UTC):
- **tempo-limite:** 3 s por servidor;
- **novas tentativas:** a mesma rodada tenta os quatro servidores stratum 1 e
  fica com a medição de menor atraso. Não há repetição em laço: uma rodada
  que falha inteira é gravada com `ok = false` e a próxima é no dia seguinte
  (ou manual, pelo admin);
- **falha não apaga nada:** a evidência usa sempre a **última medição boa**
  (`ok = true`). Uma verificação que falha não derruba a referência válida; só
  a passagem da validade (30 h) a torna `verificacao_vencida`;
- **aparelho offline durante a renovação:** ele mantém a referência que já
  tem e continua confiável até `IDADE_MAXIMA_REFERENCIA_MS`; ao voltar, a
  primeira sincronização renova a referência.

Diagnóstico do aparelho (modo Encarregado): última validação da hora, idade da
referência e estado (`nunca validada`, `válida`, `próxima do vencimento`,
`expirada`, `aparelho reiniciou`). Nada disso impede a batida. O app fala em
"referência temporal válida" e **nunca** em "sincronizado com a HLB",
porque isso ainda não é comprovável.

## Evidência registrada

- Servidor, a cada sincronização e gravação: `source` (`host` ou
  `host+ntp:<servidor>`), `serverTime`, `observedAt`, `offsetMs`,
  `uncertaintyMs`, `lastVerifiedAt`, `status`, `confiavel`. Vai para o aparelho
  (`tempo`) e para `ponto_arp_registros.evidencia_hora`.
- Aparelho, na referência: `servidorMs`, `monotonicoMs`, `bootId`, `fonte`,
  `fonteConfiavel`, `offsetHlbMs`, `verificadaEm`, `latenciaMs`.
- Evento: `horaConfiavel`, `fonteHora`, `idadeReferenciaMs` (tempo desde a
  referência), `divergenciaMs` (relógio do celular × hora estimada) e
  `relogioAlterado`. Todos entram no hash local.

## No aparelho (preservado da fase anterior)

- Hora da batida = `servidorMs + (elapsedRealtime agora − elapsedRealtime da referência)`
  (`src/domains/ponto-eletronico/relogio.js`). Mudar a hora do celular não
  muda a hora da batida; só fica registrado (`relogioAlterado`).
- Reboot: o monotônico zera e `BOOT_COUNT` muda. Sem referência do boot atual,
  a batida usa o relógio do celular e sai `horaConfiavel = false` até
  sincronizar. Aparelho sem `BOOT_COUNT` usa o instante aproximado do boot
  como identificador, o que erra para o lado seguro.
- Referência com mais de 7 dias → `horaConfiavel = false`.
- Nada disso impede a batida.

## O que falta para comprovação final de HLB

1. Conferir no texto oficial vigente (Portaria 671 / Portaria 1.486) o
   requisito exato de sincronismo e tolerância.
2. Validar em produção se a medição UDP funciona na Vercel. Se não funcionar,
   implantar o medidor fora dela.
3. Decidir `exigirVerificacao` e a frequência de medição (hoje diária, pelo
   limite de rotinas do plano).
4. Avaliar NTS (NTP autenticado) para a medição. O cliente atual não
   autentica a resposta.
5. Laudo/atestado técnico (Fase 3), que precisa citar essa evidência.
