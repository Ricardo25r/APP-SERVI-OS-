import { Fragment } from "react";

import { cn } from "@/lib/utils";

/** Converte `**negrito**` em <strong> (o único inline usado nos Termos). */
function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold text-foreground">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <Fragment key={i}>{part}</Fragment>;
  });
}

/**
 * Renderizador de markdown **mínimo** (sem dependências) para documentos legais:
 * títulos `#`/`##`/`###`, divisórias `---`, negrito `**...**` e parágrafos.
 * Blocos separados por linha em branco.
 */
export function SimpleMarkdown({
  content,
  className,
}: {
  content: string;
  className?: string;
}) {
  const blocks = content.split(/\n\s*\n/);
  return (
    <div
      className={cn(
        "space-y-3 text-sm leading-relaxed text-muted-foreground",
        className
      )}
    >
      {blocks.map((raw, i) => {
        const line = raw.trim();
        if (!line) return null;
        if (line === "---") return <hr key={i} className="border-border" />;
        if (line.startsWith("# ")) {
          return (
            <h1
              key={i}
              className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl"
            >
              {renderInline(line.slice(2))}
            </h1>
          );
        }
        if (line.startsWith("## ")) {
          return (
            <h2 key={i} className="pt-3 text-lg font-bold text-foreground">
              {renderInline(line.slice(3))}
            </h2>
          );
        }
        if (line.startsWith("### ")) {
          return (
            <h3 key={i} className="font-bold text-foreground">
              {renderInline(line.slice(4))}
            </h3>
          );
        }
        return (
          <p key={i} className="whitespace-pre-line">
            {renderInline(line)}
          </p>
        );
      })}
    </div>
  );
}
