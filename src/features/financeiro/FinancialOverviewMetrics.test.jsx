import React, {act} from "react";
import {createRoot} from "react-dom/client";
import {afterEach,expect,it} from "vitest";
import {FinancialOverviewMetrics} from "./FinancialOverviewMetrics.jsx";

let root,container;
afterEach(()=>{if(root)act(()=>root.unmount());container?.remove();});
it("separa competência, caixa e obrigações sem cortar valores ou confundir ausência com zero",()=>{
  container=document.createElement("div");document.body.append(container);root=createRoot(container);
  act(()=>root.render(<FinancialOverviewMetrics margin={-31.7} totals={{result:-19830,revenue:62570,costs:82400,cashIn:1234567890.12,cashOut:0,receivable:null,payable:359780}}/>));
  const sections=[...container.querySelectorAll("section")];
  expect(sections).toHaveLength(3);
  expect(sections[0].textContent).toContain("Resultado por competência");
  expect(sections[0].textContent).toContain("Margem de -31,7%");
  expect(sections[0].querySelector('[data-tone="danger"]').textContent).toContain("19.830,00");
  expect(sections[1].textContent).toContain("1.234.567.890,12");
  expect(sections[1].textContent).toContain("0,00");
  expect(sections[2].textContent).toContain("Não disponível");
});
