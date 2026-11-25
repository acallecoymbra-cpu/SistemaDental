import Joi from 'joi';

/** Variables de entorno obligatorias. La API no arranca si falta alguna o es inválida. */
export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
  PORT: Joi.number().port().default(3001),
  DATABASE_URL: Joi.string()
    .uri({ scheme: ['postgres', 'postgresql'] })
    .required(),
  /** Orígenes de la web separados por coma, p. ej. "http://localhost:3000". */
  WEB_ORIGINS: Joi.string()
    .pattern(/^https?:\/\/[^\s,]+(\s*,\s*https?:\/\/[^\s,]+)*$/)
    .required(),
  /** true cuando la API corre detrás de Nginx (producción). */
  TRUST_PROXY: Joi.boolean().default(false),
});
