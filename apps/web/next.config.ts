import type { NextConfig } from 'next';

/** URL interna de la API (sin barra final). En producción la define el despliegue. */
const API_URL = (process.env.API_URL ?? 'http://localhost:3001').replace(/\/+$/, '');

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ['@sistema-dental/contracts'],
  // El lint corre como tarea propia de turbo (pnpm lint), no dentro del build.
  eslint: { ignoreDuringBuilds: true },
  /**
   * El navegador llama a /api/... en el MISMO origen que la web; Next lo reenvía a la API.
   * Así la cookie de sesión (Path=/api) funciona sin CORS y el Origin coincide con WEB_ORIGINS.
   */
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${API_URL}/api/:path*` }];
  },
};

export default nextConfig;
