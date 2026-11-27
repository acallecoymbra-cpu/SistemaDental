import { expect, type Page } from '@playwright/test';
import { E2E } from './e2e-env';

/** Inicia sesión como el dentista de prueba y espera estar dentro del panel. */
export async function loginAsDentist(page: Page): Promise<void> {
  await page.goto('/panel/login');
  await page.getByLabel('Usuario').fill(E2E.dentist.username);
  await page.getByLabel('Contraseña').fill(E2E.dentist.password);
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await expect(page.getByRole('heading', { name: 'Tratamientos', level: 1 })).toBeVisible();
}

/** Nombre único por ejecución y proyecto, para que las pruebas no choquen entre sí. */
export function uniqueName(base: string, projectName: string): string {
  return `${base} ${projectName} ${Date.now().toString(36)}`;
}

/** Fecha `AAAA-MM-DD` a `days` días de hoy (hora de La Paz). */
export function futureDate(days: number): string {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/La_Paz' }).format(new Date());
  const [y, m, d] = today.split('-').map(Number);
  return new Date(Date.UTC(y!, m! - 1, d! + days)).toISOString().slice(0, 10);
}

/** Crea un intervalo de atención por la API (usa la sesión de la página ya iniciada). */
export async function createInterval(
  page: Page,
  serviceDate: string,
  startsLocal: string,
  endsLocal: string,
): Promise<void> {
  const res = await page.request.post('/api/v1/admin/availability-intervals', {
    headers: { Origin: E2E.webUrl },
    data: { serviceDate, startsLocal, endsLocal },
  });
  expect(res.status()).toBe(201);
}

/** Guarda ajustes de la clínica por la API (usa la sesión ya iniciada de la página). */
export async function setClinicSettings(
  page: Page,
  settings: {
    consultationPriceCents?: number;
    depositCents?: number;
    whatsappPhone?: string | null;
    paymentQrRef?: string | null;
  },
): Promise<void> {
  const res = await page.request.patch('/api/v1/admin/clinic-settings', {
    headers: { Origin: E2E.webUrl },
    data: settings,
  });
  expect(res.status()).toBe(200);
}
