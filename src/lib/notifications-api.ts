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
import {
  applyNotificationReadOverrides,
  rememberAllNotificationsRead,
  rememberNotificationsRead,
} from "./notification-read-state";
import type { AppNotification, NotificationSource } from "./types";

function asNotification(
  raw: Record<string, unknown>,
  source: NotificationSource,
): AppNotification {
  const type =
    (raw.type as string | null) ??
    (raw.notification_type as string | null) ??
    (raw.notificationType as string | null) ??
    null;

  const id = String(
    raw.id ??
      raw.notification_id ??
      raw.notificationId ??
      raw.NotificationId ??
      "",
  );

  const readFlag =
    raw.is_read === true ||
    raw.read === true ||
    raw.isRead === true ||
    raw.IsRead === true ||
    String(raw.status ?? "").toLowerCase() === "read";

  return {
    id: `${source}:${id}`,
    title: String(raw.title ?? raw.Title ?? "Notification"),
    message: String(raw.message ?? raw.body ?? raw.Message ?? ""),
    type,
    senderUsername:
      (raw.sender_username as string | null) ??
      (raw.senderUsername as string | null) ??
      null,
    senderAvatar: toProxiedMediaUrlOrNull(
      (raw.sender_avatar as string | null) ??
        (raw.senderAvatar as string | null) ??
        null,
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
      (raw.productId as string | null) ??
      null,
    isRead: readFlag,
    createdAt:
      (raw.created_at as string | null) ??
      (raw.createdAt as string | null) ??
      (raw.CreatedAt as string | null) ??
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

function unwrapList(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) {
    return data.filter(
      (n): n is Record<string, unknown> => !!n && typeof n === "object",
    );
  }
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    for (const key of ["items", "results", "notifications", "data"]) {
      const nested = obj[key];
      if (Array.isArray(nested)) {
        return nested.filter(
          (n): n is Record<string, unknown> => !!n && typeof n === "object",
        );
      }
    }
  }
  return [];
}

async function listFeedNotifications() {
  const data = await apiRequest<unknown>(
    ApiConfig.feedBaseUrl,
    "/api/notifications",
  );
  return unwrapList(data).map((n) => asNotification(n, "feed"));
}

async function listShopNotifications() {
  const data = await apiRequest<unknown>(
    ApiConfig.shopBaseUrl,
    "/api/notifications",
  );
  return unwrapList(data).map((n) => asNotification(n, "shop"));
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

  return applyNotificationReadOverrides(
    sortByDate([...local, ...feed, ...shop]),
  );
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
  rememberNotificationsRead([id]);
  const { source, rawId } = splitId(id);
  if (source === "local") {
    markLocalNotificationRead(id);
    return;
  }
  if (source === "shop") {
    if (!rawId) return;
    await apiRequest(
      ApiConfig.shopBaseUrl,
      `/api/notifications/${encodeURIComponent(rawId)}/mark-read`,
      { method: "POST" },
    );
    return;
  }
  if (!rawId) return;
  await apiRequest(
    ApiConfig.feedBaseUrl,
    `/api/notifications/${encodeURIComponent(rawId)}/mark-as-read`,
    { method: "POST" },
  );
}

export async function markAllNotificationsRead(
  currentItems?: AppNotification[],
) {
  const items = currentItems ?? (await listNotifications().catch(() => []));
  rememberAllNotificationsRead(items);
  markAllLocalNotificationsRead();

  const unread = items.filter((n) => !n.isRead);

  await Promise.allSettled([
    apiRequest(ApiConfig.feedBaseUrl, "/api/notifications/mark-all-as-read", {
      method: "POST",
    }),
    apiRequest(ApiConfig.shopBaseUrl, "/api/notifications/mark-all-read", {
      method: "POST",
    }),
    // Per-item fallback when mark-all endpoints no-op on the backend.
    ...unread.map(async (n) => {
      const { source, rawId } = splitId(n.id);
      if (!rawId || source === "local") return;
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
    }),
  ]);
}

export async function deleteNotification(id: string) {
  rememberNotificationsRead([id]);
  const { source, rawId } = splitId(id);
  if (source === "local") {
    deleteLocalNotification(id);
    return;
  }
  if (source === "shop") {
    try {
      if (rawId) {
        await apiRequest(
          ApiConfig.shopBaseUrl,
          `/api/notifications/${encodeURIComponent(rawId)}/mark-read`,
          { method: "POST" },
        );
      }
    } catch {
      /* ignore */
    }
    return;
  }
  if (!rawId) return;
  await apiRequest(
    ApiConfig.feedBaseUrl,
    `/api/notifications/${encodeURIComponent(rawId)}`,
    { method: "DELETE" },
  );
}
