import {test,expect} from '@playwright/test';
import {readdirSync,writeFileSync} from 'node:fs';
test('cada chunk inicia em sessão nova',async({browser})=>{
 const names=readdirSync('dist/assets').filter(n=>n.endsWith('.js')&&!/worker|^index-/i.test(n));
 const results=[];
 for(let i=0;i<names.length;i+=4)await Promise.all(names.slice(i,i+4).map(async name=>{
  const context=await browser.newContext();const page=await context.newPage();
  try{await page.goto('http://127.0.0.1:4290/',{waitUntil:'networkidle'});await page.evaluate(async path=>{await import(path);},`/assets/${name}`);results.push({name,ok:true});}
  catch(error){results.push({name,ok:false,error:error.message});}finally{await context.close();}
 }));
 writeFileSync('artifacts/batch-trash-cold-chunks.json',JSON.stringify(results,null,2));expect(results.filter(r=>!r.ok)).toEqual([]);
});
