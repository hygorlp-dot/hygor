# Ativação do domínio do portal — 16/11/2026

O usuário autorizou expressamente a ativação pública de `portaldocliente.marcelleng.com.br` após o diagnóstico de ausência de DNS e de vínculo na Vercel.

- Projeto Vercel: `mrc` (`prj_t7UJ797nm3uYPRSSTlFWWZc42tn7`).
- Produção já existente: `dpl_Dkh3utSTR1P71kU59BZskqgdvtvf`, commit `e297fbe5c62c532af71ffa53eadf15af8aa0a29e`.
- Os arquivos do portal e `vercel.json` não diferem entre esse commit publicado e o HEAD local consultado. Não foi necessário build, push ou novo deployment.
- Domínio adicionado ao projeto e propriedade confirmada pela Vercel (`verified: true`). Isso não comprova propagação DNS ou emissão do certificado.
- Na zona existente do Registro.br, foi acrescentado somente o CNAME `portaldocliente` para `e961e11e74afbb9e.vercel-dns-017.com`, destino recomendado pela API da Vercel para este projeto. A interface confirmou “Zona DNS atualizada com sucesso!”; ao reabrir a zona, a entrada persistiu, com 16 registros em vez de 15. Não foram alterados servidores DNS, MX, SPF ou os demais registros.
- Em `https://marcellapp.vercel.app/cliente`, o formulário de login carregou. Sem cookie, sessão, dashboard e PDF retornaram 401 e `Cache-Control: private, no-store, max-age=0`.

Não foram cadastradas credenciais reais, publicações de diário, liberações de obras ou mensagens de cobrança nesta ativação. A integração entre contas e obras não foi modificada.

Impacto no DRE: nenhum. Alteração somente no domínio e roteamento externo; nenhuma gravação financeira ou alteração em custos, compromissos, previsões, estoque ou pagamentos.

Ajuda/manual revisados quanto ao impacto: não há mudança em controles, regras de negócio ou passos de uso do app. Nenhuma alteração de interface foi necessária.

Verificação posterior: o DNS autoritativo e os resolvedores públicos 1.1.1.1 e 8.8.8.8 passaram a reconhecer o CNAME. A Vercel confirmou `configuredBy: CNAME` e `misconfigured: false`. O alias aponta para o deployment existente acima.

Foi emitido o certificado `cert_VZP0iak6p8eLnu6MqjdHU1Xx`, com renovação automática, exclusivamente para o novo subdomínio. A requisição HTTPS ao hostname definitivo retornou 200 com validação normal do certificado, usando `curl --resolve` com um dos endereços obtidos do DNS público (`216.198.79.65`). Não foi desabilitada a validação TLS.

A rede local ainda retornou NXDOMAIN em resolução padrão, inclusive após limpar o cache DNS do Windows. O navegador nesse computador também continuou com essa resposta antiga. Isso limita a confirmação de abertura normal local até expirar o cache da rede; não houve alteração de hosts ou dos servidores DNS do computador para mascarar o resultado. O endereço alternativo `https://marcellapp.vercel.app/cliente` permanece disponível com o formulário de login confirmado no navegador.
