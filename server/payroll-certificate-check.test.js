// @vitest-environment node
import {PGlite} from "@electric-sql/pglite";
import {expect,it,vi} from "vitest";
import {checkPayrollCertificates,payrollCertificateBlocker} from "./payroll-certificate-check.js";
import {camadaSupabase} from "./ponto-eletronico/banco-pglite.test-helper.js";

const fixture=vi.hoisted(()=>({db:null}));
vi.mock("@supabase/supabase-js",()=>({createClient:()=>new Proxy({},{
  get:(_,key)=>key==="auth"?{
    getUser:async()=>({data:{user:{id:"auth-test",email:"agente@teste.invalid"}},error:null}),
  }:fixture.db?.[key],
})}));

const periodKey="2026-11-Q2";
const company="mrc-test";
const date="2026-12-01";
const employee={id:"e",name:"Pessoa fictícia",obra:"obra"};
const data={
  employees:[employee],
  attendance:{e:{[date]:"AT","2026-11-20":"AT","2026-12-02":"P"}},
};

it("exige imagem ativa do funcionário, dia, obra e empresa certos, inclusive na virada do mês",async()=>{
  const db=new PGlite();
  try{
    await db.exec("create table public.company_app_data(company_id text,key text,value jsonb)");
    const doc={employeeId:employee.id,category:"leave",mime:"image/png",path:"privado.png",attendanceDate:date,attendanceWorkId:"obra"};
    const insert=(key,document,owner=company)=>db.query("insert into public.company_app_data values ($1,$2,$3)",[owner,key,JSON.stringify(document)]);
    await insert("rh_doc_archived",{...doc,archivedAt:"2026-12-02"});
    await insert("rh_doc_wrong_work",{...doc,attendanceWorkId:"outer"});
    await insert("rh_doc_wrong_date",{...doc,attendanceDate:"2026-11-20"});
    await insert("rh_doc_other_company",doc,"other");
    await insert("rh_doc_wrong_category",{...doc,category:"other"});
    await insert("rh_doc_no_file",{...doc,path:""});
    await insert("unrelated",doc);
    await db.transaction(async tx=>{
      const transaction=async(source,...parts)=>{
        if(Array.isArray(source)&&!source.raw)return source;
        const bindings=[];
        const bind=value=>`$${bindings.push(value)}`;
        const sql=source.reduce((query,segment,index)=>{
          if(!index)return segment;
          const part=parts[index-1];
          return query+(Array.isArray(part)?`(${part.map(bind).join(",")})`:bind(part))+segment;
        },"");
        return (await tx.query(sql,bindings)).rows;
      };
      const query=async(source,...parts)=>transaction(source,...await Promise.all(parts));
      const missing=await checkPayrollCertificates({data,periodKey,company,transaction:query});
      expect(missing).toEqual({ok:true,missing:[{employeeId:employee.id,name:employee.name,date}]});
      expect(payrollCertificateBlocker(missing)).toMatchObject({ok:false,status:409});
    });
    const documents=[doc];
    const range=vi.fn(async()=>({data:documents.map(value=>({value}))}));
    const builder={select:()=>builder,eq:()=>builder,like:()=>builder,in:()=>builder,order:()=>builder,range};
    const complete=await checkPayrollCertificates({data,periodKey,company,db:{from:()=>builder}});
    expect(complete).toEqual({ok:true,missing:[]});
    expect(payrollCertificateBlocker(complete)).toBeNull();
  }finally{await db.close();}
},30000);

it("bloqueia o fechamento quando a conferência falha e não exige imagem de dia sem marcação",async()=>{
  const from=vi.fn(()=>{throw new Error("Banco indisponível");});
  const failed=await checkPayrollCertificates({data,periodKey,company,db:{from}});
  expect(payrollCertificateBlocker(failed)).toMatchObject({ok:false,status:503});
  from.mockClear();
  const cleared={...data,attendance:{[employee.id]:{[date]:{status:null}}}};
  const result=await checkPayrollCertificates({data:cleared,periodKey,company,db:{from}});
  expect(result).toEqual({ok:true,missing:[]});
  expect(from).not.toHaveBeenCalled();
});

it("confere o ponto histórico quando a quinzena já foi arquivada",async()=>{
  const archived={...data,attendance:{},quinzenasArquivadas:{[periodKey]:{archivedAt:date}}};
  const maybeSingle=vi.fn(async()=>({data:{value:{attendance:data.attendance}}}));
  const builder={
    select:()=>builder,eq:()=>builder,like:()=>builder,in:()=>builder,order:()=>builder,
    maybeSingle,range:async()=>({data:[]}),
  };
  const result=await checkPayrollCertificates({data:archived,periodKey,company,db:{from:()=>builder}});
  expect(result.missing).toEqual([{employeeId:employee.id,name:employee.name,date}]);
  expect(maybeSingle).toHaveBeenCalledOnce();
});

it("confere também as datas de um arquivamento legado fora do calendário canônico",async()=>{
  const builder={
    select:()=>builder,eq:()=>builder,like:()=>builder,in:()=>builder,order:()=>builder,
    range:async()=>({data:[]}),
  };
  const result=await checkPayrollCertificates({data,periodKey,archiveDates:["2026-11-20"],company,db:{from:()=>builder}});
  expect(result.missing.map(item=>item.date)).toEqual(["2026-11-20",date]);
});

it("a API restringe a conferência ao RH e à administração da empresa",async()=>{
  const pg=new PGlite();
  vi.stubEnv("SUPABASE_URL","https://fixture.invalid");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY","fixture-service");
  vi.stubEnv("COMPANY_ID","arcd");
  try{
    await pg.exec("create table company_app_data(company_id text,key text,value jsonb,updated_at timestamptz,primary key(company_id,key))");
    fixture.db=camadaSupabase(pg);
    const {default:handler}=await import("../api/data.js");
    const call=async(role,obraId="")=>{
      const payload={employees:[],obras:[],usuarios:[{
        id:"op",role,obraId,authUserId:"auth-test",email:"agente@teste.invalid",active:true,
      }]};
      await pg.query("insert into company_app_data values ('arcd','arced_ponto_v1',$1,now()) on conflict (company_id,key) do update set value=excluded.value",[JSON.stringify(payload)]);
      let status,body;
      const res={setHeader(){},status(code){status=code;return res;},json(value){body=value;}};
      await handler({body:{action:"payroll-certificate-check",periodKey,accessToken:"test"},headers:{}},res);
      return {status,body};
    };
    expect(await call("engenheiro")).toMatchObject({status:403});
    expect(await call("rh","obra")).toMatchObject({status:403});
    expect(await call("rh")).toEqual({status:200,body:{ok:true,missing:[]}});
    expect(await call("admin")).toEqual({status:200,body:{ok:true,missing:[]}});
  }finally{
    await pg.close();
    vi.unstubAllEnvs();
  }
},30000);
