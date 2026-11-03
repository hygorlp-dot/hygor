# MARCELL — padrão global de controles

Revisão: 02/11/2026. Alterações locais na base comum, sem push, deploy ou migração de banco.

## Aplicação

O alinhamento deixou de ser uma correção exclusiva de Compras e Financeiro. O contrato de entradas de uma linha e seletores simples em control-contract.css usa a altura da densidade em toda a ERP; foundations.js define o padding dos botões. Campos, seletores e botões comuns deixam de ter alturas diferentes por causa do padding intrínseco. Botões com texto longo podem crescer; áreas de observação, seletores múltiplos, arquivos e editores de planilha mantêm seus contratos específicos.

No desktop compacto, campos comuns medidos passaram de 38/39 px para 36 px. No celular, os controles comuns mantêm pelo menos 44 px. Os filtros de Equipes, Gestão do ponto, Folha, Patrimônio e Planejamento foram conferidos. As datas compactas da tabela de Planejamento continuam com 30 px no computador e 44 px no celular.

Foram migrados os filtros de busca e movimentação e a ação Selecionar todas da Conciliação para os componentes compartilhados, com rótulos visíveis. O campo de categoria usa o mesmo intervalo entre rótulo e controle. Selecionar linhas não confirma conciliação.

A auditoria complementar encontrou três seletores legados em Venda de imóveis e o campo de consulta de CNPJ em Ajustes. As famílias de campos e botões desses adaptadores foram movidas para os componentes compartilhados. O CNPJ ganhou associação explícita de rótulo e controle, preservando a consulta, o preenchimento e as mensagens existentes. Não foi feita consulta real de CNPJ durante os testes.

## Verificação

- Varredura de 65 abas em computador e celular: 144 verificações de telas passaram, incluindo oito casos novos de alinhamento em Pessoas, Ponto, Patrimônio e Conciliação.
- 36 jornadas de RH, Conciliação, filas e fichas passaram com dados fictícios e APIs interceptadas.
- 153 testes do sistema de design, Conciliação, Comercial, responsividade e Ajuda passaram em 30 arquivos.
- Inspeção detalhada em 15 áreas, nas larguras 1440, 390 e 320 px; sem estouro horizontal nas capturas. Foram abertos também os cadastros de Obras e Pessoas e a planilha de Orçamento, em seis estados adicionais.
- Auditoria de campos visíveis nas 65 abas: artefato composto erp-controls-verified.json. A coleta foi dividida em 39 + 26 abas e atualizada com a inspeção dos adaptadores de Comercial e Ajustes; a primeira rotina de coleta interrompeu-se por um seletor ambíguo de carregamentos do Ponto eletrônico. Isso não foi apresentado como falha funcional do app.
- Build direto do Vite, lint, tipos, arquitetura, design:check e manual:check passaram. O prebuild não foi executado porque contém migrações. Nenhum limite de exceções de design foi elevado.
- Ajuda revisada e manual regenerado: 105 guias para 65 abas. Finalidade e nomes das ações existentes preservados.

Pacote final: 1789044 bytes gzip, abaixo do teto de 1.789.952.

## Falhas legadas reproduzidas na comparação

Uma execução mais ampla incluiu verificações antigas de LegacyApp e encontrou nove falhas em quatro arquivos. Elas foram repetidas em um checkout isolado da revisão anterior 4b14ca10: os mesmos nove testes falharam, com 19 testes passando nesses arquivos. A implementação visual não alterou as regras financeiras para satisfazer essas expectativas. Portanto, a suíte ampla não está integralmente verde, embora as validações específicas acima tenham passado.

Arquivos: LegacyApp.dre-wiring.test.js (expectativa de implementação financeira no arquivo antigo), LegacyApp.modal-focus.test.jsx (consultas de foco/DOM anteriores aos portais compartilhados), LegacyApp.purchase-workflow-fixes.test.js (verificações textuais de implementações extraídas) e LegacyApp.third-party-measurement-link.test.jsx (expectativas de DOM e linguagem anteriores). A adequação desses testes ao comportamento vigente fica registrada como pendência separada, sem afirmar que foram corrigidos nesta alteração.

Evidências: erp-global-scoped-unit.log, erp-global-legacy-baseline.log, erp-global-whole-final.log, erp-global-regress-final.log, erp-global-lint-final.log, erp-global-types-final.log e erp-global-arch-final.log em artifacts/. Capturas em erp-controls-after/, erp-controls-narrow/, erp-controls-adapters/ e erp-editors-after/. A revisão responsiva foi em navegador automatizado, sem ensaio em aparelho físico ou homologação de produção.

## Encerramento da pendência dos nove testes — 02/11/2026

A pendência acima foi investigada em alteração posterior. Oito expectativas estavam desatualizadas; um teste expôs falha real de retorno do foco ao fechar editor e confirmação juntos. Os nove testes foram corrigidos, sem remover verificações ou alterar regras financeiras. Consulte [diagnóstico e validação](MARCELL-TESTES-LEGADOS-20261102.md). O registro anterior permanece como evidência histórica da revisão visual.
