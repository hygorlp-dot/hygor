# Onda 3 — Continuidade financeira e recuperação do fechamento

Atualização posterior: as pendências aqui registradas foram tratadas no [aceite de conclusão da WF06](ROADMAP-SAAS-95-WF06-CONCLUSAO-2026-10-31.md). Este relatório conserva a fotografia da primeira entrega.

31/10/2026. Execução exclusivamente local, sem deploy, push, PR ou migrações. Skills aplicadas: Impeccable, shadcn, práticas React, investigação de falhas e verificação antes da conclusão.

## Entregas

**WF05 entregue no recorte fiscal exercitado.** A conferência documental permite consultar a obrigação específica e seguir para a revisão bancária dos pagamentos registrados. A fila de pagamentos recebe o identificador da nota, mantendo apenas aquele documento na lista. O resumo conserva o escopo da obra, com explicação explícita; o operador pode remover o recorte por documento.

O retorno restaura mês, obra, busca, conferência selecionada e recorte da fila. Se o registro selecionado sair do filtro após uma alteração, a central explica e oferece sua visualização explícita. Abertura de consulta não registra pagamento, obrigação ou conciliação.

Vínculos bancários usam os fatos de caixa do razão e as associações ativas de `reconciliationLinks`; descrições ou valores semelhantes não estabelecem vínculo. Referência bancária indisponível é explicada e não substituída por outro movimento. A conta efetiva dos movimentos vinculados tem precedência sobre uma conta divergente do cadastro da nota. Pagamento direto do cliente e caixa físico da obra não recebem o atalho para procurar uma saída bancária da empresa.

Ao entrar na Conciliação por uma origem financeira, a automação começa pausada. A pausa também vale ao reabrir uma consulta com origem guardada na sessão; retomar é uma ação explícita. Conta, situação, busca, categoria e motivo da revisão são preferências da sessão; seleção executável e formulários não foram transformados em preferências persistentes. A origem e o estado da automação aparecem num resumo expansível abaixo do título, preservando espaço no celular.

**WF06 avançada, ainda parcial.** O fechamento conserva a competência ao abrir documentos ou corrigir a ficha fiscal. A pendência fiscal abre a nota correta; após salvar, a volta recompõe a conferência com os dados atuais. A ficha ganhou seleção de categoria usando o catálogo já existente, com preservação de categorias legadas fora do catálogo. Outros tipos de origem continuam oferecendo conferência e memorial; a edição direta de todas essas origens ainda não está concluída.

Uma rejeição do salvamento fiscal mantém o formulário. Falha ao fechar o período produz aviso, libera os controles e conserva a competência. A chave de tentativa permanece na sessão para uma repetição explícita, inclusive depois de consultar outra área. Não há ciclo novo de tentativas automáticas.

O fechamento adota o registro auditável e as seções retornadas pela API por `__adotarServidorPatch`, usando o espelho atual. A tela deixou de acrescentar um snapshot calculado localmente após a resposta. Uma resposta sem fechamento auditável válido não aparece como sucesso. O teste positivo confirma que essa adoção não dispara `save` nem `save-sections`.

## Validação local

| Verificação | Evidência |
|---|---|
| Continuidade e recuperação | Oito testes aprovados: quatro cenários em desktop e celular |
| Navegação sem mutação | Documento → obrigação → movimento bancário → obrigação → conferência; zero comandos enviados nessa consulta |
| Correção na origem | Rejeição simulada mantém categoria preenchida; confirmação posterior usa o comando fiscal existente; retorno à mesma competência |
| Falha de fechamento | Controles liberados, competência mantida e mesma chave ao retomar |
| Fechamento confirmado | Registro retornado pelo servidor exibido, um fechamento e nenhuma gravação genérica adicional |
| Regressão financeira | 14 casos aprovados, incluindo desktop e celular |
| Regras e componentes | 25 testes em sete arquivos: continuidade, documentos, pendências, evidências, fila de revisão e sessão |
| Jornadas de referência | J01–J08 aprovadas no protocolo atual; 16 sessões |
| Revisão visual | 100 capturas em 1440/768/390/320 px, sem overflow de página, erro JavaScript ou comando de gravação na varredura de consulta |
| Qualidade | Build direto do Vite, lint e typecheck aprovados; detector delimitado de layout sem achados |

Evidências: `artifacts/wf-finance/continuity.log`, `closing-final.log`, `bank-final.log`, `finance-regression-final.log`, `unit.log`, `visual/verification.json`, `browser-results/` e `bank-results/`. As capturas dos novos casos mostram origem bancária, retorno aos documentos, correção fiscal, falha recuperável e confirmação do fechamento. O protocolo geral está em `artifacts/wf-foundation/wf-finance/baseline.json`.

Os testes usam fixtures e respostas interceptadas. A confirmação de fechamento é simulada localmente com o contrato da API; nenhum período real foi fechado. O roteiro de rejeição fiscal usa uma resposta negativa com mensagem de conflito; não simula toda a concorrência entre dois operadores. Os tempos de teste incluem preparação e assertions e não medem produtividade humana. Permanecem avisos de tamanho de chunks no build.

## Nota e posição

**Nota heurística provisória: 9,1/10 nas superfícies verificadas.** Fluxo 9,1; próxima ação 9,2; continuidade/recuperação 9,1; consistência 9,2; responsividade/acessibilidade 9,0; resposta 8,5. Com os pesos do roadmap, resultado 9,095. Não representa satisfação medida com operadores nem meta de 9,5 alcançada.

**Onda 3 em consolidação:** quatro entregas concluídas (WF02–WF05), duas parciais (WF01 e WF06), quatro planejadas (WF07–WF10). J07 agora tem correção fiscal e retorno verificados, além da consulta já existente; WF01 continua dependendo da medição acompanhada. WF06 ainda precisa ampliar a correção de origens não fiscais e a recuperação com sessão expirada, perda de conexão e conflito real entre versões. Esses cenários precisam de evidência antes do aceite integral, em conjunto com a WF09.

Próxima frente: concluir essas lacunas da WF06 antes de encerrar a onda 3. WF07/WF08 continuam no roadmap; não foram marcadas como iniciadas nesta entrega.
