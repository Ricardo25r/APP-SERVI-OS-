import * as React from "react";
import { Search } from "lucide-react";

import { cn } from "@/lib/utils";
import { Input, type InputProps } from "@/components/ui/input";

/**
 * `SearchInput` — input com lupa (lucide `Search`) à esquerda.
 *
 * Reutiliza `Input`; herda todas as props nativas (`value`, `onChange`,
 * `placeholder`, etc.). O wrapper aceita `containerClassName` p/ largura.
 */
export interface SearchInputProps extends InputProps {
  /** Classe do wrapper (controle de largura/posicionamento). */
  containerClassName?: string;
}

const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
  ({ className, containerClassName, type = "search", ...props }, ref) => {
    return (
      <div className={cn("relative", containerClassName)}>
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          ref={ref}
          type={type}
          className={cn("pl-9", className)}
          {...props}
        />
      </div>
    );
  }
);
SearchInput.displayName = "SearchInput";

export { SearchInput };
