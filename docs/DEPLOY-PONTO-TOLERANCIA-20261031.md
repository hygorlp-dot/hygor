# Publicação da tolerância CLT no banco de horas — 31/10/2026

Autorização explícita: conferir CCT Caruaru, aplicar tolerância, validar e publicar, preservando batidas e pagamentos reais.

- Produção: https://marcellapp.vercel.app/
- Vercel: mrc, prj_t7UJ797nm3uYPRSSTlFWWZc42tn7.
- Deployment READY: dpl_CfkmpED43eRhCpP2AKGCLCmj7Y1f.
- URL imutável: https://mrc-6xvav4lmf-hygor-s-projects1.vercel.app/
- Código publicado: 4f03706c1f4535ae4ca960f840ea80c881913422.
- Cópia isolada: C:/dev/releases/ponto-tolerancia-20261031; branch codex/ponto-tolerancia-cct-20261031.
- Base preservada: edf48315 (almoço), dbc123ed (Arquivos) e 5b82a081 (sincronização biométrica).

A main remota continua sem essas publicações por CLI. Próximas entregas devem partir da base acima ou integrar suas alterações, preservando todos os commits. Não publicar uma cópia antiga sobre esta versão. Nenhum push foi feito: uma única implantação de produção foi preparada, verificada e promovida.

Conferida a CCT original do usuário, PE000665/2026, cláusula43, página13. Não contém tolerância numérica diferente da CLT art.58 §1º. O banco compara as batidas com os horários da escala vigente: no máximo5min por marcação e10min de variações absolutas no dia. Não concede franquia ao ultrapassar qualquer limite. Verificação em milissegundos antes do arredondamento. Sem escala com horários, fontes com avisos ou sequências especiais, não presume abono. Tratamentos RH por apropriação são preservados.

Mantém horas observadas e batidas; ajusta apenas a projeção do saldo. Detalhe apresenta saldo antes da tolerância e ajuste, previstos da escala, original com segundos quando necessário e motivo de não aplicação. Nenhuma migração, gravação de negócio, mudança de pagamentos/folha/DRE/permissões ou APK. Regra e fontes detalhadas em docs/PONTO-TOLERANCIA-CARUARU.md da cópia isolada.

Validação final:188 testes em17 arquivos, quatro cenários de navegador sobre build local e quatro sobre build publicado passaram em computador/celular. Cenários usam APIs interceptadas e dados sintéticos; não gravam no servidor. Lint, tipos, arquitetura, build e orçamento de bundle passaram (1738,18KiB gzip). Login público200, assets PontoEletronicoView-NVF7D3g-.js e ArquivosView-BcJMdkWP.js presentes; endpoints do banco e sincronização retornam401 sem sessão. Sem erros de página e sem logs error/fatal encontrados para o deployment na consulta após publicação.

Evidências externas ao código: C:/Users/hygor/ponto-tolerancia-*.log, ponto-tolerancia-production-smoke.json e ponto-tolerancia-release-status.json.
