import {beforeAll,beforeEach,describe,expect,it,vi} from "vitest";

const testState=vi.hoisted(()=>({
  row:null,
  rpcCalls:[],
}));

const queryFor=table=>{
  const filters={};
  let mode="select";
  let values=null;
  const query={
    select(){return query;},
    update(next){mode="update";values=next;return query;},
    eq(key,value){filters[key]=value;return query;},
    in(){return query;},
    maybeSingle:async()=>{
      if(table!=="company_app_data")return{data:null,error:null};
      if(filters.company_id&&filters.company_id!==testState.row.company_id)return{data:null,error:null};
      if(filters.key&&filters.key!==testState.row.key)return{data:null,error:null};
      if(mode==="update"){
        testState.row={...testState.row,...values};
        return{data:testState.row,error:null};
      }
      return{data:{value:testState.row.value,updated_at:testState.row.updated_at},error:null};
    },
    then(resolve,reject){
      const result=mode==="update"
        ?(testState.row={...testState.row,...values},{data:null,error:null})
        :{data:[],error:null};
      return Promise.resolve(result).then(resolve,reject);
    },
  };
  return query;
};

const fakeDb=vi.hoisted(()=>({
  auth:{
    getUser:vi.fn(async()=>({data:{user:{id:"auth-eng"}},error:null})),
  },
  from:vi.fn(table=>queryFor(table)),
  rpc:vi.fn(async(name,args)=>{
    if(name.startsWith("auth_rate_limit_"))return{data:null,error:null};
    if(name==="company_save_with_audit"){
      testState.rpcCalls.push(args);
      if(testState.row.updated_at!==args.p_expected_updated_at){
        return{data:[{updated_at:testState.row.updated_at,applied:false}],error:null};
      }
      const updatedAt=new Date(new Date(testState.row.updated_at).getTime()+1000).toISOString();
      testState.row={...testState.row,value:args.p_value,updated_at:updatedAt};
      return{data:[{updated_at:updatedAt,applied:true}],error:null};
    }
    return{data:null,error:{code:"PGRST202",message:`Unexpected RPC ${name}`}};
  }),
}));

vi.mock("@supabase/supabase-js",()=>({
  createClient:()=>fakeDb,
}));

let handler;
const callApi=async body=>{
  let statusCode=200;
  let payload;
  const req={body,query:{},headers:{"x-forwarded-for":"127.0.0.1"}};
  const res={
    status(code){statusCode=code;return res;},
    json(value){payload=value;return value;},
  };
  await handler(req,res);
  return{status:statusCode,body:payload};
};

const initialData=()=>({
  usuarios:[{
    id:"eng-a",nome:"Engenheira A",role:"engenheiro",obraId:"obra-a",
    authUserId:"auth-eng",active:true,
  }],
  obras:[{id:"obra-a",name:"Obra A"},{id:"obra-b",name:"Obra B"}],
  employees:[
    {id:"e-a",name:"Equipe A",obra:"obra-a",active:true,startDate:"2020-01-01"},
    {id:"e-b",name:"Equipe B",obra:"obra-b",active:true,startDate:"2020-01-01"},
  ],
  attendance:{},attendanceLocks:{},unlockRequests:[],changeLog:[],
});

describe("/api/data · persistência granular do ponto",()=>{
  beforeAll(async()=>{
    process.env.SUPABASE_URL="https://attendance.test";
    process.env.SUPABASE_SERVICE_ROLE_KEY="service-role-test";
    vi.resetModules();
    ({default:handler}=await import("../../api/data.js"));
  });

  beforeEach(()=>{
    testState.row={
      company_id:"arcd",key:"arced_ponto_v1",value:initialData(),
      updated_at:"2026-07-28T12:00:00.000Z",
    };
    testState.rpcCalls.length=0;
    fakeDb.rpc.mockClear();
    fakeDb.from.mockClear();
  });

  it("confirma no servidor, persiste após nova leitura e audita uma única vez",async()=>{
    const command={
      action:"attendance-upsert",
      operationId:"10000000-0000-4000-8000-000000000001",
      employeeId:"e-a",date:"2026-07-28",selectedObraId:"obra-a",
      record:{status:"P",ot:0,note:"Conferido",obraId:"obra-a"},
      confirmDailyCheck:true,accessToken:"valid-token",
    };
    const saved=await callApi(command);

    expect(saved.status).toBe(200);
    expect(saved.body).toEqual({
      ok:true,
      result:{
        attendance:[expect.objectContaining({
          employeeId:"e-a",date:"2026-07-28",obraId:"obra-a",
          record:expect.objectContaining({status:"P",note:"Conferido"}),
        })],
        dailyCheckDate:"2026-07-28",
      },
      updatedAt:"2026-07-28T12:00:01.000Z",
    });
    expect(saved.body).not.toHaveProperty("data");
    expect(testState.rpcCalls).toHaveLength(1);
    expect(testState.rpcCalls[0]).toMatchObject({
      p_action:"attendance_upsert",
      p_before:{attendance:expect.objectContaining({employeeId:"e-a",date:"2026-07-28"})},
      p_after:{attendance:expect.objectContaining({employeeId:"e-a",date:"2026-07-28"})},
    });

    const reloaded=await callApi({action:"load",accessToken:"valid-token"});
    expect(reloaded.status).toBe(200);
    expect(reloaded.body.data.attendance["e-a"]["2026-07-28"]).toMatchObject({
      status:"P",note:"Conferido",obraId:"obra-a",
    });

    const repeated=await callApi(command);
    expect(repeated.status).toBe(200);
    expect(repeated.body.idempotent).toBe(true);
    expect(testState.rpcCalls).toHaveLength(1);
  });

  it("recusa no servidor a escrita de outra obra sem alterar o dataset",async()=>{
    const before=JSON.stringify(testState.row.value);
    const denied=await callApi({
      action:"attendance-upsert",accessToken:"valid-token",
      operationId:"10000000-0000-4000-8000-000000000002",
      employeeId:"e-b",date:"2026-07-28",selectedObraId:"obra-b",
      record:{status:"P",obraId:"obra-b"},
    });

    expect(denied).toMatchObject({status:403,body:{ok:false}});
    expect(JSON.stringify(testState.row.value)).toBe(before);
    expect(testState.rpcCalls).toHaveLength(0);
  });
});
