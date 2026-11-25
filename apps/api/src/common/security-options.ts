import type { ConfigService } from '@nestjs/config';

/** Opciones de seguridad HTTP de la API (B-03). */
export interface SecurityOptions {
  /** Orígenes web permitidos (CORS y verificación de origen en métodos que modifican datos). */
  allowedOrigins: readonly string[];
  /** true detrás de un proxy inverso (Nginx) para respetar X-Forwarded-For/Proto. */
  trustProxy: boolean;
}

export function parseOrigins(value: string): string[] {
  return value
    .split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter((origin) => origin.length > 0);
}

export function securityOptionsFromConfig(config: ConfigService): SecurityOptions {
  return {
    allowedOrigins: parseOrigins(config.getOrThrow<string>('WEB_ORIGINS')),
    trustProxy: config.get<boolean>('TRUST_PROXY') ?? false,
  };
}
