"""Coletor de métricas em memória (Fase 12 — monitoramento).

Mantém um *ring buffer* dos requests recentes para calcular taxa de erro,
latência (p50/p95/p99), endpoints mais lentos e a série de latência. Métricas de
sistema (CPU%, memória, threads) usam apenas a stdlib — **sem dependências
novas**. Tudo é volátil (reinicia com o processo); os **erros** é que são
persistidos em ``error_logs``.

Thread-safe (lock simples). Sem PII: guardamos apenas método, path **normalizado**
(IDs colapsados em ``{id}``), status e duração.
"""

from __future__ import annotations

import os
import re
import threading
import time
from collections import deque

# Capacidade do ring buffer (amostras de request).
_MAX_SAMPLES = 5000
# Cada amostra: (timestamp, método, path_normalizado, status, duração_ms).
_samples: deque[tuple[float, str, str, int, float]] = deque(maxlen=_MAX_SAMPLES)
_lock = threading.Lock()

# Início do processo (uptime).
STARTED_AT = time.time()

# Estado para o cálculo incremental de CPU%.
_cpu_state = {"wall": time.perf_counter(), "cpu": time.process_time()}

# Normalização de path: colapsa UUIDs e segmentos numéricos.
_UUID_RE = re.compile(
    r"/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-"
    r"[0-9a-fA-F]{4}-[0-9a-fA-F]{12}"
)
_NUM_RE = re.compile(r"/\d+")


def normalize_path(path: str) -> str:
    """Colapsa IDs no path para agregar endpoints (``/leads/<uuid>`` → ``/leads/{id}``)."""
    p = _UUID_RE.sub("/{id}", path)
    p = _NUM_RE.sub("/{id}", p)
    return p


def record_request(method: str, path: str, status: int, duration_ms: float) -> None:
    """Registra uma amostra de request no buffer (thread-safe)."""
    with _lock:
        _samples.append(
            (time.time(), method, normalize_path(path), status, duration_ms)
        )


def _percentile(sorted_vals: list[float], pct: float) -> float:
    if not sorted_vals:
        return 0.0
    k = (len(sorted_vals) - 1) * pct
    f = int(k)
    c = min(f + 1, len(sorted_vals) - 1)
    if f == c:
        return sorted_vals[f]
    return sorted_vals[f] + (sorted_vals[c] - sorted_vals[f]) * (k - f)


def cpu_percent() -> float:
    """CPU% do processo desde a última chamada (0–100, relativo ao host)."""
    now_wall = time.perf_counter()
    now_cpu = time.process_time()
    d_wall = now_wall - _cpu_state["wall"]
    d_cpu = now_cpu - _cpu_state["cpu"]
    _cpu_state["wall"] = now_wall
    _cpu_state["cpu"] = now_cpu
    if d_wall <= 0:
        return 0.0
    ncpu = os.cpu_count() or 1
    pct = (d_cpu / d_wall) * 100.0 / ncpu
    return round(max(0.0, min(100.0, pct)), 1)


def memory_mb() -> float:
    """RSS do processo em MB (Linux via /proc; fallback ``resource``)."""
    try:
        with open("/proc/self/status") as fh:
            for line in fh:
                if line.startswith("VmRSS:"):
                    return round(float(line.split()[1]) / 1024, 1)
    except Exception:
        pass
    try:
        import resource

        return round(
            resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1024, 1
        )
    except Exception:
        return 0.0


def snapshot() -> dict:
    """Fotografia atual das métricas (janelas de 1/5/15 min)."""
    now = time.time()
    with _lock:
        items = list(_samples)

    w5 = [s for s in items if now - s[0] <= 300]
    w15 = [s for s in items if now - s[0] <= 900]

    total5 = len(w5)
    server_err5 = sum(1 for s in w5 if s[3] >= 500)
    client_err5 = sum(1 for s in w5 if 400 <= s[3] < 500)
    durations5 = sorted(s[4] for s in w5)

    # Endpoints mais lentos (15m): média de duração por (método, path).
    agg: dict[tuple[str, str], list[float]] = {}
    for _ts, method, path, _status, dur in w15:
        agg.setdefault((method, path), []).append(dur)
    slowest = sorted(
        (
            {
                "method": m,
                "path": p,
                "count": len(v),
                "avg_ms": round(sum(v) / len(v), 1),
            }
            for (m, p), v in agg.items()
        ),
        key=lambda x: x["avg_ms"],
        reverse=True,
    )[:8]

    return {
        "uptime_seconds": int(now - STARTED_AT),
        "requests_per_min": round(total5 / 5.0, 1),
        "total_5m": total5,
        "ok_5m": total5 - server_err5 - client_err5,
        "client_errors_5m": client_err5,
        "server_errors_5m": server_err5,
        "error_rate_5m": round(
            (server_err5 / total5 * 100) if total5 else 0.0, 2
        ),
        "latency_p50": round(_percentile(durations5, 0.50), 1),
        "latency_p95": round(_percentile(durations5, 0.95), 1),
        "latency_p99": round(_percentile(durations5, 0.99), 1),
        "latency_series": [round(s[4], 1) for s in items[-40:]],
        "slowest_endpoints": slowest,
        "cpu_percent": cpu_percent(),
        "memory_mb": memory_mb(),
        "threads": threading.active_count(),
    }
