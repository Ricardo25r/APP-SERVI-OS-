/**
 * `ContactCard` — após a compra, mostra o nome do contratante. No modo padrão
 * (`CONTACT_REVEAL_MODE="masked"`) a plataforma NÃO divulga telefone/e-mail: a
 * combinação é feita pelo chat do app ("Abrir conversa"). Quando o backend
 * libera o contato (modo "full"), exibe o atalho `tel:`.
 */
"use client";

import Link from "next/link";
import { MessageCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { LeadContact } from "@/types";

interface ContactCardProps {
  contact: LeadContact;
  className?: string;
}

export function ContactCard({ contact, className }: ContactCardProps) {
  return (
    <Card className={cn("border-success/40 bg-success/5", className)}>
      <CardHeader className="p-4 pb-2">
        <div className="flex items-center gap-2">
          <Badge variant="success">Contato liberado</Badge>
        </div>
        <CardTitle className="text-base">{contact.name}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1.5 p-4 pt-0 text-sm">
        {contact.phone ? (
          <p>
            <span className="text-muted-foreground">Telefone: </span>
            <a
              href={`tel:${contact.phone}`}
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              {contact.phone}
            </a>
          </p>
        ) : (
          <div className="space-y-2">
            <p className="text-muted-foreground">
              Combine o atendimento pela conversa do app.
            </p>
            <Link
              href="/conversas"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
            >
              <MessageCircle className="h-4 w-4" aria-hidden />
              Abrir conversa
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
