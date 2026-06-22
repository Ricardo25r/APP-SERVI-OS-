// `output:'export'` + `trailingSlash` só no BUILD de produção (app/estático,
// via `next build`). Em `next dev` ficam DESLIGADOS → navegação SPA padrão do
// Next, sem redirects 308 nem as restrições do export. Melhor DX e o build do
// app (`build:app`) continua exportando normalmente (NODE_ENV=production).
const isProd = process.env.NODE_ENV === "production";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: { unoptimized: true },
  ...(isProd ? { output: "export", trailingSlash: true } : {}),
};

export default nextConfig;
