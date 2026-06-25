/**
 * `ProfileHeaderCard` — cartão de cabeçalho do perfil (Telas 16/21/22):
 * Avatar + nome + e-mail + badge do papel, e, quando profissional, uma faixa
 * com nota/avaliações e nível/XP.
 *
 * Componente **apenas visual** — recebe os dados já carregados pelas seções
 * (a lógica de fetch permanece nas seções de customer/professional).
 */
"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { BadgeCheck, Camera, Loader2, Mail, Phone } from "lucide-react";

import { Avatar } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { StarRating } from "@/modules/reviews/star-rating";
import { LevelBadge } from "@/modules/gamification/level-badge";
import { formatXp } from "@/modules/gamification/utils";
import { apiUpload } from "@/services/api";
import { useAuthStore } from "@/store/auth";
import type { User, UserRole } from "@/types";

const ROLE_LABEL: Record<UserRole, string> = {
  customer: "Contratante",
  professional: "Profissional",
  admin: "Administrador",
};

interface ProfileReputation {
  rating: number;
  totalReviews: number;
  level: number;
  levelName?: string | null;
  xp: number;
}

interface ProfileHeaderCardProps {
  user: User;
  /** Reputação/nível — exibida só quando o usuário é profissional com perfil. */
  reputation?: ProfileReputation;
}

export function ProfileHeaderCard({ user, reputation }: ProfileHeaderCardProps) {
  const setUser = useAuthStore((s) => s.setUser);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function onPickAvatar(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ""; // permite reenviar a mesma foto depois
    if (!file || !file.type.startsWith("image/")) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const updated = await apiUpload<User>("/users/me/avatar", form);
      setUser({ ...user, ...updated });
    } catch {
      /* mantém o avatar atual em caso de falha */
    } finally {
      setUploading(false);
    }
  }

  return (
    <Card className="overflow-hidden">
      <CardContent className="space-y-4 p-5 sm:p-6">
        <div className="flex items-center gap-4">
          <div className="relative shrink-0" data-tour="profile-avatar">
            <Avatar src={user.avatar_url} name={user.name} size="lg" />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              aria-label="Alterar foto"
              className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-brand text-brand-foreground shadow ring-2 ring-card transition-colors hover:bg-brand/90 disabled:opacity-60"
            >
              {uploading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              ) : (
                <Camera className="h-3.5 w-3.5" aria-hidden />
              )}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={onPickAvatar}
            />
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-lg font-bold leading-tight tracking-tight">
                {user.name}
              </h2>
              <StatusBadge
                label={ROLE_LABEL[user.role]}
                tone="info"
                className="shrink-0"
              />
              {user.kyc_status === "approved" ? (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-xs font-semibold text-success">
                  <BadgeCheck className="h-3.5 w-3.5" aria-hidden />
                  Verificado
                </span>
              ) : null}
            </div>
            <p className="flex items-center gap-1.5 truncate text-sm text-muted-foreground">
              <Mail className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span className="truncate">{user.email}</span>
            </p>
            {user.phone ? (
              <p className="flex items-center gap-1.5 truncate text-sm text-muted-foreground">
                <Phone className="h-3.5 w-3.5 shrink-0" aria-hidden />
                <span className="truncate">{user.phone}</span>
              </p>
            ) : null}
          </div>
        </div>

        {reputation ? (
          <div className="grid grid-cols-2 gap-3 rounded-xl bg-muted/50 p-3">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">
                Reputação
              </p>
              <div className="flex items-center gap-1.5">
                <span className="text-lg font-bold leading-none">
                  {reputation.rating.toFixed(1)}
                </span>
                <StarRating value={reputation.rating} size="sm" />
              </div>
              <p className="text-xs text-muted-foreground">
                {reputation.totalReviews === 0
                  ? "Sem avaliações"
                  : reputation.totalReviews === 1
                    ? "1 avaliação"
                    : `${reputation.totalReviews} avaliações`}
              </p>
            </div>
            <div className="space-y-1 border-l border-border pl-3">
              <p className="text-xs font-medium text-muted-foreground">Nível</p>
              <LevelBadge
                level={reputation.level}
                name={reputation.levelName}
                size="sm"
              />
              <p className="text-xs text-muted-foreground tabular-nums">
                {formatXp(reputation.xp)} XP
              </p>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
