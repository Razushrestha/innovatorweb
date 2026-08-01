"use client";

import Image from "next/image";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { ApiException } from "@/lib/api-client";
import { getPostsByAuthor } from "@/lib/feed-api";
import { AuthSession } from "@/lib/auth-session";
import { syncActivityNotifications } from "@/lib/activity-notifications";
import { listMutualCollaborators } from "@/lib/mutual-collaborators";
import {
  blockUser,
  listFollowers,
  listFollowing,
  toggleFollow,
  updateProfile,
  uploadAvatar,
} from "@/lib/profile-api";
import type {
  ChatPeerRequest,
  FeedPost,
  ProfileListUser,
  UserProfile,
} from "@/lib/types";
import { BrandMark } from "./BrandMark";
import { FeedCard } from "./FeedCard";
import { LiquidEmpty, LiquidError, LiquidLoader } from "./ui/LiquidChrome";

const TITLES = ["Innovator", "Creator", "Developer", "Programmer"] as const;
const DEFAULT_COVER = "/feed/post_06.jpg";

type Props = {
  profile: UserProfile;
  isOwn: boolean;
  onBack?: () => void;
  onProfileChange?: (profile: UserProfile) => void;
  onOpenAuthor?: (userId: string, name?: string | null) => void;
  onBlocked?: () => void;
  onStartChat?: (peer: ChatPeerRequest) => void;
};

export function ProfileView({
  profile,
  isOwn,
  onBack,
  onProfileChange,
  onOpenAuthor,
  onBlocked,
  onStartChat,
}: Props) {
  const [local, setLocal] = useState(profile);
  const [titleIndex, setTitleIndex] = useState(0);
  const [coverUrl, setCoverUrl] = useState(DEFAULT_COVER);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [peopleKind, setPeopleKind] = useState<
    "followers" | "following" | null
  >(null);

  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [postsError, setPostsError] = useState<string | null>(null);

  const displayName =
    local.fullName?.trim() || local.username?.trim() || "Innovator";
  const letter = displayName.slice(0, 1).toUpperCase();
  const memberLine = useMemo(() => {
    const parts = [local.education, local.occupation]
      .map((v) => v?.trim())
      .filter(Boolean);
    return parts.length ? parts.join(" · ") : "Innovator member";
  }, [local.education, local.occupation]);

  useEffect(() => {
    setLocal(profile);
  }, [profile]);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointer = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest?.(".profile-cover-menu, .profile-glass-btn")) return;
      setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  useEffect(() => {
    const key = `innovator_title_${local.authUserId || local.id}`;
    const coverKey = `innovator_cover_${local.authUserId || local.id}`;
    try {
      const saved = Number(localStorage.getItem(key) ?? "0");
      if (!Number.isNaN(saved)) setTitleIndex(saved % TITLES.length);
      const cover = localStorage.getItem(coverKey);
      if (cover) setCoverUrl(cover);
      else setCoverUrl(DEFAULT_COVER);
    } catch {
      /* ignore */
    }
  }, [local.authUserId, local.id]);

  useEffect(() => {
    const id = local.authUserId || local.id;
    if (!id) {
      setPostsLoading(false);
      return;
    }
    void (async () => {
      setPostsLoading(true);
      setPostsError(null);
      try {
        const page = await getPostsByAuthor(id);
        setPosts(page.results);
      } catch (e) {
        setPostsError(
          e instanceof ApiException ? e.message : "Could not load innovations",
        );
      } finally {
        setPostsLoading(false);
      }
    })();
  }, [local.authUserId, local.id]);

  function cycleTitle() {
    if (!isOwn) return;
    const next = (titleIndex + 1) % TITLES.length;
    setTitleIndex(next);
    try {
      localStorage.setItem(
        `innovator_title_${local.authUserId || local.id}`,
        String(next),
      );
    } catch {
      /* ignore */
    }
  }

  async function onAvatar(file: File | null) {
    if (!file || !isOwn) return;
    setBusy(true);
    setError(null);
    try {
      const avatarUrl = await uploadAvatar(file);
      const next = {
        ...local,
        avatar: avatarUrl || URL.createObjectURL(file),
      };
      setLocal(next);
      onProfileChange?.(next);
    } catch (e) {
      setError(e instanceof ApiException ? e.message : "Avatar upload failed");
    } finally {
      setBusy(false);
    }
  }

  function onCover(file: File | null) {
    if (!file || !isOwn) return;
    const reader = new FileReader();
    reader.onload = () => {
      const data = String(reader.result ?? "");
      if (!data) return;
      setCoverUrl(data);
      try {
        localStorage.setItem(
          `innovator_cover_${local.authUserId || local.id}`,
          data,
        );
      } catch {
        /* ignore quota */
      }
    };
    reader.readAsDataURL(file);
  }

  async function onFollow() {
    if (isOwn || busy) return;
    const target = local.authUserId || local.id;
    setBusy(true);
    setError(null);
    const prevFollowed = local.isFollowed;
    const prevCount = local.followersCount;
    setLocal({
      ...local,
      isFollowed: !prevFollowed,
      followersCount: Math.max(0, prevCount + (prevFollowed ? -1 : 1)),
    });
    try {
      const result = await toggleFollow(target);
      const next = {
        ...local,
        isFollowed: result.isFollowing,
        followersCount: Math.max(
          0,
          prevCount + (result.isFollowing ? (prevFollowed ? 0 : 1) : prevFollowed ? -1 : 0),
        ),
      };
      setLocal(next);
      onProfileChange?.(next);
      void syncActivityNotifications();
    } catch (e) {
      setLocal({
        ...local,
        isFollowed: prevFollowed,
        followersCount: prevCount,
      });
      setError(e instanceof ApiException ? e.message : "Collaborate failed");
    } finally {
      setBusy(false);
    }
  }

  async function onBlock() {
    if (isOwn || busy) return;
    const target = local.authUserId || local.id;
    if (!window.confirm(`Block ${displayName}?`)) return;
    setBusy(true);
    setError(null);
    try {
      await blockUser(target);
      onBlocked?.();
      onBack?.();
    } catch (e) {
      setError(e instanceof ApiException ? e.message : "Block failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="pb-6">
      <div className="profile-shell animate-fade-up">
        <div className={`profile-cover ${menuOpen ? "menu-open" : ""}`}>
          <div className="profile-cover-media">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={coverUrl}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="profile-cover-scrim" />
          </div>

          <div className="absolute left-3.5 top-3.5 z-20">
            {onBack ? (
              <button
                type="button"
                onClick={onBack}
                className="profile-glass-btn liquid-press"
                aria-label="Back"
              >
                <IconBack />
              </button>
            ) : isOwn ? (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setMenuOpen((v) => !v)}
                  className="profile-glass-btn liquid-press"
                  aria-label="Profile options"
                  aria-expanded={menuOpen}
                >
                  <IconMore />
                </button>
                {menuOpen ? (
                  <div className="profile-cover-menu">
                    <MenuItem
                      label="Edit info"
                      onClick={() => {
                        setMenuOpen(false);
                        setEditOpen(true);
                      }}
                    />
                    <MenuItem
                      label="Change photo"
                      onClick={() => {
                        setMenuOpen(false);
                        document.getElementById("profile-avatar-input")?.click();
                      }}
                    />
                    <MenuItem
                      label="Change cover"
                      onClick={() => {
                        setMenuOpen(false);
                        document.getElementById("profile-cover-input")?.click();
                      }}
                    />
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          {isOwn ? (
            <div className="absolute right-3.5 top-3.5 z-20">
              <label className="profile-glass-btn liquid-press cursor-pointer">
                <IconCamera />
                <input
                  id="profile-cover-input"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => onCover(e.target.files?.[0] ?? null)}
                />
              </label>
            </div>
          ) : null}
        </div>

        <div className="profile-avatar-anchor">
          <div className="profile-avatar-wrap">
            <div className="profile-avatar-ring">
              <div className="relative h-full w-full overflow-hidden rounded-full bg-navy">
                {local.avatar ? (
                  <Image
                    src={local.avatar}
                    alt=""
                    fill
                    unoptimized
                    className="object-cover"
                  />
                ) : (
                  <span className="flex h-full items-center justify-center font-display text-[30px] font-extrabold text-white">
                    {letter}
                  </span>
                )}
              </div>
            </div>
            {isOwn ? (
              <label className="liquid-press absolute bottom-0.5 right-0.5 grid h-[28px] w-[28px] cursor-pointer place-items-center rounded-full bg-navy text-gold ring-[3px] ring-[var(--canvas)]">
                <IconCamera small />
                <input
                  id="profile-avatar-input"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => void onAvatar(e.target.files?.[0] ?? null)}
                />
              </label>
            ) : null}
          </div>
        </div>

        <div className="profile-body">
          <h1 className="font-display text-[20px] font-extrabold tracking-[-0.04em] text-navy">
            {displayName}
          </h1>
          {local.username ? (
            <p className="mt-0.5 text-[12.5px] text-navy/42">@{local.username}</p>
          ) : null}

          <button
            type="button"
            onClick={cycleTitle}
            className="profile-title-badge liquid-press mt-1.5"
            title={isOwn ? "Tap to change title" : undefined}
          >
            <BrandMark size={14} variant="plain" />
            <span>{TITLES[titleIndex]}</span>
            <IconVerified />
          </button>

          <p className="mx-auto mt-1 max-w-[40ch] text-[12px] font-semibold text-navy/48">
            {memberLine}
          </p>

          {local.bio?.trim() ? (
            <p className="profile-bio">
              {local.bio}
            </p>
          ) : null}

          {!isOwn ? (
            <div className="profile-actions">
              <button
                type="button"
                disabled={busy}
                onClick={() => void onFollow()}
                className={`profile-follow liquid-press ${
                  local.isFollowed ? "on" : ""
                }`}
              >
                {busy ? "…" : local.isFollowed ? "Collaborating" : "Collaborate"}
              </button>
              {onStartChat ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setError(null);
                    onStartChat({
                      userId: local.authUserId || local.id,
                      username: local.username || local.fullName || displayName,
                    });
                  }}
                  className="profile-chat liquid-press"
                >
                  Message
                </button>
              ) : null}
              <button
                type="button"
                disabled={busy}
                onClick={() => void onBlock()}
                className="profile-block liquid-press"
              >
                Block
              </button>
            </div>
          ) : null}

          {error ? (
            <p className="mt-3 text-[12.5px] text-red-700">{error}</p>
          ) : null}

          <div className="profile-stats">
            <button
              type="button"
              className="profile-stat"
              onClick={() => setPeopleKind("followers")}
            >
              <span className="profile-stat-value">{local.followersCount}</span>
              <span className="profile-stat-mark" />
              <span className="profile-stat-label">Collaborators</span>
            </button>
            <span className="profile-stat-divider" />
            <button
              type="button"
              className="profile-stat"
              onClick={() => setPeopleKind("following")}
            >
              <span className="profile-stat-value">{local.followingCount}</span>
              <span className="profile-stat-mark" />
              <span className="profile-stat-label">Collaborating</span>
            </button>
            <span className="profile-stat-divider" />
            <div className="profile-stat cursor-default">
              <span className="profile-stat-value">
                {postsLoading ? "…" : posts.length}
              </span>
              <span className="profile-stat-mark" />
              <span className="profile-stat-label">Innovation</span>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-5 animate-fade-up">
        <div className="mb-2.5 flex items-center justify-center gap-2">
          <BrandMark size={18} variant="plain" />
          <h2 className="font-display text-[15px] font-bold tracking-[-0.02em] text-navy">
            Innovations
          </h2>
        </div>
        {postsLoading ? <LiquidLoader label="Loading innovations…" /> : null}
        {!postsLoading && postsError ? (
          <LiquidError message={postsError} />
        ) : null}
        {!postsLoading && !postsError && posts.length === 0 ? (
          <LiquidEmpty
            title="No innovations yet"
            body={
              isOwn
                ? "Share your first idea with the community."
                : "This member hasn’t posted yet."
            }
          />
        ) : null}
        {!postsLoading && posts.length > 0 ? (
          <div className="space-y-3">
            {posts.map((post) => (
              <FeedCard
                key={post.id}
                post={post}
                onChange={(next) =>
                  setPosts((list) =>
                    list.map((p) => (p.id === next.id ? next : p)),
                  )
                }
                onDeleted={(id) =>
                  setPosts((list) => list.filter((p) => p.id !== id))
                }
                onOpenAuthor={onOpenAuthor}
              />
            ))}
          </div>
        ) : null}
      </div>

      {editOpen ? (
        <EditProfileSheet
          profile={local}
          onClose={() => setEditOpen(false)}
          onSaved={(next) => {
            setLocal(next);
            onProfileChange?.(next);
            setEditOpen(false);
          }}
        />
      ) : null}

      {peopleKind ? (
        <PeopleSheet
          title={
            peopleKind === "followers" ? "Collaborators" : "Collaborating"
          }
          subtitle={
            peopleKind === "followers"
              ? "People collaborating with this profile"
              : "People this profile collaborates with"
          }
          authUserId={isOwn ? null : local.authUserId || local.id}
          kind={peopleKind}
          onClose={() => setPeopleKind(null)}
          onOpenAuthor={(id, name) => {
            setPeopleKind(null);
            onOpenAuthor?.(id, name);
          }}
          onStartChat={
            onStartChat
              ? (peer) => {
                  setPeopleKind(null);
                  onStartChat(peer);
                }
              : undefined
          }
        />
      ) : null}
    </div>
  );
}

function MenuItem({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="block w-full rounded-[12px] px-3.5 py-2.5 text-left text-[13.5px] font-semibold text-navy hover:bg-navy/[0.05]"
    >
      {label}
    </button>
  );
}

function EditProfileSheet({
  profile,
  onClose,
  onSaved,
}: {
  profile: UserProfile;
  onClose: () => void;
  onSaved: (p: UserProfile) => void;
}) {
  const [fullName, setFullName] = useState(profile.fullName ?? "");
  const [bio, setBio] = useState(profile.bio ?? "");
  const [phone, setPhone] = useState(profile.phone ?? "");
  const [gender, setGender] = useState(profile.gender ?? "");
  const [occupation, setOccupation] = useState(profile.occupation ?? "");
  const [education, setEducation] = useState(profile.education ?? "");
  const [address, setAddress] = useState(profile.address ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSave(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const next = await updateProfile({
        fullName,
        bio,
        phone,
        gender,
        occupation,
        education,
        address,
      });
      onSaved(next);
    } catch (err) {
      setError(err instanceof ApiException ? err.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="profile-sheet"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="profile-sheet-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-navy/[0.06] px-5 py-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gold">
              Profile
            </p>
            <h3 className="font-display text-[20px] font-extrabold tracking-[-0.03em] text-navy">
              Edit info
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="liquid-chip !py-1.5"
          >
            Close
          </button>
        </div>
        <form
          onSubmit={onSave}
          className="liquid-scroll space-y-3 overflow-y-auto px-5 py-4"
        >
          <Field label="Full name" value={fullName} onChange={setFullName} />
          <label className="block space-y-1.5">
            <span className="pl-1 text-[12.5px] font-semibold text-muted">
              Bio
            </span>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={3}
              className="glass-field min-h-[88px] resize-none"
            />
          </label>
          <Field label="Phone" value={phone} onChange={setPhone} />
          <Field label="Occupation" value={occupation} onChange={setOccupation} />
          <Field label="Education" value={education} onChange={setEducation} />
          <Field label="Address" value={address} onChange={setAddress} />
          <div>
            <p className="mb-1.5 pl-1 text-[12.5px] font-semibold text-muted">
              Gender
            </p>
            <div className="flex flex-wrap gap-2">
              {["Male", "Female", "Other"].map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGender(g)}
                  className={`liquid-chip ${gender === g ? "liquid-chip-active" : ""}`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>
          {error ? (
            <p className="text-[12.5px] text-red-700">{error}</p>
          ) : null}
          <button
            type="submit"
            disabled={busy}
            className="liquid-btn liquid-btn-dark w-full"
          >
            {busy ? "Saving…" : "Save changes"}
          </button>
        </form>
      </div>
    </div>
  );
}

function PeopleSheet({
  title,
  subtitle,
  authUserId,
  kind,
  onClose,
  onOpenAuthor,
  onStartChat,
}: {
  title: string;
  subtitle: string;
  authUserId?: string | null;
  kind: "followers" | "following";
  onClose: () => void;
  onOpenAuthor?: (userId: string, name?: string | null) => void;
  onStartChat?: (peer: ChatPeerRequest) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [users, setUsers] = useState<ProfileListUser[]>([]);
  const [query, setQuery] = useState("");
  const [mutualIds, setMutualIds] = useState<Set<string>>(new Set());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const myUserId = AuthSession.load().userId;
  const viewingOwnList = !authUserId || authUserId === myUserId;

  const filteredUsers = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => {
      const name = (u.fullName || "").toLowerCase();
      const handle = (u.username || "").toLowerCase();
      return name.includes(q) || handle.includes(q);
    });
  }, [users, query]);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      setError(null);
      setActionError(null);
      try {
        const [list, mutual] = await Promise.all([
          kind === "followers"
            ? listFollowers(authUserId)
            : listFollowing(authUserId),
          listMutualCollaborators().catch(() => [] as ProfileListUser[]),
        ]);
        setUsers(list);
        setMutualIds(new Set(mutual.map((u) => u.id).filter(Boolean)));
      } catch (e) {
        setError(e instanceof ApiException ? e.message : "Could not load list");
      } finally {
        setLoading(false);
      }
    })();
  }, [authUserId, kind]);

  async function onToggleFollow(user: ProfileListUser) {
    if (!user.id || busyId || user.id === myUserId) return;
    setBusyId(user.id);
    setActionError(null);
    const prev = user.isFollowed;
    setUsers((list) =>
      list.map((u) => (u.id === user.id ? { ...u, isFollowed: !prev } : u)),
    );
    try {
      const result = await toggleFollow(user.id);
      setUsers((list) =>
        list.map((u) =>
          u.id === user.id ? { ...u, isFollowed: result.isFollowing } : u,
        ),
      );
      // Own Collaborators + follow back ⇒ mutual chat unlocks.
      if (viewingOwnList && kind === "followers") {
        setMutualIds((prevSet) => {
          const next = new Set(prevSet);
          if (result.isFollowing) next.add(user.id);
          else next.delete(user.id);
          return next;
        });
      } else if (viewingOwnList && kind === "following" && !result.isFollowing) {
        setMutualIds((prevSet) => {
          const next = new Set(prevSet);
          next.delete(user.id);
          return next;
        });
      }
      void syncActivityNotifications();
    } catch (e) {
      setUsers((list) =>
        list.map((u) => (u.id === user.id ? { ...u, isFollowed: prev } : u)),
      );
      setActionError(
        e instanceof ApiException ? e.message : "Could not update collaboration",
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div
      className="profile-sheet"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="profile-sheet-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-navy/[0.06] px-5 py-4">
          <div>
            <h3 className="font-display text-[20px] font-extrabold tracking-[-0.03em] text-navy">
              {title}
            </h3>
            <p className="mt-0.5 text-[12.5px] text-muted">{subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="liquid-chip !py-1.5"
          >
            Close
          </button>
        </div>
        <div className="border-b border-navy/[0.06] px-4 py-3">
          <label className="relative block">
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-navy/35">
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden
              >
                <circle
                  cx="11"
                  cy="11"
                  r="6.5"
                  stroke="currentColor"
                  strokeWidth="1.8"
                />
                <path
                  d="M16 16l4 4"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
            </span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search people…"
              className="chat-search !mt-0"
              autoComplete="off"
            />
          </label>
        </div>
        <div className="liquid-scroll overflow-y-auto px-3 py-3">
          {loading ? <LiquidLoader label="Loading…" /> : null}
          {!loading && error ? <LiquidError message={error} /> : null}
          {!loading && actionError ? (
            <p className="mb-2 px-3 text-center text-[12px] text-red-700">
              {actionError}
            </p>
          ) : null}
          {!loading && !error && users.length === 0 ? (
            <p className="px-3 py-10 text-center text-[13.5px] text-muted">
              No one here yet
            </p>
          ) : null}
          {!loading && !error && users.length > 0 && filteredUsers.length === 0 ? (
            <p className="px-3 py-10 text-center text-[13.5px] text-muted">
              No matches for “{query.trim()}”
            </p>
          ) : null}
          {!loading &&
            filteredUsers.map((u) => {
              const name =
                u.fullName?.trim() || u.username?.trim() || "Innovator";
              const letter = name.slice(0, 1).toUpperCase();
              const isSelf = Boolean(myUserId && u.id === myUserId);
              const label = u.isFollowed
                ? "Collaborating"
                : kind === "followers" && viewingOwnList
                  ? "Follow back"
                  : "Collaborate";
              const showChat =
                Boolean(onStartChat) && !isSelf && mutualIds.has(u.id);
              return (
                <div
                  key={u.id}
                  className="flex items-center gap-2 rounded-[16px] px-3 py-2.5 hover:bg-canvas"
                >
                  <button
                    type="button"
                    onClick={() => onOpenAuthor?.(u.id, name)}
                    className="liquid-press flex min-w-0 flex-1 items-center gap-3 text-left"
                  >
                    <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-navy">
                      {u.avatar ? (
                        <Image
                          src={u.avatar}
                          alt=""
                          fill
                          unoptimized
                          className="object-cover"
                        />
                      ) : (
                        <span className="flex h-full items-center justify-center text-[14px] font-bold text-white">
                          {letter}
                        </span>
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-semibold text-navy">
                        {name}
                      </span>
                      {u.username ? (
                        <span className="block truncate text-[12px] text-muted">
                          @{u.username}
                        </span>
                      ) : null}
                    </span>
                  </button>
                  {!isSelf ? (
                    <div className="flex shrink-0 items-center gap-1.5">
                      {showChat ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onStartChat?.({
                              userId: u.id,
                              username: u.username?.trim() || name,
                            });
                          }}
                          className="profile-chat liquid-press !min-w-0 !px-3 !py-1.5 !text-[12px]"
                        >
                          Message
                        </button>
                      ) : null}
                      <button
                        type="button"
                        disabled={busyId === u.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          void onToggleFollow(u);
                        }}
                        className={`profile-follow liquid-press !min-w-0 !px-3 !py-1.5 !text-[12px] ${
                          u.isFollowed ? "on" : ""
                        }`}
                      >
                        {busyId === u.id ? "…" : label}
                      </button>
                    </div>
                  ) : null}
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="pl-1 text-[12.5px] font-semibold text-muted">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="glass-field"
      />
    </label>
  );
}

function IconVerified() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="10" fill="#F4B400" />
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="#071323"
        strokeOpacity="0.18"
        strokeWidth="1"
      />
      <path
        d="M7.6 12.25 10.55 15.1 16.5 8.9"
        stroke="#071323"
        strokeWidth="2.35"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconBack() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M15 6 9 12l6 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconMore() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="6" cy="12" r="1.6" fill="currentColor" />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" />
      <circle cx="18" cy="12" r="1.6" fill="currentColor" />
    </svg>
  );
}

function IconCamera({ small }: { small?: boolean }) {
  const s = small ? 14 : 16;
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 8.5A2.5 2.5 0 0 1 6.5 6h2l1.2-1.6A1.5 1.5 0 0 1 10.9 4h2.2a1.5 1.5 0 0 1 1.2.4L15.5 6h2A2.5 2.5 0 0 1 20 8.5v8A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5v-8Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12.5" r="3.2" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}
