# Deploy: arraste de arquivos e pastas de projetos

Data de referência: 14/11/2026 (America/Bahia).

- Produção: https://marcellapp.vercel.app/
- Implantação READY: `dpl_3R2AxxuaZiqgLvkRNaxcbQ17SbcE`.
- URL imutável: https://mrc-43bzwzz6j-hygor-s-projects1.vercel.app/
- Commit local: `cd584b1d1871cfac0f59d9071bec0be7f4230233`.
- Base preservada: `c80354ea`, implantação `dpl_Grd7TmNgQhPYPz8QtEP1x4kTG6WR`.
- Checkout de revisão: C:/dev/releases/arquivos-arraste-20261114.
- Pacote enviado: C:/dev/releases/arquivos-arraste-upload-20261114.

## Escopo publicado

Arrastar um arquivo para Documentos da obra abre o cadastro com arquivo, título e pasta selecionados. Somente Salvar documento envia ao OneDrive. Cancelar não envia. Mantidos limite de 3 MB, validação de formato, revisões, conexão central e permissões.

Criar pastas padrão completa Projetos com Projetos de Arquitetura e Projetos de Engenharia. A ação também fica disponível em obras com pastas existentes. Não há criação automática ao consultar a tela; documentos, pastas e revisões não são apagados ou movidos. Nomes diferentes não são ligados por semelhança; ambiguidades e ausência de permissão bloqueiam a conclusão.

A fonte da produção foi preservada em cópia isolada; o checkout principal e suas outras alterações locais não foram substituídos. Os arquivos de API, financeiros e fotos do ponto do pacote anterior foram mantidos. Mudanças de publicação adicionais limitam-se à ajuda e ao agrupamento/nomeação dos assets para caber no orçamento vigente. Hashes de conteúdo de oito caracteres e limites de bundle foram preservados.

## Validação e publicação

- 35 testes de domínio e interação aprovados.
- Fluxos de arrastar, salvar e recuperar após recarregar aprovados em 1440 e 390 pixels; modelo de pastas persistente e sem duplicatas aprovado.
- 74 chunks iniciados em sessões novas, sem falhas. Zero ciclos na auditoria de 874 fontes.
- Lint, tipos, design:check e manual:check aprovados; manual consolidado mantém 117 guias e 65 abas.
- Pacote de publicação: 1.908.731 bytes gzip, teto vigente 1.908.736, sem aumento. Regras e textos foram compactados preservando o comportamento; o agrupamento foi verificado com os testes de inicialização.
- Uma implantação e um build remoto, pelo conector Vercel autenticado; nenhum push ou PR. Build remoto concluído em 17 segundos e gate de bundle aprovado, com total arredondado de 1.864,00 KiB.
- O conector atribuiu diretamente os domínios ao concluir a implantação de produção. Alias marcellapp.vercel.app confirmado na nova implantação; nenhum segundo deploy ou rebuild foi solicitado.
- Verificação pública após publicar: desktop/celular HTTP 200, título MARCELL, sem erros JavaScript, assets JS/CSS ausentes ou overflow horizontal. APIs verificadas recusam chamadas não autenticadas com HTTP 401.

Não houve envio de arquivos reais, criação de pastas reais por automação, alteração de permissões de usuários, migração ou mudança de plano. Os fluxos autenticados foram exercitados localmente com arquivos e armazenamento sintéticos.

## DRE

Sem efeito no resultado realizado: o comando de arquivos altera a central documental e seu recibo de auditoria. O teste compara os demais dados, incluindo despesas e estoque. Nenhuma ação cria previsão financeira, compromisso, movimentação física, custo reconhecido ou pagamento; anexar um contrato não duplica seu custo.

Evidências locais: artifacts/release-files-*, artifacts/release-browser.log, artifacts/release-cold-chunks.json, artifacts/remote-build-events.json, artifacts/production-check.json e manifesto de fontes do pacote enviado.
