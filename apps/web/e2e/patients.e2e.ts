import { expect, test } from '@playwright/test';
import { loginAsDentist } from './helpers';

/** E2E de pacientes (T-05): alta, duplicado, celular compartido, menor y búsqueda. Datos inventados. */
function uniquePhone(): string {
  return `7${String(Math.floor(Math.random() * 10_000_000)).padStart(7, '0')}`;
}

test.describe('pacientes', () => {
  test('crear, evitar duplicados, avisar celular compartido, menor y buscar', async ({
    page,
  }, testInfo) => {
    const tag = `${testInfo.project.name}${Date.now().toString(36)}`;
    const name = `Paciente ${tag}`;
    const phone = uniquePhone();

    await loginAsDentist(page);
    await page.getByRole('link', { name: 'Pacientes' }).click();
    await expect(page.getByRole('heading', { name: 'Pacientes', level: 1 })).toBeVisible();

    const createForm = page.locator('section', {
      has: page.getByRole('heading', { name: 'Nuevo paciente' }),
    });
    async function fill(
      fullName: string,
      cellphone: string,
      extra?: { birth?: string; guardian?: string },
    ) {
      await createForm.getByLabel('Nombre completo').fill(fullName);
      await createForm.getByLabel('Celular', { exact: true }).fill(cellphone);
      await createForm.getByLabel('Fecha de nacimiento (opcional)').fill(extra?.birth ?? '');
      await createForm.getByLabel('Celular del apoderado').fill(extra?.guardian ?? '');
      await createForm.getByRole('button', { name: 'Agregar' }).click();
    }

    // Crear
    await fill(name, phone);
    await expect(page.getByRole('status').first()).toContainText(`«${name}» agregado.`);
    await expect(page.getByRole('row', { name: new RegExp(name) })).toContainText(phone);

    // Duplicado: mismo nombre (otras mayúsculas) y mismo celular
    await fill(name.toUpperCase(), phone);
    await expect(createForm.locator('.alert-error')).toContainText(
      'Ya existe un paciente con ese nombre y celular.',
    );

    // Mismo celular con otro nombre: se guarda y avisa
    const sibling = `Hermano ${tag}`;
    await fill(sibling, phone);
    await expect(page.getByRole('status').first()).toContainText(`«${sibling}» agregado.`);
    await expect(page.getByText('Ese celular ya está registrado con otro nombre.')).toBeVisible();

    // Menor sin apoderado: error; con apoderado: queda con la etiqueta
    const child = `Menor ${tag}`;
    const birth = `${new Date().getFullYear() - 8}-06-15`;
    await fill(child, uniquePhone(), { birth });
    await expect(createForm.locator('.alert-error')).toContainText(
      'menor de edad necesita el celular',
    );
    await fill(child, uniquePhone(), { birth, guardian: uniquePhone() });
    await expect(page.getByRole('status').first()).toContainText(`«${child}» agregado.`);

    // Buscar por nombre: la lista se acota
    await page.getByLabel('Buscar por nombre o celular').fill(tag);
    await page.getByRole('button', { name: 'Buscar' }).click();
    await expect(page.getByRole('row', { name: new RegExp(child) })).toContainText('Menor');
    await expect(page.getByRole('row', { name: new RegExp(sibling) })).toBeVisible();

    // Buscar algo que no existe
    await page.getByLabel('Buscar por nombre o celular').fill('zzz-no-existe-zzz');
    await page.getByRole('button', { name: 'Buscar' }).click();
    await expect(page.getByText('No se encontraron pacientes con ese dato.')).toBeVisible();

    // Editar
    await page.getByLabel('Buscar por nombre o celular').fill(name);
    await page.getByRole('button', { name: 'Buscar' }).click();
    const row = page.getByRole('row').filter({ hasText: name });
    await row.getByRole('button', { name: 'Editar' }).click();
    await page.getByLabel('Correo (opcional)').last().fill('nuevo@ejemplo.test');
    await page.getByRole('button', { name: 'Guardar cambios' }).click();
    await expect(page.getByRole('status').first()).toContainText('Cambios guardados.');
  });
});
