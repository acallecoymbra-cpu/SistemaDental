import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ['@sistema-dental/contracts'],
  // El lint corre como tarea propia de turbo (pnpm lint), no dentro del build.
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
