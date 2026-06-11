/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: process.cwd(),
  // Silencia la advertencia de múltiples lockfiles
  experimental: {
    externalDir: true,
  },
};

export default nextConfig;