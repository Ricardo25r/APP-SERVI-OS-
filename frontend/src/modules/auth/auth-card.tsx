/**
 * Casca visual compartilhada das telas de autenticação.
 *
 * Centraliza o conteúdo na viewport e o envolve em um `Card` com cabeçalho
 * (título + descrição) e rodapé opcional (links de navegação). Mantém o
 * visual de login e cadastro consistente.
 */
import * as React from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export interface AuthCardProps {
  title: string;
  description: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function AuthCard({
  title,
  description,
  children,
  footer,
}: AuthCardProps) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>{children}</CardContent>
        {footer ? (
          <CardFooter className="justify-center">{footer}</CardFooter>
        ) : null}
      </Card>
    </main>
  );
}
