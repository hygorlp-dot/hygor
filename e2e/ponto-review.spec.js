import {test,expect} from "@playwright/test";

// Regra de 05/11/2026 (docs/PONTO-DUAS-BATIDAS-20261105.md): duas batidas sem tipo,
// completas e confiáveis, são entrada e saída; o almoço previsto da escala é
// descontado sem exigir batida. Editar um horário volta a exigir justificativa.
test("RH define escala, integra entrada e saída com o intervalo previsto e integra uma vez",async({page},testInfo)=>{
  test.setTimeout(90000);
  const errors=[];page.on("pageerror",e=>errors.push(e.message));
  await page.goto('/e2e/fixtures/ponto-review.html',{waitUntil:'commit'});
  // Sem escala, não há conferência.
  await expect(page.getByRole('button',{name:'Conferir e integrar',exact:true})).toBeDisabled({timeout:60000});
  await page.getByRole('button',{name:'Definir escala de 44h'}).click();
  await page.getByLabel('Início da vigência').fill('2026-10-01');
  await page.getByRole('button',{name:'Salvar funcionário'}).click();
  await expect(page.getByText('07:00–12:00 / 13:00–17:00',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Conferir e integrar',exact:true}).click();
  const modal=page.getByRole('dialog');
  const confirmar=page.getByRole('button',{name:'Confirmar e integrar à Gestão do ponto'});
  await expect(modal.locator('input[type="time"]')).toHaveCount(2);
  await expect(modal).toContainText('Intervalo previsto: 12:00–13:00, descontado automaticamente');
  await expect(modal.getByLabel('Observação da conferência')).toBeVisible();
  await expect(confirmar).toBeEnabled();
  // RH alterou um horário: justificativa obrigatória até voltar ao recebido.
  await page.getByLabel('Saída',{exact:true}).fill('16:58');
  await expect(modal.getByLabel('Justificativa obrigatória')).toBeVisible();
  await expect(confirmar).toBeDisabled();
  await page.getByLabel('Saída',{exact:true}).fill('16:59');
  await expect(confirmar).toBeEnabled();
  await page.screenshot({path:`test-results/ponto-review-${testInfo.project.name}.png`,fullPage:true});
  await confirmar.click();
  await expect(page.getByRole('cell').getByText('Integrado à Gestão do ponto',{exact:true})).toBeVisible();
  await page.screenshot({path:`test-results/ponto-integrado-${testInfo.project.name}.png`,fullPage:true});
  expect(await page.evaluate(()=>window.submissions)).toBe(1);
  expect(await page.evaluate(()=>window.savedRecord)).toMatchObject({entrada:'07:04',saida:'16:59',workedMinutes:535,ot:0,pontoReview:{reviewedBy:'rh',scheduledBreak:expect.anything()}});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});
