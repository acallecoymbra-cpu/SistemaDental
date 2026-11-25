import { Controller, Get } from '@nestjs/common';
import type { HealthResponse } from '@sistema-dental/contracts';
import { DataSource } from 'typeorm';

@Controller('health')
export class HealthController {
  constructor(private readonly dataSource: DataSource) {}

  @Get()
  async check(): Promise<HealthResponse> {
    let database: HealthResponse['database'] = 'up';
    try {
      await this.dataSource.query('SELECT 1');
    } catch {
      database = 'down';
    }
    return { status: 'ok', service: 'api', database, time: new Date().toISOString() };
  }
}
