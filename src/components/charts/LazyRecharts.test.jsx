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
  });

  // Onda 4 do raio-X (item 12, 26/08/2026): todo gráfico saiu de LegacyApp.jsx
  // para seu próprio chunk lazy em src/components/charts/*.jsx (cada um
  // importando "recharts" direto, já que É a fronteira de code-splitting
  // agora). LegacyApp.jsx não precisa mais nem de Recharts nem desta
  // fronteira - nenhuma tag de gráfico deveria sobrar nele.
  it("não sobra nenhuma tag de gráfico Recharts em LegacyApp.jsx (tudo virou lazy por tela)",()=>{
    const source=fs.readFileSync(path.join(process.cwd(),"src","LegacyApp.jsx"),"utf8");
    ["<ResponsiveContainer","<BarChart","<LineChart","<PieChart","<ComposedChart"].forEach(tag=>{
      expect(source).not.toContain(tag);
    });
  });

  // As telas que ainda usam gráfico direto (fora do padrão lazy-por-tela
  // desta rodada) continuam passando pela fronteira central, não por
  // "recharts" cru.
  it("as demais telas que consomem Recharts continuam passando por esta fronteira",()=>{
    ["domains/compras/components/ComprasView.jsx","domains/orcamentos/components/OrcamentoView.jsx","domains/terceirizados/components/TerceirosView.jsx"].forEach(rel=>{
      const source=fs.readFileSync(path.join(process.cwd(),"src",rel),"utf8");
      expect(source).not.toContain('from "recharts"');
      expect(source).toContain("LazyRecharts");
    });
  });
});
