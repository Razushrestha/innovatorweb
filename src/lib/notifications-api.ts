import {
  deleteLocalNotification,
  getLocalNotifications,
  markAllLocalNotificationsRead,
  markLocalNotificationRead,
  syncActivityNotifications,
} from "./activity-notifications";
import { ApiConfig } from "./api-config";
import { apiRequest } from "./api-client";
import { toProxiedMediaUrlOrNull } from "./media-url";
import type { AppNotification, NotificationSource } from "./types";

function asNotification(
  raw: Record<string, unknown>,
  source: NotificationSource,
): AppNotification {
  const type = (raw.type as string | null) ??
    (raw.notification_type as string | null) ??
    (raw.notificationType as string | null) ??
    null;
  return {
    id: `${source}:${String(raw.id ?? "")}`,
    title: String(raw.title ?? "Notification"),
    message: String(raw.message ?? raw.body ?? ""),
    type,
    senderUsername: (raw.sender_username as string | null) ?? null,
    senderAvatar: toProxiedMediaUrlOrNull(
      (raw.sender_avatar as string | null) ?? null,
      "profile",
    ),
    relatedPostId:
      (raw.related_post_id as string | null) ??
      (raw.relatedPostId as string | null) ??
      null,
    relatedUserId:
      (raw.sender_id as string | null) ??
      (raw.senderId as string | null) ??
      (raw.related_user_id as string | null) ??
      null,
    relatedProductId:
      (raw.related_product_id as string | null) ??
      (raw.product_id as string | null) ??
      null,
    isRead:
      raw.is_read === true ||
      raw.read === true ||
      raw.isRead === true,
    createdAt:
      (raw.created_at as string | null) ??
      (raw.createdAt as string | null) ??
      null,
    source,
    targetTab:
      source === "shop"
        ? "shop"
        : /(product|shop|order|commerce)/i.test(String(type ?? ""))
          ? "shop"
          : /(collab|follow)/i.test(String(type ?? ""))
            ? "profile"
            : /(learn|course)/i.test(String(type ?? ""))
              ? "learn"
              : "feed",
  };
}

function splitId(id: string): { source: NotificationSource; rawId: string } {
  if (id.startsWith("local:")) {
    return { source: "local", rawId: id };
  }
  if (id.startsWith("shop:")) {
    return { source: "shop", rawId: id.slice("shop:".length) };
  }
  if (id.startsWith("feed:")) {
    return { source: "feed", rawId: id.slice("feed:".length) };
  }
  return { source: "feed", rawId: id };
}

async function listFeedNotifications() {
  const data = await apiRequest<unknown>(
    ApiConfig.feedBaseUrl,
    "/api/notifications",
  );
  if (!Array.isArray(data)) return [] as AppNotification[];
  return data
    .filter((n): n is Record<string, unknown> => !!n && typeof n === "object")
    .map((n) => asNotification(n, "feed"));
}

async function listShopNotifications() {
  const data = await apiRequest<unknown>(
    ApiConfig.shopBaseUrl,
    "/api/notifications",
  );
  if (!Array.isArray(data)) return [] as AppNotification[];
  return data
    .filter((n): n is Record<string, unknown> => !!n && typeof n === "object")
    .map((n) => asNotification(n, "shop"));
}

function sortByDate(items: AppNotification[]) {
  return [...items].sort((a, b) => {
    const ta = a.createdAt ? Date.parse(a.createdAt) : 0;
    const tb = b.createdAt ? Date.parse(b.createdAt) : 0;
    return tb - ta;
  });
}

/** Sync activity + merge feed, shop, and local notifications. */
export async function listNotifications() {
  const local = await syncActivityNotifications().catch(() =>
    getLocalNotifications(),
  );

  const [feed, shop] = await Promise.all([
    listFeedNotifications().catch(() => [] as AppNotification[]),
    listShopNotifications().catch(() => [] as AppNotification[]),
  ]);

  return sortByDate([...local, ...feed, ...shop]);
}

export async function getUnreadNotificationCount() {
  try {
    const items = await listNotifications();
    return items.filter((n) => !n.isRead).length;
  } catch {
    return 0;
  }
}

export async function markNotificationRead(id: string) {
  const { source, rawId } = splitId(id);
  if (source === "local") {
    markLocalNotificationRead(id);
    return;
  }
  if (source === "shop") {
    await apiRequest(
      ApiConfig.shopBaseUrl,
      `/api/notifications/${encodeURIComponent(rawId)}/mark-read`,
      { method: "POST" },
    );
    return;
  }
  await apiRequest(
    ApiConfig.feedBaseUrl,
    `/api/notifications/${encodeURIComponent(rawId)}/mark-as-read`,
    { method: "POST" },
  );
}

export async function markAllNotificationsRead() {
  markAllLocalNotificationsRead();
  await Promise.allSettled([
    apiRequest(ApiConfig.feedBaseUrl, "/api/notifications/mark-all-as-read", {
      method: "POST",
    }),
    apiRequest(ApiConfig.shopBaseUrl, "/api/notifications/mark-all-read", {
      method: "POST",
    }),
  ]);
}

export async function deleteNotification(id: string) {
  const { source, rawId } = splitId(id);
  if (source === "local") {
    deleteLocalNotification(id);
    return;
  }
  if (source === "shop") {
    // Shop API may not expose delete; mark read as a soft dismiss.
    try {
      await apiRequest(
        ApiConfig.shopBaseUrl,
        `/api/notifications/${encodeURIComponent(rawId)}/mark-read`,
        { method: "POST" },
      );
    } catch {
      /* ignore */
    }
    return;
  }
  await apiRequest(
    ApiConfig.feedBaseUrl,
    `/api/notifications/${encodeURIComponent(rawId)}`,
    { method: "DELETE" },
  );
}
