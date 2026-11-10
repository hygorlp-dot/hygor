# Relatório de ponto e banco de horas — reformulação local

Implementação a partir das instruções detalhadas do usuário em 10/11/2026. Base: árvore efetivamente publicada `0b80ab9a7c0210cce12959e75ac26f2ec7e6d1a5`. Checkout isolado: `C:/dev/relatorio-ponto-compacto-20261110`. Sem push ou deploy desta reformulação.

## Apresentação

- MRC sem distorção, título solicitado e faixa horizontal de obra, período, funcionário e emissão brasileira no fuso operacional America/Recife. Exportação registra sua emissão separada do instante de consulta da fonte.
- Resumo com uma linha por funcionário: previsto, trabalhado, créditos, débitos, saldo estimado do período, saldo anterior, compensações/ajustes e saldo final. Valores zero são neutros; crédito/débito não zero têm sinal e cor. Durações não reiniciam em 24 horas.
- Saldo anterior e compensações não são fornecidos por esta fonte. Permanecem Não disponível, assim como saldo final; não são preenchidos com zero. Tratamento de horários pelo RH não é inventado como lançamento de compensação.
- Grupos com nome, matrícula e função disponíveis; uma linha por data da jornada e sublinhas para períodos adicionais ou horários sem classificação. Nas jornadas noturnas, entrada e saída mostram as datas completas.
- Pendências somente quando existentes. Auditoria expansível na tela e inclusão opcional no PDF/Excel, desmarcada inicialmente; inclui identificadores, métodos, instantes com segundos, obra de captura e versão/origem disponíveis dos tratamentos.
- PDF em A4 paisagem, sem marca d’água, cabeçalhos repetidos, identidade do funcionário na continuação, pares de linhas preservados e Página X de Y. Controles não são impressos. A observação gerencial fica uma vez no rodapé de cada página.
- Excel preserva resumo, jornadas, pendências e contexto em linha horizontal, com auditoria opcional. A paginação da tela por dez funcionários não limita a exportação.

## Mudança explícita na apuração deste relatório

A versão anterior reutilizava a estimativa por pares cronológicos mesmo para batidas Sem tipo. A nova projeção **não infere entrada/saída dessa ordem**. Sem classificação, mostra horários cronológicos e Pendente de classificação, sem horas ou débitos presumidos. Uma entrada repetida, saída ausente, sobreposição com outra jornada tratada ou identificador conflitante impedem totalizar o dia.

Quando há períodos ativos tratados pelo RH, usa essa fonte como Ajustado e preserva a classificação original das marcações na auditoria. Nos demais casos, usa os tipos explícitos entrada/intervalo/retorno/saída para construir períodos válidos. Mantém jornada, tolerância e o intervalo padrão de uma hora existentes; o padrão é identificado como presumido, sem criar marcações. Ausência de jornada prevista impede saldo, mas não apaga horas verificáveis de períodos válidos.

Créditos e débitos somam diferenças de jornadas válidas, separadamente. Totais parciais são identificados. Dias sem registros não entram como falta ou débito. A jornada prevista do resumo corresponde às jornadas com saldo apurado, não à previsão de todo o calendário. A Gestão do ponto, a folha e o motor de estimativa anterior não foram reescritos.

Em várias obras, apura a jornada inteira uma vez. O filtro não duplica jornada, almoço ou saldo. Horas por obra exigem períodos atribuíveis; captura de entrada numa obra e saída em outra não constitui distribuição comprovada. Em tratamento do RH, usa a obra apropriada, sem confundi-la com a de captura. Sem regra disponível, os campos não atribuíveis permanecem desconhecidos e a limitação aparece na seção de pendências.

Jornadas são vinculadas à data de entrada; no tratamento do RH, conserva a data da apropriação. A consulta do relatório solicita um dia anterior e posterior de contexto para reconhecer travessias da meia-noite. Esses dias de contexto não são somados ao período por simples recebimento de uma saída.

## Correção de leitura da API

A consulta existente omitia o tipo de evento já armazenado. Agora seleciona somente `payload->>tipoEvento` e `payload->>versaoJornada`, devolvendo o tipo quando a versão fiscal é 1. Não envia o payload completo, CPF, GPS, foto, vetor ou credenciais. Registros legados continuam sem classificação quando não a possuem.

Como essa leitura é compartilhada, o banco de horas existente também passa a receber o tipo que antes se perdia na consulta. Seu algoritmo permanece igual, mas pode sinalizar duplicidades antes ocultadas — por exemplo, duas entradas tipadas — em vez de estimar um par de entrada/saída. Essa é uma correção da fonte da consulta, sem editar as batidas.

`contextoJornadas: true` é opção explícita do relatório. A consulta antiga mantém suas datas sem essa opção. Autenticação, autorização da aba, empresa e população de funcionários continuam iguais. A rota continua somente leitura; não há SQL de escrita, migração, RPC de tratamento ou modificação de eventos. O teste com PostgreSQL embarcado compara tabelas, funções e triggers antes/depois, inclusive com contexto noturno.

## Validação e limites

- 155 testes em nove arquivos aprovados; a suíte SQL de consulta foi repetida após acrescentar a verificação de contexto real, com 49 testes aprovados.
- Quatro cenários Playwright aprovados em desktop 1440×1000 e celular 390×844, usando APIs interceptadas e dados sintéticos. Incluem navegação integrada, Excel reaberto e PDFs principal/opcional.
- Cenário visual: três funcionários sintéticos, 28 jornadas regulares, registros sem tipo, jornada noturna e período adicional. O total de 224h é mantido no resumo. PDF principal: duas páginas; com auditoria: cinco.
- PDFs renderizados com PyMuPDF e inspecionados. Verificadas presença do funcionário nas continuações, nota/paginação nas margens, segundos no anexo e ausência dos identificadores no PDF principal. A sobreposição inicial do rodapé foi corrigida com caixa de margem de impressão; a página residual foi eliminada compactando linhas.
- Skills Impeccable e shadcn aplicadas, componentes/tokens MARCELL existentes. Detector Impeccable sem ocorrências. Nenhuma alteração da baseline visual.
- Lint, manual, typecheck, arquitetura e ciclos aprovados. Build direto Vite e orçamento aprovados: 1.908.480 bytes gzip; teto total local de 1.864 KiB, aumento documentado de 4 KiB. Sem novas dependências ou mudança dos limites individuais/mídia.
- Sem alterações em migrações, regras de pagamento ou APKs. Hash do APK18 conferido: `c44704a3be2cd3a98f82f9a09009ad68a7b3bc1251a9dde4bba113ac30a64e51`. Corte fiscal não ativado. Não houve conexão ou escrita em produção nesta etapa.

Prévia sintética: `output/pdf/MARCELL-Relatorio-Ponto-PREVIA-SINTETICA.pdf` e versão com auditoria ao lado. Evidência de páginas: `artifacts/repp-tecnico/relatorios-ponto/validacao-pdf.json`; capturas em `artifacts/repp-tecnico/relatorios-ponto/`. Esses artefatos locais não entram no Git ou no deploy.
