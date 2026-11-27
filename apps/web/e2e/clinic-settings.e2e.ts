import { expect, test } from '@playwright/test';
import { loginAsDentist } from './helpers';

/** E2E de la configuración de la clínica (T-01): rangos del anticipo y persistencia. */
test.describe('configuración de la clínica', () => {
  test('rechaza anticipos fuera de rango y guarda los válidos', async ({ page }) => {
    await loginAsDentist(page);
    await page.getByRole('link', { name: 'Configuración' }).click();
    await expect(page.getByRole('heading', { name: 'Configuración', level: 1 })).toBeVisible();

    const deposit = page.getByLabel('Anticipo (Bs)');
    const save = page.getByRole('button', { name: 'Guardar configuración' });
    const alert = page.locator('.alert-error');

    // 9,99 y 20,01 Bs: la API los rechaza y el mensaje se muestra
    await deposit.fill('9,99');
    await save.click();
    await expect(alert).toContainText('El anticipo debe estar entre 10 y 20 Bs.');
    await deposit.fill('20,01');
    await save.click();
    await expect(alert).toContainText('El anticipo debe estar entre 10 y 20 Bs.');

    // Un importe que no es número lo detecta la pantalla
    await deposit.fill('quince');
    await save.click();
    await expect(alert).toContainText('Escribe los importes en bolivianos');

    // Anticipo mayor que el precio
    await page.getByLabel('Precio de la consulta (Bs)').fill('12');
    await deposit.fill('15');
    await save.click();
    await expect(alert).toContainText(
      'El anticipo no puede ser mayor que el precio de la consulta.',
    );

    // Valores válidos: se guardan y siguen ahí al recargar
    await page.getByLabel('Precio de la consulta (Bs)').fill('30');
    await deposit.fill('15,50');
    await page.getByLabel('Referencia del QR de pago').fill('https://ejemplo.test/qr.png');
    await expect(page.getByLabel('Código del país del WhatsApp')).toHaveValue('591');
    await page.getByLabel('WhatsApp del consultorio').fill('70000000');
    await save.click();
    await expect(page.getByRole('status')).toContainText('Configuración guardada.');

    await page.reload();
    await expect(page.getByLabel('Anticipo (Bs)')).toHaveValue('15,50');
    await expect(page.getByLabel('Precio de la consulta (Bs)')).toHaveValue('30,00');
    await expect(page.getByLabel('Referencia del QR de pago')).toHaveValue(
      'https://ejemplo.test/qr.png',
    );
    await expect(page.getByLabel('WhatsApp del consultorio')).toHaveValue('70000000');
    // El portal enlaza al WhatsApp con el código de Bolivia
    await page.goto('/');
    await expect(page.locator('a[href^="https://wa.me/59170000000"]').first()).toBeAttached();
  });
});
