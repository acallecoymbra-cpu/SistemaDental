import { expect, test } from '@playwright/test';
import { loginAsDentist } from './helpers';

/**
 * E2E de los intervalos de atención (T-02): recorre el flujo del dentista.
 * Usa una fecha lejana y distinta en cada ejecución y proyecto, para no chocar con
 * intervalos creados antes (la base E2E se limpia al empezar, pero escritorio y
 * celular corren en la misma base).
 */
function uniqueServiceDate(): { iso: string; shown: string } {
  const year = 2100 + Math.floor(Math.random() * 800);
  const month = String(1 + Math.floor(Math.random() * 12)).padStart(2, '0');
  const day = String(1 + Math.floor(Math.random() * 28)).padStart(2, '0');
  return { iso: `${year}-${month}-${day}`, shown: `${day}/${month}/${year}` };
}

test.describe('horarios de atención', () => {
  test('crear, rechazar errores, editar y eliminar un intervalo', async ({ page }) => {
    const { iso, shown } = uniqueServiceDate();

    await loginAsDentist(page);
    await page.getByRole('link', { name: 'Horarios' }).click();
    await expect(
      page.getByRole('heading', { name: 'Horarios de atención', level: 1 }),
    ).toBeVisible();

    const createForm = page.locator('section', {
      has: page.getByRole('heading', { name: 'Nuevo intervalo' }),
    });
    async function fillAndSend(start: string, end: string) {
      await createForm.getByLabel('Fecha').fill(iso);
      await createForm.getByLabel('Hora de inicio').fill(start);
      await createForm.getByLabel('Hora de fin').fill(end);
      await createForm.getByRole('button', { name: 'Agregar' }).click();
    }

    // Crear
    await fillAndSend('08:00', '12:00');
    await expect(page.getByRole('status')).toContainText('Intervalo agregado.');
    const row = page.getByRole('row', { name: new RegExp(shown) });
    await expect(row).toContainText('08:00');
    await expect(row).toContainText('12:00');

    // Superposición: la API la rechaza y el mensaje se muestra
    await fillAndSend('11:00', '14:00');
    await expect(createForm.getByRole('alert')).toContainText(
      'Ya existe un intervalo de atención que se superpone con ese horario.',
    );

    // Menos de 45 minutos
    await fillAndSend('14:00', '14:30');
    await expect(createForm.getByRole('alert')).toContainText(
      'El intervalo debe durar al menos 45 minutos.',
    );

    // Editar el fin
    await row.getByRole('button', { name: 'Editar' }).click();
    await page.getByLabel('Hora de fin').last().fill('13:00');
    await page.getByRole('button', { name: 'Guardar cambios' }).click();
    await expect(page.getByRole('status')).toContainText('Cambios guardados.');
    await expect(page.getByRole('row', { name: new RegExp(shown) })).toContainText('13:00');

    // Eliminar: primero pide confirmación, cancelar no borra
    const editedRow = page.getByRole('row', { name: new RegExp(shown) });
    await editedRow.getByRole('button', { name: 'Eliminar' }).click();
    await editedRow.getByRole('button', { name: 'Cancelar' }).click();
    await expect(editedRow).toHaveCount(1);

    await editedRow.getByRole('button', { name: 'Eliminar' }).click();
    await editedRow.getByRole('button', { name: 'Sí, eliminar' }).click();
    await expect(page.getByRole('status')).toContainText('Intervalo eliminado.');
    await expect(page.getByRole('row', { name: new RegExp(shown) })).toHaveCount(0);
  });
});
