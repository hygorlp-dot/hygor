# Onda 3 — Revisão de conciliação e leitor de evidências

Data: 31/10/2026. UX05 e UX06 concluídas localmente, preservando MARCELL, logo, tokens e componentes existentes. Aplicadas as skills Impeccable e shadcn. Sem push, PR, deploy, migrações ou alteração de dados externos.

## UX05 — Revisão de conciliação

- A posição da revisão reúne saldo a vincular, selecionado e restante após seleção. O valor original do banco continua identificado separadamente. A comparação de cada alternativa usa o saldo restante, inclusive em vínculos parciais.
- Saldo indisponível aparece como informação ausente e impede confirmação; não se apresenta como zero. Períodos fechados exibem a restrição existente junto da ação.
- A confirmação permanece explícita, com contagem de registros e valor residual. Abrir documentos mantém a seleção; trocar a conta encerra a revisão anterior e limpa sua seleção.
- O painel segue o fluxo da página, sem rodapé fixo sobre o conteúdo ou rolagem interna concorrente. No celular, os três valores passam a linhas identificadas. Valores monetários não quebram entre dígitos.
- Permanecem os motores, vínculos parciais, operações em lote, permissões e regras financeiras existentes. Não foi criado outro motor de conciliação.

## UX06 — Evidências além da ficha fiscal

Central documental, memorial, dossiê de Compras e revisão bancária compartilham o leitor. A origem do registro, o formato e o vínculo acompanham o documento. PDF, imagem e XML usam as prévias existentes; formatos externos conservam a abertura do original.

O leitor distingue ausência de anexo, endereço indisponível, sessão necessária, acesso negado, arquivo não encontrado, endereço expirado e falha de prévia. Uma resposta 403 não é interpretada como prova de expiração. Referência cadastrada identifica metadados; não certifica acesso ou validade do conteúdo. A consulta oferece nova tentativa quando aplicável.

Referências protegidas e identidades de arquivo/provedor são resolvidas na consulta; a abertura do original pode renovar a autorização. O adaptador de prévia do Google Drive foi preservado. Evidências de pagamentos são selecionadas por identidade; documentos fiscais relacionados respeitam a obra ou rateio explícito. Uma coincidência entre ID de rateio e ID de pagamento não associa anexos indevidos.

No memorial, o leitor só é montado após “Conferir evidências”. Fechar e retornar preserva pesquisa e expansão. Datas usam `dd/mm/aaaa`; datas inválidas pedem conferência. O leitor não salva documentos nem cria operações ao abrir.

### Ciclo de leitura de PDF

A validação de navegador expôs uma falha de encerramento do worker durante carregamento, na biblioteca instalada. O problema corresponde ao tratamento de término documentado no [ajuste upstream do PDF.js](https://github.com/mozilla/pdf.js/pull/20503). Sem atualizar dependências, o leitor passou a obter os bytes com cancelamento antes de inicializar o PDF e a liberar o worker após a inicialização pendente se resolver. Testes cobrem cancelamento antes da criação e limpeza após inicialização.

Limite: PDFs são baixados integralmente antes da primeira página; arquivos grandes podem demorar mais. O original continua acessível. Permissões reais dos provedores não foram certificadas pelos testes simulados.

## Notas de design

Avaliação manual das telas e estados locais. Cinco critérios de mesmo peso; não é estudo de produtividade com usuários.

| Critério | UX05 | UX06 |
|---|---:|---:|
| Hierarquia e próxima ação | 9,0 | 9,0 |
| Consistência de textos e componentes | 9,0 | 9,0 |
| Aproveitamento de espaço | 8,5 | 8,5 |
| Adaptação a telas e conteúdo | 8,5 | 8,5 |
| Clareza dos controles e estados | 8,5 | 9,0 |
| **Nota da entrega** | **8,7** | **8,8** |

A fila bancária ainda tem ferramentas anteriores à área de comparação; as notas refletem essa densidade. Documentos extensos exigem rolagem, e a qualidade da prévia depende do arquivo e do acesso. O trabalho não redesenha todas as telas financeiras.

## Validação local

Build estático na porta 4199, com APIs interceptadas e dados sintéticos; a prévia compartilhada em 4198 não foi reiniciada. Os resultados abaixo são da execução final após a correção do ciclo de PDF.

| Verificação | Resultado |
|---|---|
| Domínio e componentes | 57 testes aprovados em 13 arquivos |
| Regressão financeira desktop/celular | 14 cenários aprovados |
| Continuidade da navegação financeira | 10 verificações aprovadas |
| Leitor e ficha fiscal | 10 verificações aprovadas |
| Jornada da onda 3 | 1440, 768, 390 e 320 px; 52 capturas; zero comandos operacionais; sem erros de página ou transbordamento verificado |
| Lint, TypeScript e build direto do Vite | Aprovados; permanece aviso conhecido de chunks grandes |
| Detector de layout nos componentes revisados | Sem ocorrências; capturas também inspecionadas visualmente |

A jornada específica cobre vínculo parcial, seleção de dois registros e impacto sem confirmar; abertura e fechamento do original; troca de conta; despesa com PDF, imagem, XML, acesso negado, endereço expirado, endereço ausente e formato externo; memorial e ausência de anexo. A fixture permanece inalterada. A suíte fiscal separada inclui uma gravação explícita apenas em API simulada.

A regressão também identificou seletores antigos de navegação móvel no teste de DRE; foram atualizados para os controles atuais, mantendo a verificação do destino. A falha de PDF foi corrigida no ciclo de carregamento, sem ocultar erros de página na jornada.

Artefatos em `artifacts/roadmap-wave-three`: `verification.json`, 52 capturas, `unit-final.log`, `finance-regression-final.log`, `navigation-final.log`, `invoice-regression-final.log` e `journeys-final.log`. Build em `build`; log em `artifacts/roadmap-wave-three-build.log`.

Reprodução da jornada: build direto com `npx vite build --outDir artifacts/roadmap-wave-three/build`; servir com `npx vite preview --host 127.0.0.1 --port 4199 --strictPort --outDir artifacts/roadmap-wave-three/build`; executar `node scripts/roadmap-wave-three-verify.mjs`. Não usar o script npm de build para essa validação, pois o prebuild do projeto executa migrações.

## Posição no roadmap

**Onda 3 de 4 concluída localmente: UX05 e UX06 concluídas; 6 de 8 entregas no total.** Próxima onda: UX07, consultas salvas e lotes, e UX08, necessidade e caixa no tempo. A contagem não corresponde a uma estimativa percentual de esforço. [Roadmap completo](ROADMAP-UX-FINANCEIRO-COMPRAS-2026-10-31.md).
