# Manual completo do sistema ARCD

Versão auditada: 22 de julho de 2026  
Base técnica da revisão: commit `d16a63c`  
Aplicação: ARCD Construtech — gestão integrada de obras

## 1. Finalidade deste manual

Este documento descreve o funcionamento atual do ARCD a partir do código publicado. Ele serve para treinamento, definição de responsabilidades, implantação e conferência dos processos.

O sistema reúne oito áreas principais:

1. Administração;
2. Painel corporativo;
3. Engenharia e gestão de obras;
4. Compras e suprimentos;
5. Financeiro;
6. Recursos Humanos;
7. Comercial;
8. Inteligência artificial e ajustes.

O ARCD é uma ferramenta gerencial. Decisões técnicas, fiscais, trabalhistas, contábeis e contratuais continuam exigindo revisão do profissional responsável.

## 2. Conceitos fundamentais

### 2.1 Visão corporativa e visão por obra

O sistema possui dois contextos diferentes:

- **Visão corporativa:** consolida todas as obras. É usada pelos setores de Compras, Financeiro, RH, Comercial e Administração.
- **Visão por obra:** é aberta pelo painel de Obras e mantém o projeto selecionado como contexto. Reúne Geral, Obra, Gestão da qualidade, Suprimentos, Financeiro, RH e Recursos.

Antes de registrar qualquer dado, confirme o nome da obra exibido no filtro ou no cabeçalho.

### 2.2 Registro gerencial, compromisso e movimentação física

- Solicitação é uma necessidade ainda não comprada.
- Cotação é uma comparação comercial.
- Pedido é um compromisso, não uma despesa liquidada.
- Nota fiscal é a evidência fiscal e a obrigação a conferir.
- Pagamento é a saída efetiva ou a quitação direta pelo cliente.
- Conciliação liga o evento registrado ao extrato bancário.
- Recebimento de material é um evento físico que movimenta o estoque.

### 2.3 Documentos

O banco do aplicativo guarda metadados e hyperlinks. Os arquivos ficam no OneDrive, organizados por obra. Fotos operacionais também podem usar o Storage configurado quando o fluxo específico assim exigir.

### 2.4 Auditoria

O aplicativo mantém um `changeLog` com operador, data, hora, tipo de ação e obra quando identificável. O histórico registra ações por item, não a diferença de cada campo. Importações em massa podem aparecer resumidas como uma única ação.

## 3. Acesso e perfis

### 3.1 Login

O acesso principal usa e-mail e senha do Supabase Auth. Durante a transição, o PIN individual ainda pode ser utilizado. A sessão por e-mail fica na sessão do navegador e é restaurada ao atualizar a página enquanto o token for válido.

Boas práticas:

- nunca compartilhe senha ou PIN;
- use uma conta individual por operador;
- inative imediatamente quem sair da empresa;
- não deixe sessões abertas em computador compartilhado;
- use o comando de sair ao terminar;
- o administrador deve revisar periodicamente usuários on-line e permissões.

### 3.2 Perfis padrão

| Perfil | Responsabilidade principal | Acesso padrão relevante |
|---|---|---|
| Administrador | Configuração, usuários, auditoria e controle total | Todos os módulos |
| Engenheiro de Campo | Execução, RDO, equipes e ajuste de pendências | Obras, orçamento, planejamento, RDO, qualidade, suprimentos e campo |
| Engenheiro Auditor | Vistoria e validação técnica | Mesmo contexto operacional do campo, com criação de conferências |
| Compras | Solicitações, cotações, pedidos, fornecedores e estoque | Compras, suprimentos, estoque e IA |
| RH / Gestão | Equipe, ponto, folha e rescisão | Módulos de RH e IA |
| Financeiro | Pagamentos, notas, conciliação, DRE e auditoria financeira | Financeiro e módulos de apoio |
| Comercial | Jornada comercial completa | Leads, agenda, propostas, contratos, clientes e indicadores |
| Visualizador | Acompanhamento institucional | Dashboard e Modo TV |

O administrador pode personalizar as abas de cada usuário. A lista acima representa o padrão inicial.

### 3.3 Regra especial da conferência técnica

- Administrador e Engenheiro Auditor podem criar vistoria.
- O Engenheiro Auditor só pode criar em seu próprio nome e dentro de seu escopo.
- O vistoriador cria e edita a pendência, julga a evidência e encerra a vistoria.
- O Engenheiro de Campo atribuído não edita a pendência. Ele apenas envia nova foto de correção.
- Após a foto, a pendência entra em **Aguardando validação**.
- Somente o vistoriador responsável ou o administrador declara **Conforme** ou **Não conforme**.

## 4. Navegação

### 4.1 Menu lateral

O menu lateral é organizado por setor e pode ser minimizado. Os grupos exibidos dependem do perfil:

- Administração;
- Painel;
- Engenharia;
- Compras;
- Financeiro;
- Recursos Humanos;
- Comercial;
- IA;
- Ajustes.

Na Engenharia, a navegação operacional começa em **Obras**. Os módulos detalhados aparecem no cabeçalho da obra aberta, evitando repetir a mesma estrutura no menu lateral.

### 4.2 Busca global

Use `Ctrl+K` ou `Cmd+K` para pesquisar registros acessíveis ao seu perfil. A busca respeita as abas liberadas na interface.

### 4.3 Dashboard

O dashboard apresenta prioridades por operador e indicadores corporativos. Para Engenheiros de Campo e Auditores, são priorizados RDOs, conferências, patologias, FVS/FVM, ponto e demais pendências técnicas.

### 4.4 Modo TV

O Modo TV é uma visão institucional com rotação de obras, imagens, avanço planejado versus executado, alertas e necessidades. É uma tela de acompanhamento, não de edição.

## 5. Cadastros mestres

Cadastros consistentes evitam duplicidade nos módulos seguintes.

### 5.1 Usuários

Administração → Central do administrador → Usuários e permissões.

Procedimento:

1. cadastre nome, e-mail e perfil;
2. defina a obra exclusiva apenas quando o operador realmente tiver escopo restrito;
3. revise as abas liberadas;
4. salve o operador;
5. ative o acesso por e-mail com senha temporária;
6. confirme o vínculo antes de entregar a conta.

### 5.2 Funcionários

RH → Equipes.

Cadastre função, CPF, telefone, PIX, diária, benefícios, lotação e datas contratuais. Inativar preserva o histórico; apagar deve ser excepcional e restrito a cadastro sem histórico relevante.

Usuário e funcionário não são o mesmo cadastro:

- usuário controla login e permissão;
- funcionário controla vínculo de trabalho, lotação, ponto e folha.

Quando a mesma pessoa possuir ambos os papéis, mantenha nome e identificação coerentes.

### 5.3 Clientes

Comercial → Clientes, ou Obras → Nova/Editar obra → Cliente.

O cadastro contratual aceita pessoa física e jurídica. Preencha, conforme aplicável:

- nome, CPF/CNPJ, RG e órgão expedidor;
- nascimento, nacionalidade, estado civil, regime de bens e profissão;
- cônjuge;
- telefone, WhatsApp e e-mail;
- CEP, logradouro, número, complemento, bairro, cidade e UF;
- razão social, nome fantasia e inscrições;
- dados do representante legal.

Sempre vincule a obra pelo `clienteId`. O nome mantido na obra deve ser tratado como fotografia legível do cliente, não como segundo cadastro mestre.

### 5.4 Fornecedores

Compras → Fornecedores.

Digite o CNPJ e use **Buscar** para preencher dados públicos disponíveis. Revise razão social, nome fantasia, situação cadastral, CNAE, telefone, e-mail, endereço e ramos de fornecimento. A consulta externa não substitui certidões ou validação fiscal.

### 5.5 Condomínios

Cadastros → Condomínios.

Registre nome, cidade, UF, contato, endereço, regras, forma de atendimento e checklist. A obra deve ser vinculada ao condomínio antes de iniciar o licenciamento.

### 5.6 Unidades, categorias, insumos e composições

Cadastros e Orçamento concentram os itens próprios. Códigos internos seguem a sequência `ARCD001`, `ARCD002` etc. Antes de criar novo insumo, pesquise por código e descrição e confirme a criação quando solicitado.

### 5.7 Bases SINAPI e ORSE

Somente o administrador pode cadastrar ou excluir bases. Os demais usuários podem consultar e vincular bases existentes.

Use fonte, competência, UF e regime de desoneração corretos. Não mantenha duas bases com a mesma combinação sem uma razão documentada.

## 6. Fluxo comercial

### 6.1 Lead até contrato

Fluxo recomendado:

1. **Indicação/Lead:** registrar origem, contato, responsável e próxima atividade.
2. **Qualificação:** detalhar necessidade, endereço, padrão, área, prazo, orçamento disponível e projetos existentes.
3. **Agenda/Reunião:** registrar pauta, participantes, necessidades, objeções e próximos passos.
4. **Proposta:** definir escopo, inclusões, exclusões, entregáveis, prazo, preço, pagamento, responsabilidades e validade.
5. **Negociação:** registrar desconto, histórico e alterações de versão.
6. **Contrato:** conferir cliente, proposta, valor, entrada, parcelas, prazo e responsáveis.
7. **Fechamento:** transferir para Engenharia e Financeiro.

Na transferência, o sistema pode criar cliente, obra, contas a receber, comissão, reunião de kickoff e atividade de pós-venda. Revise todos antes de continuar.

### 6.2 Antiduplicidade comercial

O sistema alerta quando e-mail ou WhatsApp já pertence a outro lead. Antes de confirmar, pesquise também em Clientes e Contratos.

### 6.3 Cliente contratual

Uma proposta aceita não significa que todos os dados formais estão completos. Antes de assinar:

- valide a identidade do contratante e do representante;
- confira endereço e estado civil;
- anexe documentos;
- confirme escopo e responsabilidades;
- valide datas e forma de pagamento.

## 7. Cadastro e abertura da obra

Engenharia → Obras → Nova.

Preencha:

- nome/código da obra;
- cliente contratante;
- endereço;
- condomínio, quadra e lote;
- Engenheiro de Campo responsável;
- datas previstas;
- área construída;
- fase e situação;
- tipo, valor e período do contrato;
- regras de cobrança;
- entrada e caixa da obra.

Ao salvar, acesse a obra e confira:

- capa;
- responsável;
- contrato;
- vínculo do cliente;
- orçamento;
- planejamento;
- estrutura de arquivos.

## 8. Painel da obra

### 8.1 Cabeçalho fixo

Exibe capa, obra, cliente, engenheiro, situação e indicadores de contrato, recebido e resultado. Use **Editar obra** para corrigir cadastro e **Alterar imagem** para a capa.

### 8.2 Grupos

| Grupo | Conteúdo |
|---|---|
| Geral | resumo, atualizações, indicadores e informações essenciais |
| Obra | orçamento, planejamento, diário e medição técnica |
| Gestão da qualidade | FVS/FVM e conferência |
| Suprimentos | compras e estoque |
| Financeiro | DRE, caixa, medições e visão específica da obra |
| RH | ponto, equipe e terceiros |
| Recursos | equipamentos, licenciamento, arquivos e portal do cliente |

Tudo aberto por essa barra deve permanecer filtrado pela obra atual.

### 8.3 Atualizações

A tela Geral reúne alterações do `changeLog` e acontecimentos operacionais. Confira nome do responsável e horário. Eventos sem autoria histórica aparecem como Sistema ou Não registrado.

## 9. Orçamento

### 9.1 Preparação

1. confirme a obra;
2. escolha as bases de referência;
3. confira competência, UF e desoneração;
4. configure BDI;
5. importe uma planilha ou monte a estrutura manualmente.

### 9.2 Hierarquia

As etapas de 1º nível representam os grandes serviços da obra. Níveis inferiores detalham os pacotes. Itens com código, unidade, quantidade e preço ficam associados às etapas.

Na Conferência e em Pedidos, a classificação principal utiliza a etapa de 1º nível para evitar listas de composições excessivamente detalhadas.

### 9.3 Composições e insumos

- itens de bases oficiais preservam fonte, código, competência e preço de referência;
- preço alterado deve ser tratado como preço negociado ou cotado;
- bancadas, esquadrias e itens equivalentes devem ser marcados para cotação quando não houver preço confiável;
- composições próprias devem ter código ARCD automático;
- criar novo insumo exige confirmação do operador;
- composição congelada no orçamento não deve mudar silenciosamente quando o cadastro mestre mudar.

### 9.4 Checklist de auditoria do orçamento

Revise item a item:

- escopo atendido;
- quantitativo verificável;
- unidade coerente;
- composição adequada;
- preço e data-base;
- BDI;
- interfaces entre disciplinas;
- itens ausentes;
- necessidade de cotação;
- situação: corrigir, conferido ou ignorado com justificativa.

Considere instalações e equipamentos especiais, como hidromassagem, climatização, automação, gás, aquecimento, impermeabilização, paisagismo, bancadas, esquadrias e ligações definitivas.

### 9.5 Saídas

O orçamento disponibiliza total geral, BDI, Curva ABC e exportações. Faça a revisão antes de PDF ou Excel e registre a base utilizada.

## 10. Planejamento

### 10.1 Cronograma

O planejamento usa tarefas, dependências, datas, progresso, custo real e marcos. Configure calendário de trabalho, feriados e data inicial.

### 10.2 Linha de base

Após aprovação, salve a linha de base. Ela congela datas e custos planejados. Substituí-la reinicia a comparação; faça isso apenas mediante decisão formal.

### 10.3 Acompanhamento

Compare:

- planejado versus realizado;
- avanço físico versus financeiro;
- início/fim planejados e reais;
- restrições e dependências;
- caminho crítico e tarefas atrasadas;
- compras e entregas necessárias.

O progresso pode receber informações do RDO. Revise qualquer sugestão automática antes de consolidar.

## 11. Diário de Obra — RDO

### 11.1 Fluxo cronológico

1. selecione a obra e a data;
2. confirme o responsável automático;
3. registre clima por período;
4. informe descrição e atividades planejadas;
5. vincule serviços executados ao planejamento;
6. marque equipes próprias e terceirizadas;
7. registre equipamentos e ocorrências;
8. envie áudio e/ou transcrição;
9. adicione fotos;
10. use **Refletir**;
11. revise os achados;
12. o engenheiro confirma a revisão e conclui.

### 11.2 Fotos

As imagens do RDO são comprimidas em JPEG e recortadas no centro em proporção 1:1. Legende as fotos e evite registrar pessoas ou dados pessoais sem necessidade.

### 11.3 Reflexão por IA

A IA pode interpretar texto, voz e imagens para sugerir:

- panorama do dia;
- equipes e serviços observados;
- avanço físico;
- riscos e pendências;
- materiais aparentes;
- comparação com o planejamento;
- atividade não prevista.

Ela não conclui o RDO nem substitui o responsável técnico. A revisão do engenheiro é obrigatória.

## 12. Gestão da qualidade — FVS e FVM

### 12.1 FVS

Ficha de Verificação de Serviço vinculada, preferencialmente, a uma etapa principal do orçamento.

### 12.2 FVM

Ficha de Verificação de Material vinculada a material, lote, fornecedor e nota fiscal quando disponível.

### 12.3 Checklist auditável

Cada ficha deve conter:

- código;
- obra e local;
- responsável e inspetor;
- critério, método e tolerância;
- resultado por item;
- evidência;
- data e responsável pela verificação;
- não conformidade, ação, prazo e eficácia quando aplicável.

Não libere ficha com item pendente ou não conforme sem tratamento documentado.

## 13. Conferência técnica

### 13.1 Nova vistoria

Administrador ou Engenheiro Auditor:

1. filtre a obra;
2. clique em **Nova vistoria**;
3. confirme data e responsável;
4. registre nota geral e observações;
5. crie as pendências.

### 13.2 Pendência

Toda pendência deve ter:

- etapa principal do orçamento;
- descrição objetiva;
- categoria;
- impacto;
- responsável pelo ajuste;
- ajuste necessário;
- prazo;
- fotos de registro.

As fotos podem ser abertas, anotadas e desenhadas para apontar o local do problema. Preserve também a imagem original.

### 13.3 Correção e validação

1. o Engenheiro de Campo atribuído abre a pendência;
2. envia foto da correção;
3. o sistema marca **Aguardando validação**;
4. o vistoriador analisa;
5. se conforme, resolve e registra a data;
6. se não conforme, devolve para novo ajuste com observação.

### 13.4 Relatório

Use a exportação de pendências para emitir relatório com obra, vistoria, item, impacto, responsável, prazo, evidências e situação.

## 14. Compras e suprimentos

### 14.1 Fluxo oficial

`Solicitação → análise → cotação → pedido → documento fiscal/pagamento → recebimento → estoque → aplicação → conciliação`

### 14.2 Solicitação

O campo registra a necessidade da obra. Vincule os itens à etapa de 1º nível do orçamento, informe quantidade, prioridade, data e observação.

### 14.3 Cotação

Compare fornecedores, preço, prazo e observações. Anexe um ou mais documentos por proposta, sempre com legenda. Registre vencedor e justificativa.

### 14.4 Pedido

O pedido guarda obra, fornecedor, itens, preço, previsão, origem esperada do pagamento e documentos. Ele não deve ser entendido como despesa realizada.

### 14.5 Pagamento antes da chegada

O Financeiro ou Administrador registra o pagamento. Origem real:

- conta da empresa;
- caixa da obra;
- pagamento direto pelo cliente.

Regras:

- pagamento com caixa é bloqueado se o saldo ficar negativo;
- saldo baixo gera alerta;
- comprovante pode ser anexado e vai ao diretório financeiro;
- pagamento antecipado sem NF exige confirmação e fica sinalizado;
- pagamento bancário deve ser conciliado.

### 14.6 Recebimento e estoque

O material só deve ser recebido depois da quitação conforme a regra atual. O recebimento gera entrada física no estoque e atualiza quantidades recebidas e preço médio.

O estoque não cria outra despesa: ele registra o fluxo físico.

### 14.7 Histórico de preços

Use as abas de fornecedor e evolução por insumo para conferir:

- preço por data;
- fornecedor;
- obra;
- quantidade;
- variação;
- comparação com referência.

## 15. Financeiro

### 15.1 Visão financeira

Apresenta DRE gerencial, filtros por obra, mês e ano, receitas, custos, resultado, fluxo e ranking financeiro.

### 15.2 Central de pagamentos

Fluxo visual:

1. pedidos;
2. itens sem NF;
3. documentos em conferência;
4. obrigações autorizadas;
5. pagamentos realizados;
6. pagamentos a conciliar.

O perfil Financeiro inicia nessa central.

### 15.3 Notas fiscais

Receba NF-e, NFS-e, CT-e ou outro documento. Informe obra, pedido, número, série, chave, emissão, vencimento, fornecedor, valores, retenções e rateios.

O sistema compara nota e pedido e aponta divergências. Aprovação com divergência exige confirmação humana.

### 15.4 Administrativo financeiro

Permite visão consolidada ou por obra:

- resumo;
- receitas;
- despesas;
- resultados;
- documentos.

Os documentos podem ser anexados à movimentação com legenda e visualizados pelo hyperlink.

### 15.5 Conciliação bancária

1. importe OFX preferencialmente; CSV/XLSX são aceitos;
2. revise pendentes;
3. aproprie por obra ou empresa;
4. rateie quando necessário;
5. vincule recebimentos às medições;
6. confira a soma;
7. conclua ou ignore com motivo;
8. consulte o histórico.

Ignorar não apaga. A transação permanece auditável e pode ser reaberta. Use **Ignorar todas** apenas após filtro e conferência do lote.

### 15.6 DRE

- DRE Empresa: receitas e despesas administrativas.
- DRE Obras: resultado por projeto.

O regime é gerencial. A origem de cada custo precisa ser mantida para não duplicar pedido, pagamento, caixa e transação bancária.

### 15.7 Medições e recebíveis

Cadastre modalidade, competência, vencimento, parcela, valor previsto e recebimento. Ao gerar parcelas retroativas, revise a situação de todas as parcelas já vencidas.

### 15.8 Ranking financeiro

O ranking combina margem, recebimento, caixa e conformidade. Penaliza notas vencidas, pedidos sem NF e pagamentos não conciliados. É indicador de gestão, não demonstração contábil oficial.

## 16. Recursos Humanos

### 16.1 Equipes

Cadastre e lote funcionários. Transferência preserva o histórico. A equipe da obra deve refletir a lotação atual; o ponto preserva a obra efetivamente trabalhada.

### 16.2 Ponto

Registre presença, meio período, falta, observação e hora extra conforme as opções disponíveis. Finalizações bloqueadas exigem solicitação de permissão. RH e Administração podem arquivar quinzenas; somente Administração restaura.

### 16.3 Folha

Consolida ponto, diária, benefícios, adiantamentos e pagamentos. Confira divergências antes de exportar.

### 16.4 Rescisão

Registre motivo, datas e valores. Validação jurídica e contábil permanece externa ao aplicativo.

### 16.5 Terceiros

Cadastre contrato, documentação, etapas, retenções e origem do pagamento. Medição de terceirizado exige evidência fotográfica enviada por Engenheiro de Campo ou Auditor. Pagamento sem foto deve ser tratado como risco pelo Financeiro.

## 17. Equipamentos

O módulo controla cadastro, proprietário, patrimônio, quantidade, tarifas, custo, locação, manutenção e transferência. Diferencie:

- equipamento próprio;
- equipamento de terceiro;
- valor cobrado do cliente;
- custo pago ao proprietário;
- manutenção paga pela empresa ou pelo proprietário.

## 18. Licenciamento

### 18.1 Preparação

1. vincule a obra ao condomínio;
2. escolha nova aprovação ou verificação de obra já aprovada;
3. use o checklist correspondente;
4. defina responsáveis e prazos;
5. anexe documentos por item;
6. registre protocolo, emissão e validade.

### 18.2 Condomínio Terras Alpha

O checklist inclui documentos arquitetônicos, levantamentos, hidrossanitário, propriedade, ART/RRT, acessos, ligações, sondagem, arquivos digitais e etapas posteriores de Prefeitura/Associação. Confirme sempre a versão mais recente das regras diretamente com o condomínio.

### 18.3 Dossiê

O dossiê reúne situação, responsável, observações e hyperlinks. Cada item aceita mais de um documento. Remover o link do dossiê não apaga o arquivo do OneDrive.

## 19. Arquivos e OneDrive

### 19.1 Estrutura padrão por obra

- `01 - Contratos`
- `02 - Projetos`
- `03 - Documentos`
- `03 - Documentos/Licenciamento`
- `04 - Diário de Obras`
- `05 - Fotos`
- `06 - Capa da Obra`
- `07 - Conferências Técnicas`
- `08 - Financeiro e Fiscal`
- `09 - Compras e Suprimentos`
- `11 - Outros`

### 19.2 Permissões

- todos os operadores autenticados podem navegar pela estrutura apresentada no app, criar subpastas e carregar arquivos conforme seu fluxo;
- a abertura direta do diretório administrativo no OneDrive fica reservada ao administrador;
- arquivos são visualizados por hyperlinks protegidos gerados pelo app;
- somente o administrador conecta a conta Microsoft e sincroniza todas as estruturas.

### 19.3 Regras de arquivo

- use nomes claros;
- adicione legenda funcional;
- mantenha obra, data e documento vinculados ao registro correto;
- não envie o mesmo arquivo em módulos diferentes sem necessidade;
- prefira adicionar um hyperlink ao mesmo arquivo em vez de duplicar o binário;
- o limite atual por upload do OneDrive no app é aproximadamente 6 MB.

## 20. Portal do cliente

Em Recursos → Portal do cliente:

1. configure quais informações serão publicadas;
2. ative o portal;
3. use **Visualizar como cliente**;
4. revise fotos, cronograma, financeiro e documentos;
5. copie o link somente após a revisão.

Nunca marque documento como público sem autorização. Desative o portal quando o acesso não for mais necessário.

## 21. Inteligência artificial

### 21.1 Configuração

O administrador configura uma única chave Google Gemini. Ela fica criptografada no servidor. Compras, Financeiro, Diário, Orçamento, Planejamento, Administração, Conferência, Qualidade, Comercial e RH usam essa integração.

### 21.2 Modo IA de documentos

1. carregue PDF ou imagens;
2. arquivos em lote são analisados separadamente;
3. confira a obra sugerida pelo nome do arquivo e pelo conteúdo;
4. revise fornecedor, número, datas, valor e tipo;
5. selecione o registro de destino ou crie um novo;
6. confirme a pasta sugerida;
7. aceite ou altere a sugestão;
8. finalize o vínculo.

A IA nunca deve criar lançamento definitivo sem confirmação humana.

### 21.3 Limites

- respostas dependem da cota da API;
- imagens ilegíveis geram incerteza;
- classificação fiscal e contábil precisa de validação;
- a IA só deve usar IDs existentes;
- documentos pessoais ou sigilosos exigem avaliação de privacidade antes do envio.

## 22. Administração e auditoria

### 22.1 Central do administrador

Reúne:

- auditoria e resumo por IA;
- filtros de alterações;
- exportação de auditoria;
- usuários e permissões;
- presença on-line;
- configurações centrais.

### 22.2 Rotina diária do administrador

- conferir falhas e conflitos;
- revisar usuários on-line anormais;
- verificar saves pendentes;
- tratar erros de OneDrive e IA;
- acompanhar pagamentos, documentos e pendências críticas.

### 22.3 Rotina semanal

- revisar contas sem NF;
- conferir pagamentos não conciliados;
- verificar RDOs e FVS/FVM pendentes;
- revisar patologias vencidas;
- conferir obras sem responsável, orçamento ou planejamento;
- exportar auditoria;
- validar backup.

### 22.4 Rotina mensal

- fechar ponto e folha;
- arquivar quinzena quando cabível;
- conciliar todos os extratos;
- revisar DRE e ranking financeiro;
- validar contratos, medições e recebíveis;
- revisar licenças e documentos a vencer;
- revisar acessos e usuários inativos.

## 23. Tratamento de erros

### 23.1 Conflito de gravação

Quando outro usuário salva ao mesmo tempo, o app tenta mesclar seções. Se aparecer o aviso:

1. leia o contexto;
2. escolha reaplicar suas alterações sobre a versão do servidor ou descartar;
3. confira o registro final;
4. evite que dois operadores editem o mesmo item simultaneamente.

### 23.2 Tela de erro

Se aparecer **Algo quebrou nesta tela**:

1. copie a mensagem técnica;
2. recarregue;
3. verifique se o dado foi salvo;
4. envie a mensagem, módulo, obra, operador e horário ao suporte.

### 23.3 OneDrive

Se a conexão expirar, o administrador deve reconectar a Microsoft. Não repita uploads várias vezes sem verificar a pasta, pois pode criar cópias.

### 23.4 IA

Erros comuns:

- chave não configurada;
- chave inválida;
- cota atingida;
- modelo indisponível;
- arquivo acima do limite;
- tempo de análise excedido.

## 24. Backup e continuidade

O sistema não possui rotina automática de backup documentada no código atual. Até a implantação de backup transacional:

- exporte periodicamente Folha, Medições, DRE, Orçamentos e Auditoria;
- proteja a conta OneDrive com MFA;
- configure backup do Supabase;
- teste restauração em ambiente separado;
- registre quem fez o backup, data, abrangência e resultado.

## 25. Glossário

| Termo | Significado |
|---|---|
| BDI | Benefícios e Despesas Indiretas |
| Curva ABC | classificação de itens por relevância financeira |
| DRE | Demonstração do Resultado gerencial |
| FVM | Ficha de Verificação de Material |
| FVS | Ficha de Verificação de Serviço |
| NF-e/NFS-e | nota fiscal de produto/serviço |
| RDO | Relatório/Diário de Obra |
| SINAPI | referência de custos da construção |
| ORSE | referência de custos de obras e serviços |
| Conciliação | vínculo entre registro interno e movimento bancário |
| Linha de base | fotografia aprovada do planejamento |
| Pendência técnica | desvio rastreado até correção e aceite |

## 26. Checklist de implantação

- [ ] Supabase e schema configurados.
- [ ] Variáveis do Vercel conferidas.
- [ ] Primeiro administrador validado.
- [ ] Contas individuais por e-mail ativadas.
- [ ] Perfis e abas revisados.
- [ ] OneDrive conectado pelo administrador.
- [ ] Estruturas das obras sincronizadas.
- [ ] Gemini configurado e testado.
- [ ] Clientes, fornecedores, funcionários e condomínios saneados.
- [ ] Obras com cliente e responsáveis vinculados por ID.
- [ ] Bases SINAPI/ORSE sem duplicidade.
- [ ] Orçamentos e planejamentos vinculados às obras.
- [ ] Fluxo de compra testado ponta a ponta.
- [ ] Fluxo financeiro testado ponta a ponta.
- [ ] RDO, FVS/FVM e conferência testados.
- [ ] Portal do cliente revisado.
- [ ] Backup e restauração testados.
- [ ] Treinamento por perfil concluído.

