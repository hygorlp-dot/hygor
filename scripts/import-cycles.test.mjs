import {describe,expect,it} from 'vitest';
import {auditImportGraph} from './lib/import-graph.mjs';

const virtual=sources=>auditImportGraph({root:'artifacts/import-audit/empty-fixture',sourceOverrides:new Map(Object.entries(sources))});
describe('grafo de inicialização',()=>{
 it('identifica um ciclo estático e um ciclo de import dinâmico',()=>{
  const report=virtual({'src/a.js':'import {b} from "./b.js";export const a=b;','src/b.js':'export {a as b} from "./a.js";','src/c.js':'export const load=()=>import("./d.js");','src/d.js':'import "./c.js";'});
  expect(report.staticCycles).toEqual([['src/a.js','src/b.js']]);
  expect(report.allCycles).toHaveLength(2);
 });
 it('não trata imports de tipos e npm como ciclos de execução',()=>{
  const report=virtual({'src/a.ts':'import type {B} from "./b";import React from "react";export const a=1;','src/b.ts':'import {a} from "./a";export type B=typeof a;'});
  expect(report.allCycles).toEqual([]);
  expect(virtual({'src/a.ts':'import {type B} from "./b";export const a=1;','src/b.ts':'export {type A} from "./a";export type B=number;'}).allCycles).toEqual([]);
 });
 it('permite componentes dependerem de uma paleta independente',()=>{
  const report=virtual({'src/app.js':'import "./view.js";export {C} from "./palette.js";','src/view.js':'import {C} from "./palette.js";export const color=C.text;','src/palette.js':'export const C={text:"navy"};'});
  expect(report.allCycles).toEqual([]);
 });
 it('não permite ciclos locais em src, api, server ou no app nativo',()=>{
  const report=auditImportGraph();
  expect(report.staticCycles,'Ciclos que dependem da ordem de inicialização').toEqual([]);
  expect(report.allCycles,'Ciclos incluindo carregamentos sob demanda').toEqual([]);
 },30000);
});
