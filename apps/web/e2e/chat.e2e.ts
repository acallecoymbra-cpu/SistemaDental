import { expect, test } from '@playwright/test';
import { loginAsDentist, setClinicSettings } from './helpers';

/** E2E del chat por reglas (T-18): atajos, urgencia, sin diagnóstico, respuesta por defecto. */
test.describe('chat de ayuda', () => {
  test.beforeEach(async ({ page }) => {
    // El chat ofrece el WhatsApp configurado por la doctora: se deja uno conocido.
    await loginAsDentist(page);
    await setClinicSettings(page, { whatsappPhone: '59170000000' });
    await page.context().clearCookies();
    await page.goto('/');
    await page.getByRole('button', { name: 'Chat de ayuda' }).click();
  });

  const log = (page: import('@playwright/test').Page) =>
    page.getByRole('log', { name: 'Conversación' });

  test('abre con bienvenida, responde por atajos y se cierra con Escape devolviendo el foco', async ({
    page,
  }) => {
    const dialog = page.getByRole('dialog', { name: 'Chat de ayuda' });
    await expect(dialog).toBeVisible();
    await expect(log(page)).toContainText('No hago diagnósticos ni pido datos personales');

    await page
      .getByRole('group', { name: 'Atajos' })
      .getByRole('button', { name: 'Tratamientos' })
      .click();
    await expect(log(page)).toContainText('Estos son los tratamientos del consultorio');
    await expect(log(page)).toContainText('Limpieza');

    await page
      .getByRole('group', { name: 'Atajos' })
      .getByRole('button', { name: 'Precios' })
      .click();
    await expect(log(page)).toContainText(/Bs \d+,\d{2}/);

    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Chat de ayuda' })).toBeFocused();
  });

  test('una urgencia muestra el mensaje de emergencia y el WhatsApp', async ({ page }) => {
    await page.getByLabel('Escribe tu pregunta').fill('Tengo una urgencia, me sangra la encía');
    await page.getByRole('button', { name: 'Enviar' }).click();
    await expect(log(page)).toContainText('servicio de emergencias');
    const wa = page.getByRole('dialog').getByRole('link', { name: 'Escribir ahora por WhatsApp' });
    await expect(wa).toHaveAttribute('href', /^https:\/\/wa\.me\//);
    await expect(wa).toHaveAttribute('target', '_blank');
  });

  test('no hace diagnósticos ni pide datos personales', async ({ page }) => {
    const input = page.getByLabel('Escribe tu pregunta');
    await input.fill('¿Tengo caries? ¿qué medicina me tomo?');
    await page.getByRole('button', { name: 'Enviar' }).click();
    await expect(log(page)).toContainText('no puedo hacer diagnósticos');

    await input.fill('mi correo es ana@ejemplo.test');
    await page.getByRole('button', { name: 'Enviar' }).click();
    await expect(log(page)).toContainText('no compartas datos personales');
    await expect(page.getByRole('dialog')).toContainText('No compartas datos personales aquí');
  });

  test('sin regla responde por defecto con WhatsApp; la reserva se abre desde el chat', async ({
    page,
  }) => {
    await page.getByLabel('Escribe tu pregunta').fill('el cielo es azul');
    await page.getByRole('button', { name: 'Enviar' }).click();
    await expect(log(page)).toContainText('No tengo una respuesta para eso');
    await expect(
      page.getByRole('dialog').getByRole('link', { name: 'Escribir por WhatsApp' }),
    ).toBeVisible();

    await page
      .getByRole('group', { name: 'Atajos' })
      .getByRole('button', { name: 'Reservar cita' })
      .click();
    await page.getByRole('dialog').getByRole('link', { name: 'Reservar cita' }).click();
    await expect(page).toHaveURL(/\/reservar$/);
  });

  test('lo escrito no se envía a ningún servidor', async ({ page }) => {
    const requests: string[] = [];
    page.on('request', (req) => {
      if (req.method() !== 'GET') requests.push(`${req.method()} ${req.url()}`);
    });
    await page.getByLabel('Escribe tu pregunta').fill('horarios');
    await page.getByRole('button', { name: 'Enviar' }).click();
    await expect(log(page)).toContainText('franjas de 45 minutos');
    expect(requests).toEqual([]);
  });

  test('cabe en el ancho del celular', async ({ page }) => {
    const box = await page.getByRole('dialog').boundingBox();
    const viewport = page.viewportSize()!;
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
  });
});
