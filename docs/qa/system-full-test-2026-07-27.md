# Auditoria completa do sistema — 27/07/2026

## Resumo executivo

Auditoria executada na branch `feat/integrated-production-platform`, a partir
do commit `2eb8b3f`. Os testes de navegador usaram um backend isolado em
memória; nenhum cadastro, lançamento financeiro ou documento real foi criado,
alterado ou excluído.

O gate técnico da aplicação foi aprovado após as correções:

- 107 arquivos de teste e 480 testes aprovados;
- 13 cenários E2E aprovados em mobile, tablet, paisagem e desktop;
- build, typecheck, fronteira financeira e auditoria de dependências aprovados;
- razão financeiro e golden masters sem divergências;
- cobertura global de 79,32% em statements e 87,92% em linhas;
- zero vulnerabilidades conhecidas no `npm audit`.

## Resultado por módulo

| Módulo | Resultado | Evidência principal |
|---|---|---|
| Login, sessão e PIN | Aprovado | E2E de PIN inválido, testes de API e rate limit |
| Perfis e permissões | Aprovado | 66 testes direcionados de RBAC, projeção e concorrência |
| Obras | Aprovado | smoke de navegação e testes de projeção por obra |
| Equipes e funcionários | Aprovado | fluxo E2E com funcionário e obra isolados |
| Ponto | Aprovado | persistência, recarga, bloqueio, jornada, atraso, HE, P/M/F |
| Folha | Aprovado | custo diário canônico, benefício, HE, atraso e arquivamento |
| Rescisão | Aprovado | smoke e regressão financeira |
| Terceirizados | Aprovado | mutações, pagamentos, cancelamentos e smoke |
| Orçamento | Aprovado | baseline, cálculo e testes de regressão |
| Compras, cotação e fornecedores | Aprovado | cadeia, permissões, cancelamento e cálculos |
| Estoque e suprimentos | Aprovado | saldo, recebimento, consumo, risco e planejamento |
| Medições | Aprovado | competência, recebimento, cancelamento e faturamento |
| Financeiro e conciliação | Aprovado | razão, baixa, estorno, duplicidade e golden master |
| DRE empresa/obra | Aprovado | projeções idênticas por obra e consolidado |
| Planejamento e produção | Aprovado | CPM, PPC, progresso, restrições e smoke |
| Qualidade, RDO e segurança | Aprovado | testes de domínio e abertura em navegador |
| Comercial | Aprovado | migração, transições e smoke de todas as áreas |
| Portal do cliente | Aprovado | autenticação, política, projeção e componente |
| Relatórios e planilhas | Aprovado com observação | parser/exportadores testados; abertura real de arquivo continua dependente do aplicativo do operador |
| IA | Aprovado no frontend | rotas abrem sem erro; resposta externa depende da configuração Gemini |
| Mobile | Aprovado | 320×568, 360×800, 390×844, 430×932, 768×1024 e 844×390 |

## Defeitos encontrados e corrigidos

### Ponto e folha

1. O bloqueio usava a lotação atual em vez da obra selecionada ou gravada no
   lançamento. Corrigido para resolver a obra do próprio registro.
2. Engenheiros viam ações de transferência e demissão que o servidor negava.
   As ações agora aparecem somente para administrador e RH.
3. `attendanceLocks` não era projetado, autorizado e mesclado por obra.
   A seção agora é protegida e preserva locks de outras obras.
4. O engenheiro não conseguia finalizar o ponto da própria obra e o fluxo
   tentava regravar o `changeLog` global. O lock por obra é permitido e a
   auditoria permanece no servidor.
5. No mobile, a regra de grade do login colocava as abas uma sobre a outra.
   A regra agora preserva o `TabsList`.
6. O atalho mobile do Ponto não tinha nome acessível. Foi adicionado
   `aria-label`.
7. Horas extras eram exibidas, mas não compunham Folha, DRE, custos arquivados
   e projeção servidora. Todos usam agora `calculateAttendanceDayCost`.
8. Hora extra podia permanecer em uma falta. Trocar para falta ou limpar o
   status remove HE e jornada incompatíveis.
9. `getAtt` descartava silenciosamente campos de jornada e valores congelados
   do histórico. A normalização agora preserva todos os campos.
10. Não existia jornada de entrada, intervalo, retorno, saída ou atraso.
    Foi criado um domínio puro de timekeeping, com validação, jornada noturna,
    persistência, interface mobile e desconto auditável na folha/DRE.

### Financeiro

1. Relatórios gerenciais e o contexto do CFO/IA ainda somavam diárias
   diretamente. Ambos passaram a usar o mesmo cálculo canônico do DRE.
2. O rateio da Folha por obra ignorava o desconto de atraso. O valor alocado
   agora fecha com o bruto do funcionário.
3. Hora extra e atraso são calculados em centavos a partir da diária, jornada
   e adicional configurados, preservando os valores congelados no arquivo.

### Autenticação

1. Falhas de PIN por IP também podiam bloquear sessões JWT válidas na mesma
   rede. Sessões autenticadas deixaram de participar do contador de PIN.
2. O login por e-mail chamava o provedor antes de verificar o limite. A
   limitação agora ocorre antes da autenticação e usa IP + e-mail.
3. Um login bem-sucedido não limpava falhas anteriores. Foi criada a RPC
   restrita `auth_rate_limit_success` e o fallback local correspondente.
4. A migration original do rate limit possuía `blocked_until-now` em uma
   expressão SQL, interpretando `now` como coluna. Foi corrigida para
   `blocked_until-now()` e validada pelo próprio gate produtivo.

## Conferência numérica

- Presença com diária de R$ 100,00, jornada de 8h, adicional de 50% e 2h
  extras: HE de R$ 37,50 e mão de obra de R$ 137,50.
- Presença com diária de R$ 80,00 e atraso de 30 minutos: desconto de R$ 5,00
  e mão de obra de R$ 75,00.
- Entrada 07:00, intervalo 12:00–13:00 e saída 17:00: 540 minutos (9h).
- Entrada 07:15 e saída 16:45, sem intervalo: 570 minutos e 15 minutos de atraso.
- Jornada 22:00–06:00, intervalo 01:00–01:30: 450 minutos.
- Golden master financeiro aprovado por obra e no consolidado.
- Compras comprometidas, custos reconhecidos, caixa, contas a pagar/receber,
  baixa parcial, estorno e prevenção de duplicidade aprovados.

## Testes executados

```text
npm ci
npm test
npm run test:coverage
npm run typecheck
npm run lint
node --check api/data.js
npm run architecture:check
npm run quality:knip
npm run build
npm run quality:bundle
npm audit --audit-level=moderate
npm run test:e2e
```

Resultados finais:

```text
Vitest:     107 arquivos / 480 testes aprovados
Playwright: 13 testes aprovados
Coverage:   79,32% statements / 61,32% branches /
            79,28% functions / 87,92% lines
Bundle:     LegacyApp 592,06 KiB gzip (abaixo do gate de 600 KiB)
Audit:      0 vulnerabilidades conhecidas
Arquitetura: 443 módulos / 871 dependências, sem violações
```

## Evidências de persistência do Ponto

O cenário E2E:

1. autentica um engenheiro;
2. confirma a equipe da própria obra;
3. marca presença;
4. registra jornada e atraso;
5. registra hora extra;
6. alterna meio período e falta;
7. confirma a limpeza de valores incompatíveis;
8. salva novamente;
9. aguarda o `save-sections`;
10. recarrega a página;
11. confirma funcionário, obra, data, jornada e status;
12. finaliza o Ponto;
13. confirma o lock persistido e a ausência de escrita global indevida.

O mesmo cenário foi aprovado em seis dimensões de viewport, sem overflow
horizontal.

## Riscos e ações operacionais

1. As migrations de rate limit são idempotentes e fazem parte do gate de build
   produtivo. A publicação deve comprovar sua execução junto com a homologação
   financeira em sombra.
2. O bundle principal passou no gate, porém permanece próximo do limite
   (592,06 de 600 KiB gzip). Novas telas devem continuar sendo carregadas sob
   demanda.
3. O relatório do Knip indica arquivos e exports preparados ainda não ligados
   ao runtime. Não foram removidos nesta auditoria porque incluem fronteiras de
   migração em andamento e a remoção exigiria uma revisão de produto separada.
4. Integrações externas de Gemini, Supabase, OneDrive e abertura de arquivos
   dependem das credenciais e serviços do ambiente produtivo; os contratos,
   políticas e fallbacks locais foram testados sem expor segredos.

## Recomendação

O código está aprovado para publicação. O build produtivo deve encerrar com
zero divergências na homologação financeira e com as RPCs de rate limit
aplicadas antes de liberar a nova versão.
