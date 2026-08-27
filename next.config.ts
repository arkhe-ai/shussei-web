import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  // Allow access from outside localhost (Docker/Tailscale)
  serverOptions: {
    hostname: '0.0.0.0',
    port: 3000,
  },
};

export default nextConfig;
