import { expect, test } from '@playwright/test';
import { loginAsDentist, uniqueName } from './helpers';

/**
 * Molde E2E (B-05/B-06): recorre la funcionalidad como lo haría el usuario y
 * comprueba el efecto en el portal público. Cada tarea con pantalla debe tener
 * al menos una prueba así de su recorrido principal.
 */
test.describe('catálogo de tratamientos', () => {
  test('el portal muestra los tratamientos de la semilla', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Renovando Sonrisas');
    await expect(page.getByRole('heading', { name: 'Limpieza', level: 3 })).toBeVisible();
  });

  test('crear, editar y desactivar un tratamiento', async ({ page }, testInfo) => {
    const name = uniqueName('Ortodoncia', testInfo.project.name);
    const renamed = `${name} editada`;

    await loginAsDentist(page);

    // Crear
    const createForm = page.locator('section', {
      has: page.getByRole('heading', { name: 'Nuevo tratamiento' }),
    });
    await createForm.getByLabel('Nombre').fill(name);
    await createForm.getByLabel('Descripción (opcional)').fill('Brackets metálicos');
    await createForm.getByRole('button', { name: 'Agregar' }).click();
    await expect(page.getByRole('status')).toContainText(`«${name}» agregado.`);
    const row = page.getByRole('row', { name: new RegExp(name) });
    await expect(row).toContainText('Activo');

    // Aparece en el portal
    await page.goto('/');
    await expect(page.getByRole('heading', { name, level: 3 })).toBeVisible();

    // Editar
    await page.goto('/panel/tratamientos');
    await page
      .getByRole('row', { name: new RegExp(name) })
      .getByRole('button', { name: 'Editar' })
      .click();
    await page.getByRole('textbox', { name: 'Nombre' }).last().fill(renamed);
    await page.getByRole('button', { name: 'Guardar cambios' }).click();
    await expect(page.getByRole('status')).toContainText('Cambios guardados.');

    // Desactivar: deja de verse en el portal
    const renamedRow = page.getByRole('row', { name: new RegExp(renamed) });
    await renamedRow.getByRole('button', { name: 'Desactivar' }).click();
    await expect(renamedRow).toContainText('Inactivo');
    await page.goto('/');
    await expect(page.getByRole('heading', { name: renamed, level: 3 })).toHaveCount(0);
  });

  test('un nombre repetido muestra el error de la API', async ({ page }) => {
    await loginAsDentist(page);
    const createForm = page.locator('section', {
      has: page.getByRole('heading', { name: 'Nuevo tratamiento' }),
    });
    await createForm.getByLabel('Nombre').fill('limpieza');
    await createForm.getByRole('button', { name: 'Agregar' }).click();
    await expect(createForm.getByRole('alert')).toContainText(
      'Ya existe un tratamiento con ese nombre.',
    );
  });
});
