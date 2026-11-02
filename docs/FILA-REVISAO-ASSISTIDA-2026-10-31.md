# Fila de revisão assistida · 31/10/2026

Disponível localmente em **Financeiro → Caixa por conta → Abrir fila de revisão assistida**. O link local com `assisted-review=1` abre esse mesmo fluxo depois do login habitual, sem montar a tela de Conciliação e seus disparos automáticos.

O recorte usa o mesmo motor da simulação: pendentes de extratos ativos, com melhor candidato e sem elegibilidade automática. A base real de 30/10/2026 reproduziu os 231 casos, sem alteração de seu hash em memória. O carregamento da auditoria fez sete requisições GET e nenhuma escrita. O resultado individual está fora do repositório em `C:/dev/marcell-local-review/piloto-real/fila-assistida.json`.

A lista pagina 25 registros por vez e pesquisa todo o recorte. Busca aceita nomes com ou sem acento e CPF/CNPJ com ou sem formatação. Há filtro pelo tipo de cadastro encontrado. O caso selecionado e a consulta de documentos permanecem visíveis quando ficam fora da busca, com aviso explícito.

O cruzamento mostra CPF/CNPJ completo coincidente, nome normalizado coincidente, documento divergente e todos os cadastros encontrados, sem escolher uma pessoa em caso de ambiguidade. Nomes parciais e documentos mascarados não se tornam prova de identidade. A comparação inclui fornecedores, funcionários, clientes, terceiros e contratantes presentes nos dados carregados. A regra da automação não foi alterada.

Nos dados reais, 175 casos têm nome coincidente: 112 de funcionários, 26 de clientes, 36 de terceiros e um de fornecedor. Existem 21 casos com múltiplos cadastros. Nenhum dos campos bancários disponíveis produziu coincidência de CPF/CNPJ completo. Os 56 casos restantes continuam com sugestão financeira, mas sem coincidência de nome ou documento nesta comparação.

A conferência apresenta valor, data, CPF/CNPJ, nome, PIX, obra e referência do possível destino, além das alternativas e do motivo que bloqueia a automação. Sugestões que apontam funcionário, terceiro ou caixa da obra avisam que cadastro ou movimento de caixa não comprova título financeiro a pagar ou receber.

Os anexos bancários e os anexos do possível destino ficam separados. Para candidatos a funcionário ou terceiro, são consultados os anexos existentes do respectivo cadastro. Nos tipos financeiros suportados, são usados os mesmos documentos do memorial e da conferência. Apenas dois dos 231 casos possuem anexos vinculados nas fontes consultadas. Ausência de anexo é exibida explicitamente; não há busca presumida nem cópia de documentos para completar a fila. O leitor original do OneDrive continua sendo o existente, acionado somente ao consultar os documentos.

A fila recebe somente `data` e a ação de retorno. Não recebe função de atualização, comando, conciliação ou gravação; não registra avaliações nem aprova pagamentos. Nenhum cadastro, vínculo, anexo ou arquivo do OneDrive foi alterado. O servidor local foi mantido em execução.

Validação: testes unitários do cruzamento, documentos e caixa; jornada com 231 casos fictícios, paginação, pesquisa no último registro, identidades conflitantes, imagem original efetivamente carregada, manutenção do contexto, retorno ao caixa e ausência de gravações. As jornadas existentes de piloto e conciliação foram repetidas em APIs simuladas. Capturas usam exclusivamente dados fictícios.
