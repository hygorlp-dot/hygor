# Índice de desenvolvimento do MARCELL

Revisão: 18/11/2026. Este índice aponta responsabilidades; não substitui os
documentos nem transforma propostas antigas em comportamento implementado.

A adoção local e as evidências desta organização estão no
[registro de implementação de 18/11/2026](MELHORIAS-FLUXO-DESENVOLVIMENTO-20261118.md).

## Fontes para começar

| Assunto | Fonte | Como usar |
| --- | --- | --- |
| Regras comuns de trabalho, negócio, DRE, segurança e publicação | [AGENTS.md](../AGENTS.md) | Obrigatório em qualquer cliente; complementar com o AGENTS do subdiretório. |
| Entrada do Claude Code | [CLAUDE.md](../CLAUDE.md) | Importa a fonte comum, sem copiar políticas. |
| Comandos e cobertura real | [Validação local](VALIDACAO-LOCAL.md), [package.json](../package.json), [workflow de qualidade](../.github/workflows/quality.yml) | Scripts e configurações determinam o que executa; relatórios antigos não comprovam aprovação atual. |
| Continuidade de trabalho | [Retomada de tarefas](RETOMADA-DE-TAREFAS.md) | Registrar estado verificado, pendências e recursos sem duplicar decisões duráveis. |
| Interface vigente | [DESIGN.md](../DESIGN.md), [padrão de interface](PADRAO-INTERFACE.md), [regras de UX/UI](REGRAS-UX-UI.md) | Aplicar em conjunto com skills e tokens; não usar paletas de auditorias antigas. |
| Ajuda ao operador | [Fonte da ajuda](../src/features/help/help-content.js), [manual gerado](MANUAL_DO_APP.md) | A fonte editável é a ajuda; o manual é derivado. |
| Revisão independente | [Roteiro de revisão](PROMPT_REVISAO_CLAUDE_CODE.md), [guardião do DRE](../.claude/agents/dre-integration-guardian.md) | Definir escopo, evidências e limites; revisão não autoriza correção ou publicação. |
| App Android | [AGENTS do Ponto de Obra](../apps/ponto-obra/AGENTS.md) | Instruções específicas e restrições de Expo, captura e REP-P. |

## Arquitetura, produto e histórico

- [ADR-001](ADR-001-MONOLITO-MODULAR.md) registra a decisão de monólito modular.
- [Arquitetura ARCD](ARQUITETURA_ARCD.md) contém estado histórico e arquitetura-alvo,
  com revisão de julho de 2026. Conferir cada afirmação de estado atual no código.
- [Plano de redução do LegacyApp](PLANO_REDUCAO_LEGACYAPP_SUPABASE.md) guarda
  medições e decisões históricas; suas contagens não são medições de hoje.
- `PRODUCT.md` local descreve principalmente equipe e ponto e está ignorado
  pelo Git. É contexto parcial, não especificação completa de todo o ERP.
- Relatórios datados, auditorias e documentos de deploy registram evidências do
  recorte executado. Confira revisão, código e dados antes de reutilizar conclusões.
  Um arquivo presente ou modificado localmente não prova que foi publicado.

## Ferramentas e evolução da análise

Os guias em `docs/tools/` registram decisões, alternativas e limites. Consultar
[TypeScript progressivo](tools/typescript-progressivo.md),
[dependency-cruiser](tools/dependency-cruiser.md), [Knip](tools/knip.md),
[Playwright](tools/playwright.md), [Zod](tools/zod.md) e [Sentry](tools/sentry.md)
antes de ampliar seu escopo ou instalar uma alternativa.

As primeiras melhorias são explicitar cobertura e usar os gates existentes.
Novas regras ESLint/React só entram após medir uma lacuna concreta e seu impacto;
não instalar ESLint e Biome em conjunto por padrão, impor teto global de 350
linhas, reformatar o legado ou ampliar baselines. Refatorar por responsabilidade
e consumidores, preservando os contratos e testes financeiros.

O [Vibe Coding Toolkit](https://github.com/soumatheusgomes/vibe-coding-toolkit)
foi referência para a organização das instruções, validação e retomada. Não há
instalação ou sincronização automática com ele. RTK, Graphify, Context7 e memória
externa não são pré-requisitos deste fluxo; adoção futura exige necessidade,
compatibilidade, escopo e evidência de funcionamento. Nenhuma mudança de
framework, banco, modelo ou serviço é implícita.
