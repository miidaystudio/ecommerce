import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dirname = path.dirname(fileURLToPath(import.meta.url));

// Product images are served by the API, not from /public, so next/image needs
// that origin allow-listed before it will optimize them. Derived from the same
// env var lib/api/client.ts uses, so the two can't drift apart.
const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';
const apiOrigin = new URL(apiUrl);

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@ecommerce/shared-types'],
  outputFileTracingRoot: path.join(dirname, '../../'),
  images: {
    remotePatterns: [
      {
        protocol: apiOrigin.protocol.replace(':', ''),
        hostname: apiOrigin.hostname,
        ...(apiOrigin.port ? { port: apiOrigin.port } : {}),
        // Scoped to the uploads path — not a blanket allow-list for the host.
        pathname: '/uploads/**',
      },
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        pathname: '/**',
      },
    ],
    // Matches the widths the product grid and detail image actually request,
    // so the optimizer isn't generating sizes nothing asks for.
    deviceSizes: [375, 640, 750, 828, 1080, 1200, 1920],
    imageSizes: [48, 64, 96, 128, 256, 384],
  },
};

export default nextConfig;
