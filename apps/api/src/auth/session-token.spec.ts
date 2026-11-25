import { buildToken, hashSecret, newSecret, parseToken, secretMatches } from './session-token';

const ID = '3f2b8c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4e';

describe('token de sesión', () => {
  it('genera secretos distintos de 43 caracteres base64url', () => {
    const a = newSecret();
    const b = newSecret();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(a).not.toBe(b);
  });

  it('arma y vuelve a leer un token válido', () => {
    const secret = newSecret();
    expect(parseToken(buildToken(ID, secret))).toEqual({ sessionId: ID, secret });
  });

  it.each([
    undefined,
    123,
    '',
    'sin-punto',
    `${ID}.corto`,
    `no-es-uuid.${'a'.repeat(43)}`,
    `${ID}.${'a'.repeat(43)}.extra`,
  ])('rechaza tokens mal formados: %p', (token) => {
    expect(parseToken(token)).toBeNull();
  });

  it('solo coincide el secreto correcto', () => {
    const secret = newSecret();
    const stored = hashSecret(secret);
    expect(stored).toHaveLength(64);
    expect(secretMatches(secret, stored)).toBe(true);
    expect(secretMatches(newSecret(), stored)).toBe(false);
  });
});
