/**
 * Schemas Zod da feature de PAGAMENTOS (Fase 6).
 *
 * Espelham os schemas de entrada do backend (`contrato-fase-6.md` §4.1). O
 * cliente só envia `package_id` (mass-assignment safe); todo o resto
 * (amount/credits/status/user_id) é derivado pelo servidor.
 */

import { z } from "zod";

/** Espelha `PaymentOrderCreate`: o único campo enviado pelo cliente. */
export const paymentOrderCreateSchema = z.object({
  package_id: z.string().uuid(),
});

export type PaymentOrderCreateInput = z.infer<typeof paymentOrderCreateSchema>;

/** Espelha `DevConfirmRequest`: evento simulado (default "paid"). */
export const devConfirmSchema = z.object({
  event: z.enum(["paid", "failed", "refunded"]).default("paid"),
});

export type DevConfirmInput = z.infer<typeof devConfirmSchema>;
