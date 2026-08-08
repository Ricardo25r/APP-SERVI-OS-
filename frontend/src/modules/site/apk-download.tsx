"use client";

/**
 * `ApkDownloadButton` — download direto do APK (Android), enquanto o app não
 * está na Play Store. Detecta Android para ajustar a dica de instalação; em
 * outros dispositivos o botão continua funcionando (baixa o arquivo).
 *
 * O APK é servido estaticamente pelo site (`APK_URL`, em `public/downloads`).
 */

import * as React from "react";
import { Download, ShieldQuestion } from "lucide-react";

import { cn } from "@/lib/utils";
import { APK_URL } from "@/modules/site/site-config";

export function ApkDownloadButton({
  tone = "dark",
  className,
}: {
  tone?: "dark" | "light";
  className?: string;
}) {
  const [isAndroid, setIsAndroid] = React.useState(false);

  React.useEffect(() => {
    setIsAndroid(/android/i.test(navigator.userAgent));
  }, []);

  return (
    <div className={cn("flex flex-col items-center gap-2 sm:items-start", className)}>
      <a
        href={APK_URL}
        download
        className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand px-6 py-3.5 text-base font-bold text-brand-foreground shadow-lg transition-colors hover:bg-brand/90"
      >
        <Download className="h-5 w-5" aria-hidden />
        Baixar app para Android
      </a>
      <p
        className={cn(
          "flex items-center gap-1.5 text-xs",
          tone === "dark" ? "text-blue-100/80" : "text-muted-foreground"
        )}
      >
        <ShieldQuestion className="h-3.5 w-3.5 shrink-0" aria-hidden />
        {isAndroid
          ? "Após baixar, toque no arquivo e permita “instalar de fontes desconhecidas”."
          : "Instalação direta (APK). Abra pelo celular Android para instalar."}
      </p>
    </div>
  );
}
