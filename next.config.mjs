/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Option C: emit a fully static site (into ./out) that can be served straight
  // from the public repo (GitHub Pages). No server, no middleware, no API routes.
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
