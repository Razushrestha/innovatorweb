"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiException } from "@/lib/api-client";
import { getFeed } from "@/lib/feed-api";
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

  const load = useCallback(async (nextPage: number, reset: boolean) => {
    try {
      if (reset) setLoading(true);
      else setLoadingMore(true);
      const data = await getFeed(nextPage);
      setPosts((prev) => {
        if (reset) return data.results;
        const seen = new Set(prev.map((p) => p.id));
        return [...prev, ...data.results.filter((p) => !seen.has(p.id))];
      });
      setHasMore(Boolean(data.next));
      setPage(nextPage);
      setError(null);
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

  if (loading && posts.length === 0) {
    return (
      <div className="space-y-3.5 py-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="liquid-glass animate-pulse p-4">
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
      <div className="space-y-3.5 pb-8">
        {onCompose ? <ComposePrompt onCompose={onCompose} /> : null}
        <LiquidEmpty
          title="Start the conversation"
          body="No posts yet — share something with Innovator."
          actionLabel={onCompose ? "Create a post" : undefined}
          onAction={onCompose}
        />
      </div>
    );
  }

  return (
    <div className="space-y-3.5 pb-8">
      {onCompose ? <ComposePrompt onCompose={onCompose} /> : null}

      <div className="space-y-3.5">
        {posts.map((post, index) => (
          <div
            key={post.id}
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
      </div>

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
