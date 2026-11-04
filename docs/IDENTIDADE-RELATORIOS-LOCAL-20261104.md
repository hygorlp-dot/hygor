# Identidade dos relatórios — implementação local

Revisão: 04/11/2026. Checkout vigente: C:/dev/repositorio-mrc. Sem publicação, push, PR ou migração.

Ao solicitar impressão ou PDF, a janela **Identidade do relatório** permite selecionar **MARCELL** ou **ARCD** em **Logomarca do relatório**, conferir a **Prévia da logomarca**, abrir **Ajuda**, **Cancelar** ou confirmar em **Gerar relatório**. MARCELL é a opção inicial de cada novo documento. A escolha é por documento, sem alterar cadastros ou a marca do aplicativo. Gerar fica bloqueado enquanto a imagem não estiver pronta. Falha da imagem oferece nova tentativa; bloqueio de popup mantém a escolha e permite tentar novamente. Cancelar/fechar/Escape retorna à consulta e preserva os filtros.

## Integração

Serviço compartilhado `src/reports/report-preview.js`, ponte React `ReportIdentityDialog.jsx` montada na aplicação e imagem por `report-identities.js`. O serviço reserva uma solicitação por vez; repetições são ignoradas sem duplicar a geração ou eventual auditoria do chamador. A nova janela é aberta sincronamente no gesto de confirmação, mantendo a permissão normal de popup. Cancelar não cria janela. O renderizador `marcell-report.js` conserva dados, totais, fotos, identificação legal, orientação e controles existentes. Também recebe HTML já preparado e troca exclusivamente as imagens de identidade. Fonte e imagens são aguardadas antes de imprimir.

Caminhos de geração HTML migrados: DRE, relatórios financeiros e por obra, executivo e indicadores contábeis, ponto/folha/holerites/recibos/provisões/custos, projeção de mão de obra, Orçamento e memórias de cálculo, Planejamento A2, Diário, Conferência, Compras, Comercial, Licenciamento e Patrimônio. Os consumidores de `abrirRelatorioPadrao`, inclusive Equipamentos, usam a mesma escolha. O registro de envio impresso do pedido acontece somente depois da confirmação; cancelar não registra esse envio. Exportar não cria baixas financeiras.

CSV, planilhas, ZIP de dossiês e visualização de anexos já existentes conservam seus fluxos e não recebem identidade visual. O serviço não intercepta navegação, links externos, arquivos ou qualquer `window.open` genérico.

## Logomarcas e interface

MARCELL usa a identidade oficial já existente. ARCD foi recuperada de `c560413d:public/logo-arcd.png`, com os mesmos bytes; origem e hash em `src/reports/assets/ARCD_SOURCE.txt`. O arquivo atual `public/logo-arcd.png` continua sendo uma compatibilidade da marca MRC e não foi substituído. A nova cópia ARCD fica em `src/reports/assets/arcd-original.png`.

ARCD é carregada como ativo local e convertida em URL de dados antes de liberar a confirmação; a mesma imagem é incorporada ao cabeçalho e à marca-d’água. O encaixe do cabeçalho usa a altura da MARCELL anterior (36,675 px em 108 px de largura), preservando proporção e evitando deslocar a paginação por uma imagem mais alta. Não há alteração de pixels da marca.

Dialog, Select, Button, Alert, Ajuda e receita de ações compartilhados. `IdentityPreview` acrescenta somente composição com tokens existentes em patterns/styles.css, sem novas cores ou tipografia. Tema, foundations e baseline de exceções de design preservados. Ajuda contextual `report_identity` e orientação geral em HELP_INTERFACE_GUIDE; manual regenerado, 117 guias e 65 abas, revisão em 04/11/2026.

## Validação concluída

- 178 testes aprovados em 50 arquivos: confirmação, carregamento, MARCELL/ARCD, cancelamento, foco, popup bloqueado, falha da imagem, segunda solicitação ignorada, segurança da origem da imagem, preservação de dados e regressões de relatórios/folha/diálogos.
- 50 cenários de navegador aprovados: 2 de escolha nas duas marcas em desktop/celular, 4 de relatório executivo, 33 de PDF/Folha/CLT/ações críticas de Orçamento e Planejamento, 11 de cobrança e projeção de mão de obra. Dados sintéticos locais.
- Lint, tipos, auditoria sem ciclos, build Vite direto e orçamento de bundle aprovados. Nenhum prebuild ou comando de migração executado. Bundle 1844,75 KiB gzip, abaixo do teto já existente de 1845 KiB; tetos não foram alterados. Novo ativo ARCD de 78,5 KiB fica separado do JavaScript, dentro do orçamento de mídia.
- PDFs MARCELL e ARCD renderizados e conferidos: ambos com quatro páginas, memória e referências completas. Capturas e PDFs em artifacts/report-identity; logs artifacts/report-brand-*.log. Detector sem achados nos novos componentes.
- Revisão independente Impeccable: ship; correção de encaixe/paginação conferida nas oito páginas renderizadas. Documenter: nenhuma mudança necessária no sistema de design. Deriva anterior de PRODUCT.md ainda citar ARCD como aplicativo foi registrada sem alterar essa documentação fora do escopo.

Demonstração local independente em http://127.0.0.1:4270/, com perfil e balancete fictícios e a janela de seleção aberta. O ambiente anterior em 4220 foi preservado. Servidor de demonstração: MARCELL_DAILY_PORT=4270, MARCELL_ACCOUNTING_DEMO=1, MARCELL_EXECUTIVE_DEMO=1, `node scripts/daily-production-preview.mjs`.
