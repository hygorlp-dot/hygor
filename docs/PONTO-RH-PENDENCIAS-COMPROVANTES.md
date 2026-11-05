# Liberação dos comprovantes — conferência de 05/11/2026

## Resultado da investigação de integridade

Correção preparada e validada **localmente**, ainda sem publicação. A produção permanece na versão `a54764f1` até autorização para publicar a correção.

A leitura consistente do banco encontrou 58 eventos e 58 registros fiscais, distribuídos em dois estabelecimentos (2 e 56). Os 58 hashes dos conteúdos originais conferem; as duas cadeias fiscais também conferem. Nenhum payload, horário, CPF original, NSR ou hash no banco foi alterado.

Os dez alertas `HASH_LOCAL_DIVERGENTE` eram falsos positivos: a função `eventoDoBanco` acrescentava ao conteúdo comparado o estabelecimento vinculado pelo servidor, mesmo quando esse campo não existia no evento original aceito pelo aparelho. A correção preserva a ausência original desse campo e continua verificando o vínculo do aparelho, a empresa, o estabelecimento, os demais campos materiais e a cadeia fiscal.

O mesmo snapshot privado, reavaliado com a correção, apresentou `integridadeValida=true` nos dois estabelecimentos. O arquivo original permaneceu inalterado; os relatórios completos e dados pessoais ficam somente no diretório privado de diagnóstico, fora do repositório.

## Documentos e arquivos ainda faltantes

| Item | Situação verificada ou informada | O que entregar/concluir |
|---|---|---|
| Cessão de direitos à MARCELL | O usuário informou que está assinada; o arquivo não foi apresentado/conferido | Instrumento assinado para conferir autores, titularidade e escopo do programa. Não gerar outra cessão sem necessidade. |
| Pagamento da GRU do INPI | GRU emitida; pagamento não confirmado | Comprovante da GRU já emitida. Não emitir outra guia ou realizar pagamento automaticamente. |
| Material definitivo do registro | Há seleção/inventário e dossiê de preparação; ZIP/hash definitivos não confirmados | Congelar a versão final do programa, conferir autoria/terceiros e guardar o material correspondente ao SHA-512 declarado. O pacote anterior do ERP não substitui o material definitivo deste programa. |
| Declaração de Veracidade do INPI | DV oficial informada como obtida; arquivo local e assinatura não conferidos | Arquivo oficial correspondente ao pedido, assinado com certificado ICP-Brasil após conferência dos dados e do hash. Não criar um substituto para o formulário oficial. |
| Protocolo e certificado do INPI | Pedido protocolado e registro concedido não confirmados | Concluir o pedido, guardar protocolo e obter o certificado de registro do programa. O certificado é a evidência exigida pela configuração; protocolo/GRU não o substituem. |
| Atestado Técnico e Termo de Responsabilidade | Pendente | Documento referente à versão efetiva, com identificação do programa e assinaturas dos responsáveis técnico e legal da desenvolvedora, conforme modelo/especificações oficiais. A assinatura não pode declarar requisitos ainda não demonstrados. |

Referências: [guia oficial do INPI](https://www.gov.br/inpi/pt-br/servicos/programas-de-computador/guia-basico), [orientações oficiais do MTE sobre REP](https://www.gov.br/trabalho-e-emprego/pt-br/assuntos/inspecao-do-trabalho/fiscalizacao-do-trabalho/Perguntas%20e%20Respostas%20REP) e [modelo oficial de atestado](https://www.gov.br/trabalho-e-emprego/pt-br/assuntos/inspecao-do-trabalho/fiscalizacao-do-trabalho/modelo-do-atestado-tecnico-e-termo-de-responsabilidade.pdf).

## Evidências técnicas ainda não registradas

Estes itens pertencem ao aceite técnico configurado no sistema. Não são novos certificados a solicitar ao INPI.

| Evidência | Conteúdo necessário para a conferência |
|---|---|
| Acesso do trabalhador | Ensaio de entrega e acesso individual aos comprovantes e às últimas 48 horas, sem depender exclusivamente do WhatsApp; controle de acesso/revogação. |
| Hora Legal Brasileira | Ensaio da referência de hora, limite de divergência, indisponibilidade da referência e alteração do relógio, com resultados reais. |
| Armazenamento da ARP | Retenção, preservação dos originais, redundância, disponibilidade e restauração demonstradas por plano e ensaio. |
| Coletor Android | Modelo/versão do aparelho, versão efetiva do app e ensaio físico de captura, indicação de hora, operação offline e sincronização. |
| AFD, AEJ e histórico administrativo | Conferência dos arquivos gerados, vínculos/cadastros, tratamentos explícitos e trilha administrativa completa; preservar os originais e os motivos/responsáveis pelos tratamentos. |

Para cada evidência aceita, registrar documento real, SHA-256, responsável e data de conferência. A configuração de produção deve refletir essa conferência; não preencher hashes, datas ou flags de conformidade sem a evidência correspondente.

## Pendências de dados que não desaparecem com documentos

- **58 registros antigos sem modo de captura informado no conteúdo original.** Não é possível afirmar retrospectivamente se a batida foi online/offline nem acrescentar esse dado ao conteúdo protegido. RH e Android precisam definir o tratamento/corte de homologação com os originais preservados e comprovar a captura correta nas novas versões.
- **28 registros com CPF inválido, referentes a três funcionários.** A relação para conferência ficou somente no diretório privado de diagnóstico, disponível ao RH. Conferir a identificação e os cadastros com documentos reais. Correções atuais e eventuais tratamentos devem ter trilha própria; não substituir o CPF da batida original nem recalcular sua cadeia para fazê-la passar na auditoria.
- **Um estabelecimento com inscrição do empregador inválida.** Conferir CPF/CNPJ e a identificação fiscal do estabelecimento com o responsável; não assumir que o CNPJ da desenvolvedora é o do empregador.
- **Tratamento AEJ e histórico administrativo completo ainda não comprovados/configurados.** Corrigir o que faltar no fluxo e homologar; não ativar a flag de completude para eliminar o alerta.

Esses bloqueios continuam sendo apontados depois da correção de integridade. Portanto, publicar a correção não libera sozinho o envio oficial.

O tratamento do legado não autoriza apagar, ocultar, renumerar eventos ou reiniciar cadeias fiscais do mesmo estabelecimento.

## Envio e validação da correção

O HTTPS e a assinatura privada já estão conectados à produção; não falta outra instalação de WhatsApp. O executor exige todos os requisitos fiscais e conexão real com o worker em cada rodada elegível. Nenhum comprovante foi emitido ou enviado durante esta investigação.

Recorte preservado em `America/Bahia`: 05/11 somente saídas explicitamente identificadas; desde 06/11, novas batidas do próprio dia. Não enviar histórico, inclusive após concluir a regularização fiscal.

Sete testes de regressão verificam ausência/null/vazio do estabelecimento original, imutabilidade do snapshot e rejeição de adulterações/vínculo incorreto. As quatro reproduções do falso positivo falharam antes da correção e passaram depois; os 71 testes fiscais passaram. Os testes usam somente fixtures sintéticas isoladas, sem gravar dados fictícios em produção.

Ajuda/manual revisados: não há novo controle ou procedimento de tela; muda a comparação técnica da auditoria. A orientação operacional e a proibição de alterar originais permanecem.
