---
target: tela Equipamentos (src/domains/equipamentos/components/EquipamentosView.jsx)
total_score: 24
max_score: 40
na_heuristics: 
p0_count: 2
p1_count: 2
timestamp: 2026-08-17T20-05-44Z
slug: mains-equipamentos-components-equipamentosview-jsx
---
# Crítica de Design — Tela "Equipamentos" (ARCD Obras)

**Method: dual-agent (A: revisão de design · B: detector + evidência visual, ambos isolados)**

**Nota de método**: o protocolo padrão pede injeção de detector em navegador ao vivo. Isso foi substituído por 8 screenshots reais capturados via Playwright com dados fictícios (login/dados fake, componentes e CSS de produção reais), porque a tela exige login de produção e credenciais reais nunca são usadas por política de segurança.

## Design Health Score

| # | Heurística | Nota | Achado-chave |
|---|---|---|---|
| 1 | Visibilidade do status do sistema | 3 | Banner "Alterações ainda não salvas" aparece em todas as abas mesmo sem edição — fadiga de alarme |
| 2 | Correspondência com o mundo real | 4 | Vocabulário fiel ao domínio (horímetro, aditivo, medição vs. fatura) |
| 3 | Controle e liberdade do usuário | 3 | Sem "desfazer" pós-exclusão; `window.prompt`/`confirm` oferecem menos controle visual que o `Modal` próprio |
| 4 | Consistência e padrões | 2 | 3 ações de alto risco fogem do design system para dialogs nativos do navegador |
| 5 | Prevenção de erros | 2 | Ótimo bloqueio de sobrealocação; péssimo `window.prompt` de data em texto livre, sem validação |
| 6 | Reconhecimento vs. memorização | 2 | Mapa de ocupação exige memorizar 8 códigos de 1 letra + associação cor-obra via legenda distante |
| 7 | Flexibilidade e eficiência | 2 | Sem ações em lote; só busca global |
| 8 | Estética e minimalismo | 2 | Grade de ocupação repete "livre X" idêntico em 24+ células por linha; bordas decorativas de 3px em cards violam o próprio "sem decoração gratuita" do DESIGN.md |
| 9 | Recuperação de erros | 3 | `showToast(result?.reason || padrão)` propaga o motivo real do servidor na maioria das gravações |
| 10 | Ajuda e documentação | 1 | Nenhum tooltip para conceitos confusos (medição x fatura, aditivo x renovação, códigos do mapa) |

**Total: 24/40 (60%) - Aceitável.** Nenhuma heurística é n/a nesta superfície.

## Veredito de especificidade de design

Parcialmente autoral - forte no vocabulário, genérico exatamente nos momentos de maior risco. A favor: PageHero+TabRow com linha dourada, superfícies planas sem sombra, KPIs em mono tabular, vocabulário de domínio real. Contra: C.blue (#0F62FE, Blue 60 padrão do IBM Carbon) e C.purple (#4A148C) não documentados em DESIGN.md, usados extensivamente como cor de estado. O detector mecânico confirmou de outro ângulo: 5 sites em index.css (equipment-report-brand, equipment-report-status, equipment-work-report-head, equipment-location-summary) e o componente MiniKpi usam borda decorativa de 3px sobre cards - padrão que o próprio DESIGN.md proíbe ("sem decoração gratuita", "cards não devem flutuar"). Duas evidências independentes (julgamento qualitativo + varredura mecânica) apontam para o mesmo problema.

Falsos positivos descartados: marcador de manutenção é ponto de 4x4px, não borda; nav mobile "duplicada" é artefato de stitching do Playwright sobre elemento sticky; botão dourado tem contraste correto (~9:1).

## Carga cognitiva

6 de 8 itens falham, 2 parcialmente atendidos. Piores: modal de checkpoint expõe ~15 campos num único grid sem seções; modal "Novo equipamento" achata SINAPI + imagem + dados + 8 campos de tarifa + situação + aquisição numa tela só.

## Jornada emocional

Pico positivo na entrada (KPIs do PageHero). Vale profundo nas 3 exclusões (window.confirm/prompt genéricos). Pico de recuperação no fluxo de fatura ("Emitir com saldo aberto" nomeia a consequência real). Vale de campo: "Fotos (uma URL por linha)" é impraticável sem passo de upload.

## O que está funcionando

1. Copy do botão de fatura ("Emitir com saldo aberto") nomeia a consequência real.
2. Bloqueio proativo de sobrealocação com números exatos antes de submeter.
3. Andaime estrutural repetido (PageHero+TabRow com linha dourada) cria identidade estável nas 6 sub-abas.

## Problemas prioritários

**[P0] Ações destrutivas/financeiras usam window.confirm/window.prompt nativos**
excluirEquip, excluirLoc, encerrarLoc fogem do Modal próprio nas 3 ações de maior risco. window.prompt para data é texto livre sem validação. Fix: Modal de confirmação padrão + Inp type="date". Comando: harden

**[P0] Checklist de campo pede "Fotos (uma URL por linha)" e achata 15+ campos**
Impraticável no canteiro. Fix: etapas (identificação -> estado físico -> evidência/fotos -> assinatura), captura/upload real. Comando: shape

**[P1] Paleta de estado não documentada + padrão decorativo confirmado por 2 avaliações**
Azul/roxo Carbon puro não declarados em DESIGN.md; bordas decorativas de 3px violam "sem decoração gratuita". Fix: documentar a paleta real ou remover as bordas. Comando: document

**[P1] Tamanhos de fonte hardcoded (8,5-12,5px) ignorando os tokens --arcd-type-***
Viola a governança do DESIGN.md; legendas abaixo de 9px. Comando: typeset

**[P2] Botões de ação de card no mobile ficam 4px abaixo do mínimo de toque exigido**
`.equipment-card-actions>button{min-height:40px}` contraria o DESIGN.md (mínimo 44px) e é inconsistente com classes irmãs no mesmo arquivo já corretas. Comando: adapt

**[P2] Grade "Mapa de ocupação" repete texto idêntico em cada célula**
"livre 8" repetido em 24+ colunas por linha. Comando: distill

## Red flags de persona

**Alex (power user)**: cores de obra colidem acima de 6 obras ativas; sem ação em lote; sem atalho local.
**Sam (acessibilidade)**: fontes de 8,5-9,5px hardcoded; dialogs nativos menos previsíveis para leitor de tela; codificação por 1 letra+cor sem redundância textual.
**Persona de campo**: fotos por URL inutilizável sem upload; alvo de toque confirmado abaixo do mínimo; sem salvar rascunho.

## Observações menores

- KPI "Frota ativa 14 un." vs. badge da aba "Frota 3" exige reconciliar duas escalas.
- "Materializar cadastro" (migração rara/quase irreversível) usa o mesmo destaque visual de "Nova locação" (ação do dia a dia).
- Não fica claro no modal de cadastro qual imagem prevalece até salvar.

## Perguntas provocativas

1. Por que as três ações de maior risco financeiro fogem do design system da própria empresa?
2. Quem preenche "Fotos (uma URL por linha)" parado no canteiro, e o que acontece quando fica em branco?
3. DESIGN.md ou o código: qual está desatualizado quanto à paleta de estado?
4. "Ocupação da frota 33%" e "Dias ociosos 62" ajudam a agir, ou só relatam?
5. Por que o checklist de devolução - maior chance de disputa/litígio - é o formulário menos guiado da tela?
