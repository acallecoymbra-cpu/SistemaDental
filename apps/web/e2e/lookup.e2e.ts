import { expect, test } from '@playwright/test';
import { E2E } from './e2e-env';
import { createInterval, futureDate, loginAsDentist } from './helpers';

/** E2E de «Mis consultas» (T-09). Datos inventados. */
test.describe('mis consultas', () => {
  test('el paciente ve su consulta con nombre y celular, y los errores son genéricos', async ({
    page,
  }, testInfo) => {
    const desktop = testInfo.project.name === 'escritorio';
    const tag = desktop ? 'D' : 'M';
    const day = futureDate(desktop ? 84 : 85);
    const name = `Paciente Mis Consultas ${tag}`;
    const phone = `7700${desktop ? 11 : 22}00`;
    await loginAsDentist(page);
    await createInterval(page, day, '08:00', '09:00');
    const treatments = await (await page.request.get('/api/v1/treatments')).json();
    const booked = await page.request.post('/api/v1/appointments', {
      headers: { Origin: E2E.webUrl },
      data: {
        treatmentId: treatments[0].id,
        startsAt: `${day}T12:00:00.000Z`,
        patient: { fullName: name, phone, email: `mc${tag}@ejemplo.test`, birthDate: '1990-01-01' },
      },
    });
    expect(booked.status()).toBe(201);
    await page.context().clearCookies();

    await page.goto('/');
    await page.getByRole('link', { name: 'Mis consultas' }).locator('visible=true').first().click();
    await expect(page).toHaveURL(/\/mis-consultas$/);
    await page.waitForLoadState('networkidle'); // el formulario ya está listo para enviarse
    await expect(page.getByRole('heading', { name: 'Mis consultas', level: 1 })).toBeVisible();

    // Un dato equivocado: mensaje genérico
    await page.getByLabel('Nombre completo').fill(name);
    await page.getByLabel('Celular').fill('70000001');
    await page.getByRole('button', { name: 'Ver mis consultas' }).click();
    await expect(
      page.getByRole('alert').filter({ hasText: 'No encontramos consultas con esos datos' }),
    ).toBeVisible();

    // Con los datos correctos
    await page.getByLabel('Celular').fill(phone);
    await page.getByRole('button', { name: 'Ver mis consultas' }).click();
    const list = page.getByRole('region', { name: 'Tus consultas' });
    await expect(list).toBeVisible();
    await expect(list).toContainText('08:00');
    await expect(list).toContainText('Por pagar');
    await expect(list).toContainText('falta enviar el comprobante');
    await expect(list).toContainText(/Bs \d+,\d{2}/);
    // Nada de datos personales ni clínicos en la respuesta
    await expect(list).not.toContainText(name);
    await expect(list).not.toContainText(phone);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test('tras 5 intentos fallidos avisa del bloqueo', async ({ page }, testInfo) => {
    // El bloqueo es por origen y ambos proyectos comparten el mío: lo hace el último proyecto,
    // después de que los demás ya consultaron (los fallos de las otras pruebas también cuentan).
    test.skip(testInfo.project.name === 'escritorio', 'el bloqueo es por origen');
    await page.goto('/mis-consultas');
    const blocked = page.getByRole('alert').filter({ hasText: 'Demasiados intentos' });
    for (let i = 0; i < 6 && !(await blocked.isVisible()); i += 1) {
      await page.getByLabel('Nombre completo').fill('Nadie Inventado');
      await page.getByLabel('Celular').fill('70000000');
      await page.getByRole('button', { name: 'Ver mis consultas' }).click();
      await expect(page.getByRole('alert').first()).toBeVisible();
    }
    await expect(blocked).toBeVisible();
    await expect(blocked).toContainText('15 minutos');
  });
});
