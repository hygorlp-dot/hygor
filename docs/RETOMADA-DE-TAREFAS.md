# Retomada e passagem de tarefas

Revisão: 18/11/2026. Use este roteiro quando um trabalho precisar continuar em
outro chat. Reaproveite o plano ou relatório da tarefa; não crie um segundo
histórico concorrente. Decisões duráveis pertencem ao documento do assunto,
localizado pelo [índice de desenvolvimento](INDICE-DESENVOLVIMENTO.md).

## Registro mínimo

Copie os campos abaixo para o registro da tarefa e preencha somente com fatos:

```text
Objetivo e aceite: resultado solicitado e como conferir sua conclusão.
Autorização: escopo local/remoto e restrições expressas do usuário.
Estado conferido: data, checkout/commit e mudanças locais relevantes.
Concluído: arquivos e comportamento efetivamente alterados.
Evidências: comandos exatos, resultados, data e limites; incluir falhas/pulados.
Pendente: próxima ação concreta, dependências e riscos conhecidos.
Bloqueios: causa, parte afetada e condição necessária para continuar.
Recursos: processos, portas, diretórios de build/relatório e bancos descartáveis.
Contexto a reler: fontes, decisões ou hipóteses que podem ter mudado.
Impacto no DRE: origem e efeito financeiro, ou motivo comprovado de não impacto.
Ajuda/manual: revisão feita e necessidade de atualizar instruções do operador.
```

Não incluir credenciais, payloads privados, extratos, dados pessoais ou logs
integrais. Referenciar evidências privadas pelo local apropriado.

## Antes de continuar

1. Leia as instruções compartilhadas e as do subdiretório.
2. Reconfira arquivos, `git status`, diff e revisão atual. Preserve alterações
   de outras tarefas e não atribua autoria só pela presença no checkout.
3. Confira se processos, portas, builds e destinos ainda correspondem ao registro.
4. Trate a passagem anterior como contexto: refaça a verificação necessária
   antes de afirmar que uma correção ou teste continua aprovado.
5. Execute somente o restante autorizado, conforme [validação local](VALIDACAO-LOCAL.md).
   Ausência de credencial externa não impede trabalho independente local.

O resumo não amplia autorização. Push, PR, merge, deploy e escrita na produção
continuam dependendo de solicitação explícita. Antes de uma futura mudança
importante nas instruções dos agentes, pode-se avaliar em ambiente descartável
se respeitam leitura apenas, detectam resumo desatualizado e preservam arquivos
existentes; isso não autoriza executar uma bancada de agentes automaticamente.
