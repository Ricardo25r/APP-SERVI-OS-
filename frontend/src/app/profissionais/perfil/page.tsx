/**
 * Rota do perfil público do profissional. Suspense é obrigatório por causa do
 * useSearchParams no export estático.
 */

import { Suspense } from "react";

import ProfessionalPublicView from "./view";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <ProfessionalPublicView />
    </Suspense>
  );
}
