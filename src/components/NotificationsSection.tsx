"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ApiException } from "@/lib/api-client";
import {
  normalizeShopImageUrl,
  toProxiedMediaUrl,
} from "@/lib/media-url";
import {
  deleteNotification,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/notifications-api";
import { getProfileByAuthUserId } from "@/lib/profile-api";
import { searchAll } from "@/lib/search-api";
import { findShopProductImage } from "@/lib/shop-api";
import type { AppNotification, NotificationTargetTab } from "@/lib/types";
import { LiquidError, LiquidLoader } from "./ui/LiquidChrome";

type NotifKind =
  | "like"
  | "comment"
  | "collaborate"
  | "mention"
  | "post"
  | "product"
  | "learn"
  | "system";

export type NotificationOpenTarget = {
  tab?: NotificationTargetTab;
  userId?: string | null;
  postId?: string | null;
  productId?: string | null;
  courseId?: string | null;
};

type Props = {
  onOpenTarget?: (target: NotificationOpenTarget) => void;
  onUnreadChange?: (count: number) => void;
};

function timeAgo(iso?: string | null) {
  if (!iso) return "";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  const mins = Math.max(0, Math.round((Date.now() - t) / 60000));
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(t).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function dayKey(iso?: string | null) {
  if (!iso) return "earlier";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "earlier";
  const d = new Date(t);
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startYesterday = new Date(startToday);
  startYesterday.setDate(startYesterday.getDate() - 1);
  if (d >= startToday) return "today";
  if (d >= startYesterday) return "yesterday";
  return "earlier";
}

function kindOf(n: AppNotification): NotifKind {
  const blob = `${n.type ?? ""} ${n.title} ${n.message}`.toLowerCase();
  if (/(like|loved|heart|react)/.test(blob)) return "like";
  if (/(comment|replied|reply)/.test(blob)) return "comment";
  if (/(follow|collab|collaborat|connect|mutual)/.test(blob)) {
    return "collaborate";
  }
  if (/(mention|tagged|@)/.test(blob)) return "mention";
  if (/(product|shop|ecommerce|commerce|order)/.test(blob)) return "product";
  if (/(learn|course|enroll|e-learning|elearning)/.test(blob)) return "learn";
  if (/(post|innovation|shared)/.test(blob)) return "post";
  return "system";
}

function kindLabel(kind: NotifKind) {
  switch (kind) {
    case "like":
      return "Like";
    case "comment":
      return "Comment";
    case "collaborate":
      return "Collaborate";
    case "mention":
      return "Mention";
    case "post":
      return "Post";
    case "product":
      return "Shop";
    case "learn":
      return "E-learning";
    default:
      return "Update";
  }
}

function kindActionLabel(kind: NotifKind) {
  switch (kind) {
    case "product":
      return "Shop";
    case "learn":
      return "E-learning";
    case "collaborate":
      return "Profile";
    case "post":
      return "Feed";
    case "like":
    case "comment":
    case "mention":
      return "View";
    default:
      return null;
  }
}

function groupLabel(key: string) {
  if (key === "today") return "Today";
  if (key === "yesterday") return "Yesterday";
  return "Earlier";
}

function targetFromNotification(n: AppNotification): NotificationOpenTarget {
  const kind = kindOf(n);
  if (n.targetTab) {
    return {
      tab: n.targetTab,
      userId: n.relatedUserId,
      postId: n.relatedPostId,
      productId: n.relatedProductId,
      courseId: n.relatedCourseId,
    };
  }
  if (kind === "product") {
    return { tab: "shop", productId: n.relatedProductId };
  }
  if (kind === "learn") {
    return { tab: "learn", courseId: n.relatedCourseId };
  }
  if (kind === "collaborate") {
    return { tab: n.relatedUserId ? "profile" : "chat", userId: n.relatedUserId };
  }
  if (kind === "post") {
    return {
      tab: "feed",
      postId: n.relatedPostId,
      userId: n.relatedUserId,
    };
  }
  return { tab: "feed", postId: n.relatedPostId, userId: n.relatedUserId };
}

export function NotificationsSection({
  onOpenTarget,
  onUnreadChange,
}: Props) {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const next = await listNotifications();
      setItems(next);
      onUnreadChange?.(next.length);
      setError(null);
    } catch (e) {
      setError(
        e instanceof ApiException ? e.message : "Could not load notifications",
      );
    } finally {
      setLoading(false);
    }
  }, [onUnreadChange]);

  useEffect(() => {
    void load();
  }, [load]);

  // Soft refresh while the tab is open
  useEffect(() => {
    const timer = window.setInterval(() => {
      void listNotifications()
        .then((next) => {
          setItems(next);
          onUnreadChange?.(next.length);
        })
        .catch(() => undefined);
    }, 45000);
    return () => window.clearInterval(timer);
  }, [onUnreadChange]);

  const unread = items.length;

  const groups = useMemo(() => {
    const order = ["today", "yesterday", "earlier"] as const;
    const map: Record<string, AppNotification[]> = {
      today: [],
      yesterday: [],
      earlier: [],
    };
    for (const n of items) {
      map[dayKey(n.createdAt)].push(n);
    }
    return order
      .filter((k) => map[k].length > 0)
      .map((k) => ({ key: k, label: groupLabel(k), items: map[k] }));
  }, [items]);

  async function onMarkRead(id: string) {
    setBusyId(id);
    // Remove from the list immediately — read alerts are not shown again.
    setItems((prev) => {
      const next = prev.filter((x) => x.id !== id);
      onUnreadChange?.(next.length);
      return next;
    });
    try {
      await markNotificationRead(id);
    } catch {
      /* local override still keeps it read on next load */
    } finally {
      setBusyId(null);
    }
  }

  async function onMarkAll() {
    if (unread === 0 || markingAll) return;
    setMarkingAll(true);
    const snapshot = items;
    // Optimistic: clear the list — only unread alerts are kept.
    setItems([]);
    onUnreadChange?.(0);
    try {
      await markAllNotificationsRead(snapshot);
    } catch {
      /* overrides + local store still keep everything read */
    } finally {
      setMarkingAll(false);
    }
  }

  async function onDelete(id: string) {
    setBusyId(id);
    try {
      await deleteNotification(id);
      setItems((prev) => {
        const next = prev.filter((x) => x.id !== id);
        onUnreadChange?.(next.filter((n) => !n.isRead).length);
        return next;
      });
    } finally {
      setBusyId(null);
    }
  }

  async function onOpen(n: AppNotification) {
    if (!n.isRead) await onMarkRead(n.id);
    onOpenTarget?.(targetFromNotification(n));
  }

  if (loading) return <LiquidLoader label="Loading notifications…" />;

  return (
    <div className="notif-shell space-y-3 pb-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[13px] font-semibold text-navy/55">
          {unread > 0 ? `${unread} unread` : "All caught up"}
        </p>
        <button
          type="button"
          disabled={unread === 0 || markingAll}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            void onMarkAll();
          }}
          className="rounded-full px-3 py-1.5 text-[12.5px] font-semibold text-navy/70 transition hover:bg-white hover:text-navy disabled:cursor-not-allowed disabled:opacity-40"
        >
          {markingAll ? "Updating…" : "Mark all read"}
        </button>
      </div>

      {error ? (
        <LiquidError message={error} onRetry={() => void load()} />
      ) : null}

      {!error && items.length === 0 ? (
        <div className="px-1 py-14 text-center">
          <p className="font-display text-[18px] font-extrabold tracking-[-0.03em] text-navy">
            You’re caught up
          </p>
          <p className="mx-auto mt-1.5 max-w-[38ch] text-[13.5px] leading-relaxed text-muted">
            New collaborations, mutual posts, shop products, and e-learning
            updates will show up here.
          </p>
        </div>
      ) : null}

      {!error && groups.length > 0 ? (
        <div className="space-y-5">
          {groups.map((group) => (
            <section key={group.key}>
              <h3 className="notif-group-label">{group.label}</h3>
              <ul className="notif-list">
                {group.items.map((n) => {
                  const kind = kindOf(n);
                  const letter = (
                    n.senderUsername?.trim()?.[0] ||
                    n.title.trim()?.[0] ||
                    "N"
                  ).toUpperCase();
                  const busy = busyId === n.id;

                  const action = kindActionLabel(kind);
                  return (
                    <li key={n.id}>
                      <article
                        className={`notif-item ${n.isRead ? "" : "unread"}`}
                      >
                        <div className="notif-avatar-wrap" aria-hidden>
                          <NotifAvatar
                            src={n.senderAvatar}
                            letter={letter}
                            kind={kind}
                            productId={
                              n.relatedProductId ||
                              n.id.match(/^local:product:(.+)$/i)?.[1] ||
                              null
                            }
                            productHint={n.message}
                            userId={n.relatedUserId}
                            username={
                              n.senderUsername ||
                              (!/\s/.test(n.title.trim()) ? n.title.trim() : null)
                            }
                          />
                          <span className={`notif-type-badge ${kind}`}>
                            <KindIcon kind={kind} />
                          </span>
                        </div>

                        <button
                          type="button"
                          className="min-w-0 text-left"
                          disabled={busy}
                          onClick={() => void onOpen(n)}
                        >
                          <span className="notif-title">{n.title}</span>
                          {n.message ? (
                            <span className="notif-message line-clamp-2 block">
                              {n.message}
                            </span>
                          ) : null}
                          {action ? (
                            <span className="notif-action-link">
                              <KindIcon kind={kind} size={12} />
                              {action}
                            </span>
                          ) : null}
                          <span className="notif-meta">
                            <span>{kindLabel(kind)}</span>
                            {n.senderUsername ? (
                              <span>· @{n.senderUsername}</span>
                            ) : null}
                            {!n.isRead ? (
                              <span className="font-bold text-[var(--gold)]">
                                · New
                              </span>
                            ) : null}
                          </span>
                        </button>

                        <div className="notif-actions">
                          <span className="notif-time">
                            {timeAgo(n.createdAt)}
                          </span>
                          {!n.isRead ? (
                            <button
                              type="button"
                              disabled={busy}
                              className="notif-icon-btn"
                              title="Mark as read"
                              aria-label="Mark as read"
                              onClick={() => void onMarkRead(n.id)}
                            >
                              <IconCheck />
                            </button>
                          ) : null}
                          <button
                            type="button"
                            disabled={busy}
                            className="notif-icon-btn danger"
                            title="Delete"
                            aria-label="Delete notification"
                            onClick={() => void onDelete(n.id)}
                          >
                            <IconTrash />
                          </button>
                        </div>
                      </article>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function resolveNotifImage(src: string | null | undefined, kind: NotifKind) {
  const raw = src?.trim() || "";
  if (!raw) return "";
  // Public app assets (courses, logos) — keep same-origin paths as-is.
  if (
    raw.startsWith("/courses/") ||
    raw.startsWith("/innovator") ||
    raw.startsWith("/app_") ||
    raw.startsWith("/center_")
  ) {
    return raw;
  }
  if (kind === "product") {
    return normalizeShopImageUrl(raw) || toProxiedMediaUrl(raw, "shopmedia");
  }
  if (kind === "learn") {
    if (raw.startsWith("/")) return raw;
    return toProxiedMediaUrl(raw, "feed") || raw;
  }
  return toProxiedMediaUrl(raw, "profile");
}

async function fetchUserAvatar(
  userId: string | null | undefined,
  username: string | null | undefined,
): Promise<string> {
  if (userId?.trim()) {
    try {
      const profile = await getProfileByAuthUserId(userId.trim());
      const avatar = profile.avatar?.trim() || "";
      if (avatar) return toProxiedMediaUrl(avatar, "profile") || avatar;
    } catch {
      /* try username search */
    }
  }

  const q = username?.trim().replace(/^@/, "");
  if (!q) return "";

  try {
    const { users } = await searchAll(q);
    const needle = q.toLowerCase();
    const hit =
      users.find((u) => u.username.toLowerCase() === needle) ||
      users.find((u) => u.username.toLowerCase().includes(needle)) ||
      users[0];
    if (hit?.avatar?.trim()) return hit.avatar;
    if (hit?.id) {
      try {
        const profile = await getProfileByAuthUserId(hit.id);
        const avatar = profile.avatar?.trim() || "";
        if (avatar) return toProxiedMediaUrl(avatar, "profile") || avatar;
      } catch {
        /* no photo */
      }
    }
  } catch {
    /* ignore */
  }
  return "";
}

async function fetchProductImage(
  productId: string | null | undefined,
  hint: string | null | undefined,
): Promise<string> {
  try {
    const found = await findShopProductImage({
      productId,
      nameHint: hint,
    });
    return found.image || "";
  } catch {
    return "";
  }
}

function NotifAvatar({
  src,
  letter,
  kind,
  productId,
  productHint,
  userId,
  username,
}: {
  src?: string | null;
  letter: string;
  kind: NotifKind;
  productId?: string | null;
  productHint?: string | null;
  userId?: string | null;
  username?: string | null;
}) {
  const initial = useMemo(() => resolveNotifImage(src, kind), [src, kind]);
  const [photo, setPhoto] = useState(initial);
  const [failed, setFailed] = useState(false);
  const fetchTried = useRef(false);
  const peopleKind =
    kind === "like" ||
    kind === "comment" ||
    kind === "collaborate" ||
    kind === "mention" ||
    kind === "post";

  useEffect(() => {
    setPhoto(initial);
    setFailed(false);
    fetchTried.current = false;
  }, [initial, productId, productHint, userId, username]);

  useEffect(() => {
    if (photo && !failed) return;
    if (fetchTried.current) return;
    fetchTried.current = true;
    let cancelled = false;

    const run =
      kind === "product"
        ? fetchProductImage(productId, productHint)
        : peopleKind
          ? fetchUserAvatar(userId, username)
          : Promise.resolve("");

    void run.then((url) => {
      if (cancelled || !url) return;
      setPhoto(url);
      setFailed(false);
    });
    return () => {
      cancelled = true;
    };
  }, [
    kind,
    peopleKind,
    photo,
    failed,
    productId,
    productHint,
    userId,
    username,
  ]);

  if (photo && !failed) {
    return (
      <div className="notif-avatar notif-avatar-photo">
        <Image
          src={photo}
          alt=""
          fill
          sizes="44px"
          unoptimized
          className="object-cover"
          onError={() => setFailed(true)}
        />
      </div>
    );
  }

  return (
    <div className="notif-avatar">
      {kind === "product" ? (
        <KindIcon kind="product" size={20} />
      ) : kind === "learn" ? (
        <KindIcon kind="learn" size={20} />
      ) : (
        <span className="notif-avatar-fallback">{letter}</span>
      )}
    </div>
  );
}

function KindIcon({
  kind,
  size = 11,
}: {
  kind: NotifKind;
  size?: number;
}) {
  const props = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none" as const,
    "aria-hidden": true as const,
  };

  switch (kind) {
    case "like":
      return (
        <svg {...props}>
          <path
            d="M12 20.5s-6.8-4.1-9.2-7.8C.6 9.4 2.2 5.8 5.6 5.3c1.8-.3 3.5.6 4.5 2 1-1.4 2.7-2.3 4.5-2 3.4.5 5 4.1 2.8 7.4C18.8 16.4 12 20.5 12 20.5z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "comment":
      return (
        <svg {...props}>
          <path
            d="M5 7a2.5 2.5 0 012.5-2.5h9A2.5 2.5 0 0119 7v6.5A2.5 2.5 0 0116.5 16H10l-4.5 3v-3H7.5A2.5 2.5 0 015 13.5V7z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "collaborate":
      return (
        <svg {...props}>
          <circle cx="9" cy="8.5" r="2.8" stroke="currentColor" strokeWidth="1.8" />
          <circle cx="16.2" cy="9.5" r="2.3" stroke="currentColor" strokeWidth="1.8" />
          <path
            d="M4.2 18c.6-2.5 2.5-3.8 4.8-3.8 1.5 0 2.8.5 3.7 1.4"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <path
            d="M14.2 18c.4-1.5 1.6-2.5 3.4-2.5 1.3 0 2.3.5 2.9 1.3"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      );
    case "post":
      return (
        <svg {...props}>
          <path
            d="M7 4.5h7.2L19 9.3V19a1.5 1.5 0 01-1.5 1.5h-10A1.5 1.5 0 016 19V6A1.5 1.5 0 017.5 4.5H7z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <path
            d="M14 4.5V9h4.8M9 13h6M9 16.5h4"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "product":
      // Professional shopping-bag icon (matches shop product alerts).
      return (
        <svg {...props}>
          <path
            d="M6.2 8.2h11.6l-.9 10.4a1.8 1.8 0 01-1.8 1.6H8.9a1.8 1.8 0 01-1.8-1.6L6.2 8.2z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <path
            d="M9 8.2V6.6A3 3 0 0112 3.6a3 3 0 013 3v1.6"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      );
    case "learn":
      return (
        <svg {...props}>
          <path
            d="M3.8 8.2 12 4.5l8.2 3.7L12 11.9 3.8 8.2z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <path
            d="M6.5 10.2v5.2c0 1.2 2.5 2.6 5.5 2.6s5.5-1.4 5.5-2.6v-5.2"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <path
            d="M20.2 8.5v6.2"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      );
    case "mention":
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="7.2" stroke="currentColor" strokeWidth="1.8" />
          <circle cx="12" cy="12" r="2.8" stroke="currentColor" strokeWidth="1.8" />
          <path
            d="M14.8 12v1.3a2 2 0 003.9 0V12"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      );
    default:
      return (
        <svg {...props}>
          <path
            d="M12 6.5a3.2 3.2 0 00-3.2 3.2c0 2.4 3.2 5.3 3.2 5.3s3.2-2.9 3.2-5.3A3.2 3.2 0 0012 6.5z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <circle cx="12" cy="9.6" r="1.1" fill="currentColor" />
          <path
            d="M8 18.5h8"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      );
  }
}

function IconCheck() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 12.5l4.5 4.5L19 7"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconTrash() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4.5 7h15"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <path
        d="M9.2 7V5.4A1.4 1.4 0 0110.6 4h2.8a1.4 1.4 0 011.4 1.4V7"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <path
        d="M8.2 7l.55 12.1A1.5 1.5 0 0010.25 20.5h3.5a1.5 1.5 0 001.5-1.4L15.8 7"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path
        d="M10.5 11v5.5M13.5 11v5.5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}
