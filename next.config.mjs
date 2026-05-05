/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['pdf-lib', 'pdf-parse'],
    serverActions: {
      bodySizeLimit: '50mb',
    },
  },
};

export default nextConfig;
