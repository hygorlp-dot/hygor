# Ponto, cadastro e desligamento — 01/11/2026

Implementação local no checkout `C:/dev/releases/marcell-saas-release-20261101`. Sem push ou deploy; a produção permanece na entrega anterior.

## Causas e correções

A tela “Preparando o ambiente operacional” era o fallback do download inicial do módulo principal. Não era, por si só, um erro de autenticação. O texto MARCELL estava dentro de uma marca de 52 px com o estilo antigo, podendo ultrapassar a caixa e se sobrepor à mensagem. A espera agora usa o SVG existente da marca, o Spinner compartilhado e os tokens do tema em uma composição vertical. O aviso começa após 200 ms para evitar o flash em entradas rápidas. O aplicativo ainda precisa baixar seus arquivos quando a conexão é lenta; não foi prometida a remoção desse tempo de espera.

Na Gestão do ponto, o nome era um botão de comando com borda e padding, acompanhado por Ficha em PDF e Limpar linha. O nome agora usa RecordAction, abre diretamente o cadastro para RH e administradores e ocupa menos espaço. Outros perfis conservam a consulta em PDF. Ficha e Limpar saíram dessa linha, assim como o handler de limpeza em lote e seu CSS sem uso. A edição das células do dia permanece disponível; nenhum apontamento foi apagado por essa alteração.

A primeira coluna passou de 290 px para 220 px como referência e a largura mínima da tabela acompanha essa mudança. A grade continua rolando no próprio painel. A situação de desligado permanece identificada na linha; o nome mantém alvo de toque no celular. Filtros, período e busca usam o estado de sessão existente, para retornar da ficha sem perder o recorte. Os estados do ponto têm o texto centralizado e mantêm suas cores.

No início de Editar funcionário, Vínculo e desligamento apresenta situação, último dia trabalhado, motivo e observações salvas. O PDF continua disponível em Ficha em PDF. Para funcionário ativo, Registrar desligamento abre o fluxo existente de data, tipo e confirmação. Não foi criado outro cálculo de rescisão ou outro comando de gravação.

O diálogo de desligamento é aberto sobre o cadastro. Cancelar preserva o preenchimento do cadastro. A orientação avisa que o desligamento usa dados salvos e não grava outras edições pendentes; confirmar conclui a ação existente e fecha os dois diálogos. Ponto e pagamentos não são alterados por esse atalho. Datas futuras continuam agendadas e a regra inclusiva do último dia trabalhado foi preservada.

## Padrão, ajuda e verificação

Impeccable e shadcn orientaram a revisão. RecordAction, botões, indicadores, Spinner e tipografia vêm da base compartilhada; não foi criado tema paralelo. A fonte da ajuda explica a entrada e o acesso pelo ponto; o guia Equipes explica o resumo do vínculo e a confirmação do desligamento. Manual regenerado: 98 guias cobrem 65 abas, revisão em 01/11/2026.

- 543 testes de código aprovados em 70 arquivos de Pessoas, Ponto, ajuda, fluxo, design system e recuperação de CSS.
- 8 cenários específicos aprovados no desktop e celular: coluna compacta, acesso pelo nome, retorno com filtros, cancelamento com rascunho preservado, leitura do desligamento, confirmação sem mudar histórico e entrada lenta chegando ao login.
- 52 cenários de regressão de RH, grupos, folha, provisões e fechamento aprovados.
- 136 verificações de layout aprovadas nas 65 abas, desktop e celular. Capturas específicas inspecionadas; animações foram concluídas antes das capturas da ficha.
- Lint, TypeScript, manual e padrão aprovados; auditoria sem ciclos de importação.
- Build compilado local: 1.747,88 KiB gzip de JS/CSS, abaixo do teto de 1.748 KiB. Prefixos dos chunks internos foram compactados, mantendo hashes e nomes preservados; o limite não foi aumentado.

Os cenários usaram o build compilado em 4255 com dados sintéticos e API interceptada. O simulador aplica o mesmo comando de funcionário e carimba o ator como o servidor real. Nenhuma operação foi executada em dados reais. A revisão em celular é emulada; não equivale a teste em aparelho físico.

Prévia de desenvolvimento: http://127.0.0.1:4253/. Evidências locais em `artifacts/employee-flow/`, incluindo screenshots de entrada, tabela e desligamento.
