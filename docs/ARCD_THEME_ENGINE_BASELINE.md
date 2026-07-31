# ARCD Theme Engine — linha de base e fase Carbon

Data da medição: 26/07/2026.

## Estado preservado

- Branch: `feat/integrated-production-platform`.
- Árvore de trabalho: 453 entradas modificadas/não rastreadas antes desta fase; nenhuma foi descartada.
- Dependências: `npm install` sem alterações e sem vulnerabilidades reportadas.
- Não foram executadas migrações manuais, alterações de API ou mudanças de regra de negócio.

## Auditoria visual

| Categoria | Quantidade | Exemplos | Risco |
| --- | ---: | --- | --- |
| Cores inline no legado | 522 | objeto `C`, gráficos, painéis | Alto: troca de tema ainda não é global |
| RGB/RGBA no legado | 108 | overlays, sombras e impressão | Médio |
| Estilos inline | 5.752 | `LegacyApp.jsx` | Alto: migração deve ser por componente |
| `!important` | 489 | responsividade e legado | Alto: ordem de cascata sensível |
| Raios inline | 1.067 | cards e modais históricos | Médio |
| Sombras inline | 80 | overlays e destaques | Médio |
| Fontes inline | 2.730 | módulos históricos | Alto |
| Espaçamentos inline | 1.543 | layouts históricos | Alto |

O objeto `C` e `TYPO` permanecem como adaptadores legados. As classes compartilhadas já existentes incluem `arcd-btn`, `arcd-tab`, `card-base`, `lift-card`, `page-hero`, shell, sidebar e navegação mobile.

## Métricas antes da fase

| Métrica | Valor |
| --- | ---: |
| Testes | 404 aprovados em 88 arquivos |
| CSS principal gzip | 21,76 kB |
| Chunk `LegacyApp` gzip | 597,03 kB |
| Total JS/CSS gzip | 1.104,85 kB |
| Aviso de build | `LegacyApp` acima do limite de chunk |

## Arquitetura adicionada

- Primitivos e tokens semânticos separados; aliases `--arcd-color-*` preservam os componentes já migrados.
- Tema `carbon` formalizado e único habilitado no registry.
- `ThemeProvider` grava apenas `arcd-theme` e `arcd-density` no `localStorage`, sem tocar no blob operacional.
- Densidade independente do tema: `compact`, `comfortable` e `spacious`; contexto `field` amplia controles.
- Tema de impressão força superfícies claras e remove elevação.
- `readThemeTokens()` oferece ponte temporária para migração gradual de `LegacyApp`.
- `ThemeSettings` permite ajustar densidade e restaurar o padrão, mas fica fora
  do boot principal até a integração na área de Configurações.

## Gate Carbon atual

| Item | Resultado |
| --- | --- |
| Tema ativo | `carbon` — único tema habilitado |
| Densidades | `compact`, `comfortable`, `spacious` |
| Contexto de campo | tokens de alvo e contraste ampliados |
| Tema de impressão | superfícies claras e sem elevação |
| Provider e persistência | aprovados por teste unitário |
| Button, Badge, Input, Select, Textarea, Card, Dialog, Drawer e DataTable | passam a consumir tokens semânticos |
| TabRow legado | estado separado da aparência; callbacks e IDs preservados |
| PageHero legado | superfície, tipografia, alertas e KPIs vinculados a tokens semânticos |
| KpiCard legado | tons semânticos, superfície e estados de foco centralizados |
| Testes | 410 aprovados em 89 arquivos |
| Lint financeiro | aprovado |
| Build | aprovado |

## Performance após a fase

| Métrica | Antes | Depois | Diferença |
| --- | ---: | ---: | ---: |
| CSS principal gzip | 21,76 kB | 23,72 kB | +1,96 kB |
| Chunk `LegacyApp` gzip | 597,03 kB | 596,83 kB | -0,20 kB |
| Total JS/CSS gzip | 1.104,85 kB | 1.107,22 kB | +2,37 kB |

O crescimento é CSS de tokens e não adiciona regras de negócio ao JavaScript.

## Rollback

O rollback visual consiste em remover o `ThemeProvider` da raiz e os imports do `tokens/index.css`. Os aliases mantêm o visual Carbon atual durante a migração; não há mudança de dados, persistência ou API a reverter.

## Próximo componente

`Navegação`: migrar os componentes compartilhados de sidebar, topbar e menu mobile sem alterar rotas nem permissões.
