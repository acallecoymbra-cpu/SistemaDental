import { HealthController } from './health.controller';

describe('HealthController', () => {
  it('responde ok con fecha ISO', () => {
    const result = new HealthController().check();
    expect(result.status).toBe('ok');
    expect(result.service).toBe('api');
    expect(Number.isNaN(Date.parse(result.time))).toBe(false);
  });
});
