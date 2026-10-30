import {test,expect} from "@playwright/test";

test("RH define escala, trata intervalo ausente e integra uma vez",async({page},testInfo)=>{
  test.setTimeout(90000);
  const errors=[];page.on("pageerror",e=>errors.push(e.message));
  await page.goto('/e2e/fixtures/ponto-review.html',{waitUntil:'commit'});
  await expect(page.getByRole('button',{name:'Conferir e integrar',exact:true})).toBeDisabled({timeout:60000});
  await page.getByRole('button',{name:'Definir escala de 44h'}).click();
  await page.getByLabel('Início da vigência').fill('2026-10-01');
  await page.getByRole('button',{name:'Salvar funcionário'}).click();
  await expect(page.getByText('07:00–12:00 / 13:00–17:00',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Conferir e integrar',exact:true}).click();
  await expect(page.getByRole('button',{name:'Confirmar e integrar à Gestão do ponto'})).toBeDisabled();
  for(const [label,value] of [['Entrada','07:04'],['Saída para intervalo','12:00'],['Retorno do intervalo','13:00'],['Saída','16:59']])await page.getByLabel(label,{exact:true}).fill(value);
  await page.getByLabel('Justificativa obrigatória').fill('Intervalo confirmado pelo RH com o funcionário.');
  await page.screenshot({path:`test-results/ponto-review-${testInfo.project.name}.png`,fullPage:true});
  await page.getByRole('button',{name:'Confirmar e integrar à Gestão do ponto'}).click();
  await expect(page.getByText('Conferido e integrado',{exact:true})).toBeVisible();
  await page.screenshot({path:`test-results/ponto-integrado-${testInfo.project.name}.png`,fullPage:true});
  expect(await page.evaluate(()=>window.submissions)).toBe(1);
  expect(await page.evaluate(()=>window.savedRecord)).toMatchObject({entrada:'07:04',intervaloSaida:'12:00',saida:'16:59',workedMinutes:535,ot:0,archivedWorkdayHours:9,pontoReview:{reviewedBy:'rh'}});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});
