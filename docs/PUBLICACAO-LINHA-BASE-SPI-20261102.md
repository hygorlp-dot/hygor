# Publicação da linha de base e SPI — 02/11/2026

Endereço oficial: https://mrc-hygor-s-projects1.vercel.app
Deployment ativo: `dpl_AWzfp4gR9iboALccaDfpGxnTPocD` (READY).
Anterior: `dpl_EMGUYwULGRbrq4FVL9NkAupeZeGB`.

## Entrega

Planejamento → Linha de base aprovada e SPI: propostas, justificativa, conferência de itens/calendário, aprovação por administrador ou diretoria, versões preservadas, concorrência, autor e data do servidor. Nenhuma fotografia legada é promovida automaticamente. SPI por obra, versão e referência com PV/EV do mesmo escopo e medição integral compatível em diário concluído e revisado. Relatório executivo, indicadores, memória por item, CSV com 25 seções e apresentação/PDF atualizados. Guias de Planejamento, plan_baseline, indicadores e relatório executivo sincronizados com o manual (106 guias / 65 abas); demais guias publicados preservados.

## Consolidação

Pacote construído sobre a publicação anterior, aplicando somente o delta aprovado. O endpoint local estava anterior à integração automática do ponto da produção: o endpoint do pacote conserva integralmente essa integração e recebe somente import, papéis e horário de servidor dos novos comandos de linha de base. Não substituir o API publicado por uma cópia antiga do checkout local em entregas futuras.

Comparação dos arquivos de upload não encontrou alterações fora do escopo. Dados fictícios, capturas e scripts de demonstração ficaram fora do envio. Seção scheduleBaselines já existente; sem migração de banco, push ou PR. Um build remoto de produção, conferido antes da promoção do mesmo pacote, sem rebuild.

## Validação do pacote consolidado

319 testes passaram, incluindo cálculo, histórico, concorrência, bloqueio de snapshots, autorização, ajuda, projeção e orçamento do bundle. Quatro cenários de navegador passaram: fluxo completo em 1440, 390 e 768 px, preservação da V1, leitura em nova sessão, CSV/PDF, ajuda e bloqueio de aprovação indevida pela engenharia. Lint, tipos, auditoria de ciclos, geração/verificação do manual e build direto Vite passaram. Total JS/CSS gzip medido: 1867312 bytes; orçamento total 1825 KiB. Limites individuais, entrada, mídia e baseline visual preservados.

Deployment READY e domínio oficial apontando para o novo ID. HTML oficial idêntico ao pacote conferido. Chunks servidos verificados com proposta, histórico, SPI da obra e memória por item. API inicializou e respondeu HTTP 405 ao GET de conferência, conforme sua restrição de método; nenhuma operação de gravação foi enviada à produção durante a conferência.

Na consulta imediata de logs houve uma mensagem Node DEP0169 de depreciação de url.parse(), emitida durante a chamada de conferência; não foi observada exceção de aplicação. Não equivale a monitoramento prolongado nem a validação de operações com dados reais. Os fluxos autenticados de negócio foram exercitados com dados sintéticos locais.

A demonstração local em http://127.0.0.1:4242/ foi preservada. Em produção, preparar e aprovar a base real e conferir medições compatíveis antes de esperar um SPI calculável.
