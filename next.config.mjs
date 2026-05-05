/** @type {import('next').NextConfig} */
const nextConfig = {
  api: {
    bodyParser: {
      sizeLimit: '50mb',
    },
  },
  experimental: {
    serverComponentsExternalPackages: ['pdf-lib', 'pdf-parse'],
    serverActions: {
      bodySizeLimit: '50mb',
    },
  },
};

export default nextConfig;
