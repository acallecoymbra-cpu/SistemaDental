import { expect, test } from '@playwright/test';
import { E2E } from './e2e-env';
import { createInterval, futureDate, loginAsDentist } from './helpers';

/** E2E de cancelar y avisar (T-13). Datos inventados. */
test.describe('cancelar consulta', () => {
  test('la doctora cancela con motivo, la franja queda libre y se encola el aviso', async ({
    page,
  }, testInfo) => {
    const desktop = testInfo.project.name === 'escritorio';
    const tag = desktop ? 'D' : 'M';
    const day = futureDate(desktop ? 52 : 53);
    const name = `Paciente Cancela ${tag}`;
    await loginAsDentist(page);
    await createInterval(page, day, '08:00', '08:45');
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
          ci: `CA${desktop ? 1 : 2}12345`,
          phoneCountryCode: '591',
          phone: `7900${desktop ? 1 : 2}100`,
          email: `cancela${tag}@ejemplo.test`,
          birthDate: '1990-01-01',
        },
      },
    });
    expect(booked.status()).toBe(201);
    // Mientras está reservada, la franja no se ofrece
    let slots = await (await page.request.get(`/api/v1/availability/slots?date=${day}`)).json();
    expect(slots.slots).toHaveLength(0);

    await page.getByRole('link', { name: 'Agenda', exact: true }).click();
    await page.waitForLoadState('networkidle');
    await page.getByLabel('Fecha', { exact: true }).fill(day);
    const row = page.getByRole('row').filter({ hasText: name });
    await row.getByRole('button', { name: 'Ver detalle' }).click();
    await row.getByRole('button', { name: 'Cancelar consulta' }).click();

    // Sin motivo no se cancela
    await row.getByRole('button', { name: 'Confirmar cancelación' }).click();
    await expect(
      page.getByRole('alert').filter({ hasText: 'Escribe el motivo de la cancelación.' }),
    ).toBeVisible();
    await expect(row).toContainText('Por pagar');

    // Se puede volver atrás sin cancelar
    await row.getByRole('button', { name: 'Volver' }).click();
    await expect(row.getByRole('button', { name: 'Cancelar consulta' })).toBeVisible();
    await row.getByRole('button', { name: 'Cancelar consulta' }).click();

    await row.getByLabel('Motivo de la cancelación').fill('Pidió cancelar por WhatsApp');
    await row.getByRole('button', { name: 'Confirmar cancelación' }).click();
    await expect(
      page.getByRole('status').filter({ hasText: `Consulta cancelada: ${name}` }),
    ).toContainText('Se enviará un aviso a su correo');
    await expect(row).toContainText('Cancelada');

    // El detalle sigue abierto y ya muestra el motivo y el estado del aviso
    await expect(row).toContainText('Pidió cancelar por WhatsApp');
    await expect(row).toContainText('Correo en cola');
    await expect(row.getByRole('link', { name: 'Avisar por WhatsApp' })).toHaveAttribute(
      'href',
      /https:\/\/wa\.me\/59179001\d00|https:\/\/wa\.me\/59179002\d00/,
    );
    // Ya cancelada: no se ofrece cancelar de nuevo
    await expect(row.getByRole('button', { name: 'Cancelar consulta' })).toHaveCount(0);

    // La franja volvió a estar libre para otros pacientes
    slots = await (await page.request.get(`/api/v1/availability/slots?date=${day}`)).json();
    expect(slots.slots.map((s: { startsLocal: string }) => s.startsLocal)).toEqual(['08:00']);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
