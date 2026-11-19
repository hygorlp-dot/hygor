# Publicação de usabilidade — 15/11/2026

Pacote isolado de `dpl_HjA3Mb8hbs5MWsFueDoYXy1Wmv52`, mantendo os 1.335 arquivos do manifesto publicado. Nove arquivos existentes foram atualizados e três padrões de interface adicionados; os outros 1.326 mantêm os mesmos hashes. API, servidor, políticas de OneDrive, upload/exclusão em lote, histórico e permissões permanecem byte a byte como publicados. O workspace principal não foi substituído.

Inclui navegação da obra, destino de faturamento, contexto de documentos, busca de serviços, explicação dos percentuais, ferramentas expansíveis, lista inicial móvel de terceirizados, filtros do quadro, consulta de equipe, ajuda e manual. Não inclui funcionalidades locais não publicadas de outros trabalhos. Não cria fatos de previsão, compromisso, estoque, custo reconhecido, receita ou pagamento no DRE.

Validação do pacote: 92 testes, dez jornadas no navegador em 390px/1440px, dois fluxos de exclusão em lote com proteção e retomada, 209 verificações de inicialização em sessões novas, lint, tipos, manual e design aprovados. Grafo sem ciclos em 883 arquivos. Ajuda/manual publicados continuam com 118 guias e cobertura das 65 abas; não incorporam os guias de funcionalidades locais fora do escopo.

Bundle: 1.903.875 bytes gzip, abaixo do teto vigente de 1.908.736 bytes, sem mudança de limite ou dependência. Uma compilação local do pacote final para validação; um único deployment de produção autorizado. Manifesto e comprovação de preservação em `artifacts/upload-manifest.json` e `artifacts/preservation-report.json`. Nenhum push ou preview necessário.

A verificação de produção conferirá carregamento, assets, responsividade e recusa de API sem autenticação, sem criar nem excluir documentos reais. Testes operacionais desta publicação usam dados fictícios locais; não representam uma nova homologação transacional com dados reais.

## Resultado da publicação

Deployment `dpl_Fa9KeT3gKrCEbd9XmzwtsmqsWM8w`, estado READY, fonte local `f27fff7f049cba41b333c4afa0a650311ff584a3`. Endereços: https://erp.marcelleng.com.br/, https://pontosarcd.vercel.app/ e https://marcellapp.vercel.app/. A consulta da Vercel confirma um único deployment de produção criado nesta publicação, sem previews ou pushes.

Pós-publicação: seis sessões novas (três endereços × celular/desktop), HTTP 200, formulário de entrada visível, nenhum erro de página, nenhum JavaScript/CSS ausente e nenhuma rolagem horizontal da página. Os assets servidos contêm os novos controles de evolução por valor, acesso à central e busca de serviços. As duas APIs verificadas recusaram operações sem autenticação com HTTP 401. Nenhum documento ou registro real foi criado, alterado, aprovado, pago ou excluído nesses testes. Evidência: `artifacts/production-usability-check.json`.
