import { join } from 'node:path';
import type { DataSourceOptions } from 'typeorm';

/**
 * Opciones únicas de conexión para Nest, la CLI de migraciones y las pruebas.
 * synchronize siempre en false: la BD solo cambia por migraciones (AGENTS.md).
 */
export function buildDataSourceOptions(url: string): DataSourceOptions {
  return {
    type: 'postgres',
    url,
    synchronize: false,
    migrationsRun: false,
    entities: [join(__dirname, '..', '**', '*.entity.{ts,js}')],
    migrations: [join(__dirname, 'migrations', '*.{ts,js}')],
    migrationsTableName: 'schema_migrations',
    extra: { options: '-c timezone=UTC' },
  };
}
