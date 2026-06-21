import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Capacitor — empacota o export estático do Next (`out/`) como app nativo.
 * As chamadas de rede vão pra API HTTPS pública (NEXT_PUBLIC_API_URL), nunca
 * localhost/cleartext. `androidScheme:'https'` → origem da WebView = https://localhost.
 */
const config: CapacitorConfig = {
  appId: "br.com.faztudo.app",
  appName: "FazTudo",
  webDir: "out",
  server: {
    androidScheme: "https",
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      backgroundColor: "#0D47A1",
      showSpinner: false,
      androidScaleType: "CENTER_CROP",
    },
  },
};

export default config;
