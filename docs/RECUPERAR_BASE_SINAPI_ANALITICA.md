# Recuperar uma base SINAPI sem analítico

O orçamento não perde seus valores quando uma base antiga não possui analítico. A lacuna afeta somente o detalhamento de composições e a Curva ABC por insumo.

1. No Supabase SQL Editor, execute `MIGRACAO_REFERENCIAS_ANALITICAS.sql` uma única vez.
2. Em **Orçamento → Bases oficiais e vínculos**, selecione a UF e envie o XLSX oficial SINAPI completo da mesma competência.
3. O arquivo precisa conter CSD/CCD, ICD/ISD e uma aba Analítico (o nome pode variar, como “Composições Analíticas”).
4. Se a competência já existir, confirme **reparar a mesma base**. O sistema conserva o ID e os vínculos de todos os orçamentos.

O exportador de orçamento não envia dados ao Supabase e não é arquivo de reposição SINAPI.
