# Instruções do projeto

## Leitura inicial e escopo de trabalho

- Este arquivo reúne as regras compartilhadas por Codex, Claude Code e outros agentes. Consulte também o `AGENTS.md` do subdiretório afetado. O `CLAUDE.md` da raiz importa este documento; não mantenha cópias concorrentes das regras comuns.
- Comece por [índice de desenvolvimento](docs/INDICE-DESENVOLVIMENTO.md), [validação local](docs/VALIDACAO-LOCAL.md) e, ao continuar trabalho anterior, [retomada de tarefas](docs/RETOMADA-DE-TAREFAS.md).
- Implementações e validações ficam locais por padrão. Não executar push, criar PR, fazer merge, publicar preview ou deploy, nem instalar serviços pagos sem solicitação explícita. Branches locais são permitidas; preserve alterações existentes e não use reset/checkout para apagá-las.
- Para compilar localmente, use `npm run build:local`; para lint, arquitetura, tipos e compilação em sequência, use `npm run validate:local`. Testes são selecionados conforme o risco no roteiro; esse comando não os substitui.
- `npm run build` executa o `prebuild` com rotinas de banco. Não o use como simples verificação local. A ordem de migrations, os gates de produção e as regras de publicação continuam vigentes quando houver autorização para operar nesses destinos.
- Diferencie configuração presente, execução realizada e resultado validado. Registre comandos, escopo, falhas, testes pulados e limites; não trate relatórios antigos como prova do estado atual.

## Integração de informações e impacto no DRE

- Por solicitação do usuário em 13/11/2026, verificar sempre o fluxo das informações desde a origem antes de criar campos ou cadastros. Reaproveitar vínculos, unidades, valores e etapas existentes para reduzir repreenchimentos; ambiguidades exigem conferência, sem ligações por semelhança.
- Analisar e registrar o impacto de cada integração no DRE (Demonstração do Resultado). Distinguir previsão, compromisso, estoque físico, custo reconhecido e pagamento; validar que o mesmo fato não gere custo duplicado. Quando não houver efeito no resultado realizado, registrar essa conclusão e sua evidência.

## Alterações de interface

Antes de qualquer alteração na interface, consulte e aplique em conjunto as skills **impeccable** e **shadcn**, respeitando os padrões existentes do projeto.

- Leia as instruções da skill `impeccable` antes de planejar ou implementar a alteração.
- Consulte também a skill `shadcn`, quando disponível. Se ela não estiver instalada, consulte a documentação oficial do shadcn/ui e a configuração local em `components.json` antes de implementar.
- Use as orientações de ambas em conjunto para criar, modificar ou revisar componentes, páginas, estilos, layouts e interações.

Além de `impeccable` e `shadcn`, consulte e aplique as skills abaixo quando forem relevantes à alteração de interface, antes de planejar ou implementar:

- **Figma:** use as skills correspondentes ao trabalho quando houver designs, arquivos, componentes, tokens ou referências do Figma, ou quando for necessário criar, sincronizar ou implementar designs via Figma MCP. Respeite os pré-requisitos das skills para cada ferramenta do MCP.
- **Material 3:** consulte `material-design-3-expert` quando a interface adotar ou precisar ser revisada segundo Material Design 3, incluindo cores, tipografia, componentes, layouts adaptativos, estados e movimento.
- **Expo:** consulte as skills pertinentes do plugin Expo quando a alteração envolver interfaces Expo/React Native, navegação, componentes nativos ou adaptação da experiência entre web, Android e iOS.

Combine as orientações relevantes com `impeccable` e `shadcn`, preservando a arquitetura e o sistema de design existentes. A consulta a essas skills não implica migrar a interface para Material 3, Expo ou outra biblioteca sem que isso faça parte do escopo solicitado.

Esta regra se aplica a todo o projeto, inclusive aos subdiretórios.

## Padrão obrigatório para novas interfaces

- Toda nova introdução no ERP deve obedecer a `docs/PADRAO-INTERFACE.md`, além de `DESIGN.md`. Esta exigência inclui textos, botões, dimensões, espaçamentos, componentes, telas e fluxos.
- Ajustar a escala comum em `src/design-system/foundations.js`, diferenças de tema em `themes/themeRegistry.js`, densidade e espaçamento nos tokens existentes. Reutilizar padrões e controles compartilhados; não criar estilos próprios para contornar a base.
- Linguagem genérica compartilhada usa `src/design-system/copy.js`; textos específicos pertencem ao domínio. Não alterar dados, códigos ou status persistidos como se fossem rótulos visuais.
- Mudanças de linguagem visual devem ser feitas na base compartilhada e valer para toda a ERP: textos genéricos, botões, campos, tipografia, cores e espaçamentos não recebem versões próprias por módulo. Composições específicas podem organizar o fluxo, sempre consumindo a mesma base. Verificar os efeitos em telas representativas no desktop e celular.
- Executar `npm run design:check`, também integrado ao lint. Não aumentar nem regenerar `scripts/design-system-baseline.json` para liberar novas exceções. O legado registrado não autoriza repetir seus desvios.
- Revisão visual e de interação em desktop/celular continua obrigatória; a checagem automática é parcial. Exceções novas exigem justificativa e aprovação explícita do usuário.

## Ajuda contextual e manual obrigatório

- Toda alteração no app deve incluir revisão da ajuda e do manual. Quando mudar um fluxo, botão, filtro, regra, permissão ou resultado apresentado ao usuário, atualize a orientação correspondente na mesma alteração.
- A fonte única é `src/features/help/help-content.js`. Escreva em português simples para quem nunca usou um ERP: finalidade, o que preparar, passos em ordem, resultado esperado e cuidados. Use os nomes reais dos controles; explique siglas e não prometa funções que a tela não oferece.
- Toda aba deve ter um guia específico e manter o botão Ajuda no cabeçalho compartilhado. Novas áreas internas com fluxo próprio precisam selecionar sua ajuda contextual com `useHelpTopic` e ter seu guia incluído no manual.
- Após revisar o conteúdo, atualize a data de revisão e execute `npm run manual:generate`. Inclua `docs/MANUAL_DO_APP.md` na alteração. `npm run manual:check`, também incluído no lint, verifica cobertura de abas e sincronização do arquivo com a ajuda.
- O verificador não substitui revisão humana do conteúdo: registre na validação quando uma mudança técnica não exigir alteração de instruções ao usuário.
- Preserve o contexto, os filtros e os dados ao abrir a ajuda; navegar no manual não deve gravar registros nem abrir telas operacionais automaticamente. O índice do app deve respeitar as áreas de acesso do usuário.

## Contrato de interface MARCELL — novas introduções

- Por solicitação do usuário em 01/11/2026, toda nova tela, componente, texto, botão, dimensão, espaçamento e fluxo deve seguir o padrão compartilhado MARCELL. Reutilizar componentes e tokens, sem criar estilos locais para contornar a base.
- A consolidação local vigente está no checkout `C:/dev/repositorio-mrc`, consolidado a partir de `8bfa833d` e das alterações locais preservadas. Consulte seu `docs/PADRAO-INTERFACE.md` e `DESIGN.md` antes de continuar esse trabalho. Não sobrescrever alterações deste checkout com uma versão anterior do workspace.
- Nesse checkout, a escala comum é `src/design-system/foundations.js`, textos genéricos são `src/design-system/copy.js` e `npm run design:check` integra o lint. Não aumentar a baseline do legado para liberar novas exceções. Revisar desktop, celular, ajuda e manual em cada alteração relevante.

## Interface (UX/UI)

Toda tela nova ou alterada segue `docs/REGRAS-UX-UI.md` (tokens de tema, cor só para desvio, plural com `contar()`,
percentual com vírgula, uma ação principal por tela, faixa única de indicadores, conferência nos temas Preciso e Noite).
`npm run lint` barra aumento de cor fixa, "(s)" e `toFixed()%` via `scripts/check-ux-rules.mjs`.


## Regras operacionais compartilhadas

Regras originalmente mantidas no `CLAUDE.md`, agora válidas para todos os clientes. As referências a PR, merge e deploy abaixo só se aplicam quando essas ações estiverem explicitamente autorizadas. Registros de falhas preexistentes são históricos e devem ser reconferidos antes de relatar o estado atual.

## 1. Antes de mexer

- Leia o código do caminho inteiro (tela → `api/data.js` → `server/` → banco) antes de propor correção. Não corrija só o sintoma visível.
- Regra de negócio decidida pelo responsável não muda sem pedido explícito. As vigentes:
  - **Feriado** é pago pela obra do **último dia trabalhado (P/M) antes dele**, até 31 dias para trás, sem exceção para ponto lançado no próprio feriado. Sem dia trabalhado, vale a lotação histórica na data. Fonte única: `resolveHolidayObraId` (`src/domains/ponto/permissions.js`).
  - **Dia sem obra no ponto** segue o histórico de transferências do cadastro (`resolveHistoricalEmployeeObraId`), na folha e na DRE.
  - `exigirVerificacao` do app de ponto continua `false`.
- Não modificar a ARP do REP-P (`ponto_arp_*`, NSR, hashes, `ponto_dispositivo_protegido`) fora de uma rodada própria. Não declarar conformidade REP-P nem registrar INPI.
- Não armazenar nem logar vetor facial, CPF completo fora da ARP, PIN, token ou chave.

## 2. Folha × DRE (sempre iguais)

- Custo de mão de obra tem **uma** implementação: `src/domains/financeiro/labor-cost-engine.js`, usada pela tela e por `server/dre-projection.js`. Nunca duplique a regra em componente.
- Toda mudança de regra de custo exige: teste na folha (`FolhaView.test.jsx`), teste no motor e teste na DRE do servidor (`server/dre-labor-cost.test.js`) com o **mesmo cenário e o mesmo valor esperado**.
- Mudou o cálculo da DRE? Suba `DRE_PROJECTION_VERSION` em `api/data.js`. Sem isso, a DRE salva no banco continua com o valor antigo.
- Para mudança no financeiro, rode o agente `dre-integration-guardian` antes de abrir o PR.

## 3. Segurança e permissões

- O navegador fala só com `/api`. O servidor usa `service_role` ou a conexão postgres direta. **Nenhuma tabela, sequência ou função SECURITY DEFINER do schema `public` pode ficar acessível a `anon` ou `authenticated`.** A migration 019 roda por último em todo deploy e o build falha se sobrar algo aberto.
- Migration nova: idempotente (`if not exists` / `create or replace` / `drop ... if exists`), com `.down.sql`, com teste PGlite que executa o SQL de verdade, e aplicada pelo `prebuild` **antes** de `acesso-publico:migrate`. Função SECURITY DEFINER sempre com `set search_path` e `grant execute ... to service_role`.
- Esconder menu não é permissão. Toda ação da API que devolve dado sensível confere o perfil no servidor (`podeAcessarAba` em `src/domains/administracao/abas-acesso.js`, `PAPEIS_*` no ponto) e tem teste de 403.
- Ação que aceita código, PIN ou senha tem limite de tentativas (`rateLimitCentral`).

## 4. Banco de produção (Supabase)

- SQL pelo conector é **somente leitura** por padrão (`select`). Escrita, DDL ou correção de dado só com pedido explícito do responsável naquela conversa, e sempre por migration versionada no repositório, nunca por SQL solto.
- Conferir dado real antes de concluir um diagnóstico: o dado de produção desempata hipótese.
- Linhas gzip (`arcd-gzip-base64-v1`) não são inspecionáveis por SQL; diga isso em vez de supor o conteúdo.
- A base da empresa é dividida em linhas (`arced_ponto_v1` + `__ponto`, `__equipamentos`, `__config`, `__lookahead`, `__rdo`, `__orcamentos` e o ponto por obra). Quem lê direto uma linha só vê parte dos dados; use `lerLinha()` ou mescle com `mergeDomainRows`. Campo novo numa linha própria: `DOMAIN_FIELDS` em `server/domain-row-routing.js` e teste com Postgres real.
- jsonb gravado pelo driver `postgres` vai por `sql.json(...)`, nunca `JSON.stringify(...)::jsonb` (grava texto).

## 5. Git, PR e deploy

- `main` publica em produção pela Vercel. Merge = deploy.
- Nunca reutilize nem resete a branch de um PR aberto para outro trabalho: crie branch nova a partir de `origin/main`. Force push só com autorização explícita.
- Antes de abrir PR: `npm run lint`, `npm run architecture:check`, `npm run typecheck`, `npm test` e `npx vite build`, todos verdes. Teste novo precisa falhar sem a correção.
- Depois do merge: confirmar o status da Vercel no commit de merge e, quando houver dado envolvido, conferir no banco (leitura) que o efeito apareceu.
- Falhas pré-existentes na `main` (hoje: `npm audit` e `expo-doctor` do app) são explicadas uma vez no PR, nunca escondidas.

## 6. Interface (UX/UI)

- Toda tela nova ou alterada segue `docs/REGRAS-UX-UI.md`. As mais esquecidas: cor só por token de tema (nada de hex), cor só para desvio, `contar()` no plural (nunca "(s)"), percentual com vírgula, uma ação principal por tela, excluir no menu "⋯", faixa única de indicadores (`kpi-strip.css`).
- Mudança visual é conferida nos temas MARCELL Preciso e MARCELL Noite, em 1440 px e 390 px; impressão e PDF ficam claros.
- `npm run lint` roda `scripts/check-ux-rules.mjs`, que barra aumento de cor fixa, "(s)" e `toFixed()%`. Se a contagem cair, rode `node scripts/check-ux-rules.mjs --update`.
- Telas alteradas passam pela crítica do Impeccable; a nota não pode cair e vai registrada no PR, com capturas antes e depois nos dois temas.

## 7. Relato

- Responder em português, com o que foi feito, o que foi verificado e o que ficou pendente. Não afirmar que algo funciona sem teste ou dado que mostre.
