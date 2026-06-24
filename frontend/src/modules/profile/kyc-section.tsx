"use client";

/**
 * `KycSection` — verificação de identidade do profissional.
 *
 * Envia foto do documento + selfie (`POST /kyc/me`, multipart) → fica "em
 * análise" → admin aprova/recusa. Mostra o status atual. As imagens vão para um
 * bucket privado (não públicas).
 */

import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, Clock, Loader2, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { apiGet, apiUpload } from "@/services/api";

interface KycStatus {
  status: string;
  reject_reason?: string | null;
}

export function KycSection() {
  const queryClient = useQueryClient();
  const docRef = useRef<HTMLInputElement>(null);
  const selfieRef = useRef<HTMLInputElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ["kyc", "me"],
    queryFn: () => apiGet<KycStatus>("/kyc/me"),
  });
  const status = data?.status ?? "none";

  async function submit() {
    const doc = docRef.current?.files?.[0];
    const selfie = selfieRef.current?.files?.[0];
    if (!doc || !selfie) {
      setError("Envie a foto do documento e a selfie.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("document", doc);
      form.append("selfie", selfie);
      await apiUpload("/kyc/me", form);
      queryClient.invalidateQueries({ queryKey: ["kyc", "me"] });
    } catch {
      setError("Não foi possível enviar. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" aria-hidden />
          Verificação de identidade
        </CardTitle>
        <CardDescription>
          Verifique sua conta para ganhar o selo de confiança e mais
          visibilidade.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {status === "approved" ? (
          <p className="flex items-center gap-2 text-sm font-semibold text-success">
            <BadgeCheck className="h-5 w-5" aria-hidden />
            Conta verificada
          </p>
        ) : status === "pending" ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-5 w-5" aria-hidden />
            Em análise — você será avisado quando for aprovada.
          </p>
        ) : (
          <>
            {status === "rejected" && data?.reject_reason ? (
              <p className="rounded-md border border-destructive/40 bg-destructive/5 p-2 text-sm text-destructive">
                Recusado: {data.reject_reason}. Reenvie os documentos.
              </p>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="kyc-doc">Documento (RG ou CNH)</Label>
              <input
                ref={docRef}
                id="kyc-doc"
                type="file"
                accept="image/*"
                className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border file:border-input file:bg-card file:px-3 file:py-1.5 file:text-sm file:font-medium"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="kyc-selfie">Selfie (foto do seu rosto)</Label>
              <input
                ref={selfieRef}
                id="kyc-selfie"
                type="file"
                accept="image/*"
                capture="user"
                className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border file:border-input file:bg-card file:px-3 file:py-1.5 file:text-sm file:font-medium"
              />
            </div>
            {error ? (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}
            <Button onClick={() => void submit()} disabled={submitting}>
              {submitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
              ) : null}
              Enviar para verificação
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
