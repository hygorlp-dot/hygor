# Depuração global local — 31/10/2026

## Resultado

Alterações mantidas localmente, sem push, migração ou deploy. As alterações
anteriores do checkout compartilhado foram preservadas.

4.257 testes passaram em 561 arquivos; nenhum falhou. Outros 15 testes em três
arquivos dependem de PostgreSQL externo e ficaram ignorados. Na verificação de
navegador, 182 cenários distintos passaram; um cenário exclusivo de celular foi
ignorado no projeto desktop. A consolidação considera o resultado mais recente
de cada caso, após corrigir seletores e mocks desatualizados; não soma retentativas
como cenários novos. Evidência: `artifacts/whole-app-debug/summary.json`.

## Causas investigadas e correções

1. **Falha transitória de CSS rejeitava definitivamente um módulo lazy.** O
   arquivo da imagem retornou HTTP 200 durante a investigação; isso não identifica
   o motivo original da falha de transporte. O runtime do Vite marca suas
   dependências como vistas antes de aguardar as folhas. A recuperação agora
   espera o carregamento real das folhas locais sem estilo aplicado antes de
   repetir o import uma vez, preservando nonce de CSP e impondo timeout de oito
   segundos. Todos os pontos React.lazy do app web usam o adaptador, incluindo
   previews de documentos, menu mobile, compras e financeiro.
2. **Abas antigas pediam módulos removidos de publicações anteriores.** Os
   registros de produção incluíam ARCD-132JB2I (CSS) e ARCD-136KBN8 (Projetos).
   O módulo ProjetosView-GgOXfbU9.js e o LegacyApp correspondente retornaram 404
   no alias durante a investigação. O bloqueio da recuperação automática agora
   pertence ao build carregado: impede ciclos entre arquivos diferentes e permite
   uma recuperação para uma versão nova. Offline não provoca recarga automática.
   Isso recupera a aba; não mantém arquivos antigos disponíveis no servidor.
3. **Armazenamento bloqueado derrubava telas de obra e RH.** Reproduzido no
   navegador ao fazer Storage lançar SecurityError. Os contextos opcionais de
   navegação e passagem de funcionário/obra agora usam um adaptador com fallback
   em memória. Autenticação, rascunhos e dados de negócio não usam esse fallback:
   memória não representa confirmação de persistência no aparelho.
4. **Imports em ações assíncronas podiam desaparecer dos diagnósticos.** A captura
   global ignorava toda falha de chunk, pressupondo que o ErrorBoundary a receberia.
   Imports em cliques e exportações não passam necessariamente pelo boundary.
   Esses erros agora são reportados com a redação e o limite já existentes.

Os testes também foram atualizados para os componentes atuais: o mock de botão
que retornava null impedia testar medição; o contrato do botão compartilhado e o
catálogo Storybook estavam desatualizados. A navegação mobile dos testes de DRE,
orçamento e cronograma passou a usar os selects e nomes acessíveis reais. O teste
de chat agora fecha pelo rótulo de fechamento. As verificações de resultado,
persistência, valores, permissões e exportação foram mantidas.

## Verificação executada

- Suíte completa Vitest, quatro workers: 4.257 aprovados, zero falhas, 15 ignorados.
- Navegador Chromium: 182 casos aprovados e um ignorado; cobertura de login,
  permissões, financeiro, DRE, conciliação, RH, folha, ponto, obras, orçamento,
  planejamento, compras, fornecedor, projetos, arquivos, PDFs, planilhas e revisão.
- Varredura de 50 telas em 1440 e 390 px: 100 acessos sem erros registrados.
- Falhas injetadas no build: CSS indisponível recupera sem recarga; chunk JS 404
  recupera com uma recarga limitada e restauração da sessão; armazenamento
  bloqueado mantém navegação; resposta inválida de equipe permite retentativa.
- Medição em 320, 390 e 1280 px: escolha de contrato sem planejamento, slider,
  decimais, gesto de toque, rolagem, galeria múltipla, câmera, upload parcial e
  proteção do fechamento durante upload passaram.
- Build Vite de produção, lint e tipos passaram. Arquitetura: zero violações em
  1.355 módulos e 3.852 dependências. O scanner de assets encontrou 642 referências
  verificáveis em 205 arquivos, sem arquivo faltando.

As evidências ficam em `artifacts/whole-app-debug/`, incluindo `unit-final.json`,
`browser.json`, `integrations.json`, `browser-critical-verified.json`,
`browser-critical-final.json`, `storage/report.json`, `measurement-mobile.log`,
`assets.json`, `lint-final.log`, `types-final.log` e `architecture.log`.
Relatórios intermediários com falhas foram preservados quando disponíveis.

## Pendências e limites

O orçamento local do bundle **não passou**: 1.798.171 bytes gzip contra teto de
1.789.952, diferença de 8.219 bytes (aproximadamente 8 KiB). A versão local anterior
à ampliação desta depuração já estava acima do teto: 1.796.488 bytes. O limite
não foi ampliado. Build bem-sucedido não equivale a passar esse orçamento;
`summary.json` registra `releaseReady: false` por essa pendência.

Integrações externas foram exercitadas com respostas e arquivos de teste,
sem gravações em produção, cobrança de IA ou uploads reais no Microsoft/Supabase.
Os testes nativos de lógica e integração integram a suíte, mas não foi feita
validação em aparelho Android/iOS físico nem uma compilação nativa nesta etapa.
Avisos de depreciação url.parse dos registros não foram atribuídos a código
próprio: a busca em api/server não encontrou seu uso. Não foi feita alteração
especulativa de dependências para suprimir o aviso.

Esta auditoria comprova os cenários executados e as correções reproduzidas;
não garante ausência de qualquer falha futura de rede, dados ou fornecedor.
