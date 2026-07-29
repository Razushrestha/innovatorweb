"use client";

import Image from "next/image";
import {
  FormEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { ApiException } from "@/lib/api-client";
import { AuthSession } from "@/lib/auth-session";
import {
  createComment,
  deletePost,
  getComments,
  mediaIsVideo,
  mediaPreviewUrl,
  reactToPost,
  repostPost,
} from "@/lib/feed-api";
import { blockUser, toggleFollow } from "@/lib/profile-api";
import type { FeedComment, FeedPost } from "@/lib/types";
import { MediaLightbox } from "./MediaLightbox";

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

type Props = {
  post: FeedPost;
  onChange?: (post: FeedPost) => void;
  onDeleted?: (postId: string) => void;
  onOpenAuthor?: (userId: string, username?: string | null) => void;
  onBlocked?: (userId: string) => void;
};

export function FeedCard({
  post,
  onChange,
  onDeleted,
  onOpenAuthor,
  onBlocked,
}: Props) {
  const [local, setLocal] = useState(post);
  const [busy, setBusy] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<FeedComment[]>([]);
  const [draft, setDraft] = useState("");
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const me = AuthSession.load().userId;
  const isOwn = Boolean(me && me === local.userId);
  const author = local.username?.trim() || "Innovator";
  const letter = author.slice(0, 1).toUpperCase();
  const liked =
    local.currentUserReaction?.toLowerCase() === "like" ||
    local.currentUserReaction?.toLowerCase() === "love";
  const media = local.media.filter((m) => m.file?.trim());

  useEffect(() => {
    setLocal(post);
  }, [post]);

  useEffect(() => {
    if (!menuOpen) return;
    function onDoc(e: MouseEvent) {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 1600);
    return () => window.clearTimeout(t);
  }, [toast]);

  function update(next: FeedPost) {
    setLocal(next);
    onChange?.(next);
  }

  function showToast(msg: string) {
    setToast(msg);
  }

  async function onLike() {
    if (busy) return;
    setBusy(true);
    const wasLiked = liked;
    const prev = local;
    update({
      ...local,
      currentUserReaction: wasLiked ? null : "like",
      reactionsCount: Math.max(0, local.reactionsCount + (wasLiked ? -1 : 1)),
    });
    try {
      await reactToPost(local.id, "like");
    } catch {
      update(prev);
    } finally {
      setBusy(false);
    }
  }

  async function onFollow() {
    if (busy || !local.userId || isOwn) return;
    setBusy(true);
    const next = !local.isFollowed;
    update({ ...local, isFollowed: next });
    try {
      const result = await toggleFollow(local.userId);
      update({ ...local, isFollowed: result.isFollowing });
    } catch (e) {
      update({ ...local, isFollowed: !next });
      showToast(e instanceof ApiException ? e.message : "Collaborate failed");
    } finally {
      setBusy(false);
    }
  }

  async function onRepost() {
    if (busy) return;
    setBusy(true);
    setMenuOpen(false);
    try {
      await repostPost(local.id);
      update({ ...local, shareCount: local.shareCount + 1 });
      showToast("Reposted");
    } catch (e) {
      showToast(e instanceof ApiException ? e.message : "Repost failed");
    } finally {
      setBusy(false);
    }
  }

  async function onCopy() {
    setMenuOpen(false);
    try {
      await navigator.clipboard.writeText(local.content?.trim() || local.id);
      showToast("Copied");
    } catch {
      showToast("Could not copy");
    }
  }

  async function onShare() {
    const text = local.content?.trim() || `Post by ${author}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "Innovator", text });
      } else {
        await navigator.clipboard.writeText(text);
        showToast("Link copied");
      }
    } catch {
      try {
        await navigator.clipboard.writeText(text);
        showToast("Link copied");
      } catch {
        showToast("Share failed");
      }
    }
  }

  async function onDelete() {
    setMenuOpen(false);
    if (!confirm("Delete this post?")) return;
    setBusy(true);
    try {
      await deletePost(local.id);
      onDeleted?.(local.id);
      showToast("Post deleted");
    } catch (e) {
      showToast(e instanceof ApiException ? e.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  async function onBlock() {
    setMenuOpen(false);
    if (!local.userId || isOwn) return;
    if (!confirm(`Block ${author}?`)) return;
    setBusy(true);
    try {
      await blockUser(local.userId);
      onBlocked?.(local.userId);
      showToast(`Blocked ${author}`);
    } catch (e) {
      showToast(e instanceof ApiException ? e.message : "Block failed");
    } finally {
      setBusy(false);
    }
  }

  async function openComments() {
    const next = !showComments;
    setShowComments(next);
    if (!next || comments.length > 0) return;
    setCommentsLoading(true);
    try {
      setComments(await getComments(local.id));
    } catch {
      setComments([]);
    } finally {
      setCommentsLoading(false);
    }
  }

  async function onComment(e: FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setBusy(true);
    try {
      const created = await createComment(local.id, text);
      setComments((prev) => [created, ...prev]);
      setDraft("");
      update({ ...local, commentsCount: local.commentsCount + 1 });
    } catch {
      // keep draft
    } finally {
      setBusy(false);
    }
  }

  function openAuthor() {
    if (!local.userId) return;
    onOpenAuthor?.(local.userId, local.username);
  }

  return (
    <article
      className={`liquid-glass feed-post relative ${
        menuOpen ? "feed-post-menu-open" : ""
      }`}
    >
      <header
        className={`mb-2.5 flex items-start gap-3 ${
          menuOpen ? "relative z-30" : ""
        }`}
      >
        <button
          type="button"
          onClick={() => setAvatarOpen(true)}
          className="liquid-press relative h-11 w-11 shrink-0 overflow-hidden rounded-full bg-navy p-[2px] shadow-soft"
          aria-label="View profile photo"
        >
          <span className="relative block h-full w-full overflow-hidden rounded-full bg-white">
            {local.avatar ? (
              <Image
                src={local.avatar}
                alt={author}
                fill
                sizes="44px"
                className="object-cover"
                unoptimized
              />
            ) : (
              <span className="flex h-full items-center justify-center font-display text-[16px] font-bold text-ink">
                {letter}
              </span>
            )}
          </span>
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={openAuthor}
              className="min-w-0 truncate text-left font-display text-[15px] font-semibold tracking-[-0.02em] text-navy hover:underline"
            >
              {author}
            </button>
            <span
              className="inline-flex h-[15px] w-[15px] shrink-0 items-center justify-center rounded-[4px] bg-gold text-[8px] font-bold text-navy shadow-soft"
              aria-hidden
            >
              ✓
            </span>
          </div>
          <p className="truncate text-[12px] text-muted">
            Innovator · {timeAgo(local.createdAt) || "Just now"}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {!isOwn ? (
            <button
              type="button"
              disabled={busy || !local.userId}
              onClick={() => void onFollow()}
              className={`liquid-press inline-flex items-center gap-1 rounded-full px-3 py-[7px] text-[12px] font-semibold transition ${
                local.isFollowed
                  ? "border border-navy/20 bg-white/80 text-navy"
                  : "bg-navy text-white"
              } disabled:opacity-50`}
            >
              {local.isFollowed ? (
                <>
                  <IconCheck /> Collaborating
                </>
              ) : (
                <>
                  <IconPlus /> Collaborate
                </>
              )}
            </button>
          ) : null}

          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="liquid-press grid h-9 w-9 place-items-center rounded-full text-navy/45 hover:bg-white/55 hover:text-navy"
              aria-label="Post menu"
              aria-expanded={menuOpen}
            >
              <IconMore />
            </button>

            {menuOpen ? (
              <div className="feed-post-menu absolute right-0 top-[calc(100%+6px)] z-50 w-[168px] overflow-hidden rounded-[18px] border border-navy/[0.08] bg-white p-1.5 shadow-[0_12px_28px_rgba(7,19,35,0.18)]">
                <MenuItem
                  icon={<IconRepost />}
                  label="Repost"
                  onClick={() => void onRepost()}
                />
                <MenuItem
                  icon={<IconCopy />}
                  label="Copy"
                  onClick={() => void onCopy()}
                />
                <MenuItem
                  icon={<IconTrash />}
                  label="Delete"
                  destructive
                  onClick={() => void onDelete()}
                />
                {!isOwn ? (
                  <MenuItem
                    icon={<IconBlock />}
                    label="Block"
                    destructive
                    onClick={() => void onBlock()}
                  />
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </header>

      {local.content?.trim() ? (
        <PostBody text={local.content} />
      ) : null}

      {media.length > 0 ? (
        <div
          className={`mb-3 overflow-hidden rounded-[20px] border border-white/50 bg-[var(--media-fallback)] shadow-soft ${
            media.length === 1 ? "relative w-full" : "grid gap-[3px]"
          } ${media.length === 2 ? "grid-cols-2" : ""} ${
            media.length >= 3 ? "grid-cols-2" : ""
          }`}
        >
          {media.slice(0, 4).map((m, i) => {
            const url = mediaPreviewUrl(m);
            const video = mediaIsVideo(m);
            const extra = media.length > 4 && i === 3 ? media.length - 4 : 0;
            return (
              <button
                type="button"
                key={m.id || `${i}`}
                onClick={() => setLightboxIndex(i)}
                className={`relative overflow-hidden bg-[var(--media-fallback)] ${
                  media.length === 1
                    ? "aspect-[16/10] max-h-[min(70vh,560px)] w-full sm:aspect-[16/9]"
                    : "aspect-square min-h-[150px]"
                } ${media.length === 3 && i === 0 ? "row-span-2 aspect-auto min-h-full" : ""}`}
              >
                {url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={url}
                    alt=""
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                ) : video && m.file ? (
                  <video
                    src={m.file}
                    className="h-full w-full object-cover"
                    muted
                    playsInline
                    preload="metadata"
                  />
                ) : (
                  <div className="flex h-full min-h-[150px] items-center justify-center text-white/35">
                    {video ? "Video" : "Media"}
                  </div>
                )}
                {video ? (
                  <>
                    <span className="pointer-events-none absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-black/45 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-sm">
                      <IconVideo /> Video
                    </span>
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                      <span className="grid h-12 w-12 place-items-center rounded-full border border-white/55 bg-black/35 text-white shadow-soft backdrop-blur-sm">
                        ▶
                      </span>
                    </div>
                  </>
                ) : null}
                {extra > 0 ? (
                  <div className="absolute inset-0 grid place-items-center bg-black/50 font-display text-[32px] font-bold text-white">
                    +{extra}
                  </div>
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}

      {lightboxIndex != null ? (
        <MediaLightbox
          items={media}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      ) : null}

      {avatarOpen ? (
        <AvatarLightbox
          name={author}
          letter={letter}
          imageUrl={local.avatar}
          onClose={() => setAvatarOpen(false)}
          onOpenProfile={() => {
            setAvatarOpen(false);
            openAuthor();
          }}
        />
      ) : null}

      <footer className="mt-0.5 flex items-center justify-between border-t border-white/55 px-0.5 pt-2">
        <ActionBtn
          active={liked}
          activeClass="text-[var(--like)]"
          onClick={() => void onLike()}
          label={String(local.reactionsCount)}
          ariaLabel="Love"
        >
          <IconHeart filled={liked} />
        </ActionBtn>
        <ActionBtn
          active={showComments}
          onClick={() => void openComments()}
          label={String(local.commentsCount)}
          ariaLabel="Comment"
        >
          <IconComment />
        </ActionBtn>
        <ActionBtn
          onClick={() => void onRepost()}
          label={String(local.shareCount)}
          ariaLabel="Repost"
          activeClass="text-[var(--repost)]"
        >
          <IconRepost />
        </ActionBtn>
        <ActionBtn onClick={() => void onShare()} label="Share" ariaLabel="Share">
          <IconShare />
        </ActionBtn>
      </footer>

      {showComments ? (
        <div className="mt-3 animate-fade-up rounded-[20px] border border-white/60 bg-white/40 p-3 backdrop-blur-md">
          <form onSubmit={onComment} className="mb-3 flex gap-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Write a comment…"
              className="glass-field flex-1 py-2.5 text-[14px]"
            />
            <button
              type="submit"
              disabled={busy || !draft.trim()}
              className="liquid-btn liquid-btn-dark !min-h-0 px-4 py-2.5 text-[13px] disabled:opacity-45"
            >
              Send
            </button>
          </form>
          {commentsLoading ? (
            <p className="py-2 text-center text-[13px] text-muted">Loading…</p>
          ) : comments.length === 0 ? (
            <p className="py-2 text-center text-[13px] text-muted">
              No comments yet
            </p>
          ) : (
            <ul className="space-y-2">
              {comments.map((c) => (
                <li
                  key={c.id}
                  className="rounded-[16px] border border-white/50 bg-white/45 px-3 py-2 text-[14px]"
                >
                  <span className="font-semibold text-navy">
                    {c.username || "User"}
                  </span>
                  <p className="mt-0.5 text-ink/85">{c.content}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      {toast ? (
        <div className="pointer-events-none absolute bottom-3 left-1/2 z-40 -translate-x-1/2 rounded-[14px] bg-navy/92 px-4 py-2 text-[13px] font-medium text-white shadow-soft">
          {toast}
        </div>
      ) : null}
    </article>
  );
}

/** Collapse messy API whitespace while keeping real paragraph breaks. */
function normalizePostText(raw: string) {
  return raw
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function PostBody({ text }: { text: string }) {
  const cleaned = normalizePostText(text);
  const [expanded, setExpanded] = useState(false);
  const long = cleaned.length > 180 || cleaned.split("\n").length > 3;

  return (
    <div className="feed-body-panel mb-3.5">
      <p
        className={`feed-body-text w-full text-[14px] font-medium leading-[1.6] tracking-[-0.011em] text-ink/88 ${
          !expanded && long ? "line-clamp-3" : ""
        }`}
      >
        {cleaned}
      </p>
      {long ? (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-2 text-[12.5px] font-bold tracking-[-0.01em] text-navy/55 hover:text-navy"
        >
          {expanded ? "see less" : "see more"}
        </button>
      ) : null}
    </div>
  );
}

function ActionBtn({
  children,
  label,
  onClick,
  active,
  activeClass,
  ariaLabel,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;
  activeClass?: string;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className={`liquid-press inline-flex min-w-[64px] items-center justify-center gap-1.5 rounded-[12px] px-2 py-2 text-[12.5px] font-semibold transition ${
        active
          ? activeClass || "text-navy"
          : "text-navy/55 hover:text-navy"
      }`}
    >
      <span className={active ? "scale-110 transition-transform" : ""}>
        {children}
      </span>
      <span>{label}</span>
    </button>
  );
}

function MenuItem({
  icon,
  label,
  onClick,
  destructive,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`liquid-press mb-0.5 flex w-full items-center gap-2.5 rounded-[12px] px-3 py-2.5 text-left text-[13.5px] font-semibold last:mb-0 hover:bg-navy/[0.05] ${
        destructive ? "text-[#C0392B]" : "text-navy"
      }`}
    >
      <span className="grid h-5 w-5 place-items-center opacity-80">{icon}</span>
      {label}
    </button>
  );
}

function AvatarLightbox({
  name,
  letter,
  imageUrl,
  onClose,
  onOpenProfile,
}: {
  name: string;
  letter: string;
  imageUrl?: string | null;
  onClose: () => void;
  onOpenProfile: () => void;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/82 p-6 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal
      aria-label={`${name} photo`}
    >
      <div
        className="animate-fade-up flex w-full max-w-sm flex-col items-center"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative aspect-square w-full max-w-[320px] overflow-hidden rounded-full bg-navy p-1 shadow-[0_20px_50px_rgba(0,0,0,0.45)]">
          <div className="relative h-full w-full overflow-hidden rounded-full bg-white">
            {imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imageUrl}
                alt={name}
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="flex h-full items-center justify-center font-display text-6xl font-bold text-navy">
                {letter}
              </span>
            )}
          </div>
        </div>
        <p className="mt-4 font-display text-lg font-bold text-white">{name}</p>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={onOpenProfile}
            className="liquid-btn liquid-btn-dark !min-h-0 px-5 py-2.5 text-[13px]"
          >
            View profile
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/30 bg-white/10 px-5 py-2.5 text-[13px] font-semibold text-white"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function IconHeart({ filled }: { filled?: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <path
        d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z"
        fill={filled ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconComment() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 6.5A2.5 2.5 0 0 1 7.5 4h9A2.5 2.5 0 0 1 19 6.5v7A2.5 2.5 0 0 1 16.5 16H10l-4 3v-3.2A2.5 2.5 0 0 1 5 13.5v-7Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconRepost() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M7 7h9a3 3 0 0 1 3 3v2M17 17H8a3 3 0 0 1-3-3v-2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M14 4l3 3-3 3M10 20l-3-3 3-3"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconShare() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M14 6h5v5M19 6l-8 8"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M12 5H8.5A3.5 3.5 0 0 0 5 8.5v7A3.5 3.5 0 0 0 8.5 19h7a3.5 3.5 0 0 0 3.5-3.5V12"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconMore() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <circle cx="6" cy="12" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="18" cy="12" r="1.6" />
    </svg>
  );
}

function IconPlus() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 5v14M5 12h14"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconCheck() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 12.5l5 5L19 7"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconCopy() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect
        x="8"
        y="8"
        width="11"
        height="11"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M6 16V7a2 2 0 0 1 2-2h9"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconTrash() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 7h14M9 7V5h6v2M8 7l1 12h6l1-12"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconBlock() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M7 17L17 7"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconVideo() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect
        x="3"
        y="6"
        width="12"
        height="12"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M15 10l5-2v8l-5-2v-4Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}
