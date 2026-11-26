import { expect, test, type Page } from '@playwright/test';
import { createInterval, futureDate, loginAsDentist } from './helpers';

/**
 * E2E de la reserva pública (T-06). Cada proyecto (escritorio / celular) usa su propio día
 * para no chocar con el otro. Datos inventados.
 */
test.describe('reserva pública', () => {
  let day: string;

  test.beforeEach(async ({ page }, testInfo) => {
    day = futureDate(testInfo.project.name === 'escritorio' ? 70 : 71);
    await loginAsDentist(page);
    // La segunda prueba del mismo proyecto reutiliza el día: si ya existe el intervalo, se sigue.
    try {
      await createInterval(page, day, '08:00', '12:00');
    } catch {
      /* ya creado por una prueba anterior */
    }
    await page.context().clearCookies();
  });

  async function chooseSlot(page: Page, hour: string) {
    await page.goto('/reservar');
    await page.getByLabel('Tratamiento', { exact: true }).selectOption({ label: 'Limpieza' });
    await page.getByLabel('Fecha', { exact: true }).fill(day);
    await page.getByRole('button', { name: hour, exact: true }).click();
  }

  async function fillNewPatient(page: Page, suffix: string, birth = '1990-04-12') {
    await page.getByLabel('Nombre completo').fill(`Paciente Reserva ${suffix}`);
    await page
      .getByLabel('Celular', { exact: true })
      .fill(`7200${suffix.slice(-4).padStart(4, '0')}`);
    await page.getByLabel('Correo').fill(`reserva${suffix}@ejemplo.test`);
    await page.getByLabel('Fecha de nacimiento').fill(birth);
  }

  test('reserva una cita: apartada 8 minutos con cuenta regresiva y resumen', async ({
    page,
  }, testInfo) => {
    const suffix = `${testInfo.project.name === 'escritorio' ? '10' : '20'}01`;
    await chooseSlot(page, '08:00');
    await fillNewPatient(page, suffix);
    await page.getByRole('button', { name: 'Reservar', exact: true }).click();

    const ok = page.getByRole('status').filter({ hasText: 'Tu horario está apartado' });
    await expect(ok).toBeVisible();
    await expect(ok).toContainText('8 minutos');
    await expect(ok).toContainText('Limpieza');
    await expect(ok).toContainText('08:00');
    await expect(ok).toContainText(/Bs \d+,\d{2}/);
    await expect(ok.getByLabel(/Tiempo restante 0[78]:\d\d/)).toBeVisible();

    // La franja ya no se ofrece a otra persona
    await chooseSlot(page, '08:45'); // otra franja sigue libre…
    await expect(page.getByRole('button', { name: '08:00', exact: true })).toHaveCount(0);
  });

  test('un menor necesita el celular del apoderado', async ({ page }, testInfo) => {
    const suffix = `${testInfo.project.name === 'escritorio' ? '10' : '20'}02`;
    const year = new Date().getFullYear() - 8;
    await chooseSlot(page, '09:30');
    await fillNewPatient(page, suffix, `${year}-06-15`);
    await expect(page.getByLabel('Celular del apoderado')).toBeVisible();
    await page.getByRole('button', { name: 'Reservar', exact: true }).click();
    await expect(
      page.getByRole('alert').filter({ hasText: 'necesita el celular de su apoderado' }),
    ).toBeVisible();
    await page.getByLabel('Celular del apoderado').fill('70999999');
    await page.getByRole('button', { name: 'Reservar', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('Tu horario está apartado');
  });

  test('un paciente que ya está registrado reserva sin fecha de nacimiento', async ({
    page,
  }, testInfo) => {
    const suffix = `${testInfo.project.name === 'escritorio' ? '10' : '20'}03`;
    await chooseSlot(page, '10:15');
    await fillNewPatient(page, suffix);
    await page.getByRole('button', { name: 'Reservar', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('Tu horario está apartado');

    await chooseSlot(page, '11:00');
    await page.getByLabel('Sí, ya estoy registrado').check();
    await expect(page.getByLabel('Fecha de nacimiento')).toHaveCount(0);
    await page.getByLabel('Nombre completo').fill(`PACIENTE RESERVA ${suffix}`);
    await page.getByLabel('Celular', { exact: true }).fill(`7200${suffix.slice(-4)}`);
    await page.getByLabel('Correo').fill(`reserva${suffix}@ejemplo.test`);
    await page.getByRole('button', { name: 'Reservar', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('Tu horario está apartado');
  });

  test('muestra los errores: sin tratamiento, sin horario y datos incompletos', async ({
    page,
  }) => {
    await page.goto('/reservar');
    await page.getByRole('button', { name: 'Reservar', exact: true }).click();
    await expect(
      page.getByRole('alert').filter({ hasText: 'Elige un tratamiento.' }),
    ).toBeVisible();
    await page.getByLabel('Tratamiento', { exact: true }).selectOption({ label: 'Limpieza' });
    await page.getByRole('button', { name: 'Reservar', exact: true }).click();
    await expect(
      page.getByRole('alert').filter({ hasText: 'Elige una fecha y un horario.' }),
    ).toBeVisible();

    await page.getByLabel('Fecha', { exact: true }).fill(futureDate(300));
    await expect(page.getByText('No hay horarios libres ese día.')).toBeVisible();
  });

  test('desde el inicio se llega a la reserva y no hay desbordes en el celular', async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Reservar cita' }).first().click();
    await expect(page).toHaveURL(/\/reservar$/);
    await expect(page.getByRole('heading', { name: 'Reservar cita', level: 1 })).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
