import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmailOutboxService } from './email-outbox.service';

/** Cada cuánto se revisa la cola de correos (T-13). */
export const EMAIL_OUTBOX_INTERVAL_MS = 30_000;

/**
 * Temporizador de la cola de correos. Igual que la tarea de vencimiento: sin dependencias,
 * se apaga con `EMAIL_OUTBOX_JOB=false` y en pruebas (`NODE_ENV=test`) no arranca sola.
 */
@Injectable()
export class EmailOutboxJob implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(EmailOutboxJob.name);
  private timer: NodeJS.Timeout | undefined;
  private running = false;

  constructor(
    private readonly outbox: EmailOutboxService,
    private readonly config: ConfigService,
  ) {}

  onApplicationBootstrap(): void {
    const setting = this.config.get<string | boolean | undefined>('EMAIL_OUTBOX_JOB');
    const enabled =
      setting === undefined || setting === ''
        ? process.env.NODE_ENV !== 'test'
        : String(setting) === 'true';
    if (!enabled) {
      return;
    }
    this.timer = setInterval(() => void this.runOnce(), EMAIL_OUTBOX_INTERVAL_MS);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    clearInterval(this.timer);
  }

  async runOnce(): Promise<number> {
    if (this.running) {
      return 0;
    }
    this.running = true;
    try {
      return await this.outbox.processDue();
    } catch (error) {
      this.logger.error(
        'No se pudo procesar la cola de correos',
        error instanceof Error ? error.stack : String(error),
      );
      return 0;
    } finally {
      this.running = false;
    }
  }
}
