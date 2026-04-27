import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'm-qa.atcdn.co.uk',
      },
      {
        protocol: 'https',
        hostname: 'm.atcdn.co.uk',
      }
    ],
  },
};

export default nextConfig;
