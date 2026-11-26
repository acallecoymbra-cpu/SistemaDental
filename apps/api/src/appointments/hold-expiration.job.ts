import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { AppointmentHoldsService } from './appointment-holds.service';

/** Cada cuánto se revisan las reservas vencidas (T-08). */
export const HOLD_EXPIRATION_INTERVAL_MS = 60_000;

/** Número fijo del candado de PostgreSQL para esta tarea (evita que dos instancias la corran a la vez). */
const ADVISORY_LOCK_KEY = 80_801;

/**
 * Tarea programada (T-08): cada minuto cancela las reservas `por_pagar` sin comprobante cuyo
 * plazo de 8 minutos ya pasó. Sin dependencias externas: un temporizador dentro de la API.
 *
 * - Segura con varias instancias: un candado de PostgreSQL deja que solo una trabaje a la vez.
 * - Idempotente: ejecutarla dos veces seguidas no cambia nada la segunda vez.
 * - Un fallo se registra en el log y no detiene las siguientes ejecuciones.
 * - Se apaga con `HOLD_EXPIRATION_JOB=false`; en pruebas (`NODE_ENV=test`) no arranca sola.
 */
@Injectable()
export class HoldExpirationJob implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(HoldExpirationJob.name);
  private timer: NodeJS.Timeout | undefined;
  private running = false;

  constructor(
    private readonly dataSource: DataSource,
    private readonly holds: AppointmentHoldsService,
    private readonly config: ConfigService,
  ) {}

  onApplicationBootstrap(): void {
    const setting = this.config.get<string | boolean | undefined>('HOLD_EXPIRATION_JOB');
    const enabled =
      setting === undefined || setting === ''
        ? process.env.NODE_ENV !== 'test'
        : String(setting) === 'true';
    if (!enabled) {
      return;
    }
    this.timer = setInterval(() => void this.runOnce(), HOLD_EXPIRATION_INTERVAL_MS);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    clearInterval(this.timer);
  }

  /** Una pasada. Devuelve cuántas reservas canceló (0 si ya había otra pasada en curso o falló). */
  async runOnce(): Promise<number> {
    if (this.running) {
      return 0;
    }
    this.running = true;
    try {
      return await this.dataSource.transaction(async (manager) => {
        const [lock] = await manager.query<{ locked: boolean }[]>(
          'SELECT pg_try_advisory_xact_lock($1) AS locked',
          [ADVISORY_LOCK_KEY],
        );
        if (!lock?.locked) {
          return 0;
        }
        const ids = await this.holds.releaseExpired(manager, {});
        if (ids.length > 0) {
          this.logger.log(`Reservas vencidas canceladas: ${ids.length}`);
        }
        return ids.length;
      });
    } catch (error) {
      this.logger.error(
        'No se pudieron cancelar las reservas vencidas',
        error instanceof Error ? error.stack : String(error),
      );
      return 0;
    } finally {
      this.running = false;
    }
  }
}
