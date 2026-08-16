# Relatório de evolução 10/10 — ARCD Obras

## Status atual

**Não aprovado para classificação 10/10.** A base de código passou nos gates
automatizados disponíveis, mas ainda há módulos sem homologação operacional e
pendências críticas explicitadas na matriz. Este documento evita que um build
verde seja confundido com prontidão de negócio.

> Atualizado em 16/08/2026 (rodada anterior: 26/07/2026).

## Gate de entrada — aprovado

- **215 arquivos de teste e 1.010 testes aprovados** (26/07: 91 arquivos, 423 testes);
- lint de fronteiras financeiras aprovado;
- build Vite e checagem sintática de `api/data.js` aprovados;
- auditoria de dependências: **1 alerta alto** (`brace-expansion`, correção automática disponível, não aplicada) — 26/07 estava em 0;
- `git diff --check` aprovado;
- motor financeiro mantido em modo sombra, sem ativação automática;
- nenhuma migration, deploy, commit, push ou alteração de configuração de
  produção foi executada por esta auditoria.

## Gates ainda abertos

| Gate | Estado | Evidência requerida para fechar |
| --- | --- | --- |
| Segurança e integridade | Aberto | Testes negativos de todas as ações críticas por papel e obra, no servidor. |
| DRE / financeiro canônico | Aberto | Carga idempotente, paridade por obra/empresa, divergência zero e homologação de estorno/baixa. |
| Portal do Cliente | Aberto | Migrations homologadas, publicação interna e homologação de acesso por cliente/obra. |
| Mobile / offline | Aberto | E2E de anexos, conflitos e reconexão em dispositivos reais. |
| Design System | Aberto | Migração das telas críticas e auditoria de contraste, foco e densidade. |
| Performance | **Em andamento** | `LegacyApp.jsx` caiu de 672,44 para 548,33 kB gzip (-18,5%) em 15-16/08 com 4 extrações lazy (Terceiros, Orçamento, Conciliação, Compras). Falta: repetir para Planejamento/CentralAdministrador/Comercial/Folha (fila em `docs/PLANO_REDUCAO_LEGACYAPP_SUPABASE.md`), fechar a reprovação do orçamento TOTAL (pré-existente, crescimento orgânico não relacionado às extrações) e tornar o orçamento um gate real no CI. |
| Limite de deploy Hobby | Parcialmente fechado | Portal consolidado em uma função; CI bloqueia mais de 12 funções. A publicação depende da cota diária da Vercel. |
| Operação | Aberto | Aceite documentado por operadores, engenheiro, compras e controladoria. |

## Fonte de verdade

A avaliação detalhada, a nota provisória de cada módulo e o respectivo critério
de aceite estão em [MATRIZ_MODULOS_10_10.md](./MATRIZ_MODULOS_10_10.md).
