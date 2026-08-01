"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiException } from "@/lib/api-client";
import { getFeed } from "@/lib/feed-api";
import {
  loadSeenPostIds,
  rankFeedBatch,
  rememberSeenPostIds,
} from "@/lib/feed-rank";
import type { FeedPost } from "@/lib/types";
import { ComposePrompt } from "./ComposePrompt";
import { FeedCard } from "./FeedCard";
import { LiquidEmpty, LiquidError } from "./ui/LiquidChrome";

type Props = {
  refreshKey?: number;
  onCompose?: () => void;
  onOpenAuthor?: (userId: string, username?: string | null) => void;
};

export function FeedSection({
  refreshKey = 0,
  onCompose,
  onOpenAuthor,
}: Props) {
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatedLabel, setUpdatedLabel] = useState<string | null>(null);
  const sessionSeedRef = useRef(Date.now());
  const seenRef = useRef<Set<string>>(new Set());
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    seenRef.current = loadSeenPostIds();
  }, []);

  const load = useCallback(async (nextPage: number, reset: boolean) => {
    try {
      if (reset) {
        setLoading(true);
        sessionSeedRef.current = Date.now() ^ Math.floor(Math.random() * 1e9);
        seenRef.current = loadSeenPostIds();
      } else {
        setLoadingMore(true);
      }

      const data = await getFeed(nextPage);
      const ranked = rankFeedBatch(data.results, {
        sessionSeed: sessionSeedRef.current,
        seen: seenRef.current,
        // Stronger variety on first paint; milder on later pages.
        diversify: reset || nextPage <= 2,
      });

      setPosts((prev) => {
        if (reset) return ranked;
        const seen = new Set(prev.map((p) => p.id));
        return [...prev, ...ranked.filter((p) => !seen.has(p.id))];
      });
      setHasMore(Boolean(data.next));
      setPage(nextPage);
      setError(null);
      if (reset) {
        setUpdatedLabel("Fresh for you");
        window.setTimeout(() => setUpdatedLabel(null), 2200);
      }
    } catch (e) {
      const msg = e instanceof ApiException ? e.message : "Could not load feed";
      setError(msg);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    void load(1, true);
  }, [load, refreshKey]);

  // Mark posts as seen when they stay in view briefly.
  useEffect(() => {
    const root = listRef.current;
    if (!root || posts.length === 0) return;

    const pending = new Set<string>();
    const timers = new Map<string, number>();

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = (entry.target as HTMLElement).dataset.postId;
          if (!id) continue;
          if (entry.isIntersecting && entry.intersectionRatio >= 0.55) {
            if (timers.has(id) || seenRef.current.has(id)) continue;
            const t = window.setTimeout(() => {
              pending.add(id);
              seenRef.current.add(id);
              timers.delete(id);
              if (pending.size >= 4) {
                rememberSeenPostIds(Array.from(pending));
                pending.clear();
              }
            }, 900);
            timers.set(id, t);
          } else {
            const t = timers.get(id);
            if (t) {
              window.clearTimeout(t);
              timers.delete(id);
            }
          }
        }
      },
      { threshold: [0.55], rootMargin: "0px 0px -8% 0px" },
    );

    const nodes = root.querySelectorAll<HTMLElement>("[data-post-id]");
    nodes.forEach((node) => observer.observe(node));

    return () => {
      observer.disconnect();
      timers.forEach((t) => window.clearTimeout(t));
      if (pending.size) rememberSeenPostIds(Array.from(pending));
    };
  }, [posts]);

  if (loading && posts.length === 0) {
    return (
      <div className="feed-list py-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="feed-post liquid-glass animate-pulse p-4">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-[16px] bg-navy/10" />
              <div className="h-4 w-36 rounded-full bg-navy/10" />
            </div>
            <div className="mt-4 h-4 w-[80%] rounded-full bg-navy/[0.07]" />
            <div className="mt-3 h-48 w-full rounded-[20px] bg-navy/[0.06]" />
          </div>
        ))}
      </div>
    );
  }

  if (error && posts.length === 0) {
    return (
      <LiquidError message={error} onRetry={() => void load(1, true)} />
    );
  }

  if (posts.length === 0) {
    return (
      <div className="feed-list pb-8">
        {onCompose ? <ComposePrompt onCompose={onCompose} /> : null}
        <LiquidEmpty
          title="Start the conversation"
          body="No posts yet. Share something with Innovator."
          actionLabel={onCompose ? "Create a post" : undefined}
          onAction={onCompose}
        />
      </div>
    );
  }

  return (
    <div className="feed-list pb-8" ref={listRef}>
      {onCompose ? <ComposePrompt onCompose={onCompose} /> : null}

      <div className="mb-2 flex items-center justify-between gap-2 px-1">
        <p className="text-[12px] font-semibold text-navy/45">
          {updatedLabel ?? "Home feed"}
        </p>
        <button
          type="button"
          onClick={() => void load(1, true)}
          className="liquid-press rounded-full px-2.5 py-1 text-[12px] font-semibold text-navy/55 transition hover:bg-white hover:text-navy"
        >
          Refresh
        </button>
      </div>

      {posts.map((post, index) => (
        <div
          key={post.id}
          data-post-id={post.id}
          className="animate-fade-up"
          style={{ animationDelay: `${Math.min(index, 6) * 50}ms` }}
        >
          <FeedCard
            post={post}
            onChange={(updated) =>
              setPosts((prev) =>
                prev.map((p) => (p.id === updated.id ? updated : p)),
              )
            }
            onDeleted={(id) =>
              setPosts((prev) => prev.filter((p) => p.id !== id))
            }
            onBlocked={(userId) =>
              setPosts((prev) => prev.filter((p) => p.userId !== userId))
            }
            onOpenAuthor={onOpenAuthor}
          />
        </div>
      ))}

      {hasMore ? (
        <div className="flex justify-center pt-6">
          <button
            type="button"
            disabled={loadingMore}
            onClick={() => void load(page + 1, false)}
            className="liquid-btn liquid-btn-light max-w-[220px] text-[13.5px] disabled:opacity-50"
          >
            {loadingMore ? "Loading…" : "Show more"}
          </button>
        </div>
      ) : (
        <p className="pt-8 text-center text-[13px] text-muted">
          You’re all caught up
        </p>
      )}
    </div>
  );
}
