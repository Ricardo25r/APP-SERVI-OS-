/**
 * `ContactCard` — exibe o CONTATO LIBERADO do contratante após a compra
 * (nome / telefone / e-mail). NÃO deve ser renderizado antes da compra.
 *
 * Inclui atalhos diretos (tel: / mailto:) para facilitar o primeiro contato.
 */
"use client";

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
    <Card className={cn("border-green-500/40 bg-green-500/5", className)}>
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
          <p className="text-muted-foreground">Telefone não informado</p>
        )}
        <p>
          <span className="text-muted-foreground">E-mail: </span>
          <a
            href={`mailto:${contact.email}`}
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            {contact.email}
          </a>
        </p>
      </CardContent>
    </Card>
  );
}
