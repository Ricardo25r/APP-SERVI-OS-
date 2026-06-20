/**
 * Cliente HTTP central do FazTudo.
 *
 * - Lê `NEXT_PUBLIC_API_URL` (base do backend; default localhost:8000).
 * - Helpers tipados `apiGet/apiPost/apiPatch/apiPut/apiDelete` montam
 *   `${API_URL}/api/v1` + path.
 * - Injeta `Authorization: Bearer <access>` a partir do store de auth.
 * - Em **401**, tenta refresh automático uma vez (`POST /auth/refresh`),
 *   re-tenta a request original e, se o refresh falhar, faz logout.
 * - `ApiError` carrega `status` + `message` (lendo `detail` do FastAPI).
 *
 * Compatibilidade: `API_URL`, `ApiError` e o objeto `api` continuam exportados
 * (usados por `src/app/page.tsx` para o health-check, que NÃO deve quebrar).
 */

import { useAuthStore } from "@/store/auth";
import type { TokenPair } from "@/types";

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

/** Prefixo de versão da API. Helpers tipados já o aplicam. */
export const API_PREFIX = "/api/v1";

/**
 * Erro de API. `status` é o HTTP status; `message` prioriza o `detail`
 * retornado pelo FastAPI. `body` mantém o payload bruto para inspeção.
 */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public body?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** Extrai a mensagem mais útil do corpo de erro do FastAPI. */
function extractDetail(body: unknown, fallback: string): string {
  if (body && typeof body === "object" && "detail" in body) {
    const detail = (body as { detail: unknown }).detail;
    if (typeof detail === "string") return detail;
    // FastAPI validation errors: detail é uma lista de {msg, loc, ...}.
    if (Array.isArray(detail)) {
      const msgs = detail
        .map((d) =>
          d && typeof d === "object" && "msg" in d
            ? String((d as { msg: unknown }).msg)
            : null
        )
        .filter((m): m is string => Boolean(m));
      if (msgs.length > 0) return msgs.join("; ");
    }
  }
  if (typeof body === "string" && body.trim().length > 0) return body;
  return fallback;
}

type RequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
};

/** Faz a chamada HTTP crua (sem refresh / sem prefixo /api/v1). */
async function rawFetch(
  url: string,
  options: RequestOptions,
  withAuth: boolean
): Promise<Response> {
  const { body, headers, ...rest } = options;

  const finalHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    ...(headers as Record<string, string> | undefined),
  };

  if (withAuth) {
    const token = useAuthStore.getState().accessToken;
    if (token) finalHeaders["Authorization"] = `Bearer ${token}`;
  }

  return fetch(url, {
    ...rest,
    headers: finalHeaders,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

/** Lê o corpo da resposta (JSON quando possível, senão texto). */
async function parseBody(response: Response): Promise<unknown> {
  const isJson = response.headers
    .get("content-type")
    ?.includes("application/json");
  if (response.status === 204) return undefined;
  try {
    return isJson ? await response.json() : await response.text();
  } catch {
    return undefined;
  }
}

/* ------------------------------------------------------------------ */
/* Refresh automático (single-flight)                                 */
/* ------------------------------------------------------------------ */

let refreshPromise: Promise<boolean> | null = null;

/**
 * Tenta renovar a sessão usando o refresh token do store.
 * Resolve `true` em sucesso (tokens atualizados), `false` caso contrário.
 * Garante single-flight: chamadas concorrentes compartilham a mesma promise.
 */
async function tryRefresh(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const { refreshToken, setTokens, logout } = useAuthStore.getState();
    if (!refreshToken) {
      logout();
      return false;
    }

    try {
      const res = await rawFetch(
        `${API_URL}${API_PREFIX}/auth/refresh`,
        { method: "POST", body: { refresh_token: refreshToken } },
        false
      );

      if (!res.ok) {
        logout();
        return false;
      }

      const data = (await parseBody(res)) as
        | { tokens?: TokenPair; access_token?: string; refresh_token?: string }
        | undefined;

      const access = data?.tokens?.access_token ?? data?.access_token;
      const refresh = data?.tokens?.refresh_token ?? data?.refresh_token;

      if (!access || !refresh) {
        logout();
        return false;
      }

      setTokens({ accessToken: access, refreshToken: refresh });
      return true;
    } catch {
      logout();
      return false;
    }
  })();

  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
}

/* ------------------------------------------------------------------ */
/* Request com auth + refresh                                         */
/* ------------------------------------------------------------------ */

/**
 * Request autenticada contra `/api/v1`. `path` deve começar com `/`
 * (ex.: `/categories/`). Em 401 tenta refresh + retry uma única vez.
 */
async function request<T>(
  path: string,
  options: RequestOptions = {},
  retry = true
): Promise<T> {
  const url = `${API_URL}${API_PREFIX}${path}`;

  let response = await rawFetch(url, options, true);

  if (response.status === 401 && retry) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      response = await rawFetch(url, options, true);
    }
  }

  const data = await parseBody(response);

  if (!response.ok) {
    throw new ApiError(
      response.status,
      extractDetail(
        data,
        `Request to ${path} failed with status ${response.status}`
      ),
      data
    );
  }

  return data as T;
}

/* ------------------------------------------------------------------ */
/* Helpers tipados (montam /api/v1 + path; com auth + refresh)        */
/* ------------------------------------------------------------------ */

export const apiGet = <T>(path: string, options?: RequestOptions) =>
  request<T>(path, { ...options, method: "GET" });

export const apiPost = <T>(
  path: string,
  body?: unknown,
  options?: RequestOptions
) => request<T>(path, { ...options, method: "POST", body });

export const apiPatch = <T>(
  path: string,
  body?: unknown,
  options?: RequestOptions
) => request<T>(path, { ...options, method: "PATCH", body });

export const apiPut = <T>(
  path: string,
  body?: unknown,
  options?: RequestOptions
) => request<T>(path, { ...options, method: "PUT", body });

export const apiDelete = <T>(path: string, options?: RequestOptions) =>
  request<T>(path, { ...options, method: "DELETE" });

/**
 * Upload multipart (`FormData`) autenticado contra `/api/v1`. Não define
 * `Content-Type` — o browser monta o `boundary`. Em 401 tenta refresh + retry
 * uma vez (igual ao `request`).
 */
export async function apiUpload<T>(path: string, form: FormData): Promise<T> {
  const url = `${API_URL}${API_PREFIX}${path}`;
  const doFetch = () => {
    const headers: Record<string, string> = {};
    const token = useAuthStore.getState().accessToken;
    if (token) headers["Authorization"] = `Bearer ${token}`;
    return fetch(url, { method: "POST", headers, body: form });
  };

  let response = await doFetch();
  if (response.status === 401) {
    const refreshed = await tryRefresh();
    if (refreshed) response = await doFetch();
  }

  const data = await parseBody(response);
  if (!response.ok) {
    throw new ApiError(
      response.status,
      extractDetail(data, `Upload to ${path} failed (${response.status})`),
      data
    );
  }
  return data as T;
}

/* ------------------------------------------------------------------ */
/* Compatibilidade: objeto `api` legado (sem prefixo /api/v1).        */
/* Usado pelo health-check em src/app/page.tsx — NÃO remover.         */
/* ------------------------------------------------------------------ */

async function legacyRequest<T>(
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const response = await rawFetch(`${API_URL}${path}`, options, false);
  const data = await parseBody(response);
  if (!response.ok) {
    throw new ApiError(
      response.status,
      extractDetail(
        data,
        `Request to ${path} failed with status ${response.status}`
      ),
      data
    );
  }
  return data as T;
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) =>
    legacyRequest<T>(path, { ...options, method: "GET" }),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    legacyRequest<T>(path, { ...options, method: "POST", body }),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    legacyRequest<T>(path, { ...options, method: "PATCH", body }),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    legacyRequest<T>(path, { ...options, method: "PUT", body }),
  delete: <T>(path: string, options?: RequestOptions) =>
    legacyRequest<T>(path, { ...options, method: "DELETE" }),
};
