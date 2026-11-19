# Fotos do ponto no OneDrive — validação local

Revisão: 12/11/2026. Sem publicação, migração ou envio de arquivos reais.

## Comportamento

- Novas fotos das batidas e do cadastro facial são gravadas na conexão central Microsoft existente, sob a pasta raiz configurada: `Ponto de Obra/<empresa>/marcacoes/<obra>/<data>/<id>.jpg` ou `Ponto de Obra/<empresa>/biometria/<funcionario>/<cadastro>-<numero>.jpg`.
- As fotos antigas permanecem no bucket privado `ponto-obra` do Supabase. Na consulta de uma batida, o servidor procura no OneDrive e mantém a alternativa de leitura do Supabase, inclusive quando a conexão Microsoft está indisponível. Nenhum arquivo antigo é removido.
- O painel Equipe nas Obras distingue as novas referências de cadastro (`provedor: onedrive`) das antigas. Fotos indisponíveis não impedem a consulta da equipe.
- O dispositivo continua autenticado por seu token; não precisa de cookie ou login Microsoft. A conexão utilizada é a central da empresa.
- O servidor preserva a validação de hash e vínculo da marcação com o aparelho. A consulta da foto verifica o perfil e a restrição por obra. Nenhum compartilhamento público é criado; as imagens são abertas por URLs temporárias.
- Reenvios não substituem arquivos: criação usa conflito `fail`; se já existir, compara os bytes por SHA-256 antes de confirmar. A criação concorrente de pastas recupera a mesma pasta, sem renomear cópias.
- Falha de armazenamento retorna 503. A sincronização existente mantém a foto no celular e só a retira da fila após confirmação. Cadastro facial não é confirmado se o envio falhar.
- O banco continua no Supabase, inclusive a sessão Microsoft cifrada. A alteração não elimina a dependência do serviço nem remove restrições de cota já aplicadas. Fotos antigas ainda dependem da disponibilidade do Supabase.

## Evidências

- Suíte ampliada: 209 testes aprovados, 5 ignorados; a concorrência com Postgres externo depende de ambiente descartável e não foi executada. Log: `artifacts/ponto-onedrive-tests.log`.
- Rodada final dos fluxos alterados: 42 testes aprovados. Inclui falha/retomada na fila real do aparelho, fotos mistas no painel, autorização, indisponibilidade, reenvio e divergência de bytes. Log: `artifacts/ponto-onedrive-final-tests.log`.
- Lint, tipos e arquitetura aprovados; 1.599 módulos e 5.152 dependências sem violações.
- Build local aprovado, sem executar o prebuild que aplica migrações. Bundle: 1.891.322 bytes gzip, dentro do limite existente de 1.891.328; nenhum limite foi aumentado.
- Ajuda contextual e manual revisados: 117 guias, cobertura das 65 abas. Nenhum componente visual ou layout foi alterado.

Os testes locais substituem as operações externas do Graph e do Storage por respostas controladas; os fluxos do aparelho e do servidor usam também Postgres real em memória (PGlite). Não validam uma escrita real na conta Microsoft, suas permissões atuais, capacidade disponível ou a liberação da cota do Supabase.

Referência da API Microsoft para URLs temporárias: https://learn.microsoft.com/en-us/graph/api/driveitem-get-content?view=graph-rest-1.0
