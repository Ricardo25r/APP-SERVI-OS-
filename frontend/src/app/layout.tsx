import type { Metadata, Viewport } from "next";
import { Montserrat } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { SiteHeader } from "@/components/site-header";
import { AppChrome } from "@/components/app-shell/app-chrome";
import { CapacitorInit } from "@/components/capacitor-init";

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  style: ["normal", "italic"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "FazTudo",
  description: "Marketplace de prestadores de serviços locais",
  icons: {
    icon: "/brand/logo-icon.png",
    apple: "/brand/logo-icon.png",
  },
};

// App-like: trava o zoom (mantém a tela enquadrada). SEM viewport-fit=cover —
// assim o iOS mantém cabeçalho e barra inferior dentro da área segura (sem corte
// pelo notch / home indicator).
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0D47A1",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      suppressHydrationWarning
      className={montserrat.variable}
    >
      <body className="font-sans">
        <Providers>
          <CapacitorInit />
          <SiteHeader />
          <AppChrome>{children}</AppChrome>
        </Providers>
      </body>
    </html>
  );
}
