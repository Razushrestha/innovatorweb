"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ApiException } from "@/lib/api-client";
import {
  deleteNotification,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/notifications-api";
import type { AppNotification, NotificationTargetTab } from "@/lib/types";
import { LiquidError, LiquidLoader } from "./ui/LiquidChrome";

type Filter = "all" | "unread";
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
      return "Learn";
    default:
      return "Update";
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
  const [filter, setFilter] = useState<Filter>("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const next = await listNotifications();
      setItems(next);
      onUnreadChange?.(next.filter((n) => !n.isRead).length);
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
          onUnreadChange?.(next.filter((n) => !n.isRead).length);
        })
        .catch(() => undefined);
    }, 45000);
    return () => window.clearInterval(timer);
  }, [onUnreadChange]);

  const unread = useMemo(
    () => items.filter((n) => !n.isRead).length,
    [items],
  );
  const shown = useMemo(
    () => items.filter((n) => (filter === "all" ? true : !n.isRead)),
    [items, filter],
  );

  const groups = useMemo(() => {
    const order = ["today", "yesterday", "earlier"] as const;
    const map: Record<string, AppNotification[]> = {
      today: [],
      yesterday: [],
      earlier: [],
    };
    for (const n of shown) {
      map[dayKey(n.createdAt)].push(n);
    }
    return order
      .filter((k) => map[k].length > 0)
      .map((k) => ({ key: k, label: groupLabel(k), items: map[k] }));
  }, [shown]);

  async function onMarkRead(id: string) {
    setBusyId(id);
    try {
      await markNotificationRead(id);
      setItems((prev) => {
        const next = prev.map((x) =>
          x.id === id ? { ...x, isRead: true } : x,
        );
        onUnreadChange?.(next.filter((n) => !n.isRead).length);
        return next;
      });
    } finally {
      setBusyId(null);
    }
  }

  async function onMarkAll() {
    if (unread === 0) return;
    setMarkingAll(true);
    try {
      await markAllNotificationsRead();
      setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
      onUnreadChange?.(0);
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
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setFilter("all")}
            className={`liquid-chip ${filter === "all" ? "liquid-chip-active" : ""}`}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => setFilter("unread")}
            className={`liquid-chip ${filter === "unread" ? "liquid-chip-active" : ""}`}
          >
            Unread{unread > 0 ? ` · ${unread}` : ""}
          </button>
        </div>
        <button
          type="button"
          disabled={unread === 0 || markingAll}
          onClick={() => void onMarkAll()}
          className="text-[12.5px] font-semibold text-navy/50 transition hover:text-navy disabled:cursor-not-allowed disabled:opacity-40"
        >
          {markingAll ? "Updating…" : "Mark all read"}
        </button>
      </div>

      {error ? (
        <LiquidError message={error} onRetry={() => void load()} />
      ) : null}

      {!error && shown.length === 0 ? (
        <div className="px-1 py-14 text-center">
          <p className="font-display text-[18px] font-extrabold tracking-[-0.03em] text-navy">
            {filter === "unread" ? "No unread alerts" : "You’re caught up"}
          </p>
          <p className="mx-auto mt-1.5 max-w-[38ch] text-[13.5px] leading-relaxed text-muted">
            {filter === "unread"
              ? "Everything here has been reviewed."
              : "Collaborations, mutual posts, shop products, and e-learning updates show up here."}
          </p>
          {filter === "unread" ? (
            <button
              type="button"
              onClick={() => setFilter("all")}
              className="mt-4 text-[13px] font-semibold text-navy/60 underline-offset-2 hover:text-navy hover:underline"
            >
              View all
            </button>
          ) : null}
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

                  return (
                    <li key={n.id}>
                      <article
                        className={`notif-item ${n.isRead ? "" : "unread"}`}
                      >
                        <div className="notif-avatar" aria-hidden>
                          {n.senderAvatar ? (
                            <Image
                              src={n.senderAvatar}
                              alt=""
                              width={44}
                              height={44}
                              unoptimized
                            />
                          ) : (
                            <span className="font-display text-[16px] font-bold">
                              {letter}
                            </span>
                          )}
                          <span className="notif-type-badge">
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

function KindIcon({ kind }: { kind: NotifKind }) {
  switch (kind) {
    case "like":
      return (
        <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M12 21s-7-4.35-9.5-8.2C.5 9.4 2.2 5.8 5.6 5.2c1.9-.3 3.7.6 4.7 2.1 1-1.5 2.8-2.4 4.7-2.1 3.4.6 5.1 4.2 3.1 7.6C19 16.65 12 21 12 21z" />
        </svg>
      );
    case "comment":
      return (
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M5 6.5A2.5 2.5 0 017.5 4h9A2.5 2.5 0 0119 6.5v7A2.5 2.5 0 0116.5 16H10l-4 3v-3.2A2.5 2.5 0 015 13.5v-7z"
            stroke="currentColor"
            strokeWidth="2"
          />
        </svg>
      );
    case "collaborate":
      return (
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle cx="9" cy="9" r="3" stroke="currentColor" strokeWidth="2" />
          <circle cx="16" cy="10.5" r="2.5" stroke="currentColor" strokeWidth="2" />
          <path
            d="M4.5 18c.7-2.4 2.5-3.5 4.5-3.5s3.8 1.1 4.5 3.5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      );
    case "post":
      return (
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M5 7h14M5 12h10M5 17h8"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      );
    case "product":
      return (
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M4 8h16l-1.2 11.2A2 2 0 0116.8 21H7.2a2 2 0 01-2-1.8L4 8zM9 8V6.5A3 3 0 0112 3.5 3 3 0 0115 6.5V8"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "learn":
      return (
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M4 7.5 12 4l8 3.5-8 3.5L4 7.5zM6 10v5.5c0 .8 2.7 2.5 6 2.5s6-1.7 6-2.5V10"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "mention":
      return (
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle cx="12" cy="12" r="7.5" stroke="currentColor" strokeWidth="2" />
          <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
          <path
            d="M15 12v1.4a2.1 2.1 0 004.2 0V12"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      );
    default:
      return (
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M12 4v2M12 18v2M4 12H6M18 12h2M6.8 6.8l1.4 1.4M15.8 15.8l1.4 1.4M6.8 17.2l1.4-1.4M15.8 8.2l1.4-1.4"
            stroke="currentColor"
            strokeWidth="2"
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
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 7h14M9 7V5.5A1.5 1.5 0 0110.5 4h3A1.5 1.5 0 0115 5.5V7m-7 0l.7 12.2A1.5 1.5 0 0010.2 20.5h3.6a1.5 1.5 0 001.5-1.3L16 7"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
