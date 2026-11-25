import { envValidationSchema } from './env.validation';

const base = {
  DATABASE_URL: 'postgres://u:p@localhost:5432/db',
  WEB_ORIGINS: 'http://localhost:3000',
};

function validate(env: Record<string, string>) {
  return envValidationSchema.validate(env, { allowUnknown: true });
}

describe('validación de variables de entorno', () => {
  it('acepta la configuración mínima de desarrollo', () => {
    expect(validate(base).error).toBeUndefined();
  });

  it('en desarrollo acepta AUDIT_IP_SALT vacía', () => {
    expect(validate({ ...base, AUDIT_IP_SALT: '' }).error).toBeUndefined();
  });

  it('en producción exige AUDIT_IP_SALT de al menos 32 caracteres', () => {
    const prod = { ...base, NODE_ENV: 'production' };
    expect(validate(prod).error).toBeDefined();
    expect(validate({ ...prod, AUDIT_IP_SALT: 'corta' }).error).toBeDefined();
    expect(validate({ ...prod, AUDIT_IP_SALT: 'x'.repeat(32) }).error).toBeUndefined();
  });

  it('exige WEB_ORIGINS con http(s) y rechaza valores inválidos', () => {
    expect(validate({ DATABASE_URL: base.DATABASE_URL }).error).toBeDefined();
    expect(validate({ ...base, WEB_ORIGINS: 'localhost:3000' }).error).toBeDefined();
    expect(
      validate({ ...base, WEB_ORIGINS: 'http://localhost:3000, https://ejemplo.bo' }).error,
    ).toBeUndefined();
  });

  it('TRUST_PROXY y COOKIE_SECURE aceptan true/false', () => {
    expect(
      validate({ ...base, TRUST_PROXY: 'false', COOKIE_SECURE: 'true' }).error,
    ).toBeUndefined();
    expect(validate({ ...base, TRUST_PROXY: 'quizas' }).error).toBeDefined();
  });
});
