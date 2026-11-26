import { expect, test } from '@playwright/test';
import pg from 'pg';
import { E2E } from './e2e-env';
import { createInterval, futureDate, loginAsDentist } from './helpers';

/** E2E de reprogramar y «no asistió» (T-12). Datos inventados. */
test.describe('reprogramar y no asistió', () => {
  test('la doctora mueve una consulta a otra franja libre', async ({ page }, testInfo) => {
    const desktop = testInfo.project.name === 'escritorio';
    const tag = desktop ? 'D' : 'M';
    const day = futureDate(desktop ? 90 : 91);
    const newDay = futureDate(desktop ? 92 : 93);
    const name = `Paciente Mueve ${tag}`;
    await loginAsDentist(page);
    await createInterval(page, day, '08:00', '08:45');
    await createInterval(page, newDay, '08:00', '09:30');
    const treatments = await (await page.request.get('/api/v1/treatments')).json();
    const booked = await page.request.post('/api/v1/appointments', {
      headers: { Origin: E2E.webUrl },
      data: {
        treatmentId: treatments[0].id,
        startsAt: `${day}T12:00:00.000Z`,
        patient: {
          fullName: name,
          phone: `7910${desktop ? 1 : 2}100`,
          email: `mueve${tag}@ejemplo.test`,
          birthDate: '1990-01-01',
        },
      },
    });
    expect(booked.status()).toBe(201);

    await page.getByRole('link', { name: 'Agenda', exact: true }).click();
    await page.waitForLoadState('networkidle');
    await page.waitForLoadState('networkidle');
    await page.getByLabel('Fecha', { exact: true }).fill(day);
    const row = page.getByRole('row').filter({ hasText: name });
    await row.getByRole('button', { name: 'Ver detalle' }).click();
    // Todavía no pasó la hora: no se ofrece «no asistió»
    await expect(row.getByRole('button', { name: 'Marcar no asistió' })).toHaveCount(0);
    await row.getByRole('button', { name: 'Reprogramar' }).click();
    await page.waitForLoadState('networkidle');

    // Sin elegir franja no se puede confirmar
    await expect(row.getByRole('button', { name: 'Confirmar nuevo horario' })).toBeDisabled();
    await row.getByLabel('Nueva fecha').fill(newDay);
    await row.getByRole('radio', { name: '08:45' }).click();
    await expect(row.getByRole('radio', { name: '08:45' })).toHaveAttribute('aria-checked', 'true');
    await row.getByRole('button', { name: 'Confirmar nuevo horario' }).click();

    await expect(
      page.getByRole('status').filter({ hasText: `Consulta reprogramada: ${name}` }),
    ).toContainText('08:45');
    // Ya no aparece en el día anterior
    await expect(page.getByRole('row').filter({ hasText: name })).toHaveCount(0);

    // La franja original volvió a estar libre; la nueva quedó ocupada
    const old = await (await page.request.get(`/api/v1/availability/slots?date=${day}`)).json();
    expect(old.slots.map((s: { startsLocal: string }) => s.startsLocal)).toEqual(['08:00']);
    const next = await (await page.request.get(`/api/v1/availability/slots?date=${newDay}`)).json();
    expect(next.slots.map((s: { startsLocal: string }) => s.startsLocal)).toEqual(['08:00']);

    await page.getByLabel('Fecha', { exact: true }).fill(newDay);
    await expect(page.getByRole('row').filter({ hasText: name })).toContainText('Por pagar');

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test('la doctora marca «no asistió» una consulta confirmada que ya pasó', async ({
    page,
  }, testInfo) => {
    const desktop = testInfo.project.name === 'escritorio';
    const name = `Paciente Falta ${desktop ? 'D' : 'M'}`;
    const startsAt = new Date(Date.now() - (desktop ? 3 : 6) * 3_600_000);
    const localDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/La_Paz' }).format(
      startsAt,
    );

    const db = new pg.Client({ connectionString: E2E.databaseUrl });
    await db.connect();
    try {
      const patient = await db.query(
        `INSERT INTO patient (full_name, normalized_name, phone, origin)
         VALUES ($1, $3, $2, 'web') RETURNING id`,
        [name, `7920${desktop ? 1 : 2}100`, name.toLowerCase()],
      );
      const treatment = await db.query('SELECT id FROM treatment WHERE active = true LIMIT 1');
      await db.query(
        `INSERT INTO appointment (patient_id, treatment_id, starts_at, ends_at, status,
                                  deposit_cents, origin)
         VALUES ($1, $2, $3::timestamptz, $3::timestamptz + interval '45 minutes',
                 'confirmada', 1000, 'web')`,
        [patient.rows[0].id, treatment.rows[0].id, startsAt.toISOString()],
      );
    } finally {
      await db.end();
    }

    await loginAsDentist(page);
    await page.getByRole('link', { name: 'Agenda', exact: true }).click();
    await page.waitForLoadState('networkidle');
    await page.waitForLoadState('networkidle');
    await page.getByLabel('Fecha', { exact: true }).fill(localDay);
    const row = page.getByRole('row').filter({ hasText: name });
    await row.getByRole('button', { name: 'Ver detalle' }).click();
    await row.getByRole('button', { name: 'Marcar no asistió' }).click();
    await expect(
      page.getByRole('status').filter({ hasText: `Marcada como no asistió: ${name}` }),
    ).toBeVisible();
    await expect(row).toContainText('No asistió');
    await row.getByRole('button', { name: 'Ver detalle' }).click();
    // Estado final: ya no hay acciones
    await expect(row.getByRole('button', { name: 'Marcar no asistió' })).toHaveCount(0);
    await expect(row.getByRole('button', { name: 'Reprogramar' })).toHaveCount(0);
    await expect(row.getByRole('button', { name: 'Cancelar consulta' })).toHaveCount(0);
  });
});

/** Cerrar consulta (T-17). */
test.describe('cerrar consulta', () => {
  test('la doctora cierra una consulta con diagnóstico y costo y queda de solo lectura', async ({
    page,
  }, testInfo) => {
    const desktop = testInfo.project.name === 'escritorio';
    const name = `Paciente Cierre ${desktop ? 'D' : 'M'}`;
    const startsAt = new Date(Date.now() - (desktop ? 12 : 15) * 3_600_000);
    const localDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/La_Paz' }).format(
      startsAt,
    );

    const db = new pg.Client({ connectionString: E2E.databaseUrl });
    await db.connect();
    try {
      const patient = await db.query(
        `INSERT INTO patient (full_name, normalized_name, phone, origin)
         VALUES ($1, $3, $2, 'web') RETURNING id`,
        [name, `7930${desktop ? 1 : 2}100`, name.toLowerCase()],
      );
      const treatment = await db.query('SELECT id FROM treatment WHERE active = true LIMIT 1');
      await db.query(
        `INSERT INTO appointment (patient_id, treatment_id, starts_at, ends_at, status,
                                  deposit_cents, origin)
         VALUES ($1, $2, $3::timestamptz, $3::timestamptz + interval '45 minutes',
                 'confirmada', 1000, 'web')`,
        [patient.rows[0].id, treatment.rows[0].id, startsAt.toISOString()],
      );
    } finally {
      await db.end();
    }

    await loginAsDentist(page);
    await page.getByRole('link', { name: 'Agenda', exact: true }).click();
    await page.waitForLoadState('networkidle');
    await page.getByLabel('Fecha', { exact: true }).fill(localDay);
    const row = page.getByRole('row').filter({ hasText: name });
    await row.getByRole('button', { name: 'Ver detalle' }).click();
    await row.getByRole('button', { name: 'Cerrar consulta' }).click();

    // Diagnóstico y costo son obligatorios
    await row.getByRole('button', { name: 'Cerrar consulta' }).click();
    await expect(
      page.getByRole('alert').filter({ hasText: 'Escribe el diagnóstico.' }),
    ).toBeVisible();
    await row.getByLabel('Diagnóstico').fill('Caries tratada en pieza 36');
    await row.getByRole('button', { name: 'Cerrar consulta' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'Escribe el costo' })).toBeVisible();
    await expect(row).toContainText('Confirmada');

    await row.getByLabel('Costo de la consulta (Bs)').fill('150,50');
    await row.getByRole('button', { name: 'Cerrar consulta' }).click();
    await expect(
      page.getByRole('status').filter({ hasText: `Consulta cerrada: ${name}` }),
    ).toBeVisible();
    await expect(row).toContainText('Completada');
    await expect(row).toContainText('Caries tratada en pieza 36');
    await expect(row).toContainText('Bs 150,50');

    // Solo lectura: ya no hay acciones
    for (const action of [
      'Cerrar consulta',
      'Reprogramar',
      'Cancelar consulta',
      'Marcar no asistió',
    ]) {
      await expect(row.getByRole('button', { name: action })).toHaveCount(0);
    }
  });
});
