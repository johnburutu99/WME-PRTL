/** @type {import('next').NextConfig} */
const nextConfig = {
  // Standalone output for Vercel / Docker
  output: 'standalone',
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'wme-vault.s3.amazonaws.com' },
      { protocol: 'https', hostname: '*.supabase.co' },
    ],
  },
};

export default nextConfig;
