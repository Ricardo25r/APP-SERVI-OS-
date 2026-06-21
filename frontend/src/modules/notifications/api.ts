/**
 * Camada de acesso à API de **Notificações** (Fase 14).
 *
 * Endpoints (Bearer injetado por `@/services/api`):
 * - `GET  /notifications`               → lista + total de não lidas.
 * - `GET  /notifications/unread-count`  → contador (sino).
 * - `POST /notifications/{id}/read`     → marca uma como lida.
 * - `POST /notifications/read-all`      → marca todas como lidas.
 */

import { apiGet, apiPost } from "@/services/api";

/** Notificação como vem do backend (`NotificationOut`). */
export interface ApiNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  href: string | null;
  read: boolean;
  created_at: string;
}

export interface NotificationListResponse {
  items: ApiNotification[];
  page: number;
  page_size: number;
  total: number;
  unread: number;
}

export function fetchNotifications(): Promise<NotificationListResponse> {
  return apiGet<NotificationListResponse>("/notifications");
}

export async function fetchUnreadCount(): Promise<number> {
  const data = await apiGet<{ count: number }>("/notifications/unread-count");
  return data.count ?? 0;
}

export function markNotificationRead(id: string): Promise<void> {
  return apiPost<void>(`/notifications/${id}/read`);
}

export function markAllNotificationsRead(): Promise<{ updated: number }> {
  return apiPost<{ updated: number }>("/notifications/read-all");
}
