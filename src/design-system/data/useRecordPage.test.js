import {describe,it,expect,vi} from 'vitest';
import {recordPage} from './useRecordPage.js';
it('pagina sem cortar nem alterar a coleção usada por totais e lotes',()=>{const rows=Array.from({length:37},(_,id)=>({id})),before=JSON.stringify(rows);expect(recordPage(rows,0)).toMatchObject({count:37,start:1,end:12,pageCount:4});expect(recordPage(rows,1).rows.map(r=>r.id)).toEqual(Array.from({length:12},(_,i)=>i+12));expect(recordPage(rows,99)).toMatchObject({page:3,start:37,end:37});expect(JSON.stringify(rows)).toBe(before);});
it('mantém página válida para lista vazia ou reduzida',()=>{expect(recordPage([],9)).toMatchObject({page:0,count:0,start:0,end:0,pageCount:1});expect(recordPage([{id:'only'}],2).rows).toEqual([{id:'only'}]);});
