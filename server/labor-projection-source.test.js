import {describe,it,expect} from "vitest";
import {gzipSync} from "node:zlib";
import {loadLaborProjectionArchives,composeLaborProjectionSource} from "./labor-projection-source.js";
const employee={id:"e",name:"Pessoa",dailyRate:100,obra:"o"};
describe("fonte composta da projeção",()=>{
 it("lê e descomprime arquivos por empresa e sinaliza ausentes e inválidos",async()=>{
  const archive={employeesSnapshot:[employee],attendance:{e:{"2026-07-24":{status:"P"}}}};
  const calls=[];const db={from:table=>{calls.push(table);const query={select(){return query;},eq(...args){calls.push(args);return query;},in(...args){calls.push(args);return Promise.resolve({data:[{key:"base__arq__2026-07-Q2",value:{__arcdEncoding:"arcd-gzip-base64-v1",data:gzipSync(JSON.stringify(archive)).toString("base64")},updated_at:"v1"},{key:"base__arq__2026-08-Q1",value:{invalid:true}}]});}};return query;}};
  const result=await loadLaborProjectionArchives({db,company:"company",key:"base",data:{quinzenasArquivadas:{"2026-07-Q2":{},"2026-08-Q1":{},"2026-09-Q1":{}}},start:"2026-07-21",end:"2026-10-20"});
  expect(result.archives).toHaveLength(1);expect(result.missing).toEqual(["2026-08-Q1","2026-09-Q1"]);expect(calls).toContainEqual(["company_id","company"]);
  expect(result.archives[0].archive).toEqual(archive);
 });
 it("sobreposição conflitante suspende o par sem duplicar e recorta datas",()=>{
  const data={employees:[employee],attendance:{},quinzenasArquivadas:{"2026-07-Q1":{inicio:"2026-07-06",fim:"2026-07-21"},"2026-07-Q2":{}}};
  const archives=["2026-07-Q1","2026-07-Q2"].map((id,index)=>({id,archive:{employeesSnapshot:[employee],attendance:{e:{"2026-07-21":{status:index?"F":"P"}}}}}));
  const result=composeLaborProjectionSource(data,archives,"2026-07-21","2026-10-20");expect(result.conflicts).toContain("e|2026-07-21");expect(result.data.attendance.e["2026-07-21"]).toBeNull();expect(result.data.attendance.e["2026-07-20"]).toBeUndefined();
 });
});
