import { expect, test } from '@playwright/test';
import { loginAsDentist } from './helpers';

/** E2E del portal público (T-04): inicio, tratamientos activos, WhatsApp y responsive. */
test.describe('portal público', () => {
  test('muestra la marca, los valores de la consulta, los tratamientos y el WhatsApp configurado', async ({
    page,
  }) => {
    // El dentista configura precio, anticipo y WhatsApp; el portal debe reflejarlo.
    await loginAsDentist(page);
    await page.getByRole('link', { name: 'Configuración' }).click();
    await page.getByLabel('Precio de la consulta (Bs)').fill('30');
    await page.getByLabel('Anticipo (Bs)').fill('15,50');
    await page.getByLabel('WhatsApp del consultorio').fill('59170000000');
    await page.getByRole('button', { name: 'Guardar configuración' }).click();
    await expect(page.getByRole('status')).toContainText('Configuración guardada.');

    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Renovando Sonrisas');
    await expect(page.getByLabel('Valores de la consulta')).toContainText('Bs 30,00');
    await expect(page.getByLabel('Valores de la consulta')).toContainText('Bs 15,50');
    await expect(page.getByRole('heading', { name: 'Limpieza', level: 3 })).toBeVisible();

    // Todos los botones de WhatsApp apuntan al número configurado
    const links = page.locator('a[href^="https://wa.me/59170000000"]');
    await expect(links.locator('visible=true').first()).toBeVisible();
    expect(await links.count()).toBeGreaterThanOrEqual(2);
    await expect(page.getByRole('link', { name: 'Escribir por WhatsApp' }).first()).toHaveAttribute(
      'href',
      /text=Hola/,
    );
  });

  test('sin texto de la demo, sin elegir profesional y sin desbordar el ancho', async ({
    page,
  }) => {
    await page.goto('/');
    const body = (await page.locator('body').innerText()).toLowerCase();
    expect(body).not.toContain('lúmina');
    expect(body).not.toContain('lumina');
    expect(body).not.toContain('concept demo');
    expect(body).not.toContain('odontólogo');
    await expect(page.getByRole('link', { name: 'Acceso del dentista' })).toHaveAttribute(
      'href',
      '/panel',
    );

    // Responsive: ningún desplazamiento horizontal (360 px en el proyecto de celular)
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test('desde el portal se puede ir a las secciones', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Ver tratamientos' }).click();
    await expect(page).toHaveURL(/#tratamientos$/);
    await expect(page.getByRole('heading', { name: 'Tratamientos', level: 2 })).toBeInViewport();
  });
});
