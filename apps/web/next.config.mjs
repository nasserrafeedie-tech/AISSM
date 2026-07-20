/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The old vercel.app address stays alive but forwards everyone (and search
  // engines, permanently) to the real domain.
  async redirects() {
    return [
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'aissm-web.vercel.app' }],
        destination: 'https://texthandled.com/:path*',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
