/**
 * `MarketingShell` — moldura do site institucional: header + conteúdo + footer.
 *
 * Reutilizada em dois lugares:
 * - `app/(site)/layout.tsx` (todas as páginas do grupo de marketing);
 * - a home web (`/`), renderizada condicionalmente quando o visitante está no
 *   navegador (fora do app nativo).
 *
 * Mantém header/footer consistentes num só lugar (DRY).
 */

import { MarketingHeader } from "@/modules/site/marketing-header";
import { MarketingFooter } from "@/modules/site/marketing-footer";

export function MarketingShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <MarketingHeader />
      <main className="flex-1">{children}</main>
      <MarketingFooter />
    </div>
  );
}
