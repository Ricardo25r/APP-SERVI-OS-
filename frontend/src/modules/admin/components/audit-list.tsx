"use client";

/**
 * `AuditList` — trilha de auditoria (somente leitura, admin).
 *
 * Lista paginada dos registros imutáveis (`GET /admin/audit`): ação, ator,
 * entidade e data. Cada item mostra os metadados resumidos quando presentes.
 */

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { History, Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";

import { fetchAuditLogs } from "../api";
import type { AuditFilters } from "../types";
import { adminErrorMessage, formatDateTime, shortId } from "../utils";
import { Pagination } from "./pagination";

export const auditKey = (filters: AuditFilters) =>
  ["admin", "audit", filters] as const;

export function AuditList() {
  const [filters, setFilters] = useState<AuditFilters>({ page: 1 });

  const { data, isLoading, isFetching, isError, error } = useQuery({
    queryKey: auditKey(filters),
    queryFn: () => fetchAuditLogs(filters),
  });

  const items = data?.items ?? [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        <span>Carregando auditoria...</span>
      </div>
    );
  }

  if (isError) {
    return (
      <div
        role="alert"
        className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
      >
        {adminErrorMessage(error, "Não foi possível carregar a auditoria.")}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
        <History className="h-7 w-7 text-muted-foreground/60" aria-hidden />
        <span>Nenhum registro de auditoria ainda.</span>
      </div>
    );
  }

  return (
    <div>
      <ul className="space-y-3">
        {items.map((log) => (
          <li
            key={log.id}
            className="rounded-lg border bg-card p-4 shadow-sm"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="default">{log.action}</Badge>
                <Badge variant="outline">{log.entity}</Badge>
              </div>
              <span className="text-xs text-muted-foreground">
                {formatDateTime(log.created_at)}
              </span>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span>
                Ator:{" "}
                <span className="font-mono text-foreground">
                  {shortId(log.actor_id)}
                </span>
              </span>
              {log.entity_id ? (
                <span>
                  Entidade:{" "}
                  <span className="font-mono text-foreground">
                    {shortId(log.entity_id)}
                  </span>
                </span>
              ) : null}
              {log.ip_address ? (
                <span>
                  IP:{" "}
                  <span className="font-mono text-foreground">
                    {log.ip_address}
                  </span>
                </span>
              ) : null}
            </div>

            {log.meta && Object.keys(log.meta).length > 0 ? (
              <pre className="mt-3 overflow-x-auto rounded-md border bg-muted/40 p-2 text-xs text-muted-foreground">
                {JSON.stringify(log.meta, null, 2)}
              </pre>
            ) : null}
          </li>
        ))}
      </ul>

      {data && (
        <Pagination
          page={data.page}
          pageSize={data.page_size}
          total={data.total}
          loading={isFetching}
          onPageChange={(page) => setFilters((p) => ({ ...p, page }))}
        />
      )}
    </div>
  );
}
