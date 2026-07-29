"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { AuthSession } from "@/lib/auth-session";
import { getMyProfile } from "@/lib/profile-api";

type Props = {
  onCompose: () => void;
};

export function ComposePrompt({ onCompose }: Props) {
  const session = AuthSession.load();
  const [avatar, setAvatar] = useState<string | null>(null);
  const [name, setName] = useState(session.username || "Innovator");

  useEffect(() => {
    let alive = true;
    void getMyProfile()
      .then((p) => {
        if (!alive) return;
        setAvatar(p.avatar?.trim() || null);
        setName(p.fullName || p.username || session.username || "Innovator");
      })
      .catch(() => {
        /* session fallback */
      });
    return () => {
      alive = false;
    };
  }, [session.username]);

  const first = name.trim().split(/\s+/)[0] || "there";
  const letter = first.slice(0, 1).toUpperCase();

  return (
    <button
      type="button"
      onClick={onCompose}
      className="compose-bar liquid-press group w-full text-left"
      aria-label="Create a post"
    >
      <span className="compose-bar-sheen" aria-hidden />

      <span className="relative z-[1] flex items-center gap-3 px-3.5 py-3 sm:gap-3.5 sm:px-4 sm:py-3.5">
        <span className="compose-avatar relative h-[46px] w-[46px] shrink-0 sm:h-[50px] sm:w-[50px]">
          <span className="compose-avatar-ring" aria-hidden />
          <span className="relative z-[1] block h-full w-full overflow-hidden rounded-full bg-white shadow-soft ring-[2.5px] ring-white">
            {avatar ? (
              <Image
                src={avatar}
                alt=""
                fill
                sizes="50px"
                unoptimized
                className="object-cover"
              />
            ) : (
              <span className="flex h-full items-center justify-center bg-navy font-display text-[17px] font-bold text-gold">
                {letter}
              </span>
            )}
          </span>
        </span>

        <span className="min-w-0 flex-1">
          <span className="mb-1 block text-[11px] font-semibold tracking-[-0.01em] text-muted">
            Hey {first}
          </span>
          <span className="compose-input flex items-center gap-2 rounded-[16px] px-3.5 py-2.5 sm:px-4">
            <span className="compose-caret" aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-display text-[15px] font-semibold tracking-[-0.02em] text-navy/55 transition group-hover:text-navy">
                What’s on your mind?
              </span>
            </span>
          </span>
        </span>

        <span className="relative z-[1] hidden shrink-0 items-center gap-1.5 sm:flex">
          <span className="compose-media" title="Photo">
            <IconPhoto />
          </span>
          <span className="compose-media" title="Video">
            <IconVideo />
          </span>
          <span className="compose-post-cta">
            Post
          </span>
        </span>

        <span className="compose-post-orb relative z-[1] grid h-10 w-10 shrink-0 place-items-center sm:hidden">
          <span className="text-[18px] font-bold leading-none text-gold">+</span>
        </span>
      </span>
    </button>
  );
}

function IconPhoto() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect
        x="3.5"
        y="5.5"
        width="17"
        height="13"
        rx="3"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <circle cx="9" cy="10" r="1.6" fill="currentColor" />
      <path
        d="M7 16l3.2-3.2a1.2 1.2 0 0 1 1.7 0L15 16l1.3-1.3a1.2 1.2 0 0 1 1.7 0L20 16"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconVideo() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect
        x="3"
        y="6"
        width="12"
        height="12"
        rx="2.5"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M15 10.2l5-2.5v8.6l-5-2.5v-3.6Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}
