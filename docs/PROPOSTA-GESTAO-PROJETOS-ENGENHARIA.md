# Gestão de projetos de engenharia e arquitetura

Data: 31/10/2026. Situação: escopo aprovado pelo usuário; implementado e validado localmente.

## Objetivo e decisão confirmada

Adicionar a aba Projetos ao ERP, preservando o planejamento de execução de obras. O usuário escolheu iniciar e pausar um cronômetro por projeto; o sistema calcula as horas entre essas ações. Não é necessário detectar aplicativos do computador nesta primeira entrega.

## Referências pesquisadas

| Produto | Referência aproveitada | Fonte oficial |
| --- | --- | --- |
| Monograph | Projetos de arquitetura e engenharia, etapas, horas e acompanhamento do planejado | https://monograph.com/features/project-execution |
| Runrun.it | Cronômetro e relatórios de horas por projeto e pessoa | https://support.runrun.it/pt-BR/como-o-runrun-it-funciona |
| Autodesk Docs / Forma | Histórico documental, revisão e aprovação | https://www.autodesk.com/uk/products/autodesk-docs/features |

As referências orientam os fluxos; a primeira entrega não reproduz todos os recursos desses serviços.

## Alternativas

1. **Módulo próprio com links e cronômetro — recomendado.** Reaproveita usuários, obras e identidade visual existentes. Oferece um fluxo completo sem depender de contratação ou credenciais externas.
2. **Conectar diretamente um SaaS.** Acrescenta dependência de conta, API, permissões e eventuais custos. Requer definir o serviço antes de implementar sincronização.
3. **Monitorar AutoCAD/Revit e sincronizar arquivos automaticamente.** Exige agente local ou plugins e conectores de arquivos. É uma extensão posterior, além do cronômetro escolhido.

## Experiência proposta

### Carteira

Lista pesquisável de projetos com obra vinculada quando houver, cliente, disciplina, responsável, etapa, prazo, horas previstas e realizadas. Filtros de obra, responsável e situação. Cadastro e edição de projetos, encerramento e acesso ao detalhe. Projetos de escritório podem existir sem obra; seu acesso fica restrito a operadores autorizados sem restrição de obra.

### Detalhe do projeto

Quatro áreas internas: Visão geral, Links e entregas, Horas e Revisões. Etapas iniciais: levantamento, estudo preliminar, anteprojeto, executivo e concluído. Disciplinas contemplam arquitetura, estrutura, hidrossanitário, elétrica e outras. Atividades possuem responsável, prazo e situação; os indicadores são calculados a partir dos registros.

### Links e entregas

Registrar título, disciplina e endereço HTTPS/HTTP de pastas, modelos ou documentos do OneDrive, Google Drive, Autodesk ou outros serviços. Abrir em nova aba com proteção contra acesso à janela de origem. Validar protocolo e não aceitar endereços executáveis. Cadastrar um link não concede acesso ao arquivo: as permissões continuam no provedor. A primeira entrega não acessa nem altera arquivos externos.

### Horas

Uma sessão ativa por usuário. Iniciar registra projeto, atividade opcional, usuário e instante inicial; pausar encerra a sessão. O total é calculado por timestamps, sem gravar a cada segundo. O contador continua até a pausa, inclusive durante navegação, recarga ou fechamento do navegador; essa regra deve aparecer junto ao controle. Mostrar sessão ativa, duração, histórico e totais por projeto e pessoa. Sessões longas devem ficar visíveis para conferência; ajustes exigem justificativa e trilha de auditoria. O servidor deve evitar duas sessões simultâneas para o mesmo usuário, inclusive entre abas ou dispositivos.

### Revisões

Cada entrega tem revisões numeradas, endereço do arquivo, descrição das mudanças, autor e data. A revisão nasce pendente e recebe parecer de aprovação ou solicitação de ajustes, com responsável e data. Preservar versões anteriores e decisões; uma nova versão não herda a aprovação anterior. Na primeira entrega, revisão é um fluxo documental humano. Comparação visual automática de PDF/DWG/RVT e descoberta de alterações no provedor precisam de conectores adicionais.

## Integração técnica proposta

- Criar domínio isolado em `src/domains/projetos`, carregado sob demanda pela aplicação operacional.
- Integrar a aba Projetos ao grupo de engenharia, ao catálogo de abas, às permissões e ao fluxo de navegação existentes.
- Reutilizar os primitivos locais e componentes shadcn, conforme `components.json`, e os padrões documentados em `DESIGN.md`; interface responsiva e acessível, com estados vazios, erros e carregamento.
- Reutilizar a sessão autenticada. Administração gerencia o módulo; engenharia opera nos projetos permitidos; demais perfis dependem de concessão explícita. Restrições de obra e autorização devem ser verificadas no servidor.
- Persistir projetos, entregas, revisões e sessões no servidor. Validar os comandos e a concorrência na fronteira de gravação; não depender de localStorage para as horas oficiais.
- Registrar autoria e timestamps no servidor. Rejeitar aprovações inválidas, encerramentos repetidos, referências inexistentes e gravações fora do escopo autorizado.
- Preservar os dados e as alterações locais preexistentes; não converter horas de projeto em folha de pagamento ou lançamentos financeiros automaticamente.

## Critérios de aceite e validação local

1. Criar projeto, vincular obra e responsável, filtrar a carteira e recuperar os dados após recarga.
2. Cadastrar e abrir links válidos; bloquear protocolos inseguros.
3. Iniciar e pausar horas, navegar e recarregar sem perder a sessão; impedir duplicação em abas concorrentes.
4. Criar duas revisões, registrar parecer e manter o histórico; nova revisão permanece pendente.
5. Bloquear leitura e alteração de projetos de outra obra ou de perfil sem permissão.
6. Exercitar os fluxos em desktop e celular, incluindo teclado, formulários inválidos, falha de persistência e dados vazios.
7. Executar testes de domínio, de autorização, de concorrência e de interface; compilar localmente com `node node_modules/vite/bin/vite.js build`, evitando o prebuild que pode executar migrações.

## Limite desta proposta

O usuário aprovou o escopo e autorizou a implementação local. O módulo foi desenvolvido; as regras e instruções de uso estão em `docs/GESTAO-PROJETOS-ENGENHARIA.md`. Não houve push, pull request, deployment ou alteração do banco real.
