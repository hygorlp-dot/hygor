import fs from "node:fs";
import path from "node:path";
import {describe,expect,it} from "vitest";
import * as Recharts from "recharts";
import * as LazyRecharts from "./LazyRecharts";

// Achado de 25/08/2026 (ver docs/BLUEPRINT_CONCORRENCIA_TRAVA.md, "TODO
// gráfico Recharts renderiza vazio em produção"): esta fronteira envolvia
// cada componente em React.lazy() para manter o Recharts fora do caminho
// inicial - mas o motor interno do Recharts identifica seus filhos
// (CartesianGrid/XAxis/YAxis/Line/Bar/Pie/Cell/Tooltip) pelo NOME e por
// propriedades estáticas como defaultProps, lidos de forma SÍNCRONA; um
// wrapper lazy nunca carrega essas propriedades a tempo, e o gráfico
// inteiro ficava em branco sem lançar nenhum erro. A fronteira agora só
// centraliza o import (útil para uma divisão de código mais fina no
// futuro, por tela), sem envolver nada em lazy/Suspense.
describe("fronteira de import do Recharts",()=>{
  it("reexporta exatamente os componentes reais do Recharts, sem nenhum wrapper",()=>{
    ["Bar","BarChart","CartesianGrid","Cell","ComposedChart","LabelList","Line","LineChart","Pie","PieChart","ResponsiveContainer","Tooltip","XAxis","YAxis"].forEach(name=>{
      expect(LazyRecharts[name]).toBe(Recharts[name]);
    });
  });

  it("impede que LegacyApp importe Recharts diretamente, fora desta fronteira",()=>{
    const source=fs.readFileSync(path.join(process.cwd(),"src","LegacyApp.jsx"),"utf8");
    expect(source).not.toContain('from "recharts"');
    expect(source).toContain('from "./components/charts/LazyRecharts"');
  });
});
