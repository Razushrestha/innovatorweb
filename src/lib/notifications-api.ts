import {
  cleanNotificationCopy,
  deleteLocalNotification,
  getLocalNotifications,
  markAllLocalNotificationsRead,
  markLocalNotificationRead,
  syncActivityNotifications,
} from "./activity-notifications";
import { ApiConfig } from "./api-config";
import { apiRequest } from "./api-client";
import {
  normalizeShopImageUrl,
  toProxiedMediaUrlOrNull,
} from "./media-url";
import {
  applyNotificationReadOverrides,
  rememberAllNotificationsRead,
  rememberNotificationsRead,
} from "./notification-read-state";
import { getProfileByAuthUserId } from "./profile-api";
import { searchAll } from "./search-api";
import { attachProductImagesToNotifications } from "./notification-product-images";
import type { AppNotification, NotificationSource } from "./types";

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : null;
}

function firstString(...vals: unknown[]): string | null {
  for (const v of vals) {
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

function pickRawImage(raw: Record<string, unknown>): string | null {
  const nested =
    asRecord(raw.product) ??
    asRecord(raw.data) ??
    asRecord(raw.sender) ??
    asRecord(raw.user) ??
    asRecord(raw.actor) ??
    asRecord(raw.from_user) ??
    null;
  return firstString(
    raw.sender_avatar,
    raw.senderAvatar,
    raw.avatar,
    raw.profile_image,
    raw.profileImage,
    raw.image,
    raw.product_image,
    raw.productImage,
    raw.thumbnail,
    raw.cover,
    nested?.avatar,
    nested?.image,
    nested?.product_image,
    nested?.thumbnail,
    nested?.profile_image,
  );
}

function pickSenderUsername(raw: Record<string, unknown>): string | null {
  const nested =
    asRecord(raw.sender) ??
    asRecord(raw.user) ??
    asRecord(raw.actor) ??
    asRecord(raw.from_user) ??
    null;
  return firstString(
    raw.sender_username,
    raw.senderUsername,
    raw.username,
    nested?.username,
    nested?.name,
  );
}

function pickSenderUserId(raw: Record<string, unknown>): string | null {
  const nested =
    asRecord(raw.sender) ??
    asRecord(raw.user) ??
    asRecord(raw.actor) ??
    asRecord(raw.from_user) ??
    null;
  return firstString(
    raw.sender_id,
    raw.senderId,
    raw.related_user_id,
    raw.relatedUserId,
    raw.user_id,
    raw.userId,
    raw.actor_id,
    raw.actorId,
    nested?.id,
    nested?.auth_user_id,
    nested?.authUserId,
  );
}

function isPeopleNotification(n: AppNotification) {
  if (isProductNotification(n)) return false;
  const blob = `${n.type ?? ""} ${n.title} ${n.message}`.toLowerCase();
  return (
    !!n.relatedUserId ||
    !!n.senderUsername ||
    /(like|react|comment|follow|collab|mention|tagged|replied|post)/i.test(blob)
  );
}

function isProductNotification(n: Pick<AppNotification, "type" | "title" | "targetTab" | "relatedProductId">) {
  const blob = `${n.type ?? ""} ${n.title ?? ""}`;
  return (
    !!n.relatedProductId ||
    n.targetTab === "shop" ||
    /(product|shop|order|commerce)/i.test(blob)
  );
}

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

  const relatedProductId =
    (raw.related_product_id as string | null) ??
    (raw.product_id as string | null) ??
    (raw.productId as string | null) ??
    ((raw.product as Record<string, unknown> | undefined)?.id as string | null) ??
    null;

  const targetTab =
    source === "shop"
      ? "shop"
      : /(product|shop|order|commerce)/i.test(String(type ?? ""))
        ? "shop"
        : /(collab|follow)/i.test(String(type ?? ""))
          ? "profile"
          : /(learn|course)/i.test(String(type ?? ""))
            ? "learn"
            : "feed";

  const rawImage = pickRawImage(raw);
  const productLike =
    targetTab === "shop" ||
    !!relatedProductId ||
    /(product|shop)/i.test(String(type ?? ""));

  const senderUsername = pickSenderUsername(raw);
  const relatedUserId = pickSenderUserId(raw);

  return {
    id: `${source}:${id}`,
    title: cleanNotificationCopy(
      String(raw.title ?? raw.Title ?? "Notification"),
    ),
    message: cleanNotificationCopy(
      String(raw.message ?? raw.body ?? raw.Message ?? ""),
    ),
    type,
    senderUsername,
    senderAvatar: productLike
      ? normalizeShopImageUrl(rawImage) ||
        toProxiedMediaUrlOrNull(rawImage, "shopmedia")
      : toProxiedMediaUrlOrNull(rawImage, "profile"),
    relatedPostId:
      (raw.related_post_id as string | null) ??
      (raw.relatedPostId as string | null) ??
      null,
    relatedUserId,
    relatedProductId,
    isRead: readFlag,
    createdAt:
      (raw.created_at as string | null) ??
      (raw.createdAt as string | null) ??
      (raw.CreatedAt as string | null) ??
      null,
    source,
    targetTab,
  };
}

function usernameFromNotification(n: AppNotification): string | null {
  if (n.senderUsername?.trim()) return n.senderUsername.trim();
  // Titles like "yubrajshahi395" or messages "user reacted to your post"
  const title = n.title?.trim() || "";
  if (title && !/\s/.test(title) && title.length >= 2 && title.length <= 40) {
    return title.replace(/^@/, "");
  }
  const m = n.message.match(
    /^@?([A-Za-z0-9._-]{2,40})\s+(reacted|liked|commented|replied|started|followed)/i,
  );
  return m?.[1] || null;
}

async function resolveUserAvatar(
  userId: string | null,
  username: string | null,
): Promise<{ avatar: string; userId?: string; username?: string }> {
  if (userId?.trim()) {
    try {
      const profile = await getProfileByAuthUserId(userId.trim());
      const avatar = profile.avatar?.trim() || "";
      if (avatar) {
        return {
          avatar: toProxiedMediaUrlOrNull(avatar, "profile") || avatar,
          userId: profile.authUserId || userId,
          username: profile.username || username || undefined,
        };
      }
    } catch {
      /* try search */
    }
  }

  if (username?.trim()) {
    try {
      const { users } = await searchAll(username.trim());
      const needle = username.trim().toLowerCase();
      const hit =
        users.find((u) => u.username.toLowerCase() === needle) ||
        users.find((u) => u.username.toLowerCase().includes(needle)) ||
        users[0];
      if (hit?.avatar?.trim()) {
        return {
          avatar: hit.avatar,
          userId: hit.id || userId || undefined,
          username: hit.username || username,
        };
      }
      if (hit?.id) {
        try {
          const profile = await getProfileByAuthUserId(hit.id);
          const avatar = profile.avatar?.trim() || "";
          if (avatar) {
            return {
              avatar: toProxiedMediaUrlOrNull(avatar, "profile") || avatar,
              userId: hit.id,
              username: profile.username || hit.username,
            };
          }
        } catch {
          /* no avatar */
        }
      }
    } catch {
      /* ignore */
    }
  }

  return { avatar: "" };
}

async function enrichUserAvatars(items: AppNotification[]) {
  const needs = items.filter(
    (n) => isPeopleNotification(n) && !n.senderAvatar?.trim(),
  );
  if (!needs.length) return items;

  const cache = new Map<string, Awaited<ReturnType<typeof resolveUserAvatar>>>();

  return Promise.all(
    items.map(async (n) => {
      if (!isPeopleNotification(n) || n.senderAvatar?.trim()) return n;
      const username = usernameFromNotification(n);
      const key = `${n.relatedUserId || ""}:${username || ""}`;
      if (!key.replace(":", "")) return n;

      let resolved = cache.get(key);
      if (!resolved) {
        resolved = await resolveUserAvatar(n.relatedUserId ?? null, username);
        cache.set(key, resolved);
      }
      if (!resolved.avatar) return n;

      return {
        ...n,
        senderAvatar: resolved.avatar,
        relatedUserId: resolved.userId || n.relatedUserId,
        senderUsername: resolved.username || n.senderUsername || username,
      };
    }),
  );
}

/** Attach real product thumbnails when the API/local alert omitted them. */
async function enrichProductThumbnails(items: AppNotification[]) {
  const resolved = await attachProductImagesToNotifications(items);
  try {
    patchLocalProductAvatars(resolved);
  } catch {
    /* ignore */
  }
  return resolved;
}

function patchLocalProductAvatars(items: AppNotification[]) {
  if (typeof window === "undefined" || !window.localStorage) return;
  const key = "innovator_activity_notifications_v1";
  const raw = window.localStorage.getItem(key);
  if (!raw) return;
  const store = JSON.parse(raw) as {
    items?: AppNotification[];
    [k: string]: unknown;
  };
  if (!Array.isArray(store.items)) return;
  const byId = new Map(
    items
      .filter((n) => n.id.startsWith("local:") && n.senderAvatar)
      .map((n) => [n.id, n.senderAvatar] as const),
  );
  if (!byId.size) return;
  let changed = false;
  store.items = store.items.map((n) => {
    const next = byId.get(n.id);
    if (next && n.senderAvatar !== next) {
      changed = true;
      return { ...n, senderAvatar: next, type: n.type || "product" };
    }
    return n;
  });
  if (changed) {
    window.localStorage.setItem(key, JSON.stringify(store));
  }
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

/**
 * Sync activity + merge feed/shop/local notifications.
 * Only unread items are returned (and enriched) so the page stays fast.
 */
export async function listNotifications() {
  const local = await syncActivityNotifications().catch(() =>
    getLocalNotifications(),
  );

  const [feed, shop] = await Promise.all([
    listFeedNotifications().catch(() => [] as AppNotification[]),
    listShopNotifications().catch(() => [] as AppNotification[]),
  ]);

  const merged = applyNotificationReadOverrides(
    sortByDate([...local, ...feed, ...shop]).map((n) => ({
      ...n,
      title: cleanNotificationCopy(n.title || ""),
      message: cleanNotificationCopy(n.message || ""),
    })),
  );

  // Drop read alerts before expensive avatar/product enrichment.
  const unread = merged.filter((n) => !n.isRead);
  if (!unread.length) return [];

  const withProductThumbs = await enrichProductThumbnails(unread);
  const withUserThumbs = await enrichUserAvatars(withProductThumbs);

  return withUserThumbs.map((n) => ({
    ...n,
    senderAvatar: isProductNotification(n)
      ? normalizeShopImageUrl(n.senderAvatar) ||
        toProxiedMediaUrlOrNull(n.senderAvatar, "shopmedia")
      : toProxiedMediaUrlOrNull(n.senderAvatar, "profile"),
  }));
}

export async function getUnreadNotificationCount() {
  try {
    const local = await syncActivityNotifications().catch(() =>
      getLocalNotifications(),
    );
    const [feed, shop] = await Promise.all([
      listFeedNotifications().catch(() => [] as AppNotification[]),
      listShopNotifications().catch(() => [] as AppNotification[]),
    ]);
    const merged = applyNotificationReadOverrides(
      sortByDate([...local, ...feed, ...shop]),
    );
    return merged.filter((n) => !n.isRead).length;
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
