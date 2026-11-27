import { join } from 'node:path';
import { DataSource, type QueryRunner } from 'typeorm';
import { buildDataSourceOptions } from '../../src/database/data-source-options';
import { PatientNamePartsCiPhoneCountry1765200000000 as Migration } from '../../src/database/migrations/1765200000000-PatientNamePartsCiPhoneCountry';
import { resetTestDatabase, testDatabaseUrl } from './test-database';

/**
 * Migración de pacientes a nombre por partes, país del celular y CI, con datos en el formato
 * anterior (todos inventados). Se aplican las migraciones previas y luego esta, a mano.
 */
describe('migración PatientNamePartsCiPhoneCountry (PostgreSQL real)', () => {
  let ds: DataSource;
  const migration = new Migration();
  const migrationsDir = join(__dirname, '..', '..', 'src', 'database', 'migrations');

  async function withRunner<T>(fn: (qr: QueryRunner) => Promise<T>): Promise<T> {
    const qr = ds.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      const result = await fn(qr);
      await qr.commitTransaction();
      return result;
    } catch (error) {
      await qr.rollbackTransaction();
      throw error;
    } finally {
      await qr.release();
    }
  }

  async function oldPatient(
    name: string,
    phone: string,
    extra: { guardian?: string } = {},
  ): Promise<string> {
    const [row] = await ds.query(
      `INSERT INTO patient (full_name, normalized_name, phone, origin, birth_date, is_minor,
                            guardian_phone)
       VALUES ($1, $5, $2, 'web', '2015-01-01', $3, $4) RETURNING id`,
      [name, phone, Boolean(extra.guardian), extra.guardian ?? null, name.toLowerCase()],
    );
    return row.id;
  }

  const patientRow = async (id: string) =>
    (await ds.query('SELECT * FROM patient WHERE id = $1', [id]))[0];

  beforeEach(async () => {
    await resetTestDatabase();
    ds = new DataSource({
      ...buildDataSourceOptions(testDatabaseUrl()),
      migrations: [join(migrationsDir, '1764*.ts'), join(migrationsDir, '1765[01]*.ts')],
    });
    await ds.initialize();
    await ds.runMigrations({ transaction: 'each' });
    await ds.query(`UPDATE clinic_settings SET whatsapp_phone = '79000000'`);
  });

  afterEach(async () => {
    await ds?.destroy();
  });

  it('separa nombres, deduce el país y corrige el WhatsApp sin prefijo', async () => {
    const ana = await oldPatient('Ana', '70000001');
    const juan = await oldPatient('Juan Pérez de la Roca', '5491123456789');
    const luis = await oldPatient('Luis Gómez', '70000002', { guardian: '71000000' });

    await withRunner((qr) => migration.up(qr));

    expect(await patientRow(ana)).toMatchObject({
      given_names: 'Ana',
      first_surname: 'Ana',
      second_surname: null,
      first_given_name_key: 'ana',
      first_surname_key: 'ana',
      phone_country_code: '591',
      phone: '70000001',
      ci: null,
    });
    expect(await patientRow(juan)).toMatchObject({
      given_names: 'Juan',
      first_surname: 'Pérez de la Roca',
      first_surname_key: 'perezdelaroca',
      phone_country_code: '54',
      phone: '91123456789',
      full_name: 'Juan Pérez de la Roca',
    });
    expect(await patientRow(luis)).toMatchObject({
      given_names: 'Luis',
      first_surname: 'Gómez',
      guardian_phone_country_code: '591',
      guardian_phone: '71000000',
    });
    const [settings] = await ds.query('SELECT whatsapp_phone FROM clinic_settings');
    expect(settings.whatsapp_phone).toBe('+59179000000');
  });

  it('falla con un mensaje claro si no puede deducir el país de un celular', async () => {
    await oldPatient('Eva Rojas', '9876543');
    await expect(withRunner((qr) => migration.up(qr))).rejects.toThrow(
      /no se pudo deducir el país/,
    );
  });

  it('al revertir, rearma los celulares extranjeros y la unicidad anterior', async () => {
    const juan = await oldPatient('Juan Pérez', '5491123456789');
    await withRunner((qr) => migration.up(qr));
    await withRunner((qr) => migration.down(qr));

    const row = await patientRow(juan);
    expect(row.phone).toBe('5491123456789');
    expect(row.given_names).toBeUndefined();
    const constraints = await ds.query(
      `SELECT conname FROM pg_constraint WHERE conname = 'patient_name_phone_uq'`,
    );
    expect(constraints).toHaveLength(1);
  });

  it('no revierte si un celular extranjero ya no cabe en la columna anterior', async () => {
    await withRunner((qr) => migration.up(qr));
    await ds.query(
      `INSERT INTO patient (full_name, normalized_name, given_names, first_surname,
                            first_given_name_key, given_names_key, first_surname_key,
                            phone_country_code, phone, origin)
       VALUES ('Rosa Vera', 'rosa vera', 'Rosa', 'Vera', 'rosa', 'rosa', 'vera', '595',
               '12345678901234', 'dentist')`,
    );
    await expect(withRunner((qr) => migration.down(qr))).rejects.toThrow(/no cabe/);
  });
});
