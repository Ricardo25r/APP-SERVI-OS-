"use client";

/**
 * Painel de **Monitoramento** (`/admin/monitoramento`) — admin-only.
 *
 * Mostra status geral, gauges (CPU/memória/taxa de erro/latência p95), stat
 * cards, saúde dos serviços, série de latência, endpoints mais lentos e os
 * **erros recentes com traceback** (linhas de código que falharam) — para
 * diagnóstico. Consome `GET /monitoring/overview` e `/monitoring/errors`
 * (protegidos por RBAC admin). Segue o design system (tokens, tema claro).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Bell,
  BellRing,
  Bug,
  ChevronDown,
  Cpu,
  Database,
  FlaskConical,
  Layers,
  RefreshCw,
  Timer,
  X,
  Zap,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useRequireAuth } from "@/hooks/use-auth";
import { apiDelete, apiGet, apiPost, apiPut } from "@/services/api";

interface SlowEndpoint {
  method: string;
  path: string;
  count: number;
  avg_ms: number;
}

interface Overview {
  status: string;
  uptime_seconds: number;
  requests_per_min: number;
  total_5m: number;
  ok_5m: number;
  client_errors_5m: number;
  server_errors_5m: number;
  error_rate_5m: number;
  latency_p50: number;
  latency_p95: number;
  latency_p99: number;
  latency_series: number[];
  slowest_endpoints: SlowEndpoint[];
  cpu_percent: number;
  memory_mb: number;
  threads: number;
  db_latency_ms: number | null;
  errors_24h: number;
  alerts?: {
    enabled: boolean;
    configured: boolean;
    email_to: string;
    slow_ms: number;
  };
}

interface ErrorItem {
  id: string;
  created_at: string;
  error_type: string;
  message: string;
  path: string | null;
  method: string | null;
  status_code: number;
  request_id: string | null;
  traceback: string | null;
}

function formatUptime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

/** Gauge semicircular (SVG) com número central. */
function Gauge({
  value,
  max,
  display,
  label,
  tone = "primary",
}: {
  value: number;
  max: number;
  display: string;
  label: string;
  tone?: "primary" | "warn" | "danger";
}) {
  const arcLen = Math.PI * 52; // comprimento do semicírculo (r=52)
  const pct = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  const toneClass =
    tone === "danger"
      ? "text-destructive"
      : tone === "warn"
        ? "text-brand"
        : "text-primary";
  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 120 70" className="w-full max-w-[150px]">
        <path
          d="M 8 60 A 52 52 0 0 1 112 60"
          fill="none"
          className="stroke-muted"
          strokeWidth="9"
          strokeLinecap="round"
        />
        <path
          d="M 8 60 A 52 52 0 0 1 112 60"
          fill="none"
          stroke="currentColor"
          className={cn("transition-all duration-500", toneClass)}
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={`${pct * arcLen} ${arcLen}`}
        />
        <text
          x="60"
          y="54"
          textAnchor="middle"
          className="fill-foreground text-[22px] font-extrabold"
        >
          {display}
        </text>
      </svg>
      <span className="mt-1 text-center text-xs font-medium text-muted-foreground">
        {label}
      </span>
    </div>
  );
}

/** Mini gráfico de linha (série de latência). */
function Sparkline({ data }: { data: number[] }) {
  if (data.length < 2) {
    return (
      <p className="flex h-40 items-center justify-center text-sm text-muted-foreground">
        Coletando dados de latência…
      </p>
    );
  }
  const max = Math.max(...data, 1);
  const w = 100;
  const h = 40;
  const pts = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = h - (v / max) * h;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
  return (
    <div className="h-40 w-full">
      <svg
        viewBox={`0 0 ${w} ${h}`}
        preserveAspectRatio="none"
        className="h-full w-full text-primary"
      >
        <polyline
          points={pts}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof Zap;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Icon className="h-3.5 w-3.5" aria-hidden />
        {label}
      </p>
      <p className="mt-1 text-2xl font-extrabold tabular-nums text-foreground">
        {value}
      </p>
      {hint ? (
        <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

export default function MonitoringPage() {
  const auth = useRequireAuth("admin");

  const [overview, setOverview] = useState<Overview | null>(null);
  const [errors, setErrors] = useState<ErrorItem[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [live, setLive] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<string>("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [alerting, setAlerting] = useState(false);
  const [alertResult, setAlertResult] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function clearErrors() {
    if (
      !window.confirm(
        "Limpar todos os erros registrados? Não afeta o sistema — só o histórico exibido aqui."
      )
    )
      return;
    setClearing(true);
    try {
      await apiDelete("/monitoring/errors");
      setErrors([]);
    } catch {
      /* ignore */
    } finally {
      setClearing(false);
    }
  }

  // E-mails que recebem alerta de erro (equipe — o do dono vem do .env).
  const [teamEmails, setTeamEmails] = useState<string[]>([]);
  const [ownerEmails, setOwnerEmails] = useState<string[]>([]);
  const [newEmail, setNewEmail] = useState("");
  const [savingEmails, setSavingEmails] = useState(false);
  const [emailsMsg, setEmailsMsg] = useState<string | null>(null);

  const loadEmails = useCallback(async () => {
    try {
      const r = await apiGet<{ emails: string[]; owner_emails: string[] }>(
        "/monitoring/alert-emails"
      );
      setTeamEmails(r.emails ?? []);
      setOwnerEmails(r.owner_emails ?? []);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!auth.isAuthenticated || !auth.isAdmin) return;
    void loadEmails();
  }, [auth.isAuthenticated, auth.isAdmin, loadEmails]);

  async function saveEmails(next: string[]) {
    setSavingEmails(true);
    setEmailsMsg(null);
    try {
      const r = await apiPut<{ emails: string[] }>("/monitoring/alert-emails", {
        emails: next,
      });
      setTeamEmails(r.emails ?? []);
      setEmailsMsg("E-mails salvos.");
    } catch {
      setEmailsMsg("Não foi possível salvar.");
    } finally {
      setSavingEmails(false);
    }
  }

  function addEmail() {
    const e = newEmail.trim();
    if (
      !e ||
      !e.includes("@") ||
      teamEmails.some((x) => x.toLowerCase() === e.toLowerCase())
    )
      return;
    setNewEmail("");
    void saveEmails([...teamEmails, e]);
  }

  function removeEmail(target: string) {
    void saveEmails(teamEmails.filter((x) => x !== target));
  }

  const load = useCallback(async () => {
    try {
      const [ov, er] = await Promise.all([
        apiGet<Overview>("/monitoring/overview"),
        apiGet<{ items: ErrorItem[] }>("/monitoring/errors?limit=50"),
      ]);
      setOverview(ov);
      setErrors(er.items ?? []);
      setLoadError(null);
      setUpdatedAt(new Date().toLocaleTimeString("pt-BR"));
    } catch {
      setLoadError("Não foi possível carregar o monitoramento.");
    }
  }, []);

  useEffect(() => {
    if (!auth.isAuthenticated || !auth.isAdmin) return;
    void load();
  }, [auth.isAuthenticated, auth.isAdmin, load]);

  // Auto-refresh "Ao vivo".
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (live && auth.isAdmin) {
      timerRef.current = setInterval(() => void load(), 10000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [live, auth.isAdmin, load]);

  async function triggerTestError() {
    setTesting(true);
    try {
      // Espera-se 500 (erro proposital); ignoramos a falha e recarregamos.
      await apiPost("/monitoring/test-error");
    } catch {
      /* esperado */
    }
    setTimeout(() => {
      void load();
      setTesting(false);
    }, 900);
  }

  async function triggerTestAlert() {
    setAlerting(true);
    setAlertResult(null);
    try {
      const r = await apiPost<{ result: string }>("/monitoring/test-alert");
      setAlertResult(
        r.result === "sent"
          ? "Alerta de teste enviado por e-mail."
          : "SMTP não configurado — alerta só registrado no log. Configure o SMTP para receber por e-mail."
      );
    } catch {
      setAlertResult("Falha ao disparar o alerta de teste.");
    } finally {
      setAlerting(false);
    }
  }

  if (!auth.hasHydrated || !auth.isAuthenticated || !auth.isAdmin) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <p className="text-sm text-muted-foreground">Carregando...</p>
      </main>
    );
  }

  const ok = overview?.status === "ok";

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      {/* Cabeçalho + ações */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href="/admin"
            className="mb-2 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
            Painel administrativo
          </Link>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight sm:text-3xl">
            <Activity className="h-6 w-6 text-primary" aria-hidden />
            Monitoramento
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            FazTudo API
            {overview ? ` · no ar há ${formatUptime(overview.uptime_seconds)}` : ""}
            {updatedAt ? ` · atualizado às ${updatedAt}` : ""}
          </p>
          {overview?.alerts ? (
            <p className="mt-1 flex items-center gap-1.5 text-xs">
              <Bell className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
              {overview.alerts.configured ? (
                <span className="text-success">
                  Alertas ativos · {overview.alerts.email_to} · lentidão acima de{" "}
                  {overview.alerts.slow_ms}ms
                </span>
              ) : (
                <span className="text-muted-foreground">
                  Alertas inativos — configure o SMTP para receber por e-mail
                </span>
              )}
            </p>
          ) : null}
          {alertResult ? (
            <p className="mt-1 text-xs text-primary">{alertResult}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant={live ? "default" : "outline"}
            size="sm"
            className="gap-1.5"
            onClick={() => setLive((v) => !v)}
          >
            <span
              className={cn(
                "inline-block h-2 w-2 rounded-full",
                live ? "animate-pulse bg-success" : "bg-muted-foreground"
              )}
            />
            {live ? "Ao vivo" : "Pausado"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => void triggerTestError()}
            disabled={testing}
          >
            <FlaskConical className="h-4 w-4" aria-hidden />
            {testing ? "Testando…" : "Testar captura"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => void triggerTestAlert()}
            disabled={alerting}
          >
            <BellRing className="h-4 w-4" aria-hidden />
            {alerting ? "Enviando…" : "Testar alerta"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => void load()}
          >
            <RefreshCw className="h-4 w-4" aria-hidden />
            Atualizar
          </Button>
        </div>
      </div>

      {loadError ? (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {loadError}
        </div>
      ) : !overview ? (
        <div className="h-40 animate-pulse rounded-2xl border bg-muted/40" />
      ) : (
        <div className="space-y-6">
          {/* Status geral */}
          <div
            className={cn(
              "flex items-center justify-between gap-4 rounded-2xl border p-5",
              ok
                ? "border-success/30 bg-success/10"
                : "border-brand/40 bg-brand/10"
            )}
          >
            <div className="flex items-center gap-3">
              <span
                className={cn(
                  "flex h-11 w-11 items-center justify-center rounded-full",
                  ok ? "bg-success/20 text-success" : "bg-brand/20 text-brand"
                )}
              >
                {ok ? (
                  <Activity className="h-5 w-5" aria-hidden />
                ) : (
                  <AlertTriangle className="h-5 w-5" aria-hidden />
                )}
              </span>
              <div>
                <p className="text-lg font-bold tracking-tight text-foreground">
                  {ok
                    ? "Tudo operando normalmente"
                    : "Atenção — degradação detectada"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {overview.server_errors_5m > 0
                    ? `${overview.server_errors_5m} erro(s) de servidor nos últimos 5 min`
                    : "Sem erros de servidor nos últimos 5 min"}
                </p>
              </div>
            </div>
            <span
              className={cn(
                "text-xl font-extrabold",
                ok ? "text-success" : "text-brand"
              )}
            >
              {ok ? "OK" : "ALERTA"}
            </span>
          </div>

          {/* Gauges */}
          <div className="grid grid-cols-2 gap-3 rounded-2xl border bg-card p-4 sm:grid-cols-4">
            <Gauge
              value={overview.cpu_percent}
              max={100}
              display={`${overview.cpu_percent}`}
              label="CPU (processo) %"
              tone={overview.cpu_percent > 80 ? "danger" : "primary"}
            />
            <Gauge
              value={overview.memory_mb}
              max={1024}
              display={`${Math.round(overview.memory_mb)}`}
              label="Memória (MB)"
            />
            <Gauge
              value={overview.error_rate_5m}
              max={10}
              display={`${overview.error_rate_5m}%`}
              label="Taxa de erro (5m)"
              tone={overview.error_rate_5m > 0 ? "danger" : "primary"}
            />
            <Gauge
              value={overview.latency_p95}
              max={1000}
              display={`${Math.round(overview.latency_p95)}`}
              label="Latência p95 (ms)"
              tone={overview.latency_p95 > 500 ? "warn" : "primary"}
            />
          </div>

          {/* Stat cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <StatCard
              icon={Zap}
              label="Requisições/min"
              value={`${overview.requests_per_min}`}
              hint="janela de 5 min"
            />
            <StatCard
              icon={Activity}
              label="Total (5m)"
              value={`${overview.total_5m}`}
              hint={`${overview.ok_5m} ok · ${overview.client_errors_5m} 4xx · ${overview.server_errors_5m} 5xx`}
            />
            <StatCard
              icon={Timer}
              label="Latência p50 / p99"
              value={`${Math.round(overview.latency_p50)} / ${Math.round(
                overview.latency_p99
              )}`}
              hint="ms"
            />
            <StatCard
              icon={Database}
              label="Banco (ping)"
              value={
                overview.db_latency_ms != null
                  ? `${overview.db_latency_ms} ms`
                  : "—"
              }
              hint={overview.db_latency_ms != null ? "SELECT 1" : "indisponível"}
            />
            <StatCard
              icon={Bug}
              label="Erros (24h)"
              value={`${overview.errors_24h}`}
              hint="exceções capturadas"
            />
            <StatCard
              icon={Layers}
              label="Threads"
              value={`${overview.threads}`}
              hint={`${Math.round(overview.memory_mb)} MB RSS`}
            />
          </div>

          {/* Saúde + latência */}
          <div className="grid gap-4 lg:grid-cols-[minmax(0,320px)_1fr]">
            <div className="rounded-2xl border bg-card p-4 shadow-sm">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-bold tracking-tight">
                <Cpu className="h-4 w-4 text-primary" aria-hidden />
                Saúde dos serviços
              </h2>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center justify-between gap-2 rounded-lg bg-muted/40 px-3 py-2">
                  <span className="flex items-center gap-2">
                    <span
                      className={cn(
                        "inline-block h-2 w-2 rounded-full",
                        overview.db_latency_ms != null
                          ? "bg-success"
                          : "bg-destructive"
                      )}
                    />
                    Banco de dados
                  </span>
                  <span className="font-medium tabular-nums text-muted-foreground">
                    {overview.db_latency_ms != null
                      ? `${overview.db_latency_ms} ms`
                      : "offline"}
                  </span>
                </li>
                <li className="flex items-center justify-between gap-2 rounded-lg bg-muted/40 px-3 py-2">
                  <span className="flex items-center gap-2">
                    <span className="inline-block h-2 w-2 rounded-full bg-success" />
                    Processo da API
                  </span>
                  <span className="font-medium tabular-nums text-muted-foreground">
                    {Math.round(overview.memory_mb)} MB · {overview.cpu_percent}%
                    CPU
                  </span>
                </li>
              </ul>
            </div>

            <div className="rounded-2xl border bg-card p-4 shadow-sm">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-bold tracking-tight">
                <Activity className="h-4 w-4 text-primary" aria-hidden />
                Latência dos últimos requests (ms)
              </h2>
              <Sparkline data={overview.latency_series} />
            </div>
          </div>

          {/* Endpoints mais lentos + Erros recentes */}
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border bg-card p-4 shadow-sm">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-bold tracking-tight">
                <Timer className="h-4 w-4 text-primary" aria-hidden />
                Endpoints mais lentos (15m)
              </h2>
              {overview.slowest_endpoints.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Sem dados ainda.
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {overview.slowest_endpoints.map((e) => (
                    <li
                      key={`${e.method} ${e.path}`}
                      className="flex items-center justify-between gap-3 py-2 text-sm"
                    >
                      <span className="min-w-0 truncate font-mono text-xs text-foreground">
                        <span className="font-semibold text-primary">
                          {e.method}
                        </span>{" "}
                        {e.path}
                      </span>
                      <span className="shrink-0 tabular-nums text-muted-foreground">
                        {e.count}× ·{" "}
                        <span className="font-semibold text-foreground">
                          {e.avg_ms} ms
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="rounded-2xl border bg-card p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="flex items-center gap-2 text-sm font-bold tracking-tight">
                  <Bug className="h-4 w-4 text-destructive" aria-hidden />
                  Erros recentes
                </h2>
                {errors.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => void clearErrors()}
                    disabled={clearing}
                    className="text-xs font-medium text-muted-foreground hover:text-destructive disabled:opacity-50"
                  >
                    Limpar
                  </button>
                ) : null}
              </div>
              {errors.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Nenhum erro capturado. Tudo limpo.
                </p>
              ) : (
                <ul className="space-y-2">
                  {errors.map((e) => {
                    const open = expanded === e.id;
                    return (
                      <li
                        key={e.id}
                        className="overflow-hidden rounded-xl border border-destructive/30 bg-destructive/5"
                      >
                        <button
                          type="button"
                          onClick={() => setExpanded(open ? null : e.id)}
                          className="flex w-full items-start justify-between gap-3 px-3 py-2 text-left"
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-semibold text-destructive">
                              {e.error_type}
                            </span>
                            <span className="block truncate text-xs text-muted-foreground">
                              {e.method} {e.path} · {formatWhen(e.created_at)}
                            </span>
                          </span>
                          <ChevronDown
                            className={cn(
                              "mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                              open && "rotate-180"
                            )}
                            aria-hidden
                          />
                        </button>
                        {open ? (
                          <div className="space-y-2 border-t border-destructive/20 px-3 py-2">
                            <p className="text-sm text-foreground">{e.message}</p>
                            {e.traceback ? (
                              <pre className="max-h-72 overflow-auto rounded-lg bg-foreground/90 p-3 text-[11px] leading-relaxed text-background">
                                {e.traceback}
                              </pre>
                            ) : null}
                            {e.request_id ? (
                              <p className="font-mono text-[10px] text-muted-foreground">
                                request_id: {e.request_id}
                              </p>
                            ) : null}
                          </div>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="rounded-2xl border bg-card p-4 shadow-sm">
              <h2 className="mb-1 flex items-center gap-2 text-sm font-bold tracking-tight">
                <BellRing className="h-4 w-4 text-primary" aria-hidden />
                E-mails que recebem alerta de erro
              </h2>
              <p className="mb-3 text-xs text-muted-foreground">
                Adicione e-mails da equipe. Todos recebem aviso por e-mail
                quando o sistema registrar um erro.
              </p>

              {ownerEmails.length > 0 ? (
                <div className="mb-3">
                  <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Dono (sempre recebe)
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {ownerEmails.map((e) => (
                      <span
                        key={e}
                        className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground"
                      >
                        {e}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="space-y-1.5">
                {teamEmails.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Nenhum e-mail da equipe ainda.
                  </p>
                ) : (
                  teamEmails.map((e) => (
                    <div
                      key={e}
                      className="flex items-center justify-between gap-2 rounded-lg border bg-background px-3 py-1.5"
                    >
                      <span className="truncate text-sm">{e}</span>
                      <button
                        type="button"
                        onClick={() => removeEmail(e)}
                        disabled={savingEmails}
                        className="shrink-0 text-muted-foreground hover:text-destructive disabled:opacity-50"
                        aria-label={`Remover ${e}`}
                      >
                        <X className="h-4 w-4" aria-hidden />
                      </button>
                    </div>
                  ))
                )}
              </div>

              <form
                onSubmit={(ev) => {
                  ev.preventDefault();
                  addEmail();
                }}
                className="mt-3 flex gap-2"
              >
                <input
                  type="email"
                  value={newEmail}
                  onChange={(ev) => setNewEmail(ev.target.value)}
                  placeholder="email@equipe.com"
                  className="min-w-0 flex-1 rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                />
                <Button
                  type="submit"
                  size="sm"
                  disabled={savingEmails || !newEmail.trim()}
                >
                  Adicionar
                </Button>
              </form>
              {emailsMsg ? (
                <p className="mt-1.5 text-xs text-muted-foreground">
                  {emailsMsg}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
