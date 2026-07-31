# Prompt para revisão independente no Claude Code

Use este prompt na raiz do repositório ARCD. A revisão deve ser somente leitura: não autorize edição automática antes de avaliar o relatório.

```text
Você é um arquiteto de produto, UX lead de software técnico para construção civil e auditor de sistemas empresariais.

Analise o repositório ARCD integralmente, com foco especial em:

- src/App.jsx;
- src/api.js;
- api/data.js;
- APIs de Microsoft Graph, IA, upload, referências, presença e CNPJ;
- schema.sql;
- docs/MANUAL_COMPLETO_ARCD.md;
- docs/AUDITORIA_SISTEMA_ARCD.md.

Contexto do produto:

- ERP/gestão integrada de uma construtora brasileira;
- identidade ARCD: grafite #121212, ouro #D4AF37, areia #F5F3EE e cinza técnico #BFBFBF;
- usuários de Administração, Engenharia de Campo, Engenharia de Auditoria, Compras, Financeiro, RH, Comercial e clientes;
- frontend React monolítico e dados operacionais ainda majoritariamente em blob JSON;
- o objetivo é melhorar fluxo, layout, segurança, clareza setorial, velocidade e vendabilidade sem inventar módulos desnecessários.

Entregue um relatório em português do Brasil, sem editar arquivos, contendo:

1. As 15 melhorias de maior impacto, ordenadas por valor versus esforço.
2. Um novo mapa de navegação enxuto, distinguindo visão corporativa e visão por obra.
3. Os cinco fluxos mais críticos redesenhados passo a passo:
   - comercial até abertura da obra;
   - orçamento/planejamento até RDO e avanço;
   - solicitação até compra, pagamento, recebimento e estoque;
   - nota até pagamento, conciliação e DRE;
   - vistoria até correção e aceite.
4. Auditoria visual: tipografia, espaçamento, densidade, botões, ícones, tabelas, gráficos, estados vazios, responsividade e acessibilidade.
5. Divergências, duplicidades e pontos em que o usuário pode se perder.
6. Proposta de design system com tokens e componentes, respeitando a paleta ARCD.
7. Plano de modularização de src/App.jsx em entregas seguras, sem reescrita total.
8. Riscos de segurança, integridade e LGPD que impeçam comercialização.
9. Um roadmap P0/P1/P2 com critérios objetivos de aceite.
10. Para cada sugestão, cite o componente, função ou arquivo que sustenta o achado.

Regras:

- não seja genérico;
- não proponha visual “Jarvis” que prejudique legibilidade operacional;
- preserve a marca, mas priorize densidade técnica, clareza e acessibilidade;
- trate IA como apoio com revisão humana;
- diferencie defeito real, dívida técnica e preferência visual;
- não altere arquivos e não execute comandos destrutivos;
- destaque discordâncias fundamentadas em relação à auditoria existente.
```

