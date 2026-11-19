// @vitest-environment node
import {beforeAll,afterAll,beforeEach,it,expect,vi} from 'vitest';
const state=vi.hoisted(()=>({company:'arcd',context:null,storage:{from:vi.fn()}}));
vi.mock('../server/company-context.js',()=>({currentCompany:()=>state.company,isolationEnabled:()=>true,withCompanyContext:handler=>handler}));
vi.mock('../server/app-auth.js',()=>({authenticateAppContext:vi.fn(async()=>state.context)}));
vi.mock('@supabase/supabase-js',()=>({createClient:()=>({storage:state.storage,from:()=>{const query={select:()=>query,eq:()=>query,maybeSingle:async()=>({data:{value:{obras:state.context?.payload?.obras||[]}}})};return query;}})}));
let handler;
beforeAll(async()=>{vi.stubEnv('SUPABASE_URL','https://storage.test');vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY','test-only-service-key');handler=(await import('./upload.js')).default;});
afterAll(()=>vi.unstubAllEnvs());
beforeEach(()=>{state.company='arcd';state.context={user:{id:'engineer',role:'engenheiro',active:true,obraId:'work-a'},payload:{obras:[{id:'work-a'}]}};state.storage.from.mockReset();});
const reference='company-file://arcd/work-a/2026/35136ece-8161-4cb3-89a2-b9d6a4ad470c.jpg';
async function request(body,method='POST'){const response={code:200,headers:{},status(code){this.code=code;return this;},json(value){this.body=value;return this;},setHeader(key,value){this.headers[key]=value;}};await handler({method,body},response);return response;}
it('exige POST e autenticação antes de assinar',async()=>{
 expect((await request({action:'signed-company-file',reference},'GET')).code).toBe(405);
 state.context=null;expect((await request({action:'signed-company-file',reference})).code).toBe(401);expect(state.storage.from).not.toHaveBeenCalled();
});
it('aplica escopo e retorna link temporário sem cache',async()=>{
 const signed=vi.fn(async()=>({data:{signedUrl:'https://storage.test/temporary'}}));state.storage.from.mockReturnValue({createSignedUrl:signed});
 const r=await request({action:'signed-company-file',reference});expect(r.code).toBe(200);expect(r.body).toMatchObject({ok:true,expiresIn:300});expect(r.headers['Cache-Control']).toBe('private, no-store');expect(signed).toHaveBeenCalledTimes(1);
 state.company='mrc';expect((await request({action:'signed-company-file',reference})).code).toBe(403);expect(signed).toHaveBeenCalledTimes(1);
});
it('novo upload isolado devolve referência estável e não um link público ou assinado persistido',async()=>{
 const upload=vi.fn(async()=>({})),getPublicUrl=vi.fn();state.storage.from.mockReturnValue({upload,getPublicUrl});
 const r=await request({dataUrl:'data:image/jpeg;base64,aW1hZ2U=',obraId:'work-a',ext:'jpg'});
 expect(r.code).toBe(200);expect(r.body.url).toMatch(/^company-file:\/\/arcd\/work-a\/\d{4}\//);expect(state.storage.from).toHaveBeenCalledWith('company-files-private');expect(getPublicUrl).not.toHaveBeenCalled();expect(upload).toHaveBeenCalledTimes(1);
});
