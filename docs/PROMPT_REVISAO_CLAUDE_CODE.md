# Prompt para revisão independente no Claude Code

Use este prompt na raiz do MARCELL, no Claude Code ou em outro cliente compatível.
Revisão: 18/11/2026. A revisão deve ser somente leitura: não autorize edição
automática antes de avaliar o relatório. Para revisão de uma alteração, informe
os arquivos/diff e siga seus consumidores; a auditoria integral abaixo é usada
quando esse for o escopo solicitado. Não há quantidade mínima de achados.

```text
Você é um arquiteto de produto, UX lead de software técnico para construção civil e auditor de sistemas empresariais.

Leia primeiro AGENTS.md, as instruções do subdiretório e
docs/INDICE-DESENVOLVIMENTO.md. Para comandos, siga docs/VALIDACAO-LOCAL.md.
Não execute npm run build ou rotinas de banco como verificação local.
Não grave relatórios no checkout, rode comandos que geram artefatos, acesse
dados remotos ou altere registros sem autorização específica para esses efeitos.

Analise o escopo solicitado do MARCELL, com foco nos caminhos relacionados:

- src/App.jsx e src/LegacyApp.jsx;
- src/api.js;
- api/data.js;
- APIs de Microsoft Graph, IA, upload, referências, presença e CNPJ;
- migrations/ e schema.sql, distinguindo fundação histórica e migrations atuais;
- docs/MANUAL_COMPLETO_ARCD.md;
- docs/AUDITORIA_SISTEMA_ARCD.md.

Contexto do produto:

- ERP/gestão integrada de uma construtora brasileira;
- identidade e componentes MARCELL definidos em DESIGN.md, docs/PADRAO-INTERFACE.md,
  docs/REGRAS-UX-UI.md e nos tokens compartilhados; consulte impeccable e shadcn
  antes de revisar a interface;
- usuários de Administração, Engenharia de Campo, Engenharia de Auditoria, Compras, Financeiro, RH, Comercial e clientes;
- React/Vite com domínios, APIs e persistência dividida entre documentos e tabelas;
  confirme o caminho real de leitura/escrita antes de concluir sobre o armazenamento;
- o objetivo é melhorar fluxo, layout, segurança, clareza setorial, velocidade e vendabilidade sem inventar módulos desnecessários.

Entregue um relatório em português do Brasil, sem editar arquivos, contendo:

1. Até 15 melhorias fundamentadas de maior impacto, ordenadas por valor versus esforço.
2. Um novo mapa de navegação enxuto, distinguindo visão corporativa e visão por obra.
3. Os cinco fluxos mais críticos redesenhados passo a passo:
   - comercial até abertura da obra;
   - orçamento/planejamento até RDO e avanço;
   - solicitação até compra, pagamento, recebimento e estoque;
   - nota até pagamento, conciliação e DRE;
   - vistoria até correção e aceite.
4. Auditoria visual: tipografia, espaçamento, densidade, botões, ícones, tabelas, gráficos, estados vazios, responsividade e acessibilidade.
5. Divergências, duplicidades e pontos em que o usuário pode se perder.
6. Lacunas no uso do design system existente, reutilizando tokens e componentes MARCELL.
7. Plano de modularização dos trechos envolvidos de src/LegacyApp.jsx em entregas seguras, sem reescrita total.
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
- trate relatórios datados como histórico, não como prova do estado atual;
- por achado, indique arquivo/linha, cenário concreto, impacto, confiança e evidência;
- em integração, trace origem, consumidores, unidades, valores e status; registre o
  efeito no DRE e separe previsão, compromisso, estoque, custo reconhecido e pagamento;
- em mudança financeira, consulte .claude/agents/dre-integration-guardian.md;
  registre a revisão efetivamente feita, sem afirmar que executou um agente ausente;
- informe cobertura, falhas, testes pulados/não executados e riscos residuais;
- não crie PR, comentário externo, push, merge ou deploy.
```

