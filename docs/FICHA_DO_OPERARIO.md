# Ficha individual do operário

Implementação local de 25/10/2026, no mesmo cadastro e nos mesmos fluxos de RH, ponto e financeiro existentes. A publicação e o teste remoto devem ser conferidos em `RH-PONTO-STATUS.md`; este relatório não declara produção validada.

## Como usar

Em **Equipes → Abrir ficha**, o RH encontra sete seções:

| Seção | Conteúdo e ação |
| --- | --- |
| Resumo e pendências | Cadastro a completar, arquivos a conferir, reserva pendente, adiantamentos a pagar e avisos de engenharia. Cada pendência abre a seção correspondente. |
| Dados | Dados pessoais, função, jornada, vínculo e remuneração, contato, endereço e emergência. “Editar cadastro” usa o editor já existente. |
| Documentos e fotos | Prontuário privado fixado no funcionário aberto. Inclui foto, documentos pessoais, ASO, treinamentos, atestados e demais categorias existentes. |
| Ponto | Consulta mensal dos registros canônicos. “Ver batidas” abre a revisão já existente em modo de consulta. Períodos arquivados podem ser consultados sem restauração. |
| Pagamentos | Títulos e baixas existentes, valor aprovado, pago e saldo, além do histórico de adiantamentos antigos e da reserva gerencial. |
| Histórico | Alterações disponíveis do cadastro, vigências, documentos e referência aos avisos da engenharia. |
| Engenharia | Orientações, ocorrências e solicitações, com obra, autor, data, situação e histórico de providências. |

O editor ganhou campos simples para e-mail, nascimento, estado civil, endereço e contato de emergência. Objetos de endereço e emergência são copiados para o formulário; editar e cancelar não modifica o cadastro original. O salvamento continua usando `FUNCIONARIO_SALVO`, a versão do funcionário e a auditoria existente.

O prontuário continua usando `/api/upload`, pasta lógica `rh`, bucket privado e URLs temporárias. A nova categoria `photo` usa o mesmo limite de 3 MB e os mesmos formatos PDF/JPEG/PNG. Não há cópia pública dos anexos. A tela não confunde falha de consulta com ausência de documento.

## Ponto atual e arquivado

A ficha lê `attendance` com `getAtt` e resolve a obra pela função canônica de lotação histórica. Não calcula uma segunda folha e não altera marcações, apropriações, NSR ou hash.

As datas de arquivo vêm de `quinzenasArquivadas`, incluindo os cortes que atravessam meses. Antes da consulta, a linha informa **“Em arquivo — consultar”**, sem chamar o dia de ausência. A ação reutiliza `carregarQuinzenaArquivada`/`load-quinzena-archive`; mantém em memória local apenas o ponto do funcionário da ficha. Depois de consultar, a origem fica **“Arquivo consultado”**. Um dia sem lançamento dentro do arquivo carregado é identificado como tal.

Essa consulta não restaura a quinzena, não grava `attendance` no estado principal e não recalcula o custo histórico. Um registro atual existente conserva prioridade. A engenharia consulta o ponto autorizado e recebe orientação para solicitar ao RH os períodos arquivados, conforme as permissões já existentes da API de arquivos.

## Avisos de engenharia

Os registros usam a coleção `employeeEngineeringRecords`, dentro da linha CORE já existente. Não foi criada tabela ou migration.

Os comandos oficiais são:

- `AVISO_ENGENHARIA_FUNCIONARIO_CRIADO`: novo aviso, versão inicial zero, funcionário, obra vigente, tipo, título e descrição.
- `AVISO_ENGENHARIA_FUNCIONARIO_SITUACAO`: providência sobre um aviso existente, versão esperada, nova situação e justificativa.

O servidor define autor, nome, perfil, escopo e horário. Ignora carimbos, histórico ou autoria enviados pelo cliente. A data de negócio usa `America/Recife`; uma transferência futura não antecipa a obra do aviso. A atualização consulta a obra do registro salvo, impedindo trocar o escopo pelo payload.

Situações: Pendente → Ciente ou Resolvido; Ciente → Resolvido. RH/admin também podem cancelar com justificativa. Um aviso finalizado não é reaberto nem sobrescrito. Cada providência acrescenta autor, horário, situação e texto ao histórico. O idempotency key e a versão da entidade usam a infraestrutura operacional existente. Um reenvio não cria outro aviso nem outra providência.

O texto original não é editado. As rotas legadas `save` e `save-sections` não podem substituir a coleção. A gravação e o evento de auditoria usam a mesma transação já existente em `api/data.js`.

Os avisos aparecem dentro da ficha e como pendências na lista da equipe. Não há envio de e-mail, WhatsApp ou push externo. Informações clínicas e documentos pessoais devem permanecer no prontuário do RH.

## Permissões e transferência de obra

| Perfil | Dados pessoais e documentos | Pagamentos | Avisos de engenharia |
| --- | --- | --- | --- |
| Admin | Acesso existente | Consulta existente | Criar, acompanhar, resolver e cancelar |
| RH | Acesso existente no cadastro/prontuário | Consulta existente | Criar, acompanhar, resolver e cancelar, respeitando escopo operacional |
| Engenheiro | Apenas identificação e dados profissionais permitidos | Ocultos e removidos da projeção | Criar e registrar providência na obra autorizada |
| Engenheiro auditor | Apenas identificação profissional permitida | Ocultos | Consulta dos avisos no escopo |
| Demais perfis | Mantidas as permissões existentes | Mantidas as permissões existentes | Sem novo direito de escrita |

A projeção do servidor passou a usar lista explícita de campos operacionais para perfis fora de RH/admin. Salário mensal, memórias de holerite, provisões, endereço, nascimento, contato de emergência e referências a documentos privados não seguem no JSON da engenharia.

A seleção de funcionários usa a lotação vigente. Um aviso antigo não desaparece ao transferir o funcionário: se o aviso for a única relação com a obra anterior, a projeção entrega apenas identificação mínima e o marcador de consulta histórica. A lista oferece **“Histórico da engenharia”**; a ficha permite consultar e concluir o aviso daquela obra, sem criar novo aviso como se o trabalhador ainda estivesse lotado ali. Avisos da outra obra continuam fora do escopo.

## Fontes e limites financeiros

Títulos e baixas são lidos de `titulosFolha` com `resumoTituloFolha`; o saldo do adiantamento usa `advancePaymentStatus`. O novo painel não cria obrigação nem registra pagamento. Os botões levam aos fluxos de folha e ponto já existentes.

As reservas continuam gerenciais e exigem apuração identificada para CLT por diária. A ficha mostra essa pendência e declara que a reserva não é lançamento automático na DRE nem pagamento. As fórmulas de custo, encargos e DRE não foram modificadas pela ficha.

## Verificações locais

- Domínio, política, autorização e projeção: primeiro lote de **186 testes em quatro arquivos**, aprovado em **7,31 s**.
- Componentes, prontuário, editor e ligação dos comandos: **15 testes em cinco arquivos**, aprovados em **8,68 s**. Um teste reproduziu o erro ao abrir dias com `getAtt` nulo; a correção passou.
- Revisão cruzada reproduziu transferência futura enviada à obra errada e desaparecimento do aviso da obra anterior. Os dois novos testes falharam antes da correção.
- Lote após os ajustes temporais, incluindo `src/integration/employee-engineering-api.test.js`: **24 testes em quatro arquivos**, aprovados em **12,98 s**.
- Arquivo de ponto: teste falhou mostrando “Sem apontamento” antes da consulta e passou com a indicação e consulta corretas; **cinco testes do componente aprovados em 3,92 s**.
- `npm run lint` canônico aprovado no checkpoint anterior à consulta de arquivos: 426 arquivos na checagem de nomes e 428 na checagem de UI. O gate final do root cobre o freeze completo.

O teste de integração dos avisos chama `api/data.js` de verdade e usa Postgres local em memória (PGlite), transações e tabela `audit_events` reais. Autenticação e relógio são dublês identificados. Exercita tentativa de forjar autor/data, outro perfil/obra, versão antiga, cancelamento indevido, reenvio, recarga, privacidade da projeção e bloqueio das rotas legadas. Confirma que cadastro, ponto e títulos não mudam ao registrar avisos.

A fixture do teste usa a linha de Ponto já separada, como o ambiente atual. Uma variante inicial com ponto apenas na CORE expôs uma pré-condição antiga de migração: `coreFieldsOnly` remove `attendance` da CORE. Esse comportamento transversal foi informado ao root; não foi alterado pela ficha nem usado como evidência de preservação para ambientes não migrados.

### Navegador desktop e celular

O cenário `ficha do operário` de `e2e/clt-payslips.spec.js` foi executado em Chromium, projetos `clt-desktop` (1440 × 1000) e `clt-mobile` (390 × 844), com um worker. Resultado final: **dois testes aprovados em 27,4 s**; desktop 13,2 s e celular 10,1 s. A primeira execução parou em um seletor escrito incorretamente no teste (“E-mail” em vez de “E-mail do funcionário”). A correção foi exclusiva do teste; não exigiu mudar a implementação congelada.

O percurso abre a ficha pela equipe, confere as sete abas, salva dados pessoais pelo editor existente, lista atestado, anexa foto, consulta um dia do ponto, confere adiantamento antigo, encontra o documento no histórico e registra/resolve aviso de engenharia. Verifica ausência de erro JavaScript, ausência de transbordamento horizontal e preservação do ponto, adiantamentos e pagamentos. As imagens foram inspecionadas visualmente.

Comando reproduzível:

```sh
PLAYWRIGHT_BROWSERS_PATH=/workspace/scratch/148e5b60e3bc/playwright-browsers npx playwright test e2e/clt-payslips.spec.js --project=clt-desktop --project=clt-mobile --grep 'ficha do operário' --workers=1
```

Evidências locais preservadas em `.tools/validation-ficha/desktop.png`, `mobile.png` e `playwright.log`. A revisão cruzada posterior confirmou os dois ajustes temporais sem identificar outro bloqueio concreto.

Os componentes React usam controles e serviços simulados; o navegador usa a UI real com respostas de rede fictícias. O teste de API descrito acima usa persistência SQL real local. Nenhuma dessas evidências comprova uso em aparelho físico ou execução remota da ficha.
