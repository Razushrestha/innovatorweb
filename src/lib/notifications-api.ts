import { ApiConfig } from "./api-config";
import { apiRequest } from "./api-client";
import type { AppNotification } from "./types";

function asNotification(raw: Record<string, unknown>): AppNotification {
  return {
    id: String(raw.id ?? ""),
    title: String(raw.title ?? "Notification"),
    message: String(raw.message ?? raw.body ?? ""),
    type: (raw.type as string | null) ?? null,
    senderUsername: (raw.sender_username as string | null) ?? null,
    senderAvatar: (raw.sender_avatar as string | null) ?? null,
    relatedPostId:
      (raw.related_post_id as string | null) ??
      (raw.relatedPostId as string | null) ??
      null,
    isRead: raw.is_read === true || raw.read === true,
    createdAt:
      (raw.created_at as string | null) ??
      (raw.createdAt as string | null) ??
      null,
  };
}

export async function listNotifications() {
  const data = await apiRequest<unknown>(
    ApiConfig.feedBaseUrl,
    "/api/notifications",
  );
  if (!Array.isArray(data)) return [] as AppNotification[];
  return data
    .filter((n): n is Record<string, unknown> => !!n && typeof n === "object")
    .map(asNotification);
}

export async function markNotificationRead(id: string) {
  await apiRequest(
    ApiConfig.feedBaseUrl,
    `/api/notifications/${id}/mark-as-read`,
    { method: "POST" },
  );
}

export async function markAllNotificationsRead() {
  await apiRequest(
    ApiConfig.feedBaseUrl,
    "/api/notifications/mark-all-as-read",
    { method: "POST" },
  );
}

export async function deleteNotification(id: string) {
  await apiRequest(ApiConfig.feedBaseUrl, `/api/notifications/${id}`, {
    method: "DELETE",
  });
}
