import {test,expect} from '@playwright/test';
import {data as fixture,profile} from '../scripts/fixtures/workflow-priorities-data.mjs';

async function enter(page,tab,report){
  const data=structuredClone(fixture);
  const user={...profile,role:'admin'};
  data.usuarios=[user];
  data.equipamentos=Array.from({length:25},(_,i)=>({
    id:'equip-'+i,nome:'Equipamento '+String(i+1).padStart(2,'0'),ativo:true,quantidadeTotal:1,
  }));
  data.conferencias=[{id:'vistoria',obraId:data.obras[0].id,codigo:7,pendencias:Array.from({length:25},(_,i)=>({
    id:'achado-'+i,descricao:'Conferência de campo '+String(i+1).padStart(2,'0'),status:'aberta',responsavelAjusteNome:i===24?'João Fiscal':'Equipe local',
  }))}];
  data.changeLog=Array.from({length:25},(_,i)=>({
    id:'evento-'+i,at:new Date(Date.UTC(2026,10,i+1)).toISOString(),message:'Consulta registrada '+String(i+1).padStart(2,'0'),type:'revisao',
  }));
  const writes=[],errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(({tab,id})=>sessionStorage.setItem('arcd-section:'+id,tab),{tab,id:user.id});
  await page.route('https://**/*',route=>route.abort());
  await page.route('**/api/**',route=>route.fulfill({json:{ok:true,items:[],presencas:[],mensagens:[],bases:[],obras:{}}}));
  await page.route('**/api/data',route=>{
    const request=route.request().postDataJSON()||{};
    if(request.action==='financial-company-dre-report')return report?.(route,request)??route.fulfill({status:503,json:{error:'Consulta indisponível no teste'}});
    if(!['auth-login','auth-refresh','profiles','load','obras-custo-acumulado'].includes(request.action)){
      writes.push(request.action);
      return route.fulfill({status:403,json:{error:'Operação bloqueada no ensaio'}});
    }
    return route.fulfill({json:{ok:true,user,usuario:user,usuarios:[user],data,precisaSetup:false,accessToken:'local-audit',refreshToken:'local-audit',updatedAt:'2026-11-17T12:00:00Z',obras:{}}});
  });
  await page.goto('/');
  await page.locator('#login-email').fill(user.email);
  await page.locator('#login-senha').fill('local-only');
  await page.getByRole('button',{name:'Acessar central MARCELL',exact:true}).click();
  return async()=>{
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize().width);
    expect(writes).toEqual([]);
    expect(errors).toEqual([]);
  };
}

for(const width of [320,390,1440])test.describe(width+'px',()=>{
  test.use({viewport:{width,height:844},hasTouch:width<768,isMobile:width<768});
  test('DRE esconde números e exportação na falha e em nova competência',async({page},info)=>{
    let phase="failure";
    let release;
    const waiting=new Promise(resolve=>{release=resolve});
    const check=await enter(page,'dre_emp',async route=>{
      if(phase==="failure")return route.fulfill({status:503,json:{error:'Consulta indisponível no teste'}});
      if(phase==="success")return route.fulfill({json:{ok:true,source:'canonical_ledger',current:{faturamentoTotal:1234,receitaLiquida:1111,ebitda:978,lucroLiquido:822}}});
      await waiting;
      return route.fulfill({json:{ok:true,source:'canonical_ledger',current:{}}});
    });
    const alert=page.getByRole('alert').filter({hasText:'DRE mensal indisponível'});
    const kpis=page.locator('.dre-company-kpis');
    await expect(alert).toBeVisible();
    await expect(kpis).toHaveCount(0);
    await expect(page.getByRole('button',{name:'Exportar PDF',exact:true})).toHaveCount(0);
    await expect(page.locator('.dre-ai-score')).toHaveCount(0);
    await page.screenshot({path:info.outputPath('dre-indisponivel.png')});
    phase='success';
    await alert.getByRole('button',{name:'Tentar novamente'}).click();
    await expect(kpis).toContainText('1.234,00');
    const month=page.getByRole('combobox',{name:'Mês',exact:true});
    phase="switching";
    await month.selectOption((Number(await month.inputValue())+1)%12+'');
    try{
      await expect(kpis).toHaveCount(0);
      await expect(page.locator('.dre-ai-score')).toHaveCount(0);
    }finally{release();}
    await expect(alert).toBeVisible();
    await check();
  });
  test('Comunicação busca responsáveis e pagina sem alterar as tarefas',async({page},info)=>{
    const check=await enter(page,'chat');
    const results=page.getByRole('region',{name:'Resultados de tarefas de conferência'});
    await expect(results).toContainText('1–12 de 25');
    await results.getByRole('button',{name:'Próxima'}).click();
    await expect(results).toContainText('13–24 de 25');
    await page.getByRole('textbox',{name:'Buscar tarefas'}).fill('joao fiscal');
    await expect(results).toContainText('1–1 de 1');
    await expect(page.getByRole('heading',{name:'Conferência de campo 25'})).toBeVisible();
    await page.screenshot({path:info.outputPath('comunicacao.png')});
    await check();
  });
  test('Frota preserva busca e acesso ao último equipamento',async({page},info)=>{
    const check=await enter(page,'equip');
    const cards=page.locator('.equipment-fleet-card');
    await expect(cards).toHaveCount(width<768?12:25);
    if(width<768)await page.getByRole('region',{name:'Resultados de equipamentos na frota'}).getByRole('button',{name:'Próxima'}).click();
    await page.getByRole('textbox',{name:'Pesquisar na frota'}).fill('Equipamento 25');
    await expect(cards).toHaveCount(1);
    await expect(cards.first()).toContainText('Equipamento 25');
    await page.screenshot({path:info.outputPath('frota.png')});
    await check();
  });
  test('Administração compacta filtros móveis e alcança alterações fora da primeira página',async({page},info)=>{
    const check=await enter(page,'admin_central');
    const results=page.getByRole('region',{name:'Resultados de alterações'});
    await expect(results).toContainText('1–12 de 25');
    const filter=page.getByRole('combobox',{name:'Tipo de evento'});
    if(width<768){
      await expect(filter).toBeHidden();
      await page.locator('summary').getByText('Filtros',{exact:true}).click();
    }
    await expect(filter).toBeVisible();
    await page.getByRole('textbox',{name:'Pesquisar',exact:true}).fill('Consulta registrada 01');
    await expect(results).toContainText('1–1 de 1');
    await expect(page.getByText('Consulta registrada 01',{exact:true})).toBeVisible();
    await page.screenshot({path:info.outputPath('administracao.png')});
    await check();
  });
});
