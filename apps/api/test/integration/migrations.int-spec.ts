import type { DataSource } from 'typeorm';
import { createTestDataSource, resetTestDatabase } from './test-database';

async function hasExtension(ds: DataSource, name: string): Promise<boolean> {
  const rows: unknown[] = await ds.query('SELECT 1 FROM pg_extension WHERE extname = $1', [name]);
  return rows.length === 1;
}

describe('migraciones (PostgreSQL real)', () => {
  let ds: DataSource;

  beforeAll(async () => {
    await resetTestDatabase();
    ds = createTestDataSource();
    await ds.initialize();
  });

  afterAll(async () => {
    await ds?.destroy();
  });

  it('synchronize está desactivado', () => {
    expect(ds.options.synchronize).toBe(false);
  });

  it('aplica todas las migraciones sobre una base vacía', async () => {
    const applied = await ds.runMigrations({ transaction: 'each' });
    expect(applied.length).toBeGreaterThan(0);
    expect(await ds.showMigrations()).toBe(false);
    expect(await hasExtension(ds, 'btree_gist')).toBe(true);
  });

  it('revierte todas las migraciones y las vuelve a aplicar', async () => {
    const total = ds.migrations.length;
    for (let i = 0; i < total; i++) {
      await ds.undoLastMigration({ transaction: 'each' });
    }
    expect(await hasExtension(ds, 'btree_gist')).toBe(false);

    const reapplied = await ds.runMigrations({ transaction: 'each' });
    expect(reapplied).toHaveLength(total);
  });
});
