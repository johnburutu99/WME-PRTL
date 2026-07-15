/** @type {import('next').NextConfig} */
const nextConfig = {
  // Standalone output for Docker multi-stage builds
  output: 'standalone',
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'wme-vault.s3.amazonaws.com',
      },
    ],
  },
};

export default nextConfig;
