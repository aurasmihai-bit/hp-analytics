/** @type {import('next').NextConfig} */
const nextConfig = {
  // Dashboard privat: nu se indexează de motoare de căutare sau crawlere AI.
  async headers() {
    return [{
      source: '/:path*',
      headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive, nosnippet, noimageindex, noai, noimageai' }],
    }]
  },
}
module.exports = nextConfig
