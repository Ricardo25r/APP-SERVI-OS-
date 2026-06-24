"use client";

/**
 * `FavoriteButton` — salva/remove um profissional dos favoritos do cliente.
 * `POST /users/favorites` / `DELETE /users/favorites/{id}`.
 */

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Heart, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { apiDelete, apiPost } from "@/services/api";
import { cn } from "@/lib/utils";

export function FavoriteButton({
  proUserId,
  initial,
}: {
  proUserId: string;
  initial?: boolean;
}) {
  const queryClient = useQueryClient();
  const [fav, setFav] = useState(Boolean(initial));
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    const next = !fav;
    try {
      if (next) {
        await apiPost("/users/favorites", { professional_user_id: proUserId });
      } else {
        await apiDelete(`/users/favorites/${proUserId}`);
      }
      setFav(next);
      queryClient.invalidateQueries({ queryKey: ["favorites"] });
    } catch {
      /* mantém o estado anterior */
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      onClick={() => void toggle()}
      disabled={busy}
      aria-pressed={fav}
      className={cn("gap-1.5", fav && "border-destructive/40 text-destructive")}
    >
      {busy ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      ) : (
        <Heart
          className={cn("h-4 w-4", fav && "fill-current")}
          aria-hidden
        />
      )}
      {fav ? "Salvo" : "Salvar"}
    </Button>
  );
}
