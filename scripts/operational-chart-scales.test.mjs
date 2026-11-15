// @vitest-environment node
import {expect,it} from 'vitest';
import {assertOperationalAxes} from './operational-chart-scales.mjs';
it('preserva eixos automáticos e tipos usados pelo ERP, incluindo funções explícitas',()=>{
 for(const value of ['auto','linear','band','point'])expect(()=>assertOperationalAxes(`import {XAxis} from 'recharts';export const View=()=> <XAxis scale="${value}"/>;`,'View.jsx')).not.toThrow();
 expect(()=>assertOperationalAxes(`import {YAxis} from 'recharts';export const View=()=> <YAxis scale={value=>value}/>;`,'View.jsx')).not.toThrow();
 expect(()=>assertOperationalAxes(`import * as R from 'recharts';export const View=()=> <R.XAxis/>;`,'View.jsx')).not.toThrow();
});
it('bloqueia escalas novas ou propriedades que poderiam introduzi-las sem revisão',()=>{
 for(const props of ['scale="log"','scale={mode}','{...properties}'])expect(()=>assertOperationalAxes(`import {XAxis as Axis} from 'recharts';export const View=()=> <Axis ${props}/>;`,'View.jsx')).toThrow('revisão');
 expect(()=>assertOperationalAxes(`import {YAxis} from 'recharts';React.createElement(YAxis,{scale:'time'});`,'View.js')).toThrow('revisão');
 expect(()=>assertOperationalAxes(`import * as R from 'recharts';export const View=()=> <R.XAxis scale="sqrt"/>;`,'View.jsx')).toThrow('revisão');
});
