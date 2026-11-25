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
