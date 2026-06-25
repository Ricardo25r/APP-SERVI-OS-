/**
 * `useChatSocket` — conexão WebSocket do chat em tempo real (#59).
 *
 * Conecta em `…/api/v1/chat/ws`, autentica enviando `{ token }` como primeira
 * mensagem (token NUNCA na URL), e chama `onEvent` a cada evento do servidor
 * (`{ type: "message", conversation_id }`). Reconecta com backoff exponencial e
 * mantém o socket vivo com `ping`. Retorna se está conectado — o chamado usa
 * isso para reduzir o polling de fallback quando o tempo real está ativo.
 *
 * Falha graciosamente: sem token ou sem WS, simplesmente não conecta e o polling
 * (4s) cobre. Nunca lança.
 */
"use client";

import { useEffect, useRef, useState } from "react";

import { API_PREFIX, API_URL } from "@/services/api";
import { useAuthStore } from "@/store/auth";

interface ChatSocketEvent {
  type?: string;
  conversation_id?: string;
  [k: string]: unknown;
}

function chatWsUrl(): string {
  let base = API_URL;
  if (!base || base.startsWith("/")) base = window.location.origin;
  const url = new URL(`${API_PREFIX}/chat/ws`, base);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url.toString();
}

export function useChatSocket(
  onEvent: (event: ChatSocketEvent) => void
): boolean {
  const [connected, setConnected] = useState(false);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    if (typeof window === "undefined") return;

    let ws: WebSocket | null = null;
    let closedByUs = false;
    let retry = 0;
    let pingTimer: ReturnType<typeof setInterval> | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const clearTimers = () => {
      if (pingTimer) {
        clearInterval(pingTimer);
        pingTimer = null;
      }
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
    };

    const scheduleReconnect = () => {
      if (closedByUs) return;
      retry = Math.min(retry + 1, 6);
      const delay = Math.min(1000 * 2 ** retry, 30000);
      reconnectTimer = setTimeout(connect, delay);
    };

    function connect() {
      const token = useAuthStore.getState().accessToken;
      if (!token) {
        // Store ainda hidratando — espera curta e fixa (sem backoff), para a
        // 1a conexão não atrasar; o backoff é só para falha real de conexão.
        if (!closedByUs) reconnectTimer = setTimeout(connect, 400);
        return;
      }
      try {
        ws = new WebSocket(chatWsUrl());
      } catch {
        scheduleReconnect();
        return;
      }
      ws.onopen = () => {
        try {
          ws?.send(JSON.stringify({ token }));
        } catch {
          /* fechará e reconecta */
        }
        pingTimer = setInterval(() => {
          try {
            ws?.send("ping");
          } catch {
            /* ignore */
          }
        }, 25000);
      };
      ws.onmessage = (e) => {
        let data: ChatSocketEvent | null = null;
        try {
          data = JSON.parse(e.data);
        } catch {
          return;
        }
        if (!data) return;
        if (data.type === "ready") {
          retry = 0;
          setConnected(true);
          return;
        }
        onEventRef.current(data);
      };
      ws.onclose = () => {
        setConnected(false);
        if (pingTimer) {
          clearInterval(pingTimer);
          pingTimer = null;
        }
        scheduleReconnect();
      };
      ws.onerror = () => {
        try {
          ws?.close();
        } catch {
          /* ignore */
        }
      };
    }

    connect();

    return () => {
      closedByUs = true;
      clearTimers();
      try {
        ws?.close();
      } catch {
        /* ignore */
      }
    };
  }, []);

  return connected;
}
