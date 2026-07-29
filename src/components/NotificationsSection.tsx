"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiException } from "@/lib/api-client";
import {
  deleteNotification,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/notifications-api";
import type { AppNotification } from "@/lib/types";
import {
  LiquidEmpty,
  LiquidError,
  LiquidLoader,
} from "./ui/LiquidChrome";

function timeAgo(iso?: string | null) {
  if (!iso) return "";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  const mins = Math.max(0, Math.round((Date.now() - t) / 60000));
  if (mins < 60) return `${mins}m`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}

export function NotificationsSection() {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "unread">("all");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setItems(await listNotifications());
      setError(null);
    } catch (e) {
      setError(
        e instanceof ApiException ? e.message : "Could not load notifications",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const shown = items.filter((n) => (filter === "all" ? true : !n.isRead));
  const unread = items.filter((n) => !n.isRead).length;

  if (loading) return <LiquidLoader label="Loading alerts…" />;

  return (
    <div className="space-y-4 pb-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2">
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
          className="liquid-chip"
          onClick={() =>
            void markAllNotificationsRead().then(() =>
              setItems((prev) => prev.map((n) => ({ ...n, isRead: true }))),
            )
          }
        >
          Mark all read
        </button>
      </div>

      {error ? (
        <LiquidError message={error} onRetry={() => void load()} />
      ) : null}

      {!error && shown.length === 0 ? (
        <LiquidEmpty
          title="You’re caught up"
          body="New likes, comments, and follows will land here."
        />
      ) : null}

      <ul className="space-y-2.5">
        {shown.map((n) => (
          <li
            key={n.id}
            className={`liquid-glass p-4 ${
              n.isRead ? "opacity-85" : "ring-1 ring-gold/40"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-display text-[15px] font-bold text-navy">
                  {n.title}
                </p>
                <p className="mt-1 text-[13.5px] text-ink/80">{n.message}</p>
                <p className="mt-2 text-[12px] text-muted">
                  {[n.senderUsername, timeAgo(n.createdAt)]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              <div className="flex shrink-0 flex-col gap-1.5">
                {!n.isRead ? (
                  <button
                    type="button"
                    className="liquid-chip !py-1 text-[11px]"
                    onClick={() =>
                      void markNotificationRead(n.id).then(() =>
                        setItems((prev) =>
                          prev.map((x) =>
                            x.id === n.id ? { ...x, isRead: true } : x,
                          ),
                        ),
                      )
                    }
                  >
                    Read
                  </button>
                ) : null}
                <button
                  type="button"
                  className="liquid-chip !py-1 text-[11px] text-red-600"
                  onClick={() =>
                    void deleteNotification(n.id).then(() =>
                      setItems((prev) => prev.filter((x) => x.id !== n.id)),
                    )
                  }
                >
                  Delete
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
