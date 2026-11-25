import { expect, test } from '@playwright/test';
import { loginAsDentist } from './helpers';

test.describe('acceso al panel', () => {
  test('una página del panel sin sesión lleva al login', async ({ page }) => {
    await page.goto('/panel/tratamientos');
    await expect(page).toHaveURL(/\/panel\/login\?next=%2Fpanel%2Ftratamientos/);
    await expect(page.getByRole('heading', { name: 'Panel del dentista' })).toBeVisible();
  });

  test('una contraseña incorrecta muestra un error sin revelar detalles', async ({ page }) => {
    await page.goto('/panel/login');
    await page.getByLabel('Usuario').fill('dra.e2e');
    await page.getByLabel('Contraseña').fill('incorrecta');
    await page.getByRole('button', { name: 'Ingresar' }).click();
    // Se busca dentro del formulario: Next.js agrega su propio elemento role="alert".
    await expect(page.locator('form').getByRole('alert')).toContainText(
      'Usuario o contraseña incorrectos.',
    );
  });

  test('con credenciales correctas entra y puede cerrar sesión', async ({ page }) => {
    await loginAsDentist(page);
    await expect(page.getByText('Dra. E2E')).toBeVisible();
    await page.getByRole('button', { name: 'Cerrar sesión' }).click();
    await expect(page).toHaveURL(/\/panel\/login/);
    await page.goto('/panel/tratamientos');
    await expect(page).toHaveURL(/\/panel\/login/);
  });
});
