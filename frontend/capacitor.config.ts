import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Capacitor — app nativo do FazTudo.
 *
 * O app **carrega o site ao vivo** (`server.url`): toda atualização de tela
 * publicada em produção aparece no app na próxima abertura, **sem rebuildar
 * nem reenviar à Play Store**. Só mudanças nativas (ícone, splash, plugins,
 * permissões) exigem um novo APK/AAB. `webDir` fica como fallback do build.
 */
const config: CapacitorConfig = {
  appId: "br.com.faztudo.app",
  appName: "FazTudo",
  webDir: "out",
  server: {
    androidScheme: "https",
    url: "https://faztudoapp.com.br",
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      backgroundColor: "#FFFFFF",
      showSpinner: false,
      androidScaleType: "CENTER_CROP",
    },
  },
};

export default config;
