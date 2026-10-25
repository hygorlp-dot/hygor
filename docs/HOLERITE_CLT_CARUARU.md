# Holerite CLT mensal e adiantamentos

RH e administradores selecionam a modalidade no cadastro da equipe: diária ou CLT mensal, com vigência. Cadastros antigos continuam como diária. O histórico resolve a modalidade por data; a planilha quinzenal de diárias não inclui dias CLT. A diária de referência continua como parâmetro explícito de custeio do ponto no DRE, separado do salário mensal contratado.

Em Folha → Holerites CLT, selecionar funcionário e competência. Preencher salário, matrícula, CBO, dias e eventos. O perfil Caruaru é uma sugestão reutilizável por funcionário e preservado em cada competência salva. Não converte diária em salário. Salvar um demonstrativo utiliza FUNCIONARIO_SALVO, com versão esperada e permissão RH/admin já existente; não cria obrigação, baixa, conciliação ou novo custo no DRE. Nunca representa quitação bancária.

## Fonte e vigência

PDF fornecido pelo usuário: `cct-caruaru-2026-17853519576a6a4f1580c96 (2).pdf`, registro MTE PE000665/2026, registrado em 14/07/2026. Convenção geral: 01/05/2026 a 30/04/2028; pisos e várias cláusulas econômicas: até 30/04/2027. Abrangência: construção civil, Caruaru/PE. Não estender automaticamente os pisos para 2027/2028.

- Cl. 3: pisos R$ 1.810,60 / R$ 2.406,80; classificação confirmada pelo RH.
- Cl. 7 e 37: identificação, remuneração discriminada, referências, descontos, INSS e FGTS.
- Cl. 39: extras 70% / 100%, com classificação dos eventos pelo operador. DSR sobre extras separado do DSR já incluído no salário mensal.
- Cl. 14: incentivo de formação, mediante elegibilidade comprovada.
- Cl. 18: cesta R$ 65,00, R$ 90,00 desde maio/2027, com requisitos de elegibilidade e mês de pagamento confirmado. Não confundir com refeição/ticket fornecido.
- Cl. 19: VT limitado ao custo concedido e ao percentual proporcional informado.
- Cl. 72: taxa assistencial 2%, teto do piso profissional; nunca aplicada sem confirmação de abrangência e oposição. Mensalidade associativa e taxa negocial não são automáticas.

## Tributação e limites

Automático: folha mensal ordinária 2026, INSS progressivo (Portaria MPS/MF 13/2026), IRRF mensal 2026 com redução da Lei 15.270/2025, dedução legal ou simplificada mais favorável. IRRF por mês de pagamento, com campos para outros rendimentos, deduções e retenções da mesma fonte no mês.

Férias, 13º, rescisões, vínculos concomitantes, situações especiais e adiantamentos/saldo pagos em meses diferentes exigem valores apurados pela contabilidade. Apuração manual exige INSS, IRRF, base IRRF e referência/responsável. Não há extrapolação de tabela de 2026 para outro ano. FGTS é informativo como encargo do empregador, nunca desconto do líquido. Rubricas adicionais exigem definição das incidências pela contabilidade.

Fontes oficiais consultadas: [INSS](https://www.gov.br/inss/pt-br/direitos-e-deveres/inscricao-e-contribuicao/tabela-de-contribuicao-mensal), [IRRF 2026](https://www.gov.br/receitafederal/pt-br/assuntos/meu-imposto-de-renda/tabelas/2026), [CLT](https://www.planalto.gov.br/ccivil_03/decreto-lei/del5452compilado.htm).

## Adiantamentos e exportação

Seleção de parcelas existentes pela competência de desconto; IDs únicos. Recibos utilizam registros existentes e ficam para assinatura após recebimento. Não criam transferência nem comprovam pagamento. Mudanças/cancelamento do adiantamento bloqueiam exportação sem nova conferência. Exportação mensal requer dados completos, confirmação e salvamento. PDF MARCELL com logo e fontes incorporadas.

Validação isolada: cenários tributários, vigência, histórico de modalidade, eventos, adiantamentos, preservação financeira, persistência e PDFs em desktop e celular. Nenhum empregado, adiantamento ou pagamento fictício é criado em produção.

## Provisões trabalhistas

Folha → Provisões trabalhistas apresenta reserva mensal por funcionário e total no filtro de obra/competência. CLT mensal é incluído por padrão; diária exige inclusão explícita e base mensal informada. Base remuneratória + média de variáveis, sem conversão automática da diária.

Componentes: 13º (1/12), férias (1/12), terço constitucional (1/36), FGTS das verbas conforme incidência e cenário de reserva de multa de FGTS (40% sem justa causa, 20% acordo ou sem reserva). A reserva mensal da multa usa FGTS ordinário estimado e FGTS das verbas provisionadas. O FGTS ordinário não integra o total de reservas. Outras reservas mensais podem ser informadas. Férias reservadas substituem o salário durante o gozo: não duplicar o custo salarial no DRE.

São estimativas de planejamento para mês integral, com remuneração constante, não apuração automática de passivo ou rescisão. Avos efetivos e férias já gozadas não são inferidos. Saldo projetado exige mês inicial, abertura e utilização informados, inclusive zero: abertura + reserva atual × meses inclusivos − utilização. Sem dados, “Não apurado”; totais incompletos são parciais. Base FGTS para fins rescisórios do extrato gera exposição à multa separada da reserva projetada, sem somar ambas. Saques não substituem essa base. INSS patronal, RAT, terceiros e aviso-prévio não são presumidos.

Persistência versionada no funcionário por competência, nas mesmas permissões de RH/admin. Não gera lançamento, pagamento ou provisão contábil no DRE. PDF gerencial MARCELL. Fontes: [Lei 4.090/1962](https://www.planalto.gov.br/ccivil_03/leis/l4090.htm), [Lei 8.036/1990, art. 18](https://www.planalto.gov.br/ccivil_03/leis/l8036compilada.htm), [CLT](https://www.planalto.gov.br/ccivil_03/decreto-lei/del5452compilado.htm) e [FGTS Digital/MTE](https://www.gov.br/trabalho-e-emprego/pt-br/servicos/empregador/fgtsdigital/perguntas-frequentes).

Déficit projetado é permitido e destacado, sem retirar a reserva mensal válida do total. Abertura negativa pode carregar déficit anterior. Utilização e base FGTS rescisória permanecem não negativas. Outras reservas aparecem separadas na tabela, permitindo conferir a soma.

## Simulação mensal e admissão

O RH escolhe diária ou CLT por funcionário e competência em Simulação CLT × diária. A escolha simulada não altera a modalidade contratual, holerites, provisões ou pagamentos. Custos de admissão são opcionais e exclusivos da competência: ASO, exames complementares, EPIs/uniformes iniciais, treinamento/integração, registro/serviços e outros custos. Não há preços presumidos: preencher valores conhecidos ou zero. Somam ao custo da empresa nos dois cenários, com subtotal separado do custo recorrente, sem reduzir o líquido. Não se repetem no próximo mês e não criam lançamentos financeiros. Diária é forma de cálculo, não dispensa de obrigações trabalhistas.

Na transição CPRB de 2025–2027, a CPP reonerada é excluída do 13º provisionado (Lei 12.546/2011, art. 9-A, §1º, incluído pela Lei 14.973/2024). RAT e terceiros permanecem na base aplicável. A contribuição CPRB sobre receita não está estimada neste comparativo.

## Fechamento integrado, custos e prontuário

Fluxo em Pessoas e terceiros → Folha. Preparação do mês reutiliza contrato/perfil, rubricas explicitamente marcadas como recorrentes e seleciona parcelas de adiantamentos existentes quando solicitado. VT pode ser sugerido pelo valor diário cadastrado × dias com presença; exige confirmação do benefício concedido. Não concede cesta, incentivo, desconto sindical ou pagamento por inferência.

Ponto: importação do mês civil usa os registros operacionais e os fechamentos diários existentes por obra. Dias previstos sem registro ou abertos bloqueiam a importação. F e M precisam de classificação pelo RH; horas extras precisam ser distribuídas entre adicionais. Atrasos/horários incompletos exigem decisão registrada e rubricas cabíveis. A escala padrão é segunda a sexta; sábado é opção explícita. DSR semanal por domingo na competência é uma opção do RH; semanas que atravessam competência e escalas especiais exigem ajuste justificado. Mês de admissão/desligamento/troca de modalidade exige confirmação de proporcionalidade. Não se presume falta por ausência de registro.

Cada importação registra origem, opções, autor, data e assinatura determinística dos registros e fechamentos. Mudança/reabertura impede salvar e exportar até atualizar. O servidor verifica os eventos ao salvar. Campos importados ficam protegidos; ajuste manual exige justificativa e preserva a origem. Importação não bloqueia o ponto nem gera lançamentos financeiros. A aprovação final do holerite permanece explícita. Fechamento mostra situação por funcionário e permite imprimir em lote somente holerites salvos e válidos; parcelas alteradas invalidam a aprovação anterior.

Custos: painel por competência e funcionário separa custeio operacional usado no DRE, bruto/líquido/FGTS do holerite válido, provisões salvas, cenário simulado/admissão e saídas de folha do razão canônico no mês do pagamento. As colunas não são somadas entre si: representam naturezas e bases que se sobrepõem. Ausência de fonte é Não apurado, e totais incompletos são parciais. Pagamentos sem identificação e arquivo agregado por obra são sinalizados, sem rateio presumido. Apenas consulta e PDF; preserva o DRE e pagamentos.

Prontuário: somente RH/admin, verificado no servidor. PDF/JPEG/PNG até 3 MB com verificação de assinatura do arquivo. Bucket privado rh-prontuarios, sem URLs públicas ou novas políticas concedendo acesso direto. Metadados ficam em chaves rh_doc_* independentes do payload operacional, em company_app_data (RLS ativo, sem privilégios anon/authenticated). Lista e arquivo exigem funcionário existente; caminho é gerado no servidor, vínculo entre funcionários não é aceito. Downloads assinados por 60 segundos com no-store. Nome, categoria, emissão, validade, autor, SHA-256 e observações são registrados. Arquivamento com motivo preserva arquivo e autoria; não há exclusão física por esta tela. Upload idempotente por UUID; falha ao registrar metadados tenta remover o objeto recém-enviado. Não há antivírus/OCR ou assinatura eletrônica integrada; anexos não substituem validação documental. ASO anexado não altera automaticamente a validade no cadastro.

Referências de fluxo (não dependências): Convenia (dados existentes e contabilidade), Sólides (ponto/benefícios integrados), Factorial (aprovação e bloqueio da fonte). Sem integração automática com eSocial/DCTFWeb/FGTS Digital e sem portal/assinatura de funcionário nesta entrega. Nenhum envio a terceiros é executado.

Preparação em lote cria somente rascunhos inexistentes, mantém confirmação desmarcada, preserva demonstrativos existentes e informa falhas por funcionário. Não confirma elegibilidade automaticamente nem gera pagamento. A importação considera somente os dias de modalidade CLT vigente; dias por diária continuam na folha própria.

## Escolha real de modalidade pela gestão do ponto

RH/admin podem abrir Definir diária ou CLT pelo ponto em Gestão de ponto e Ponto por obra. O servidor confere cadastro necessário à modalidade: identificação/CPF válido, função, admissão, telefone, lotação ou área administrativa, diária de custeio, jornada e dados PIX ou instrução de pagamento. Para CLT, salário mensal, matrícula, CBO, categoria e ASO válido na vigência. O cadastro da Equipe permite preencher esses campos antes da escolha; documentos são tratados no prontuário conforme função e contratação, não inferidos pelo simples preenchimento.

A alteração usa FUNCIONARIO_MODALIDADE_DEFINIDA, versão esperada e papéis RH/admin; vigência e justificativa são obrigatórias. Preserva histórico de modalidade por data e decisões feitas pelo ponto com autoria. Não recalcula folhas fechadas: impede vigência até o último holerite confirmado, título de folha ou quinzena arquivada. A ação não liquida pagamento, não muda diária/salário cadastrados e não gera lançamentos no DRE. Diária é forma de remuneração e não elimina obrigações de vínculo. A comparação simulada continua separada.

Após definir/conferir a modalidade, o atalho abre Folha na competência e no funcionário escolhidos (holerite CLT ou folha por diária). O holerite recebe o perfil cadastrado, mas continua exigindo ponto aprovado, análise de exceções e confirmação antes da emissão. Instrução de pagamento não comprova quitação.
