import type { FeedPost } from "./types";

const SEEN_KEY = "innovator_feed_seen_v1";
const MAX_SEEN = 220;

function canUseStorage() {
  return typeof window !== "undefined" && !!window.localStorage;
}

export function loadSeenPostIds(): Set<string> {
  if (!canUseStorage()) return new Set();
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.map(String).filter(Boolean));
  } catch {
    return new Set();
  }
}

export function rememberSeenPostIds(ids: string[]) {
  if (!canUseStorage() || ids.length === 0) return;
  try {
    const prev = Array.from(loadSeenPostIds());
    const next = [...ids, ...prev.filter((id) => !ids.includes(id))].slice(
      0,
      MAX_SEEN,
    );
    localStorage.setItem(SEEN_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

/** Stable seeded random in [0, 1) from post id + session seed. */
export function seededUnit(postId: string, sessionSeed: number) {
  let h = sessionSeed ^ 0x9e3779b9;
  const s = `${postId}:${sessionSeed}`;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 0x85ebca6b);
    h ^= h >>> 13;
  }
  return ((h >>> 0) % 10_000) / 10_000;
}

function recencyScore(iso?: string | null) {
  if (!iso) return 0;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return 0;
  const ageHours = Math.max(0, (Date.now() - t) / 3_600_000);
  // Fresh posts score high; older posts decay.
  return Math.max(0, 100 - ageHours * 4);
}

function engagementScore(post: FeedPost) {
  return (
    (post.reactionsCount || 0) * 2 +
    (post.commentsCount || 0) * 3 +
    (post.shareCount || 0) * 2.5 +
    Math.min(post.viewsCount || 0, 40) * 0.15
  );
}

export function scoreFeedPost(
  post: FeedPost,
  seen: Set<string>,
  sessionSeed: number,
) {
  const unseenBoost = seen.has(post.id) ? 0 : 34;
  const jitter = seededUnit(post.id, sessionSeed) * 12;
  return recencyScore(post.createdAt) + engagementScore(post) + unseenBoost + jitter;
}

/** Avoid several posts from the same author in a row. */
export function diversifyByAuthor(posts: FeedPost[]) {
  if (posts.length < 3) return posts;
  const out: FeedPost[] = [];
  const rest = [...posts];
  while (rest.length) {
    let pick = 0;
    const lastAuthor = out[out.length - 1]?.userId;
    if (lastAuthor) {
      const alt = rest.findIndex((p) => p.userId !== lastAuthor);
      if (alt > 0) pick = alt;
    }
    out.push(rest.splice(pick, 1)[0]!);
  }
  return out;
}

/**
 * Rank a batch for a "fresh session" feel.
 * Use on initial load / refresh; append pages with milder ranking.
 */
export function rankFeedBatch(
  posts: FeedPost[],
  opts: {
    sessionSeed: number;
    seen?: Set<string>;
    diversify?: boolean;
  },
) {
  const seen = opts.seen ?? loadSeenPostIds();
  const scored = [...posts].sort(
    (a, b) =>
      scoreFeedPost(b, seen, opts.sessionSeed) -
      scoreFeedPost(a, seen, opts.sessionSeed),
  );
  return opts.diversify === false ? scored : diversifyByAuthor(scored);
}
