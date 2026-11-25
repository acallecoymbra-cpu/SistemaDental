/**
 * Configuración de las pruebas E2E. Puertos distintos de los de desarrollo (3000/3001)
 * para poder correrlas con `pnpm dev` abierto. La base debe terminar en _e2e o _test.
 */
const apiPort = 3101;
const webPort = 3100;

export const E2E = {
  apiPort,
  webPort,
  apiUrl: `http://localhost:${apiPort}`,
  webUrl: `http://localhost:${webPort}`,
  databaseUrl:
    process.env.E2E_DATABASE_URL ??
    'postgres://dental:dental_dev@localhost:5432/sistema_dental_e2e',
  dentist: {
    username: 'dra.e2e',
    password: 'clave-e2e-segura-2026',
    fullName: 'Dra. E2E',
  },
} as const;
