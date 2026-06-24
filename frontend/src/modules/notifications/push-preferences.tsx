/**
 * `PushPreferences` — liga/desliga categorias de notificação push (#53).
 *
 * Lê/grava `GET|PUT /notifications/preferences`. Atualização otimista; categorias
 * transacionais (KYC, suporte, avaliação) são sempre enviadas e não aparecem aqui.
 */
"use client";

import { useEffect, useState } from "react";
import { BellRing } from "lucide-react";

import { ToggleSwitch } from "@/components/ui/toggle-switch";
import { apiGet, apiPut } from "@/services/api";

interface Prefs {
  allow_chat: boolean;
  allow_leads: boolean;
  allow_marketing: boolean;
}

const ROWS: { key: keyof Prefs; label: string; desc: string }[] = [
  { key: "allow_chat", label: "Conversas", desc: "Novas mensagens no chat." },
  {
    key: "allow_leads",
    label: "Novos pedidos",
    desc: "Pedidos na sua categoria e região.",
  },
  {
    key: "allow_marketing",
    label: "Novidades",
    desc: "Dicas, lembretes e novidades do FazTudo.",
  },
];

export function PushPreferences() {
  const [prefs, setPrefs] = useState<Prefs | null>(null);

  useEffect(() => {
    apiGet<Prefs>("/notifications/preferences")
      .then(setPrefs)
      .catch(() => {});
  }, []);

  if (!prefs) return null;

  async function toggle(key: keyof Prefs, value: boolean) {
    setPrefs((p) => (p ? { ...p, [key]: value } : p));
    try {
      await apiPut("/notifications/preferences", { [key]: value });
    } catch {
      setPrefs((p) => (p ? { ...p, [key]: !value } : p));
    }
  }

  return (
    <section className="mb-5 rounded-xl border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <BellRing className="h-4 w-4 text-primary" aria-hidden />
        <h2 className="text-sm font-bold text-foreground">
          Preferências de notificação
        </h2>
      </div>
      <ul className="space-y-3">
        {ROWS.map((r) => (
          <li key={r.key} className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">{r.label}</p>
              <p className="text-xs text-muted-foreground">{r.desc}</p>
            </div>
            <ToggleSwitch
              checked={prefs[r.key]}
              onCheckedChange={(v) => void toggle(r.key, v)}
              label={r.label}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
