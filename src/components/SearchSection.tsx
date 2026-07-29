"use client";

import { FormEvent, useEffect, useState } from "react";
import { ApiException } from "@/lib/api-client";
import { searchAll, suggestedUsers } from "@/lib/search-api";
import type { SearchPostHit, SearchUserHit } from "@/lib/types";
import {
  LiquidEmpty,
  LiquidError,
  SectionLabel,
} from "./ui/LiquidChrome";

export function SearchSection() {
  const [q, setQ] = useState("");
  const [users, setUsers] = useState<SearchUserHit[]>([]);
  const [posts, setPosts] = useState<SearchPostHit[]>([]);
  const [suggested, setSuggested] = useState<SearchUserHit[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    void suggestedUsers()
      .then(setSuggested)
      .catch(() => setSuggested([]));
  }, []);

  async function onSearch(e: FormEvent) {
    e.preventDefault();
    const query = q.trim();
    if (!query) return;
    setBusy(true);
    setError(null);
    setSearched(true);
    try {
      const result = await searchAll(query);
      setUsers(result.users);
      setPosts(result.posts);
    } catch (err) {
      setError(err instanceof ApiException ? err.message : "Search failed");
    } finally {
      setBusy(false);
    }
  }

  const noResults =
    searched && !busy && !error && users.length === 0 && posts.length === 0;

  return (
    <div className="space-y-4 pb-6">
      <form onSubmit={onSearch} className="liquid-glass p-4">
        <div className="flex gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search people, posts, ideas…"
            className="glass-field flex-1"
          />
          <button
            type="submit"
            disabled={busy || !q.trim()}
            className="liquid-btn liquid-btn-dark !min-h-12 shrink-0 px-5 text-sm disabled:opacity-45"
          >
            {busy ? "…" : "Search"}
          </button>
        </div>
      </form>

      {error ? <LiquidError message={error} /> : null}

      {!searched && suggested.length > 0 ? (
        <section className="liquid-glass p-4">
          <SectionLabel>Suggested people</SectionLabel>
          <ul className="mt-1 space-y-2">
            {suggested.slice(0, 8).map((u) => (
              <li key={u.id}>
                <div className="liquid-panel liquid-press flex items-center gap-3 px-3 py-2.5">
                  <span className="grid h-10 w-10 place-items-center rounded-[14px] bg-navy font-display text-sm font-bold text-gold">
                    {u.username.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-display text-[15px] font-semibold text-navy">
                      {u.username}
                    </span>
                    {u.bio ? (
                      <span className="block truncate text-[12.5px] text-muted">
                        {u.bio}
                      </span>
                    ) : (
                      <span className="block text-[12.5px] text-muted">
                        Innovator member
                      </span>
                    )}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {noResults ? (
        <LiquidEmpty
          title="No matches"
          body="Try another name, keyword, or topic."
        />
      ) : null}

      {users.length > 0 ? (
        <section className="liquid-glass p-4">
          <SectionLabel>People · {users.length}</SectionLabel>
          <ul className="mt-1 space-y-2">
            {users.map((u) => (
              <li key={u.id}>
                <div className="liquid-panel flex items-center gap-3 px-3 py-2.5">
                  <span className="grid h-10 w-10 place-items-center rounded-[14px] bg-white/80 font-display text-sm font-bold text-navy shadow-soft">
                    {u.username.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="truncate font-display text-[15px] font-semibold text-navy">
                    {u.username}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {posts.length > 0 ? (
        <section className="liquid-glass p-4">
          <SectionLabel>Posts · {posts.length}</SectionLabel>
          <ul className="mt-1 space-y-2">
            {posts.map((p) => (
              <li key={p.id} className="liquid-panel px-3.5 py-3">
                {p.username ? (
                  <p className="mb-1 text-[12px] font-semibold text-gold">
                    @{p.username}
                  </p>
                ) : null}
                <p className="text-[14px] leading-relaxed text-ink/90">
                  {p.content || "Post"}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
