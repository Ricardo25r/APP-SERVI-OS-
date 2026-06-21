/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Export estático: empacotável no Capacitor (app) e servível como SPA na web.
  output: "export",
  images: { unoptimized: true },
  // Rotas viram pasta/index.html (bom p/ host estático + Capacitor).
  trailingSlash: true,
};

export default nextConfig;
