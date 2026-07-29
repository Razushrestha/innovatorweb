"use client";

import Image from "next/image";
import {
  FormEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ApiException } from "@/lib/api-client";
import { searchAll, suggestedUsers } from "@/lib/search-api";
import type { SearchPostHit, SearchUserHit } from "@/lib/types";
import { BrandMark } from "./BrandMark";
import { LiquidError, LiquidLoader } from "./ui/LiquidChrome";

const HISTORY_KEY = "innovator_search_history";
const MAX_HISTORY = 8;

type Props = {
  onOpenAuthor?: (userId: string, name?: string | null) => void;
};

function loadHistory(): string[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.map(String).filter(Boolean).slice(0, MAX_HISTORY);
  } catch {
    return [];
  }
}

function saveHistory(items: string[]) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0, MAX_HISTORY)));
  } catch {
    /* ignore */
  }
}

function highlight(text: string, query: string) {
  const q = query.trim();
  if (!q) return text;
  const lower = text.toLowerCase();
  const needle = q.toLowerCase();
  const parts: ReactNode[] = [];
  let start = 0;
  let idx = lower.indexOf(needle);
  let key = 0;
  while (idx !== -1) {
    if (idx > start) parts.push(text.slice(start, idx));
    parts.push(
      <mark key={key++} className="search-mark">
        {text.slice(idx, idx + needle.length)}
      </mark>,
    );
    start = idx + needle.length;
    idx = lower.indexOf(needle, start);
  }
  if (start < text.length) parts.push(text.slice(start));
  return parts;
}

function UserAvatar({
  user,
  size = 46,
}: {
  user: SearchUserHit;
  size?: number;
}) {
  const letter = (user.username || "?").slice(0, 1).toUpperCase();
  return (
    <span
      className="chat-avatar chat-avatar-ring relative shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.36 }}
    >
      {user.avatar ? (
        <Image
          src={user.avatar}
          alt=""
          fill
          unoptimized
          className="object-cover"
        />
      ) : (
        letter
      )}
    </span>
  );
}

export function SearchSection({ onOpenAuthor }: Props) {
  const [q, setQ] = useState("");
  const [users, setUsers] = useState<SearchUserHit[]>([]);
  const [posts, setPosts] = useState<SearchPostHit[]>([]);
  const [suggested, setSuggested] = useState<SearchUserHit[]>([]);
  const [history, setHistory] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [boot, setBoot] = useState(true);
  const [searched, setSearched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<number | null>(null);
  const reqId = useRef(0);

  useEffect(() => {
    setHistory(loadHistory());
    void suggestedUsers()
      .then(setSuggested)
      .catch(() => setSuggested([]))
      .finally(() => setBoot(false));
    const t = window.setTimeout(() => inputRef.current?.focus(), 350);
    return () => window.clearTimeout(t);
  }, []);

  const runSearch = useCallback(async (query: string, remember = true) => {
    const trimmed = query.trim();
    if (!trimmed) {
      setSearched(false);
      setUsers([]);
      setPosts([]);
      setError(null);
      return;
    }

    const id = ++reqId.current;
    setBusy(true);
    setError(null);
    setSearched(true);
    try {
      const result = await searchAll(trimmed);
      if (id !== reqId.current) return;
      setUsers(result.users);
      setPosts(result.posts);
      if (remember) {
        setHistory((prev) => {
          const next = [
            trimmed,
            ...prev.filter((h) => h.toLowerCase() !== trimmed.toLowerCase()),
          ].slice(0, MAX_HISTORY);
          saveHistory(next);
          return next;
        });
      }
    } catch (err) {
      if (id !== reqId.current) return;
      setError(err instanceof ApiException ? err.message : "Search failed");
    } finally {
      if (id === reqId.current) setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    const trimmed = q.trim();
    if (!trimmed) {
      setSearched(false);
      setUsers([]);
      setPosts([]);
      setError(null);
      setBusy(false);
      return;
    }
    debounceRef.current = window.setTimeout(() => {
      void runSearch(trimmed, true);
    }, 280);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [q, runSearch]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    void runSearch(q, true);
  }

  function clearQuery() {
    setQ("");
    setSearched(false);
    setUsers([]);
    setPosts([]);
    setError(null);
    inputRef.current?.focus();
  }

  function clearHistory() {
    setHistory([]);
    saveHistory([]);
  }

  const total = users.length + posts.length;
  const noResults =
    searched && !busy && !error && users.length === 0 && posts.length === 0;
  const idle = !searched && !q.trim();

  const resultLabel = useMemo(() => {
    if (busy && total === 0) return "Searching…";
    if (busy) return `${total} results · updating`;
    return `${total} result${total === 1 ? "" : "s"}`;
  }, [busy, total]);

  if (boot) {
    return <LiquidLoader label="Preparing search…" />;
  }

  return (
    <div className="hub-list animate-fade-up space-y-4 pb-6">
      <form onSubmit={onSubmit} className="search-shell">
        <div className="mb-3 flex items-center gap-3 px-0.5">
          <BrandMark size={40} variant="soft" />
          <div className="min-w-0">
            <p className="font-display text-[20px] font-extrabold tracking-[-0.03em] text-navy">
              Search
            </p>
            <p className="text-[12.5px] text-muted">
              People, posts, and ideas across Innovator
            </p>
          </div>
        </div>

        <div className="search-bar">
          <span className="shrink-0 text-navy/40">
            <IconSearch />
          </span>
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search people, posts, hashtags…"
            className="search-bar-input"
            autoComplete="off"
            spellCheck={false}
          />
          {q.trim() ? (
            <button
              type="button"
              onClick={clearQuery}
              className="search-clear liquid-press"
              aria-label="Clear search"
            >
              <IconClear />
            </button>
          ) : null}
          <button
            type="submit"
            disabled={busy || !q.trim()}
            className="search-go liquid-press"
            aria-label="Search"
          >
            {busy ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/25 border-t-gold" />
            ) : (
              <IconArrow />
            )}
          </button>
        </div>
      </form>

      {error ? (
        <LiquidError message={error} onRetry={() => void runSearch(q, false)} />
      ) : null}

      {idle ? (
        <>
          {history.length > 0 ? (
            <section className="search-shell">
              <div className="search-section-title">
                <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-muted">
                  Recent
                </p>
                <button
                  type="button"
                  onClick={clearHistory}
                  className="text-[12px] font-semibold text-navy/50 hover:text-navy"
                >
                  Clear
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {history.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setQ(item)}
                    className="search-chip liquid-press"
                  >
                    <IconClock />
                    {item}
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          <section className="search-shell">
            <div className="search-section-title">
              <p className="font-display text-[16px] font-bold tracking-[-0.02em] text-navy">
                Suggested for you
              </p>
              <span className="text-[12px] text-muted">
                {suggested.length} people
              </span>
            </div>
            {suggested.length === 0 ? (
              <p className="px-1 py-8 text-center text-[13px] text-muted">
                No suggestions yet — collaborate with people to grow your network.
              </p>
            ) : (
              <ul>
                {suggested.slice(0, 10).map((u, i) => (
                  <li
                    key={u.id || u.username}
                    className="stagger-in"
                    style={{ animationDelay: `${i * 40}ms` }}
                  >
                    <UserTile
                      user={u}
                      onOpen={() => onOpenAuthor?.(u.id, u.username)}
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : null}

      {searched && !error ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2 px-1">
            <p className="text-[13px] font-semibold text-navy/70">
              {resultLabel}
              {q.trim() ? (
                <span className="text-muted">
                  {" "}
                  for “{q.trim()}”
                </span>
              ) : null}
            </p>
            {busy && total > 0 ? (
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-navy/15 border-t-gold" />
            ) : null}
          </div>

          {noResults ? (
            <div className="px-1 py-14 text-center">
              <div className="mx-auto mb-4 grid place-items-center">
                <BrandMark size={56} variant="navy" />
              </div>
              <p className="font-display text-[22px] font-extrabold tracking-[-0.03em] text-navy">
                No matches
              </p>
              <p className="mx-auto mt-2 max-w-[34ch] text-[14px] leading-relaxed text-muted">
                Nothing found for “{q.trim()}”. Try another name, keyword, or
                topic.
              </p>
            </div>
          ) : null}

          {users.length > 0 ? (
            <section className="search-shell">
              <div className="search-section-title">
                <p className="font-display text-[16px] font-bold tracking-[-0.02em] text-navy">
                  People
                </p>
                <span className="text-[12px] text-muted">{users.length}</span>
              </div>
              <ul>
                {users.map((u, i) => (
                  <li
                    key={u.id || `${u.username}-${i}`}
                    className="stagger-in"
                    style={{ animationDelay: `${i * 35}ms` }}
                  >
                    <UserTile
                      user={u}
                      query={q}
                      onOpen={() => onOpenAuthor?.(u.id, u.username)}
                    />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {posts.length > 0 ? (
            <section className="search-shell">
              <div className="search-section-title">
                <p className="font-display text-[16px] font-bold tracking-[-0.02em] text-navy">
                  Posts
                </p>
                <span className="text-[12px] text-muted">{posts.length}</span>
              </div>
              <ul>
                {posts.map((p, i) => (
                  <li
                    key={p.id || i}
                    className="search-post stagger-in"
                    style={{ animationDelay: `${i * 35}ms` }}
                  >
                    {p.username ? (
                      <p className="mb-1.5 text-[12px] font-semibold text-gold">
                        @{p.username}
                      </p>
                    ) : null}
                    <p className="text-[14.5px] leading-relaxed text-ink/90">
                      {highlight(p.content || "Post", q)}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function UserTile({
  user,
  query = "",
  onOpen,
}: {
  user: SearchUserHit;
  query?: string;
  onOpen?: () => void;
}) {
  return (
    <button type="button" onClick={onOpen} className="search-tile liquid-press">
      <UserAvatar user={user} />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-display text-[15px] font-semibold tracking-[-0.02em] text-navy">
          {highlight(user.username, query)}
        </span>
        {user.bio?.trim() ? (
          <span className="mt-0.5 block truncate text-[12.5px] text-muted">
            {highlight(user.bio, query)}
          </span>
        ) : (
          <span className="mt-0.5 block text-[12.5px] text-muted">
            Innovator member
          </span>
        )}
      </span>
      <span className="shrink-0 text-[12px] font-semibold text-navy/35">→</span>
    </button>
  );
}

function IconSearch() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M16 16l4 4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconClear() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6 6l12 12M18 6 6 18"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconArrow() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 12h12M13 6l6 6-6 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconClock() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M12 8v5l3 2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
