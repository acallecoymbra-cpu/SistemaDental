import { expect, test } from '@playwright/test';

/** El campo de celular no deja escribir letras. */
test.describe('campo de celular', () => {
  test('en «Mis consultas» ignora letras y símbolos, al escribir y al pegar', async ({ page }) => {
    await page.goto('/mis-consultas');
    await page.waitForLoadState('networkidle');
    const phone = page.getByLabel('Celular', { exact: true });
    await phone.pressSequentially('7a0b0-c0 0d0*0#0');
    await expect(phone).toHaveValue('700-0 0000');

    await phone.fill('');
    await phone.evaluate((el) => {
      const input = el as HTMLInputElement;
      input.value = '+591 abc 7000';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await expect(phone).toHaveValue('+591  7000');
  });
});
