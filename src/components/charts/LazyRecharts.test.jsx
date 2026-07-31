import fs from "node:fs";
import path from "node:path";
import {describe,expect,it} from "vitest";
import {BarChart,ResponsiveContainer} from "./LazyRecharts";

describe("carregamento incremental dos gráficos",()=>{
  it("expõe um contêiner local e componentes lazy",()=>{
    expect(typeof ResponsiveContainer).toBe("function");
    expect(BarChart).toBeTruthy();
  });

  it("impede que LegacyApp importe Recharts no chunk inicial",()=>{
    const source=fs.readFileSync(path.join(process.cwd(),"src","LegacyApp.jsx"),"utf8");
    expect(source).not.toContain('from "recharts"');
    expect(source).toContain('from "./components/charts/LazyRecharts"');
  });
});
