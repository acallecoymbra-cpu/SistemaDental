import type { DataSource } from 'typeorm';
import { HealthController } from './health.controller';

const fakeDataSource = (ok: boolean) =>
  ({
    query: jest.fn(
      ok
        ? () => Promise.resolve([{ '?column?': 1 }])
        : () => Promise.reject(new Error('sin conexión')),
    ),
  }) as unknown as DataSource;

describe('HealthController', () => {
  it('responde ok con BD disponible', async () => {
    const result = await new HealthController(fakeDataSource(true)).check();
    expect(result).toMatchObject({ status: 'ok', service: 'api', database: 'up' });
    expect(Number.isNaN(Date.parse(result.time))).toBe(false);
  });

  it('informa la BD caída sin lanzar error ni exponer detalles', async () => {
    const result = await new HealthController(fakeDataSource(false)).check();
    expect(result.database).toBe('down');
    expect(JSON.stringify(result)).not.toContain('sin conexión');
  });
});
