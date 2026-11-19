# Reauditoria do ERP publicado em 18/11/2026

**Nota geral de 8,9/10, ante 8,7. Faltam 0,6 ponto para a meta de 9,5.**

O domínio [ERP MARCELL](https://erp.marcelleng.com.br/) apontava para o deploy `dpl_3bfKVHtM6Hyh89iX6VMkBgmTSTfR`, commit `62726098`. A jornada autenticada percorreu os oito setores pela aba nativa, principalmente a 390 × 844 px. O menu Mais módulos abriu a 320 px sem rolagem lateral do documento. A aba foi deixada no Dashboard a 1198 × 883 px.

As 65 telas a 390 px e dez a 1440 px renderizaram em sessões isoladas sem tela de erro, rolagem lateral do documento ou tentativa de gravação detectada na abertura. Passaram 91 testes operacionais e 23 cenários direcionados à entrega. Esses ensaios carregaram a interface publicada, com dados fictícios e requisições de API interceptadas. Nenhum registro real foi alterado pela auditoria. [Cobertura](../artifacts/reauditoria-operador-62726098/coverage.json) · [Testes operacionais](../artifacts/reauditoria-operador-62726098/flows.log) · [Cenários direcionados](../artifacts/reauditoria-operador-62726098/targeted.log)

## Notas por setor

A régua heurística mantém os pesos da auditoria anterior. Clareza e experiência no celular pesam 25% cada. Próxima ação e continuidade entre setores pesam 20% cada. Orientação e recuperação pesam 10%. A média usa as notas ponderadas antes do arredondamento.

| Setor | Anterior | Clareza | Celular | Próxima ação | Continuidade | Orientação | Atual |
|---|---:|---:|---:|---:|---:|---:|---:|
| Gestão e relatórios | 8,8 | 9,0 | 9,0 | 9,0 | 8,5 | 9,0 | **8,9** |
| Comercial e contratos | 8,4 | 9,0 | 9,0 | 8,5 | 8,5 | 8,5 | **8,8** |
| Obras e projetos | 8,9 | 9,0 | 9,0 | 9,0 | 8,5 | 9,0 | **8,9** |
| Compras e estoque | 8,7 | 9,0 | 9,0 | 9,0 | 9,0 | 8,5 | **9,0** |
| Financeiro | 8,6 | 9,0 | 8,5 | 9,0 | 8,5 | 9,0 | **8,8** |
| Equipamentos e locações | 8,5 | 9,0 | 9,5 | 9,0 | 8,0 | 8,5 | **8,9** |
| Pessoas e terceiros | 8,9 | 9,0 | 9,0 | 9,0 | 8,5 | 9,0 | **8,9** |
| Administração | 8,9 | 9,0 | 9,5 | 9,0 | 8,0 | 8,5 | **8,9** |

## Jornada e evidências

1. **Gestão e relatórios.** Dashboard → Comunicação → Aprovações → Relatórios. O painel explica que Obra em foco não muda os valores consolidados. A lista de Comunicação ainda mede cerca de 4.248 px em 390 px. A ligação da tarefa com sua origem e o retorno ao recorte foram verificados em simulação. [Dashboard](../artifacts/reauditoria-operador-62726098/390-home.png)
2. **Comercial e contratos.** Comando → Pipeline → Relacionamentos → Propostas e contratos. A lista mostrou responsável e próxima ação e recolheu o seletor de etapa em **Mover etapa**. A primeira página tinha 12 de 17 oportunidades e cerca de 3.321 px de conteúdo. Na simulação, a mudança só foi enviada após a confirmação e o histórico foi mantido. A passagem de contrato assinado para Obras ficou restrita à simulação. [Pipeline](../artifacts/reauditoria-operador-62726098/390-com_funil.png)
3. **Obras e projetos.** Carteira → Projetos → Arquivos → Orçamento → Planejamento → Diário → Avanço → Conferência → Licenciamento. O Diário ocupou cerca de 617 px. Licenciamento mediu aproximadamente 5.797 px. O fluxo isolado verificou o acesso à revisão antiga, a recuperação após falha no visualizador e a ausência de sincronização automática ao abrir Obras e Planejamento. [Licenciamento](../artifacts/reauditoria-operador-62726098/390-licenca.png)
4. **Compras e estoque.** Fila → origem da solicitação → cotação → pedido → recebimento → estoque. O recebimento parcial simulado atualizou o saldo fictício sem criar pagamento. Fornecedores mostrou 12 de 35, com nota geral no cartão. O toque no nome abriu preço, frete, prazo, qualidade e evidências. A lista ainda ocupava aproximadamente 2.600 px. [Fornecedores](../artifacts/reauditoria-operador-62726098/390-fornecedores.png)
5. **Financeiro.** Hoje → Caixa por conta → Documentos → Pagamentos → Custos por etapa → Relatórios → Notas → Homologação. O relatório real exibiu **791 diferenças e avisos e uma verificação pendente**. O filtro **Somente avisos** apresentou estado vazio. O número é de ocorrências do relatório. Ele não representa custos adicionais ou títulos para pagamento. A busca e o filtro funcionam, mas no celular ficam abaixo da primeira janela. O fluxo isolado cobriu vínculo entre documento, obrigação e movimento, conferência de PIX e retomada de fechamento. [Triagem a 320 px](../artifacts/correcoes-auditoria-20261117/homologacao-audit-62726098-320.png)
6. **Equipamentos e locações.** Central de locação → Equipamentos → Frota. A aba real mostrou **1–6 de 24** e cerca de **2.274 px** de conteúdo a 390 px. As ações estavam disponíveis nos cartões. A paginação, a busca de um item fora da página e os detalhes foram verificados na sessão isolada. [Frota](../artifacts/reauditoria-operador-62726098/390-equip.png)
7. **Pessoas e terceiros.** Equipes → Equipe nas Obras → Ponto → Folha → Terceirizados → Indicadores. O ponto por obra ainda exige rolagem extensa, com aproximadamente 4.611 px. A busca da folha preservou os totais e a medição conservou o percentual original nos ensaios. O ponto e a folha reais ficaram em consulta. [Folha](../artifacts/reauditoria-operador-62726098/390-folha.png)
8. **Administração.** Auditoria → Patrimônio → Cadastros → Ajustes. Os Ajustes recolhidos mediram cerca de 698 px, e o Patrimônio, 3.329 px. Mudança de permissão e edição de cadastro ficaram em simulação. [Ajustes](../artifacts/reauditoria-operador-62726098/390-config.png)

## DRE por obra

Em 390 e 1440 px, a troca de obra ocultou os valores anteriores e bloqueou a exportação enquanto a nova consulta carregava. Simulei uma falha HTTP 503 e uma resposta HTTP 200 incompleta. Nos dois casos, a interface avisou **Cálculo local da obra** e manteve **DRE PDF** desabilitado. Após **Tentar novamente** e receber o demonstrativo da competência fechada, o botão foi liberado. A prévia gerada exibiu os valores da obra selecionada no cabeçalho e na tabela. O teste usou o frontend publicado e respostas fictícias porque a consulta real ao razão pode materializar projeções. [Aviso a 390 px](../artifacts/reauditoria-operador-62726098/targeted-results/published-mobile-audit-fol-9a847-PDF-com-o-relatório-da-obra/dre-calculo-local.png) · [Botão PDF desabilitado](../artifacts/reauditoria-operador-62726098/dre-evidence-results/dre-evidence-390px-DRE-sin-4e777-PDF-com-o-relatório-da-obra/dre-pdf-bloqueado.png)

## O que ainda pesa na nota

- **Acessibilidade da navegação.** Após sair de Pessoas e terceiros pelo menu Mais módulos, o seletor continuou se anunciando como **Telas de Pessoas e terceiros** ao exibir Pipeline, Administração e Financeiro. As opções visíveis mudaram, mas o nome acessível ficou desatualizado.
- **Tempo para chegar à próxima ação.** Em 390 px, o primeiro cartão do Pipeline começa perto do rodapé, os filtros da Homologação aparecem depois da primeira janela e Licenciamento exige aproximadamente sete alturas de tela.
- **Conferência financeira e continuidade.** Na Homologação, o trabalho de conferir a origem permanece registro a registro. Os efeitos de assinatura, fechamento, pagamento, ponto e OneDrive foram verificados com dados fictícios ou até o passo anterior à confirmação real.
