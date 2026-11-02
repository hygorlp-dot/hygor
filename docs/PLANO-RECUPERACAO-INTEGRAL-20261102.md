# Recuperação integral — implementação local

Escopo autorizado: pendências da fila geral, recarga, sessão durante edição, conflitos, formulários com ações de recuperação acessíveis e integração local com API/banco. Sem deploy/push ou migração remota. Operadores/aparelhos reais permanecem verificação humana, não simular sua aprovação.

1. Diário durável por usuário e aba, gravado antes do envio. Preservar intenções mais novas, isolar contas, limpar somente a revisão confirmada. Falha de armazenamento bloqueia o envio e não descarta a memória.
2. Recuperação explícita após recarga, sem escrita automática. Conferir permissões e versão atual; não repetir comandos financeiros.
3. Renovação da mesma conta sem desmontar a edição. Permissão continua validada no servidor.
4. Comparação por campo/registro, sem escolha silenciosa no conflito. Preservar mudanças independentes, exigir escolha para valores concorrentes e validar novamente no envio.
5. Acesso compartilhado à recuperação inclusive em formulários abertos; proteção contra reenvio acidental de outra edição enquanto há pendência.
6. Verificar domínio/armazenamento, navegador desktop/celular, falhas e API/PostgreSQL locais com PGlite. Inspecionar ambiente conectado sem usar produção como base de ensaio. Atualizar ajuda/manual/roadmap e documentar limites efetivamente encontrados.
7. Manter orçamento de interface, verificar pacote e reduzir custo estrutural; não ocultar falhas de verificação na nota.


Implementação dos itens 1–7 consolidada no piloto local. Evidências e limites: [relatório de recuperação integral](PILOTO-MARCELL-RECUPERACAO-INTEGRAL-20261102.md). Não houve publicação nem migração remota. A validação com operadores e aparelhos físicos continua preparada para aplicação posterior, conforme decisão do usuário.
