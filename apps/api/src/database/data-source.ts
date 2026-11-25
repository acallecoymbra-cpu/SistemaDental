import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { buildDataSourceOptions } from './data-source-options';

/** DataSource para la CLI de TypeORM (pnpm migration:*). Lee DATABASE_URL del entorno. */
const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error('DATABASE_URL no está definida (ver .env.example).');
}

export default new DataSource(buildDataSourceOptions(url));
