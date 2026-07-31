# ARCD Mobile — fundação progressiva

## Limites desta etapa

Esta fundação muda apenas a apresentação e permanece isolada do fluxo legado até cada piloto ser validado. Não altera fórmulas, regras financeiras, banco, blob persistido, API, autenticação, permissões, migrações ou variáveis de ambiente.

O fluxo legado continua disponível: os novos componentes só são consumidos por módulos que os integrem explicitamente. O editor de fornecedores também permanece sob `features.newSupplierEditor = false`, pois ainda não reproduz a consulta automática de CNPJ e CEP do fluxo atual.

## Auditoria inicial

| Módulo | Situação mobile | Impacto | Prioridade | Direção |
| --- | --- | --- | --- | --- |
| Login | Funciona com limitações | Espaçamentos e visual decorativo em tela curta | Alta | Grid, safe areas, landscape e redução de movimento |
| Dashboard | Inadequada para mobile | KPIs e gráficos concorrem com ações de campo | Alta | Visão priorizada por obra e ações rápidas |
| Navegação | Funciona com limitações | Muitos destinos disputam largura | Alta | Cinco destinos + menu Mais |
| Obras | Funciona com limitações | Contexto da obra pouco persistente | Alta | Seletor de obra ativo na sessão |
| Compras e estoque | Funciona com limitações | Listas e ações densas | Alta | Cartões responsivos, filtros em sheet e menu Mais |
| Ponto, diário e conferências | Funciona bem | Operação com uma mão ainda desigual | Alta | Modo Campo com ações de maior frequência |
| Equipe e terceirizados | Funciona com limitações | Formulários e listas extensos | Média | Editor full-screen e cards |
| Medições | Funciona com limitações | Formulários e evidências densos | Média | Aplicar o editor e filtros após piloto |
| Orçamento | Inadequada para mobile | Tabelas e composição analítica | Média | Cartões apenas para consulta; manter desktop no detalhamento |
| Equipamentos | Funciona com limitações | Listas, filtros e cadastro | Média | Próximo piloto de baixo risco |
| Relatórios e exportações | Inadequada para mobile | Arquivos e tabelas largas | Baixa | Acesso sob demanda, sem compressão artificial |
| Conciliação, DRE e financeiro | Não migrar nesta fase | Risco financeiro | Crítica | Somente após caracterização e testes de domínio |
| Folha e rescisão | Não migrar nesta fase | Dados pessoais e cálculo crítico | Crítica | Somente após caracterização e testes de domínio |
| Modais e drawers | Funciona com limitações | Teclado pode ocultar ações | Alta | Editor full-screen no mobile |
| Tabelas | Inadequada para mobile | Rolagem horizontal e ações pequenas | Alta | `ResponsiveDataTable` configurável |

## Componentes entregues

| Área | Componentes |
| --- | --- |
| Shell | `MobileAppShell`, `MobileAppBar`, `MobileBottomNavigation`, `MobileMoreMenu`, `ActiveProjectSwitcher` |
| Campo | `FieldHome`, `FieldActionGrid`, `FieldActionCard`, `FieldContextHeader` |
| Edição | `FullScreenEditor`, `MobileEditorHeader`, `StickyFormActions`, `KeyboardAwareContainer` |
| Dados | `ResponsiveDataTable`, `MobileRecordList`, `MobileRecordCard`, `MobileRecordActions` |
| Filtros | `MobileFilterSheet`, `ActiveFilterChips` |
| Conexão | `NetworkStatus`, `SyncStatus`, `OfflineBanner` |
| Dashboard | `MobileDashboard` |

## Regras de interação

- Alvos de toque: mínimo de 44 px, sem aumentar desnecessariamente o ícone visível.
- Editor mobile: cabeçalho e ações fixas; alteração não salva exige confirmação antes de sair.
- Dados: tabela no desktop, cartões configuráveis no mobile; ações destrutivas ficam separadas no menu.
- Conexão: não há alegação de gravação no servidor sem confirmação explícita.
- PWA: existe somente `manifest.webmanifest`; não há service worker nem cache de dados autenticados.

## Validação pendente de integração

Os testes automatizados validam a fundação e o build. Ainda são necessárias validações manuais em 320×568, 360×800, 390×844, 430×932 e tablet, incluindo teclado aberto, zoom de 200%, leitor de tela e aparelhos reais. Nenhum módulo financeiro foi convertido nesta etapa.

## Medição atual de bundle

| Artefato | Gzip |
| --- | ---: |
| Total JavaScript/CSS | 1100,75 kB |
| `LegacyApp` | 596,79 kB |
| Ferramentas de planilha | 249,66 kB |
| Gráficos | 104,12 kB |
| CSS principal | 21,77 kB |

Planilha e gráficos já são emitidos como chunks distintos. A redução adicional do `LegacyApp` requer extrações por módulo com testes de caracterização; não foi feita nesta fundação, para não alterar fluxos operacionais críticos.

## Próximo piloto

**Fornecedores**: integrar lista em cartões, filtro em sheet e editor full-screen somente após paridade com as consultas automáticas de CNPJ e CEP do fluxo legado.
