// Achado de 25/08/2026 (ver docs/BLUEPRINT_CONCORRENCIA_TRAVA.md, "TODO
// gráfico Recharts renderiza vazio em produção"): esta fronteira envolvia
// CADA componente do Recharts (containers E filhos como CartesianGrid/
// XAxis/YAxis/Line/Bar/Pie/Cell/Tooltip) em React.lazy() para manter a
// biblioteca fora do caminho inicial. Isso quebra o Recharts de duas formas
// que não lançam nenhum erro na primeira (só na segunda):
//
// 1. O motor interno (generateCategoricalChart.renderByOrder) identifica
//    cada filho pelo NOME (child.type.displayName || child.type.name) para
//    decidir como desenhá-lo. Um wrapper React.lazy() não carrega esse nome
//    - renderByOrder nunca encontra um handler para nenhum filho, devolve
//    um array vazio, e o gráfico fica em branco (só o <Surface> externo,
//    que É montado normalmente por React, aparece).
// 2. Corrigir só o nome (que fizemos primeiro, via Component.displayName)
//    revela um segundo problema: o Recharts também lê propriedades estáticas
//    como child.type.defaultProps (ex.: Line.defaultProps.yAxisId) de forma
//    SÍNCRONA, ao computar o estado do gráfico - antes mesmo do import()
//    assíncrono do wrapper ter resolvido. Um wrapper lazy nunca tem essa
//    propriedade disponível a tempo, e o acesso quebra com "Cannot read
//    properties of undefined (reading 'yAxisId')".
//
// Conclusão: qualquer componente que o Recharts INSPECIONA como filho de
// outro (CartesianGrid, XAxis, YAxis, Tooltip, Cell, Bar, Line, Pie) precisa
// ser a referência real e síncrona - não dá para envolver em lazy() sem
// quebrar a identificação interna. Só os componentes que o React MONTA
// diretamente (as próprias BarChart/LineChart/PieChart/ComposedChart/
// ResponsiveContainer) seriam candidatos seguros a lazy - mas como os
// filhos já precisam do pacote inteiro carregado de forma síncrona, manter
// só os containers como lazy não evita mais o carregamento do Recharts+d3;
// simplifica-se aqui como import direto. Uma divisão de código mais fina
// (lazy por TELA, com o Recharts importado de forma síncrona dentro de cada
// chunk lazy) recuperaria o benefício de bundle size, se algum dia for
// necessário - não fizemos isso agora para não estender o escopo desta
// correção.
export {
  Bar,BarChart,CartesianGrid,Cell,ComposedChart,LabelList,Line,LineChart,Pie,PieChart,
  ResponsiveContainer,Tooltip,XAxis,YAxis,
} from "recharts";
