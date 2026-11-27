import { expect, test } from '@playwright/test';
import { E2E } from './e2e-env';
import { createInterval, futureDate, loginAsDentist } from './helpers';

/** E2E de la agenda (T-10): día y semana, filtros por estado y paciente, y detalle. */
test.describe('agenda del dentista', () => {
  test('muestra las consultas por día y semana, filtra y abre el detalle', async ({
    page,
  }, testInfo) => {
    const mobile = testInfo.project.name !== 'escritorio';
    const day = futureDate(mobile ? 81 : 80);
    const tag = mobile ? 'M' : 'D';
    await loginAsDentist(page);
    await createInterval(page, day, '08:00', '10:00');

    // Dos reservas del portal público (quedan «por pagar»)
    const book = async (startsAtUtc: string, name: string, phone: string) => {
      const treatments = await (await page.request.get('/api/v1/treatments')).json();
      const res = await page.request.post('/api/v1/appointments', {
        headers: { Origin: E2E.webUrl },
        data: {
          treatmentId: treatments[0].id,
          startsAt: startsAtUtc,
          patient: {
            kind: 'new',
            givenNames: name.split(' ')[0],
            firstSurname: name.split(' ').slice(1).join(' '),
            ci: `AG${phone}`,
            phoneCountryCode: '591',
            phone,
            email: 'a@ejemplo.test',
            birthDate: '1990-01-01',
          },
        },
      });
      expect(res.status()).toBe(201);
    };
    await book(`${day}T12:00:00.000Z`, `Ana Agenda ${tag}`, `7300${tag === 'M' ? '11' : '22'}01`);
    await book(`${day}T12:45:00.000Z`, `Beto Agenda ${tag}`, `7300${tag === 'M' ? '11' : '22'}02`);

    await page.getByRole('link', { name: 'Agenda', exact: true }).click();
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: 'Agenda', level: 1 })).toBeVisible();

    // Día: ver las dos, ordenadas por hora
    await page.getByLabel('Fecha', { exact: true }).fill(day);
    const rows = page.getByRole('row').filter({ hasText: 'Agenda ' + tag });
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0)).toContainText('08:00');
    await expect(rows.nth(0)).toContainText(`Ana Agenda ${tag}`);
    await expect(rows.nth(1)).toContainText('08:45');
    await expect(rows.nth(0)).toContainText('Por pagar');

    // Filtro por estado
    await page.getByLabel('Estado', { exact: true }).selectOption('confirmada');
    await expect(
      page.getByText('No hay consultas en este período con esos filtros.'),
    ).toBeVisible();
    await page.getByLabel('Estado', { exact: true }).selectOption('por_pagar');
    await expect(rows).toHaveCount(2);

    // Filtro por paciente
    await page.getByLabel('Paciente (nombre o celular)').fill(`beto agenda ${tag}`);
    await page.getByRole('button', { name: 'Buscar' }).click();
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText(`Beto Agenda ${tag}`);
    await page.getByRole('button', { name: 'Quitar filtro de paciente' }).click();
    await expect(rows).toHaveCount(2);

    // Detalle: anticipo y comprobante
    await rows.first().getByRole('button', { name: 'Ver detalle' }).click();
    await expect(rows.first()).toContainText('Sin comprobante');
    await expect(rows.first()).toContainText(/Bs \d+,\d{2}/);
    await expect(rows.first()).toContainText('Reserva en línea');
    await rows.first().getByRole('button', { name: 'Ocultar detalle' }).click();
    await expect(rows.first()).not.toContainText('Sin comprobante');

    // Semana: agrupa por día con su título
    await page.getByRole('button', { name: 'Semana', exact: true }).click();
    await expect(page.getByRole('heading', { name: /^Semana del/ })).toBeVisible();
    await expect(rows).toHaveCount(2);

    // Navegar a la semana siguiente: ya no están
    await page.getByRole('button', { name: 'Semana siguiente' }).click();
    await expect(rows).toHaveCount(0);
    await page.getByRole('button', { name: 'Semana anterior' }).click();
    await expect(rows).toHaveCount(2);

    // Sin desbordes de ancho (también en celular de 360 px)
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test('sin sesión la agenda lleva al ingreso', async ({ page }) => {
    await page.goto('/panel/agenda');
    await expect(page).toHaveURL(/\/panel\/login/);
  });
});
