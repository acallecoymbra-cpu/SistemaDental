import { HoldExpirationJob, HOLD_EXPIRATION_INTERVAL_MS } from './hold-expiration.job';

/** Pruebas unitarias del temporizador (sin base de datos): arranque, apagado y errores. */
function makeJob(opts: { setting?: string | boolean; nodeEnv?: string; fail?: boolean } = {}) {
  const calls: string[] = [];
  const dataSource = {
    transaction: jest.fn(async (fn: (m: unknown) => Promise<number>) => {
      calls.push('tx');
      if (opts.fail) {
        throw new Error('boom');
      }
      return fn({ query: async () => [{ locked: true }] });
    }),
  };
  const holds = { releaseExpired: jest.fn(async () => ['a', 'b']) };
  const config = { get: () => opts.setting };
  const job = new HoldExpirationJob(dataSource as never, holds as never, config as never);
  /** Arranca la tarea como si la API corriera con ese NODE_ENV. */
  const start = () => {
    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = opts.nodeEnv ?? 'development';
    try {
      job.onApplicationBootstrap();
    } finally {
      process.env.NODE_ENV = previous;
    }
  };
  return { job, start, dataSource, holds, calls };
}

describe('HoldExpirationJob', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('arranca y ejecuta una pasada cada minuto', async () => {
    const { job, start, dataSource } = makeJob();
    start();
    await jest.advanceTimersByTimeAsync(HOLD_EXPIRATION_INTERVAL_MS * 3);
    expect(dataSource.transaction).toHaveBeenCalledTimes(3);
    job.onModuleDestroy();
    await jest.advanceTimersByTimeAsync(HOLD_EXPIRATION_INTERVAL_MS * 3);
    expect(dataSource.transaction).toHaveBeenCalledTimes(3);
  });

  it('en pruebas no arranca, salvo que se active expresamente', async () => {
    const off = makeJob({ nodeEnv: 'test' });
    off.start();
    await jest.advanceTimersByTimeAsync(HOLD_EXPIRATION_INTERVAL_MS * 2);
    expect(off.dataSource.transaction).not.toHaveBeenCalled();

    const on = makeJob({ nodeEnv: 'test', setting: true });
    on.start();
    await jest.advanceTimersByTimeAsync(HOLD_EXPIRATION_INTERVAL_MS);
    expect(on.dataSource.transaction).toHaveBeenCalledTimes(1);
    on.job.onModuleDestroy();
  });

  it('HOLD_EXPIRATION_JOB=false la apaga', async () => {
    const { start, dataSource } = makeJob({ setting: false });
    start();
    await jest.advanceTimersByTimeAsync(HOLD_EXPIRATION_INTERVAL_MS * 2);
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('un fallo no se propaga y la siguiente pasada funciona', async () => {
    const { job } = makeJob({ fail: true });
    await expect(job.runOnce()).resolves.toBe(0);
    await expect(job.runOnce()).resolves.toBe(0);
  });

  it('devuelve cuántas canceló', async () => {
    const { job } = makeJob();
    await expect(job.runOnce()).resolves.toBe(2);
  });
});
