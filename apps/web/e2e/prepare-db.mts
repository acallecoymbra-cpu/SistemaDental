import { hash } from '@node-rs/argon2';
import { execSync } from 'node:child_process';
import { resolve } from 'node:path';
import pg from 'pg';
import { E2E } from './e2e-env.ts';

/**
 * Prepara una base limpia ANTES de las pruebas E2E (se ejecuta con `node`, antes de
 * `playwright test`, porque Playwright arranca la API antes de su globalSetup):
 * 1. crea la base si no existe; 2. la vacía; 3. aplica las migraciones reales;
 * 4. crea al dentista de prueba (sin contraseña temporal).
 */
async function prepare(): Promise<void> {
  const url = new URL(E2E.databaseUrl);
  const dbName = url.pathname.replace(/^\//, '');
  if (!/_(e2e|test)$/.test(dbName)) {
    throw new Error(`La base E2E debe terminar en _e2e o _test (se recibió "${dbName}").`);
  }

  const adminUrl = new URL(E2E.databaseUrl);
  adminUrl.pathname = '/postgres';
  const admin = new pg.Client({ connectionString: adminUrl.toString() });
  await admin.connect();
  const exists = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
  if (exists.rowCount === 0) {
    await admin.query(`CREATE DATABASE "${dbName}"`);
  }
  await admin.end();

  const db = new pg.Client({ connectionString: E2E.databaseUrl });
  await db.connect();
  await db.query('DROP SCHEMA IF EXISTS public CASCADE');
  await db.query('CREATE SCHEMA public');
  await db.query('DROP EXTENSION IF EXISTS btree_gist');
  await db.end();

  execSync('pnpm run migration:run', {
    cwd: resolve(import.meta.dirname, '../../api'),
    env: { ...process.env, DATABASE_URL: E2E.databaseUrl },
    stdio: 'pipe',
  });

  const seed = new pg.Client({ connectionString: E2E.databaseUrl });
  await seed.connect();
  await seed.query(
    `INSERT INTO dentist_user (username, password_hash, full_name, must_change_password)
     VALUES ($1, $2, $3, false)`,
    [E2E.dentist.username, await hash(E2E.dentist.password), E2E.dentist.fullName],
  );
  await seed.end();
  console.warn(`Base E2E lista: ${dbName}`);
}

await prepare();
