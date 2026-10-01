import type { NextConfig } from 'next';

const pagesBasePath = process.env.NEXT_PUBLIC_BASE_PATH || undefined;

const nextConfig: NextConfig = {
  ...(process.env.STAMSTAFF_STATIC_EXPORT === '1' ? { output: 'export' as const } : {}),
  basePath: pagesBasePath,
};

export default nextConfig;
