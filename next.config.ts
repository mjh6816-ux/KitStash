import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Increase body size for image uploads via Server Actions
  // (we also validate client-side to 5MB)
  experimental: {
    serverActions: {
      bodySizeLimit: '8mb',
    },
  },
};

export default nextConfig;
