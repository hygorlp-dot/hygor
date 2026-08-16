# Relatório de evolução 10/10 — ARCD Obras

## Status atual

**Não aprovado para classificação 10/10.** A base de código passou nos gates
automatizados disponíveis, mas ainda há módulos sem homologação operacional e
pendências críticas explicitadas na matriz. Este documento evita que um build
verde seja confundido com prontidão de negócio.

> Atualizado em 16/08/2026, segunda rodada do dia (rodada anterior: 26/07/2026).

## Gate de entrada — aprovado

- **215 arquivos de teste e 1.010 testes aprovados** (26/07: 91 arquivos, 423 testes), estável após fechar a fila de extração e aplicar as correções de bug desta rodada;
- lint de fronteiras financeiras aprovado (script ajustado para a nova localização de `MedicoesView`);
- build Vite, `architecture:check` (dependency-cruiser) e checagem sintática de `api/data.js` aprovados;
- auditoria de dependências: **1 alerta alto** (`brace-expansion`, correção automática disponível, não aplicada — sem relação com o trabalho desta sessão) — 26/07 estava em 0;
- `git diff --check` aprovado;
- motor financeiro mantido em modo sombra, sem ativação automática;
- nenhuma migration, deploy, commit, push ou alteração de configuração de
  produção foi executada por esta auditoria.

## Depuração pós-extração (nova nesta rodada)

Com a fila de extração de UI fechada (8/8 itens), uma auditoria dirigida
varreu os módulos extraídos e os pontos de interação entre eles. 3 bugs
reais foram corrigidos (falso "sucesso" em decisões financeiras não
confirmadas pelo servidor em Compras e Terceirizados; uma métrica
internamente inconsistente em Terceirizados; uma conta duplicada em
Conciliação). 2 achados que exigem decisão de produto/arquitetura — não
bugs óbvios de corrigir às cegas — foram registrados como tarefas
separadas em vez de corrigidos nesta sessão: (1) o `update()` otimista de
`LegacyApp.jsx` não desfaz o estado local quando o servidor rejeita
definitivamente uma gravação; (2) Terceirizados e Compras calculam alguns
totais financeiros fora do adaptador canônico `calcVisaoFinanceira`, com
risco de divergência da mesma figura noutras telas. Detalhes em
[MATRIZ_MODULOS_10_10.md](./MATRIZ_MODULOS_10_10.md), seção "Achados da
depuração pós-extração".

## Gates ainda abertos

| Gate | Estado | Evidência requerida para fechar |
| --- | --- | --- |
| Segurança e integridade | Aberto | Testes negativos de todas as ações críticas por papel e obra, no servidor. |
| DRE / financeiro canônico | Aberto | Carga idempotente, paridade por obra/empresa, divergência zero e homologação de estorno/baixa. |
| Portal do Cliente | Aberto | Migrations homologadas, publicação interna e homologação de acesso por cliente/obra. |
| Mobile / offline | Aberto | E2E de anexos, conflitos e reconexão em dispositivos reais. |
| Design System | Aberto | Migração das telas críticas e auditoria de contraste, foco e densidade. |
| Performance | **Em andamento** | `LegacyApp.jsx` caiu de 672,44 para 462,95 kB gzip (-31,2%) em 15-16/08 com a **fila completa de 8 extrações lazy** (Terceiros, Orçamento, Conciliação, Compras, Planejamento, CentralAdministrador, Comercial, Folha/Medições) — `docs/PLANO_REDUCAO_LEGACYAPP_SUPABASE.md` fechada. Falta: corrigir a reprovação do orçamento TOTAL de bundle (pré-existente, ~28 kB antes de qualquer extração desta sessão, não resolvida por code-splitting já que o total pouco mudou) e tornar o orçamento um gate real no CI. |
| Limite de deploy Hobby | Parcialmente fechado | Portal consolidado em uma função; CI bloqueia mais de 12 funções. A publicação depende da cota diária da Vercel. |
| Operação | Aberto | Aceite documentado por operadores, engenheiro, compras e controladoria. |

## Fonte de verdade

A avaliação detalhada, a nota provisória de cada módulo e o respectivo critério
de aceite estão em [MATRIZ_MODULOS_10_10.md](./MATRIZ_MODULOS_10_10.md).
