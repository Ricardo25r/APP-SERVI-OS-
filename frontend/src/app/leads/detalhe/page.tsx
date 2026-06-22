/**
 * Rota ESTÁTICA de detalhe (SPA). O id vem por query (`?id=`) e é lido no
 * cliente em `./view` (useSearchParams) — funciona com qualquer id, no dev e no
 * app empacotado (output:export não suporta path param dinâmico em runtime).
 * Suspense é obrigatório por causa do useSearchParams no export.
 */
import { Suspense } from "react";

import View from "./view";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <View />
    </Suspense>
  );
}
