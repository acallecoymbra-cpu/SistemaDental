import { expect, test } from '@playwright/test';
import { E2E } from './e2e-env';
import { createInterval, futureDate, loginAsDentist } from './helpers';

/** E2E de confirmar pago (T-11). Datos inventados. */
test.describe('confirmar pago', () => {
  test('la doctora confirma una consulta con comprobante y las demás no ofrecen el botón', async ({
    page,
  }, testInfo) => {
    const desktop = testInfo.project.name === 'escritorio';
    const tag = desktop ? 'D' : 'M';
    const day = futureDate(desktop ? 50 : 51);
    const run = Date.now().toString(36).toUpperCase();
    await loginAsDentist(page);
    await createInterval(page, day, '08:00', '09:30');
    const treatments = await (await page.request.get('/api/v1/treatments')).json();

    const ids: string[] = [];
    for (const [i, hour] of ['12:00', '12:45'].entries()) {
      const res = await page.request.post('/api/v1/appointments', {
        headers: { Origin: E2E.webUrl },
        data: {
          treatmentId: treatments[0].id,
          startsAt: `${day}T${hour}:00.000Z`,
          patient: {
            kind: 'new',
            givenNames: 'Paciente',
            firstSurname: `Confirma ${tag}${i}`,
            ci: `CF${desktop ? 1 : 2}${i}1234`,
            phoneCountryCode: '591',
            phone: `7800${desktop ? 1 : 2}${i}00`,
            email: `cf${tag}${i}@ejemplo.test`,
            birthDate: '1990-01-01',
          },
        },
      });
      expect(res.status()).toBe(201);
      ids.push((await res.json()).id);
    }
    // Solo la primera envía comprobante
    const proof = await page.request.post(`/api/v1/appointments/${ids[0]}/payment-proof`, {
      headers: { Origin: E2E.webUrl },
      data: { receiptNumber: `CF-${tag}${run}` },
    });
    expect(proof.status()).toBe(201);

    await page.getByRole('link', { name: 'Agenda', exact: true }).click();
    await page.waitForLoadState('networkidle');
    await page.getByLabel('Fecha', { exact: true }).fill(day);
    const withProof = page.getByRole('row').filter({ hasText: `Paciente Confirma ${tag}0` });
    const noProof = page.getByRole('row').filter({ hasText: `Paciente Confirma ${tag}1` });

    // Sin comprobante: no hay botón para confirmar
    await noProof.getByRole('button', { name: 'Ver detalle' }).click();
    await expect(noProof).toContainText('Sin comprobante');
    await expect(noProof.getByRole('button', { name: 'Confirmar pago' })).toHaveCount(0);
    await noProof.getByRole('button', { name: 'Ocultar detalle' }).click();

    // El filtro «por confirmar» muestra solo la que tiene comprobante
    await page.getByLabel('Solo por confirmar (próximos 2 meses)').check();
    await expect(page.getByRole('heading', { name: 'Pagos por confirmar' })).toBeVisible();
    await expect(withProof).toHaveCount(1);
    await expect(noProof).toHaveCount(0);

    await withProof.getByRole('button', { name: 'Ver detalle' }).click();
    await expect(withProof).toContainText(`N.º CF-${tag}${run}`);
    // No existe un botón para rechazar
    await expect(page.getByRole('button', { name: /rechazar/i })).toHaveCount(0);
    await withProof.getByRole('button', { name: 'Confirmar pago' }).click();
    await expect(
      page.getByRole('status').filter({ hasText: `Pago confirmado: Paciente Confirma ${tag}0` }),
    ).toBeVisible();
    await expect(withProof).toHaveCount(0); // ya no está «por confirmar»

    // En el día aparece confirmada, con el comprobante confirmado
    await page.getByLabel('Solo por confirmar (próximos 2 meses)').uncheck();
    await expect(withProof).toContainText('Confirmada');
    await withProof.getByRole('button', { name: 'Ver detalle' }).click();
    await expect(withProof).toContainText('(confirmado)');
    await expect(withProof.getByRole('button', { name: 'Confirmar pago' })).toHaveCount(0);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
