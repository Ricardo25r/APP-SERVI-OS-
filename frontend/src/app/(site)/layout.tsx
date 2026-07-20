/**
 * Layout do grupo de rotas `(site)` — o site institucional público.
 *
 * Envolve todas as páginas de marketing (para-contratantes, para-profissionais,
 * categorias, sobre, contato, baixar) na `MarketingShell` (header + footer
 * próprios). O `SiteHeader` do app e o bottom-nav se ocultam nessas rotas
 * (ver `site-header.tsx` / `AppChrome`).
 */

import { MarketingShell } from "@/modules/site/marketing-shell";

export default function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <MarketingShell>{children}</MarketingShell>;
}
