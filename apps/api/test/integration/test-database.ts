import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseEnv } from 'node:util';
import { DataSource } from 'typeorm';
import { buildDataSourceOptions } from '../../src/database/data-source-options';

// Jest aísla process.env por archivo de prueba; por eso se copian los valores
// del .env raíz a mano (sin pisar los que ya vienen del entorno, como en CI).
const rootEnv = join(__dirname, '..', '..', '..', '..', '.env');
if (existsSync(rootEnv)) {
  for (const [key, value] of Object.entries(parseEnv(readFileSync(rootEnv, 'utf8')))) {
    process.env[key] ??= value;
  }
}

/**
 * URL de la base de pruebas. Se exige que el nombre termine en "_test" para no
 * borrar nunca la base de desarrollo ni la de producción por error.
 */
export function testDatabaseUrl(): string {
  const url = process.env.DATABASE_URL_TEST;
  if (!url) {
    throw new Error('DATABASE_URL_TEST no está definida (ver .env.example).');
  }
  const name = new URL(url).pathname.replace(/^\//, '');
  if (!name.endsWith('_test')) {
    throw new Error(`La base de pruebas debe terminar en "_test" (se recibió "${name}").`);
  }
  return url;
}

/** Deja la base de pruebas vacía: borra y recrea el esquema public. */
export async function resetTestDatabase(): Promise<void> {
  const ds = new DataSource({ type: 'postgres', url: testDatabaseUrl() });
  await ds.initialize();
  try {
    await ds.query('DROP SCHEMA IF EXISTS public CASCADE');
    await ds.query('CREATE SCHEMA public');
    await ds.query('DROP EXTENSION IF EXISTS btree_gist');
  } finally {
    await ds.destroy();
  }
}

export function createTestDataSource(): DataSource {
  return new DataSource(buildDataSourceOptions(testDatabaseUrl()));
}
