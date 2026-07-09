/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Static export: cPanel hosting has no Node.js to run a Next.js server.
  output: 'export',
  trailingSlash: true,
  env: {
    NEXT_PUBLIC_API_BASE: process.env.NEXT_PUBLIC_API_BASE ?? '',
  },
};
export default nextConfig;
