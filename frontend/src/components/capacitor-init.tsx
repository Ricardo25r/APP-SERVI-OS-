"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Inicialização específica do app nativo (Capacitor). Em web é no-op total:
 * sai cedo via `Capacitor.isNativePlatform()` e nem carrega os plugins.
 * No app: status bar azul da marca, esconde a splash quando a web está pronta
 * e trata o botão "voltar" do Android (volta na história; na raiz, minimiza).
 */
export function CapacitorInit() {
  const router = useRouter();

  useEffect(() => {
    let dispose: (() => void) | undefined;

    (async () => {
      const { Capacitor } = await import("@capacitor/core");
      if (!Capacitor.isNativePlatform()) return;

      const [{ StatusBar, Style }, { SplashScreen }, { App }] = await Promise.all([
        import("@capacitor/status-bar"),
        import("@capacitor/splash-screen"),
        import("@capacitor/app"),
      ]);

      try {
        await StatusBar.setStyle({ style: Style.Dark }); // texto claro sobre o azul
        await StatusBar.setBackgroundColor({ color: "#0D47A1" });
      } catch {
        /* status bar pode não existir em alguns devices — ignora */
      }

      try {
        await SplashScreen.hide();
      } catch {
        /* splash já escondida — ignora */
      }

      const backHandle = await App.addListener("backButton", ({ canGoBack }) => {
        if (canGoBack || window.history.length > 1) {
          router.back();
        } else {
          void App.exitApp();
        }
      });

      dispose = () => {
        void backHandle.remove();
      };
    })();

    return () => dispose?.();
  }, [router]);

  return null;
}
