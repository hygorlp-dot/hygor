# Pendências guiadas do RH — entrega local

Base: `bf74c107817db356b1bae7e974a0766eb4df0254`, obtida da main em 30/10/2026. Branch local `codex/rh-pendencias-guiadas`, em `C:/Users/hygor/rh-integracao-local`. Sem push, PR, preview ou deploy desta entrega.

## Uso

Em **Pessoas e terceiros → Folha**, RH/admin encontram **Organizar pendências do RH** e a área **Pendências do RH**. O funcionário e a competência mensal podem ser selecionados sem alterar dados.

| Etapa | O que mostra | Atalho |
| --- | --- | --- |
| Cadastro | Campos faltantes do contrato, usando as validações existentes | Abre a edição do funcionário escolhido; não salva |
| Ponto | Dias sem registro, fechamentos e exceções da importação CLT | Abre a Gestão com funcionário e ciclo; fechamento por obra com data/obra da pendência |
| Folha | Situação do demonstrativo salvo e validação existente; diária mantém conferência própria | Abre o funcionário e a competência, preservando as confirmações obrigatórias |
| Provisões | Não incluído, dados pendentes, estimativa não salva/salva e saldo não apurado | Abre a provisão existente ou o rascunho com base conhecida |

As pendências extensas ficam em uma lista expansível, mantendo a ação principal visível. A interface usa tokens MARCELL e componentes shadcn já instalados, sem nova dependência. Em celular, as etapas passam a uma coluna.

## Reaproveitamento e limites

- Reutiliza cadastro, salário contratual/perfil existente, ponto, demonstrativos e provisões salvos. Não inventa matrícula, CBO, enquadramento na CCT, ASO, abertura ou utilização de reserva.
- Base de provisão manual não substitui salário contratual ausente no diagnóstico do cadastro.
- Estimativa válida ainda não salva pode ser salva explicitamente sem alterar artificialmente um campo. Estimativa já salva e sem alterações continua com reenvio desabilitado.
- O saldo não informado continua “Não apurado”. Reserva mensal integral não equivale a pagamento nem a cálculo dos avos efetivos.
- O primeiro dia com pendência do ponto considera os dias previstos/registros existentes, evitando mandar o RH fechar um domingo sem registro. Datas de 01 a 05 abrem o ciclo quinzenal que começa no mês anterior.
- Contexto de navegação fica somente no sessionStorage, com validação de competência/data e sem credenciais. O destino consome o recorte; isso não amplia permissões.
- Nenhuma ação de navegação despacha comando operacional ou financeiro. Gravações continuam explícitas nos formulários existentes, com permissões e controle de versão existentes.
- A navegação manual entre áreas limpa a seleção guiada antiga para não reutilizar silenciosamente outro funcionário.

## Validação

- **33 testes direcionados aprovados em cinco arquivos**, cobrindo diagnóstico, reaproveitamento, ausência de dados, datas/ciclos, provisões, validação CLT e Folha. Log: `C:/Users/hygor/rh-pendencias-tests-final.log`.
- **Seis cenários de navegador**, em computador (1440 × 1000) e celular (390 × 844): atalhos de cadastro/holerite/provisões, ponto com recorte, preservação de provisão salva e limite de acesso do perfil financeiro. Log: `C:/Users/hygor/rh-pendencias-browser-final.log`. Dados isolados e API interceptada; nenhuma requisição de comando/save permitida pelos testes.
- Capturas `test-results/rh-readiness-*/pendencias.png` conferidas visualmente.
- Lint, tipos, arquitetura e build local passaram; orçamento do pacote aprovado sem aumentar limites: **1.738,95 KiB JS/CSS gzip**. Relatório preservado fora do versionamento em `C:/Users/hygor/rh-pendencias-bundle-metrics.json`.
- Rodadas iniciais encontraram timeout de worker em Node 24 e de carregamento inicial no navegador. A execução final usa Node 22.23.4, um worker e espera de DOM; o teste respeita que o perfil financeiro não tem acesso à Folha, em vez de forçar permissão. Os seletores dos formulários seguem seus nomes acessíveis.

APK, API, servidor, pagamentos reais e regras de cálculo não foram alterados. Não foi executada suíte geral nem ensaio de escrita em produção nesta entrega. Antes de futura publicação autorizada, consolidar com a main então vigente e cumprir os checks do repositório.
