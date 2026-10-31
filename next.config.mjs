/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  serverExternalPackages: ['pg'],
  experimental: {
    // Photos are resized in the browser first (~200-500 KB); this leaves headroom for un-resized uploads.
    serverActions: { bodySizeLimit: '8mb' },
  },
};

export default nextConfig;
