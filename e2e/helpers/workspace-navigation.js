import {expect} from '@playwright/test';

export async function selectWorkspaceArea(page, navigation, label) {
  const selector=page.getByRole('combobox',{name:navigation,exact:true});
  const button=page.getByRole('navigation',{name:navigation,exact:true}).getByRole('button',{name:label,exact:true});
  // A folha lazy pode aparecer depois do DOM: aguardar o controle esperado
  // evita escolher a navegação desktop antes de aplicar o breakpoint móvel.
  if(page.viewportSize()?.width < 768) {
    await expect(selector).toBeVisible();
    const option=selector.getByRole('option').filter({hasText:label}).first();
    await selector.selectOption(await option.getAttribute('value'));
    return;
  }
  await expect(button).toBeVisible();
  await button.click();
}
