# MARCELL — recuperação integral de edições

Revisão: 02/11/2026. Implementação local na branch `codex/marcell-precise-local-20261101`, sem push, deploy ou alteração do banco remoto.

## Resultado

As pendências técnicas da P5 foram tratadas em conjunto: proteção durável da fila geral, recuperação após recarga, renovação da mesma conta sem desmontar a edição, comparação explícita dos valores concorrentes e acesso à recuperação dentro dos formulários.

- Antes de enviar uma edição geral, a fila protege a intenção no navegador, identificada por conta, aba, escopo de acesso e revisão. A confirmação remove apenas a revisão correspondente.
- Recarregar e abrir uma edição não gravam no servidor. Resolver salvamento → Consultar versão atual → escolher valores → Salvar alterações revisadas exige uma decisão explícita. Concluir conferência encerra mudanças que já constam no servidor sem reenviar.
- Outra tentativa de salvar durante uma pendência recebe proteção separada. As revisões são apresentadas em sequência; falha de armazenamento conserva a memória e bloqueia a confirmação até proteção ou descarte explícito.
- A mesma conta pode renovar a sessão no formulário. Respostas e renovações atrasadas da conta anterior não atualizam a sessão nova. A reprodução dessa corrida falhou antes da correção e passou depois.
- Permissão recusada não gera repetição automática. O preenchimento continua disponível para conferência; mudanças de acesso ou obra bloqueiam a retomada até revisão do acesso. A validação final continua no servidor.
- Modal, Dialog e Drawer compartilham foco, rolagem, Escape e área visível com teclado. Recuperação invalida formulários antigos; Fechar continua acessível. No celular, Mais permite Sair do sistema.
- Pagamento, recebimento e alocação preservam a recuperação própria por comando e chave de confirmação; não são transformados em gravações gerais.

## Verificação

Os testes usam dados fictícios, APIs interceptadas no navegador e PostgreSQL local com PGlite. Não foram executados pagamentos, recebimentos ou edições reais em produção.

| Verificação | Resultado | Evidência local |
| --- | --- | --- |
| Domínio, fila, sessão, componentes e API/PostgreSQL | 178 testes em 24 arquivos, todos passaram | artifacts/integral-final-tests.log |
| Gráficos, geometria final e contexto de navegação | 23 testes em 6 arquivos, todos passaram | artifacts/integral-charts-context.log |
| Recuperação desktop e celular | 56 cenários passaram | artifacts/integral-browser-final.log |
| Recuperação adversa: 320 px, texto ampliado e fontes bloqueadas | 56 cenários passaram | artifacts/integral-stress-final.log |
| Telas e controles da ERP, desktop e celular | 136 verificações passaram | artifacts/integral-whole.log |
| Fluxos de Compras, Financeiro e recuperação | 42 jornadas passaram | artifacts/integral-regression.log |
| Lint, padrão de interface e manual | Sem falhas; sem aumento das exceções registradas | artifacts/integral-final-lint.log |
| Typecheck e arquitetura | Sem falhas ou violações de dependência | artifacts/integral-final-types.log; artifacts/integral-final-arch.log |
| Build local e orçamento | Passaram; build direto do Vite, sem executar migrations do prebuild | artifacts/integral-build.log; artifacts/integral-bundle.log |

Foram inspecionadas capturas da recuperação no desktop e celular, incluindo 320 px. Os cenários cobrem recarga, mesma conta em outra aba, sessão expirada, acesso revogado, colisão de identificador, dois formulários concorrentes, armazenamento bloqueado, quota insuficiente e confirmação explícita. Uma primeira execução identificou duas expectativas de texto antigas; foram atualizadas para a mensagem revisada e a suíte completa foi repetida com sucesso. Os testes de sessão reproduziram também respostas atrasadas e renovação de token após troca de conta.

Revisão das skills: impeccable e shadcn aplicadas ao padrão compartilhado; systematic-debugging e verificação antes da conclusão para reprodução e evidências; orientações Supabase para inspeção somente de leitura; revisão React e refatoração arquitetural para os componentes comuns.

O pacote JS/CSS final mede 1787629 bytes gzip, abaixo do limite de 1.789.952 bytes, sem aumentar o orçamento ou excluir arquivos do cálculo. Gráficos operacionais passam diretamente ao estado final, preservando geometria, valores e interações; bases de sobreposição e código compartilhado foram consolidados.

Ajuda e manual: 105 guias para 65 abas. A ajuda explica proteção local, memória, conferência, descarte, sessão e limites. Fonte única: src/features/help/help-content.js; manual regenerado na mesma alteração.

## API e Supabase

Inspeção remota somente de leitura do projeto Ponto ArcD: projeto ativo e saudável; PostgreSQL 17.6; consulta em 02/11/2026 às 18:25 UTC. No recorte de 24 horas consultado, foram observadas 8.705 respostas 200, duas 201, 46 respostas 204 e dez 403, sem respostas 5xx. Os dez 403 eram GET /auth/v1/user. Esse agregado não demonstra a causa de uma falha específica de gravação.

A revisão encontrou problemas reais de coordenação e recuperação no cliente, inclusive respostas atrasadas após troca de conta. Não há evidência para atribuí-los genericamente ao Supabase. Políticas de acesso não foram abertas e nenhuma credencial privilegiada foi levada ao navegador.

Os advisors também apresentam recomendações separadas: search_path em funções, proteção de senhas vazadas, extensão em public e índices/planos de RLS. Esses achados não foram alterados nem apresentados como causa comprovada das falhas. Exigem uma auditoria própria antes de qualquer migração de produção.

## Roadmap e avaliação crítica

P0–P4: implementações locais preservadas. P5: correções técnicas consolidadas e regressão local realizada. Próximo marco já preparado: aplicar o roteiro com seis operadores e pelo menos 20 tarefas, conforme decisão de realização posterior. Não houve participação ou aprovação simulada.

Nota interna conservadora: **8,5/10**. A recuperação e a coerência melhoraram, mas 9,5/10 não está comprovado por testes automatizados. Ainda faltam evidências de uso por operadores e aparelhos físicos. A inspeção remota não substitui a validação de uma versão publicada.

## Limites explícitos

- Proteção das tentativas de salvar não significa que todos os campos de todo formulário sejam gravados automaticamente. Antes da recuperação geral, salve ou cancele outros preenchimentos; após recuperar, reabra os editores antigos.
- Armazenamento do navegador não é backup: limpeza de dados, modo privado, quota, troca de dispositivo ou endereço podem impedir recuperação. Quando a escrita falha, o sistema bloqueia envio e saída com trabalho somente na memória; o usuário pode tentar proteger ou descartar com confirmação.
- Uma resposta perdida pode corresponder a uma operação já confirmada no servidor. Consultar a versão atual e os recibos é parte da retomada; não há confirmação financeira por arraste, abertura ou recarga.
- Alterações remotas de acesso devem continuar sendo resolvidas por um administrador autorizado. A aplicação não contorna a recusa do servidor.
