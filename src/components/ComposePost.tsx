"use client";

import Image from "next/image";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { ApiException } from "@/lib/api-client";
import { createPost, getCategories } from "@/lib/feed-api";
import type { FeedCategory, FeedPost } from "@/lib/types";
import { LiquidButton } from "./LiquidButton";
import { SectionLabel } from "./ui/LiquidChrome";

type Props = {
  onPublished?: (post: FeedPost) => void;
};

export function ComposePost({ onPublished }: Props) {
  const [content, setContent] = useState("");
  const [categories, setCategories] = useState<FeedCategory[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const previews = useMemo(
    () => files.map((f) => ({ file: f, url: URL.createObjectURL(f) })),
    [files],
  );

  useEffect(() => {
    return () => {
      previews.forEach((p) => URL.revokeObjectURL(p.url));
    };
  }, [previews]);

  useEffect(() => {
    void getCategories()
      .then(setCategories)
      .catch(() => setCategories([]));
  }, []);

  function toggleCategory(id: string) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!content.trim() && files.length === 0) {
      setError("Add text or media to post.");
      return;
    }
    setBusy(true);
    setError(null);
    setDone(false);
    try {
      const post = await createPost({
        content: content.trim(),
        categoryIds: selected,
        files,
      });
      setContent("");
      setFiles([]);
      setSelected([]);
      setDone(true);
      onPublished?.(post);
    } catch (err) {
      setError(err instanceof ApiException ? err.message : "Could not publish");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 pb-6">
      <div className="liquid-glass space-y-4 p-5 sm:p-6">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={6}
          placeholder="What’s on your mind?"
          className="glass-field min-h-[170px] resize-none text-[15.5px] leading-relaxed"
        />

        {previews.length > 0 ? (
          <div className="grid grid-cols-3 gap-2.5">
            {previews.map((p, i) => (
              <div
                key={p.url}
                className="relative aspect-square overflow-hidden rounded-[18px] border border-white/60 bg-[var(--media-fallback)] shadow-soft"
              >
                {p.file.type.startsWith("video/") ? (
                  <video
                    src={p.url}
                    className="h-full w-full object-cover"
                    muted
                  />
                ) : (
                  <Image
                    src={p.url}
                    alt=""
                    fill
                    unoptimized
                    className="object-cover"
                  />
                )}
                <button
                  type="button"
                  onClick={() => removeFile(i)}
                  className="absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-full bg-navy/70 text-xs text-white"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <label className="liquid-chip liquid-press cursor-pointer">
            <input
              type="file"
              accept="image/*,video/*"
              multiple
              className="hidden"
              onChange={(e) => {
                const list = Array.from(e.target.files ?? []);
                setFiles((prev) => [...prev, ...list].slice(0, 8));
                e.target.value = "";
              }}
            />
            + Photos / video
          </label>
          <span className="liquid-chip text-muted">
            {files.length}/8 media
          </span>
        </div>

        {categories.length > 0 ? (
          <div>
            <SectionLabel>Categories</SectionLabel>
            <div className="flex flex-wrap gap-2">
              {categories.map((c) => {
                const on = selected.includes(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => toggleCategory(c.id)}
                    className={`liquid-chip ${on ? "liquid-chip-active" : ""}`}
                  >
                    {c.name}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        {error ? (
          <p className="liquid-panel px-3 py-2 text-[12.5px] text-red-700">
            {error}
          </p>
        ) : null}
        {done ? (
          <p className="liquid-panel px-3 py-2 text-[12.5px] font-semibold text-[var(--repost)]">
            Posted. Check Home for your update.
          </p>
        ) : null}

        <LiquidButton type="submit" disabled={busy}>
          {busy ? "Publishing…" : "Publish post"}
        </LiquidButton>
      </div>
    </form>
  );
}
