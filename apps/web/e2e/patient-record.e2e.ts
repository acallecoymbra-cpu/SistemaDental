import { expect, test } from '@playwright/test';
import { E2E } from './e2e-env';
import { createInterval, futureDate, loginAsDentist } from './helpers';

/** E2E de la ficha del paciente (T-14). Datos inventados. */
test.describe('ficha del paciente', () => {
  test('abre la ficha desde la lista y muestra contacto y consultas', async ({
    page,
  }, testInfo) => {
    const desktop = testInfo.project.name === 'escritorio';
    const tag = desktop ? 'D' : 'M';
    const day = futureDate(desktop ? 82 : 83);
    const name = `Paciente Ficha ${tag}`;
    await loginAsDentist(page);
    await createInterval(page, day, '08:00', '09:00');

    const treatments = await (await page.request.get('/api/v1/treatments')).json();
    const booked = await page.request.post('/api/v1/appointments', {
      headers: { Origin: E2E.webUrl },
      data: {
        treatmentId: treatments[0].id,
        startsAt: `${day}T12:00:00.000Z`,
        patient: {
          kind: 'new',
          givenNames: name.split(' ')[0],
          firstSurname: name.split(' ').slice(1).join(' '),
          ci: `PR${desktop ? 1 : 2}12345`,
          phoneCountryCode: '591',
          phone: `7600${desktop ? 11 : 22}00`,
          email: `ficha${tag}@ejemplo.test`,
          birthDate: '1988-02-03',
        },
      },
    });
    expect(booked.status()).toBe(201);

    await page.getByRole('link', { name: 'Pacientes' }).click();
    await page.getByLabel('Buscar por nombre o celular').fill(name);
    await page.getByRole('button', { name: 'Buscar' }).click();
    const row = page.getByRole('row').filter({ hasText: name });
    await row.getByRole('link', { name: 'Ver ficha' }).click();

    await expect(page.getByRole('heading', { name, level: 1 })).toBeVisible();
    await expect(page.getByText(`ficha${tag}@ejemplo.test`)).toBeVisible();
    await expect(page.getByText('03/02/1988')).toBeVisible();
    await expect(page.getByText('Desde el portal')).toBeVisible();

    const consulta = page.getByRole('row').filter({ hasText: 'Por pagar' });
    await expect(consulta).toHaveCount(1);
    await expect(consulta).toContainText('08:00');
    await expect(consulta).toContainText(/Bs \d+,\d{2}/);
    await expect(page.getByRole('heading', { name: 'Historia clínica' })).toBeVisible();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);

    await page.getByRole('link', { name: '← Volver a pacientes' }).click();
    await expect(page.getByRole('heading', { name: 'Pacientes', level: 1 })).toBeVisible();
  });

  test('un paciente que no existe muestra un error claro', async ({ page }) => {
    await loginAsDentist(page);
    await page.goto('/panel/pacientes/3f2b8a4e-1c5d-4e6f-8a9b-0c1d2e3f4a5b');
    await expect(
      page.getByRole('alert').filter({ hasText: 'El paciente no existe.' }),
    ).toBeVisible();
  });

  test('sin sesión la ficha lleva al ingreso', async ({ page }) => {
    await page.goto('/panel/pacientes/3f2b8a4e-1c5d-4e6f-8a9b-0c1d2e3f4a5b');
    await expect(page).toHaveURL(/\/panel\/login/);
  });
});

/** Historia clínica por versiones (T-15). */
test.describe('historia clínica', () => {
  test('guarda versiones, no crea una si no hay cambios y deja ver las anteriores', async ({
    page,
  }, testInfo) => {
    const desktop = testInfo.project.name === 'escritorio';
    const name = `Paciente Historia ${desktop ? 'D' : 'M'}`;
    await loginAsDentist(page);
    const created = await page.request.post('/api/v1/admin/patients', {
      headers: { Origin: E2E.webUrl },
      data: {
        givenNames: name.split(' ')[0],
        firstSurname: name.split(' ').slice(1).join(' '),
        phoneCountryCode: '591',
        phone: `7610${desktop ? 1 : 2}000`,
        email: null,
        birthDate: '1985-05-05',
      },
    });
    expect(created.status()).toBe(201);
    const patientId = (await created.json()).patient.id as string;

    await page.goto(`/panel/pacientes/${patientId}`);
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('Al guardar se crea la versión 1.')).toBeVisible();

    // Vacío no crea nada
    await page.getByRole('button', { name: 'Guardar historia' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'No hay cambios' })).toBeVisible();

    await page.getByLabel('Anamnesis').fill('Sin alergias conocidas.');
    await page.getByLabel('Índice (tipo)').fill('CPO-D');
    await page.getByLabel('Índice (valor)').fill('3');
    await page.getByLabel('Diagnóstico').fill('Caries en 36');
    await page.getByRole('button', { name: 'Guardar historia' }).click();
    await expect(
      page.getByRole('status').filter({ hasText: 'Se guardó la versión 1.' }),
    ).toBeVisible();

    // Sin cambios: no crea versión
    await page.getByRole('button', { name: 'Guardar historia' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'No hay cambios' })).toBeVisible();
    await expect(page.getByText('Versión vigente: 1')).toBeVisible();

    await page.getByLabel('Diagnóstico').fill('Caries en 36 y 37');
    await page.getByRole('button', { name: 'Guardar historia' }).click();
    await expect(
      page.getByRole('status').filter({ hasText: 'Se guardó la versión 2.' }),
    ).toBeVisible();
    await expect(page.getByText('Versión vigente: 2')).toBeVisible();

    // La versión 1 se puede ver, en solo lectura, con su contenido original
    await page.getByRole('button', { name: 'Ver versión 1' }).click();
    const old = page.getByLabel('Versión 1', { exact: true });
    await expect(old).toContainText('Caries en 36');
    await expect(old).not.toContainText('36 y 37');
    await expect(old.locator('textarea, input')).toHaveCount(0);

    // Al recargar, el formulario trae la versión vigente
    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(page.getByLabel('Diagnóstico')).toHaveValue('Caries en 36 y 37');

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
