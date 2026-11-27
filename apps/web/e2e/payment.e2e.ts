import { expect, test, type Page } from '@playwright/test';
import { createInterval, futureDate, loginAsDentist, setClinicSettings } from './helpers';

/**
 * E2E del pago por QR y comprobante (T-07). Cada proyecto usa su propio día; como la reserva,
 * necesita una base limpia en cada ejecución. Datos inventados.
 */
test.describe('pago por QR y comprobante', () => {
  let day: string;
  let tag: string;
  const run = Date.now().toString(36).toUpperCase();

  test.beforeEach(async ({ page }, testInfo) => {
    const desktop = testInfo.project.name === 'escritorio';
    day = futureDate(desktop ? 72 : 73);
    tag = desktop ? 'D' : 'M';
    await loginAsDentist(page);
    await setClinicSettings(page, {
      paymentQrRef: '/qr-prueba.png',
      whatsappPhone: '+59170000000',
    });
    try {
      await createInterval(page, day, '08:00', '12:00');
    } catch {
      /* ya creado por una prueba anterior */
    }
    await page.context().clearCookies();
  });

  async function reserve(page: Page, hour: string, n: number) {
    await page.goto('/reservar');
    await page.getByLabel('Tratamiento', { exact: true }).selectOption({ label: 'Limpieza' });
    await page.getByLabel('Fecha', { exact: true }).fill(day);
    await page.getByRole('button', { name: hour, exact: true }).click();
    await page.getByLabel('Nombre(s)').fill('Paciente');
    await page.getByLabel('Primer apellido').fill(`Pago ${tag}${n}`);
    await page.getByLabel('CI', { exact: true }).fill(`PG${tag}${n}${run}`.slice(0, 20));
    await page.getByLabel('Celular', { exact: true }).fill(`7300${tag === 'D' ? 1 : 2}${n}00`);
    await page.getByLabel('Correo').fill(`pago${tag}${n}@ejemplo.test`);
    await page.getByLabel('Fecha de nacimiento').fill('1990-04-12');
    await page.getByRole('button', { name: 'Reservar', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('Tu horario está apartado');
  }

  test('muestra el QR, el monto y el contador, y recibe el comprobante', async ({ page }) => {
    await reserve(page, '08:00', 1);
    const ok = page.getByRole('status');
    await expect(
      ok.getByRole('img', { name: /Código QR para pagar el anticipo de Bs/ }),
    ).toBeVisible();
    await expect(ok).toContainText(/Bs \d+,\d{2}/);
    await expect(ok.getByLabel(/Tiempo restante 0[78]:\d\d/)).toBeVisible();

    await page.getByRole('button', { name: 'Enviar comprobante' }).click();
    await expect(
      page.getByRole('alert').filter({ hasText: 'Escribe el número de comprobante.' }),
    ).toBeVisible();
    await page.getByLabel('Número de comprobante').fill('con espacio');
    await page.getByRole('button', { name: 'Enviar comprobante' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'solo lleva letras' })).toBeVisible();

    await page.getByLabel('Número de comprobante').fill(`ok-${tag}${run}`);
    await page.getByRole('button', { name: 'Enviar comprobante' }).click();
    await expect(page.getByRole('status')).toContainText('Recibimos tu comprobante');
    await expect(page.getByRole('status')).toContainText('La doctora revisará tu pago');

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test('rechaza un comprobante repetido y la doctora ve el que sí se aceptó', async ({ page }) => {
    const receipt = `DUP-${tag}${run}`;
    await reserve(page, '08:45', 2);
    await page.getByLabel('Número de comprobante').fill(receipt);
    await page.getByRole('button', { name: 'Enviar comprobante' }).click();
    await expect(page.getByRole('status')).toContainText('Recibimos tu comprobante');

    await reserve(page, '09:30', 3);
    await page.getByLabel('Número de comprobante').fill(receipt.toLowerCase());
    await page.getByRole('button', { name: 'Enviar comprobante' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'ya fue registrado' })).toBeVisible();
    // Sigue pudiendo corregir y enviar otro
    await expect(page.getByLabel('Número de comprobante')).toBeEditable();

    await loginAsDentist(page);
    await page.getByRole('link', { name: 'Agenda', exact: true }).click();
    await page.waitForLoadState('networkidle');
    await page.waitForLoadState('networkidle');
    await page.getByLabel('Fecha', { exact: true }).fill(day);
    const row = page.getByRole('row').filter({ hasText: `Paciente Pago ${tag}2` });
    await row.getByRole('button', { name: 'Ver detalle' }).click();
    await expect(row).toContainText(`N.º ${receipt}`);
    await expect(row).toContainText('por revisar');
    const other = page.getByRole('row').filter({ hasText: `Paciente Pago ${tag}3` });
    await other.getByRole('button', { name: 'Ver detalle' }).click();
    await expect(other).toContainText('Sin comprobante');
  });

  test('al terminar los 8 minutos avisa y ofrece WhatsApp', async ({ page }) => {
    await page.clock.install({ time: Date.now() });
    await reserve(page, '10:15', 4);
    await page.clock.fastForward('09:00');
    const late = page.getByRole('alert').filter({ hasText: 'Pasaron los 8 minutos' });
    await expect(late).toBeVisible();
    await expect(page.getByLabel('Número de comprobante')).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Escribir por WhatsApp' })).toHaveAttribute(
      'href',
      /https:\/\/wa\.me\/59170000000/,
    );
    await expect(page.getByRole('link', { name: 'Reservar de nuevo' })).toBeVisible();
  });

  test('si el servidor rechaza por vencimiento, muestra el mensaje con WhatsApp', async ({
    page,
  }) => {
    await page.route('**/api/v1/appointments/*/payment-proof', (route) =>
      route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({
          statusCode: 409,
          message:
            'La reserva venció y el horario se liberó. Escríbenos por WhatsApp para ayudarte con tu pago.',
        }),
      }),
    );
    await page.clock.install({ time: Date.now() });
    await page.goto('/reservar');
    await page.getByLabel('Tratamiento', { exact: true }).selectOption({ label: 'Limpieza' });
    await page.getByLabel('Fecha', { exact: true }).fill(day);
    await page.getByRole('button', { name: '11:00', exact: true }).click();
    await page.getByLabel('Nombre(s)').fill('Paciente');
    await page.getByLabel('Primer apellido').fill(`Pago ${tag}5`);
    await page.getByLabel('CI', { exact: true }).fill(`PG${tag}5${run}`.slice(0, 20));
    await page.getByLabel('Celular', { exact: true }).fill(`7300${tag === 'D' ? 1 : 2}500`);
    await page.getByLabel('Correo').fill(`pago${tag}5@ejemplo.test`);
    await page.getByLabel('Fecha de nacimiento').fill('1990-04-12');
    await page.getByRole('button', { name: 'Reservar', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('Tu horario está apartado');
    await page.getByLabel('Número de comprobante').fill(`LATE-${tag}${run}`);
    await page.getByRole('button', { name: 'Enviar comprobante' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'WhatsApp' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Escribir por WhatsApp' })).toBeVisible();
  });
});
