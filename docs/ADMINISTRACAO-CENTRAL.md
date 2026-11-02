# Obras e Administração Central

Integração sobre main ac0fad2 (PRs 217, 218 e 219). Preserva a projeção autenticada, correções recentes de lotação/histórico/diaristas inativos e modalidade MEI já integradas.

Folha, Ponto por obra e Gestão do ponto usam Consolidado, Obras e Administração Central. workArea administrativo identifica a central; engenheiros e mestres integram provisoriamente esse grupo por decisão do responsável. A classificação é de consulta: não regrava lotação, ponto ou vínculo.

A Folha separa listas, indicadores, relatórios e consultas CLT/provisões/simulações. A projeção existente abre no grupo selecionado e conserva seus filtros autorizados. Fechamento/reabertura e arquivamento globais exigem Consolidado; comparar fechamento global com lista parcial não gera falsa divergência.

A identificação da central é compartilhada pelo cadastro e pelo domínio da projeção; não é o tipo contratual admin_only da obra. Custos e regras MEI continuam no motor integrado da main.

O PDF da folha mede também o rodapé em negrito, respeitando colspan e largura mínima dos totais. Valores monetários do total ficam em uma linha sem ocultar caracteres; ajustes salvos continuam disponíveis.

Validação: testes de domínio, Folha e projeção, integração API, lint, arquitetura, tipos, build e Playwright. Detalhes dos resultados finais na PR. APK permanece inalterado.
