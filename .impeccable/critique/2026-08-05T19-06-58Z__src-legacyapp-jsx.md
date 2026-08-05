---
target: obras
total_score: 20
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
timestamp: 2026-08-05T19-06-58Z
slug: src-legacyapp-jsx
---
# Crítica de design — Central de obras

## Saúde do design

| # | Heurística | Nota | Questão principal |
|---|---|---:|---|
| 1 | Visibilidade do estado do sistema | 2/4 | Contadores e sincronização existem, mas operações críticas dependem de toast e não mantêm progresso visível. |
| 2 | Correspondência entre sistema e mundo real | 4/4 | Fases, contratos, equipe, prazo, administração e caixa refletem corretamente a construção civil. |
| 3 | Controle e liberdade | 2/4 | Não há desfazer ao mover obras; recuperação de mudanças de fase é fraca. |
| 4 | Consistência e padrões | 2/4 | Tipografia, sombras, gradientes e tamanhos locais divergem do ARCD Carbon. |
| 5 | Prevenção de erros | 1/4 | Cadastro financeiro carece de validações cruzadas e bloqueio de dupla submissão. |
| 6 | Reconhecimento em vez de memorização | 3/4 | Filtros e estados são visíveis, mas alertas condensados escondem o caminho de correção. |
| 7 | Flexibilidade e eficiência | 1/4 | Há busca e duas visões, mas faltam ações em lote, ordenação e aceleradores. |
| 8 | Estética e design minimalista | 2/4 | A hierarquia funciona, porém cards e cabeçalho repetem sinais e ações demais. |
| 9 | Reconhecimento, diagnóstico e recuperação de erros | 2/4 | Erros são legíveis, mas ficam em toasts distantes dos campos e sem trilha de recuperação. |
| 10 | Ajuda e documentação | 1/4 | Falta ajuda contextual sobre fases, completude, alertas e consequências financeiras. |
| **Total** |  | **20/40** | **Aceitável; melhorias significativas necessárias.** |

## Veredito de especificidade

**Avaliação independente:** a superfície é genuinamente própria da ARCD em conteúdo e fluxo. “Requer atenção”, prazo contratual, fase, equipe, modalidade de contrato, administração sobre custos, caixa e OneDrive formam um instrumento de gestão de obras, não um dashboard SaaS genérico. A visão horizontal por fases é a expressão mais autêntica da assinatura planejamento → execução → controle.

A especificidade visual é menor: a visão em painel usa cards com capa, sombras, gradientes, `Inter`, pesos 850–900 e muitos tamanhos locais. Isso contradiz a linguagem ARCD Carbon — IBM Plex, tokens compartilhados, superfícies estruturais e pouca decoração.

**Varredura determinística:** foram encontrados 84 alertas no monólito, mas apenas um pertence à seção Obras: `side-tab` em `src/LegacyApp.jsx:7650`, na borda colorida do card do Kanban. É um provável falso positivo contextual, pois reforça semanticamente a fase já indicada pela coluna. Os outros 83 achados estão fora do escopo. A fase, contudo, não deve depender apenas da cor.

**Evidência visual:** não há overlay visível. A ferramenta de navegador recusou a URL como não segura; o fallback HTTP confirmou produção acessível com status 200, mas não permitiu avaliar renderização autenticada ou responsividade.

## Impressão geral

A Central de obras começa bem: orienta, prioriza e oferece duas leituras úteis do portfólio. O maior desperdício ocorre depois do diagnóstico. A interface diz que uma obra exige atenção, mas não leva diretamente à correção; quando o usuário abre o cadastro, encontra uma operação financeira extensa com pouca prevenção e recuperação.

## O que funciona

1. **Arquitetura orientada a decisões reais:** os filtros “Requer atenção”, “Em execução” e “Prazo próximo” refletem a operação, não categorias abstratas.
2. **Painel e fluxo se complementam:** o painel localiza e compara; o quadro acompanha fases. A alternativa “Mover para” reduz a dependência de arrastar no celular.
3. **Integridade do quadro foi considerada:** obras órfãs são reposicionadas, há conferência de contagem e estados vazios úteis.

## Problemas prioritários

### [P1] Cadastro crítico sem prevenção suficiente

**Por que importa:** datas, percentuais, parcelas, entrada e vencimentos alimentam cobrança e DRE. Combinações inconsistentes podem gerar erro financeiro silencioso.

**Correção:** validação inline por seção; coerência entre início/fim, entrada/contrato, percentuais e parcelas; estado `Salvando…`; bloqueio de duplo clique; revisão resumida antes de confirmar regras financeiras.

**Comando sugerido:** `$impeccable harden`

### [P1] Alterações de fase sem auditabilidade e recuperação

**Por que importa:** mover, criar, renomear, excluir e ordenar fases altera o estado compartilhado da operação, mas usa atualizações diretas, sem autor/data, conflito ou desfazer.

**Correção:** comandos transacionais versionados, permissões explícitas, histórico de autor/data e ação “Desfazer” após movimento ou reordenação.

**Comando sugerido:** `$impeccable harden`

### [P1] Controles inacessíveis e microtipografia

**Por que importa:** seletores visuais implementados como `div`, cores sem nomes acessíveis, busca sem rótulo, textos de 7,5–10 px e controles de 27–32 px prejudicam teclado, leitor de tela, baixa visão e uso em campo.

**Correção:** checkbox/radio nativos, `aria-pressed`, nomes de cor, rótulo da busca, tokens `--arcd-type-*` e alvos de 44 px no mobile.

**Comando sugerido:** `$impeccable audit`

### [P2] Alertas identificam risco, mas não conduzem à correção

**Por que importa:** o card mostra a primeira pendência e `+N`; o usuário precisa investigar onde corrigir, contrariando a promessa de “decisão agora”.

**Correção:** expandir todas as pendências e oferecer ações contextuais como “Definir engenheiro”, “Vincular cliente”, “Completar endereço” e “Revisar prazo”.

**Comando sugerido:** `$impeccable clarify`

### [P2] Linguagem visual diverge do ARCD Carbon

**Por que importa:** a tela parece uma exceção dentro do produto e reduz previsibilidade para quem alterna módulos durante o dia.

**Correção:** consumir tokens tipográficos, reduzir pesos extremos, retirar sombras/gradientes decorativos e tornar a linha planejamento → execução → controle o elemento visual dominante.

**Comando sugerido:** `$impeccable polish`

## Sinais de alerta por persona

**Marina — administradora/financeiro:** precisa configurar contrato, base da administração, parcelas, vencimentos, entrada e caixa numa única superfície, sem validação cruzada ou revisão. Pode descobrir um cadastro inconsistente apenas na cobrança ou DRE.

**Rafael — engenheiro de campo no celular:** encontra filtros e ações com 27–32 px, textos de 8–10 px e não consegue desfazer um movimento acidental. Ícones compactos para editar/excluir fase aumentam o risco de toque incorreto.

**Joana — colaboradora nova/usuária de teclado:** não entende quais dados compõem “Qualidade do cadastro”; `+2` não revela pendências; falsos checkboxes e botões de cor não comunicam estado a tecnologia assistiva.

## Observações menores

- “Metragem quadrada (m)” deve ser “Área (m²)”.
- “Arraste uma obra pra cá” deve ser “Mova uma obra para esta fase”, incluindo teclado e celular.
- “Prazo próximo” inclui também prazos vencidos; o rótulo é impreciso.
- O placeholder da busca não menciona fase, embora ela seja pesquisável.
- Um identificador derivado da posição no array não é estável após reordenação/exclusão.
- `window.confirm("Remover obra?")` é menos informativo que a confirmação de exclusão de fase.
- Cores livres de fase podem colidir com verde/amarelo/vermelho reservados para estados.

## Perguntas a considerar

- Se “Requer atenção” é a promessa central, por que cada pendência não pode ser resolvida diretamente no card?
- O cadastro deve ser um único modal ou um fluxo “Identificação → Contrato e cobrança → Revisão”?
- Quem pode criar, ordenar ou excluir fases compartilhadas?
- “Qualidade do cadastro” mede qualidade real ou somente preenchimento?
- Uma obra vencida pertence a “Prazo próximo” ou merece categoria própria?
