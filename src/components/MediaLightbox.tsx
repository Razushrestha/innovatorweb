"use client";

import { useEffect, useState } from "react";
import { mediaIsVideo, mediaPreviewUrl } from "@/lib/feed-api";
import type { FeedMediaItem } from "@/lib/types";

type Props = {
  items: FeedMediaItem[];
  initialIndex?: number;
  onClose: () => void;
};

export function MediaLightbox({
  items,
  initialIndex = 0,
  onClose,
}: Props) {
  const [index, setIndex] = useState(
    Math.min(Math.max(initialIndex, 0), Math.max(items.length - 1, 0)),
  );
  const item = items[index];

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") {
        setIndex((i) => Math.min(i + 1, items.length - 1));
      }
      if (e.key === "ArrowLeft") {
        setIndex((i) => Math.max(i - 1, 0));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [items.length, onClose]);

  if (!item) return null;
  const video = mediaIsVideo(item);
  const preview = mediaPreviewUrl(item);

  return (
    <div
      className="fixed inset-0 z-[80] flex flex-col bg-navy/92 backdrop-blur-md"
      role="dialog"
      aria-modal
    >
      <div className="flex items-center justify-between px-4 py-3">
        <button
          type="button"
          onClick={onClose}
          className="liquid-chip !bg-white/10 !text-white"
        >
          Close
        </button>
        {items.length > 1 ? (
          <p className="text-[13px] font-semibold text-white/80">
            {index + 1} / {items.length}
          </p>
        ) : (
          <span />
        )}
        <span className="w-16" />
      </div>

      <div
        className="relative flex flex-1 items-center justify-center px-3 pb-6"
        onClick={onClose}
      >
        <div
          className="relative max-h-[82vh] w-full max-w-4xl"
          onClick={(e) => e.stopPropagation()}
        >
          {video ? (
            <video
              key={item.file}
              src={item.file}
              className="max-h-[82vh] w-full rounded-[20px] bg-black object-contain"
              controls
              autoPlay
              playsInline
            />
          ) : preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview}
              alt=""
              className="max-h-[82vh] w-full rounded-[20px] object-contain"
            />
          ) : (
            <p className="text-center text-white/60">Media unavailable</p>
          )}
        </div>

        {items.length > 1 ? (
          <>
            <button
              type="button"
              disabled={index === 0}
              onClick={(e) => {
                e.stopPropagation();
                setIndex((i) => Math.max(0, i - 1));
              }}
              className="absolute left-3 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/15 text-white disabled:opacity-30"
            >
              ‹
            </button>
            <button
              type="button"
              disabled={index >= items.length - 1}
              onClick={(e) => {
                e.stopPropagation();
                setIndex((i) => Math.min(items.length - 1, i + 1));
              }}
              className="absolute right-3 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/15 text-white disabled:opacity-30"
            >
              ›
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}
