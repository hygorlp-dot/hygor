import { expect, it } from "vitest";
import { budgetOwnCompositionRows, budgetOwnCompositionPrintHtml, budgetOwnCompositionSheets, budgetOwnCompositionWorkbook, loadBudgetOwnCompositionRows } from "./budget-own-compositions-export.js";
import * as spreadsheet from '../../lib/spreadsheet.js';
import ExcelJS from 'exceljs';

it("exports the open version's own items and prefers each item's saved detail", () => {
  const budget = {
    itens: [
      { id:"a", fonte:"PRÓPRIA", codigo:"CP-1", quantidade:2, precoUnit:18,
        composicao:JSON.stringify([{ codigo:"0004", coeficiente:2, precoUnit:9 }]) },
      { id:"b", fonte:"propria", codigo:"cp-1", quantidade:1, precoUnit:10 },
      { id:"c", fonte:"PRÓPRIA", codigo:"SEM-DETALHE", composicao:"Memória em texto" },
      { id:"d", fonte:"SINAPI", codigo:"CP-1" },
      { id:"e", tipo:"titulo", fonte:"PRÓPRIA", codigo:"TÍTULO" },
    ],
    composicoesProprias: [
      { codigo:"CP-1", itens:[{ codigo:"0007", coeficiente:1, precoUnit:10 }] },
      { codigo:"SOBRANDO", itens:[{ codigo:"0009" }] },
    ],
  };
  const result = budgetOwnCompositionRows(budget, new Map([["a","1.1"],["b","1.2"]]), value => String(value ?? "").toUpperCase());
  expect(result.compositions.map(row => [row[0], row[1], row[6], row[7]])).toEqual([
    ["1.1","CP-1","Memória do item",""],
    ["1.2","cp-1","Composição da versão",""],
    ["","SEM-DETALHE","Sem componentes detalhados","Memória em texto"],
  ]);
  expect(result.components.map(row => [row[0], row[4], row[7], row[8]])).toEqual([
    ["1.1","0004",2,9],
    ["1.2","0007",1,10],
  ]);
});

const normalize = value => String(value ?? '').trim().toUpperCase();
const fixture = () => ({ dataBase:'2026-07', uf:'PE', desonerado:false, referencias:['base'],
  itens:[{id:'a',fonte:'PRÓPRIA',codigo:'CP-1',descricao:'Piso <teste>',unidade:'M2',quantidade:3,precoUnit:21,
    composicao:JSON.stringify([{tipoItem:'COMPOSICAO',fonte:'SINAPI',codigo:'100',descricao:'Auxiliar',unidade:'M3',coeficiente:2,precoUnit:10}])}],
  composicoesProprias:[] });
const relations = [
  {compositionFonte:'SINAPI',fonte:'ORSE',baseId:'base',compositionCode:'100',itemType:'COMPOSICAO',itemCode:'200',descricao:'Argamassa',unidade:'M3',coeficiente:3,precoNao:2,precoDisponivel:true},
  {compositionFonte:'ORSE',fonte:'SINAPI',baseId:'base',compositionCode:'200',itemType:'INSUMO',itemCode:'001',descricao:'Cimento',unidade:'KG',coeficiente:4,precoNao:.5,precoDisponivel:true},
];
it('keeps each saved cost and shows nested coefficients without adding auxiliaries twice', async () => {
  const budget=fixture(), original=JSON.stringify(budget);
  const rows=await loadBudgetOwnCompositionRows(budget,new Map([['a','1.1']]),normalize,async()=>({ok:true,components:relations}));
  const html=budgetOwnCompositionPrintHtml({name:'K1-10',version:2,rows});
  expect(html).toContain('Custo parcial');
  expect(html).toContain('Soma dos componentes');
  expect(html).toContain('Diferença');
  expect(html).toContain('Cimento');
  expect(html).toContain('Piso &lt;teste&gt;');
  expect(html).not.toContain('Piso <teste>');
  expect(rows.records[0].children[0].children[0].children[0]).toMatchObject({accumulated:24,partial:2});
  expect(budgetOwnCompositionSheets(rows).some(([name])=>name==='Fichas')).toBe(true);
  expect(JSON.stringify(budget)).toBe(original);
});
it('does not expand an adapted remainder into the full official composition',async()=>{
  const budget=fixture(); budget.itens[0].composicao=JSON.stringify([{tipoItem:'COMPOSICAO',fonte:'SINAPI',codigo:'100',descricao:'Saldo após deduzir argamassa',coeficiente:1,precoUnit:5}]);
  const fetch=async()=>({ok:true,components:relations});
  const rows=await loadBudgetOwnCompositionRows(budget,new Map(),normalize,fetch);
  expect(rows.records[0].children[0].children).toHaveLength(0);
  expect(rows.records[0].children[0].warnings.join()).toContain('Parcela adaptada');
});
it('exports explicit missing and circular detail warnings, including request failure',async()=>{
  const budget=fixture();
  const rows=await loadBudgetOwnCompositionRows(budget,new Map(),normalize,async()=>{throw Error('offline');});
  expect(rows.warnings.join()).toContain('Não foi possível');
  expect(rows.records[0].children[0].warnings.join()).toContain('indisponível');
  budget.itens[0].composicao=JSON.stringify([{tipoItem:'COMPOSICAO',fonte:'PRÓPRIA',codigo:'CP-1',coeficiente:1,precoUnit:21}]);
  expect(budgetOwnCompositionRows(budget,new Map(),normalize).records[0].children[0].warnings.join()).toContain('circular');
});
it('does not turn an absent price into a zero price or combine ambiguous bases',async()=>{
  const budget=fixture();
  const missing=await loadBudgetOwnCompositionRows(budget,new Map(),normalize,async()=>({ok:true,components:[{...relations[0],precoDisponivel:false}]}));
  expect(missing.records[0].children[0].children[0].price).toBeNull();
  const ambiguous=await loadBudgetOwnCompositionRows(budget,new Map(),normalize,async()=>({ok:true,components:[{...relations[0],baseId:'a',dataBase:'2026-07',uf:'PE'},{...relations[0],baseId:'b',dataBase:'2026-07',uf:'PE'}]}));
  expect(ambiguous.records[0].children[0].warnings.join()).toContain('Mais de uma base');
});

it('keeps separate item sheets when the same own code has different saved components',()=>{
  const budget=fixture(); budget.itens.push({...budget.itens[0],id:'b',composicao:JSON.stringify([{codigo:'OUTRO',descricao:'Material da segunda ocorrência',coeficiente:1,precoUnit:7}])});
  const rows=budgetOwnCompositionRows(budget,new Map([['a','1.1'],['b','2.1']]),normalize);
  expect(rows.records.map(r=>r.children[0].codigo)).toEqual(['100','OUTRO']);
  expect(budgetOwnCompositionPrintHtml({name:'Obra',version:1,rows}).match(/class="composition-sheet"/g)).toHaveLength(2);
});
it('preserves explicit zero costs and nested snapshots without requiring a reference request',async()=>{
  const budget=fixture(); const component={tipoItem:'COMPOSICAO',fonte:'SINAPI',codigo:'100',coeficiente:2,precoUnit:0,itens:[{codigo:'001',coeficiente:1,precoUnit:0}]};
  budget.itens[0].composicao=[component]; let calls=0;
  const rows=await loadBudgetOwnCompositionRows(budget,new Map(),normalize,async()=>{calls++;return{ok:true,components:[]};});
  expect(calls).toBe(0);expect(rows.records[0].children[0].children[0]).toMatchObject({price:0,partial:0});
});
it('writes grouped XLSX sheets with numeric costs, text codes and readable wrapped detail',async()=>{
  const rows=await loadBudgetOwnCompositionRows(fixture(),new Map([['a','1.1']]),normalize,async()=>({ok:true,components:relations}));
  const workbook=budgetOwnCompositionWorkbook(rows,spreadsheet);
  const reopened=await new ExcelJS.Workbook().xlsx.load(await workbook.xlsx.writeBuffer());
  expect(reopened.worksheets.map(s=>s.name)).toEqual(['Composições','Fichas','Componentes']);
  expect(reopened.getWorksheet('Composições').getCell('F2').value).toBe(21);
  expect(reopened.getWorksheet('Composições').getCell('F2').numFmt).toContain('R$');
  expect(reopened.getWorksheet('Fichas').getColumn(3).width).toBe(64);
  const leaves=[];reopened.getWorksheet('Componentes').eachRow(row=>{if(row.getCell(7).value==='001')leaves.push(row);});
  expect(leaves).toHaveLength(1);
  expect(leaves[0].getCell(13).value).toBe(24);
  expect(leaves[0].getCell(14).value).toBe(12);
});
