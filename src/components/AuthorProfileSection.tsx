"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { ApiException } from "@/lib/api-client";
import { AuthSession } from "@/lib/auth-session";
import {
  getProfileByAuthUserId,
  toggleFollow,
} from "@/lib/profile-api";
import type { UserProfile } from "@/lib/types";
import {
  LiquidError,
  LiquidLoader,
  SectionLabel,
} from "./ui/LiquidChrome";

type Props = {
  authUserId: string;
  fallbackName?: string | null;
  onBack: () => void;
};

export function AuthorProfileSection({
  authUserId,
  fallbackName,
  onBack,
}: Props) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const me = AuthSession.load().userId;
  const isOwn = Boolean(me && me === authUserId);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        setProfile(await getProfileByAuthUserId(authUserId));
      } catch (e) {
        setError(
          e instanceof ApiException ? e.message : "Could not load profile",
        );
      } finally {
        setLoading(false);
      }
    })();
  }, [authUserId]);

  async function onFollow() {
    if (!profile || busy || isOwn) return;
    setBusy(true);
    const prev = profile.isFollowed;
    setProfile({ ...profile, isFollowed: !prev });
    try {
      const result = await toggleFollow(authUserId);
      setProfile((p) =>
        p
          ? {
              ...p,
              isFollowed: result.isFollowing,
              followersCount: Math.max(
                0,
                p.followersCount + (result.isFollowing ? 1 : -1),
              ),
            }
          : p,
      );
    } catch (e) {
      setProfile((p) => (p ? { ...p, isFollowed: prev } : p));
      setError(e instanceof ApiException ? e.message : "Follow failed");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <LiquidLoader label="Loading profile…" />;
  if (error && !profile) {
    return (
      <div className="space-y-3">
        <button type="button" onClick={onBack} className="liquid-chip">
          ← Back
        </button>
        <LiquidError message={error} onRetry={() => window.location.reload()} />
      </div>
    );
  }

  const name =
    profile?.fullName ||
    profile?.username ||
    fallbackName ||
    "Innovator";
  const letter = name.slice(0, 1).toUpperCase();

  return (
    <div className="space-y-4 pb-6">
      <button type="button" onClick={onBack} className="liquid-chip">
        ← Back to feed
      </button>

      <div className="liquid-glass p-5">
        <div className="flex items-center gap-4">
          <div className="relative h-20 w-20 overflow-hidden rounded-[22px] bg-navy p-[2px] shadow-soft">
            <div className="relative h-full w-full overflow-hidden rounded-[20px] bg-white">
              {profile?.avatar ? (
                <Image
                  src={profile.avatar}
                  alt=""
                  fill
                  unoptimized
                  className="object-cover"
                />
              ) : (
                <span className="flex h-full items-center justify-center font-display text-2xl font-bold text-navy">
                  {letter}
                </span>
              )}
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap gap-2">
              <span className="liquid-chip !py-1">
                {profile?.followersCount ?? 0} followers
              </span>
              <span className="liquid-chip !py-1">
                {profile?.followingCount ?? 0} following
              </span>
            </div>
            {!isOwn ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => void onFollow()}
                className={`liquid-press mt-3 inline-flex items-center gap-1 rounded-full px-3.5 py-2 text-[12.5px] font-semibold ${
                  profile?.isFollowed
                    ? "border border-navy/20 bg-white/80 text-navy"
                    : "bg-navy text-white"
                }`}
              >
                {profile?.isFollowed ? "✓ Following" : "+ Follow"}
              </button>
            ) : null}
          </div>
        </div>

        {profile?.bio ? (
          <div className="mt-4">
            <SectionLabel>Bio</SectionLabel>
            <p className="text-[14.5px] leading-relaxed text-ink/85">
              {profile.bio}
            </p>
          </div>
        ) : null}

        {(profile?.occupation || profile?.education) && (
          <div className="mt-4 space-y-2">
            {profile.occupation ? (
              <p className="liquid-panel px-3 py-2 text-[13px]">
                <span className="text-muted">Occupation · </span>
                <span className="font-semibold text-navy">
                  {profile.occupation}
                </span>
              </p>
            ) : null}
            {profile.education ? (
              <p className="liquid-panel px-3 py-2 text-[13px]">
                <span className="text-muted">Education · </span>
                <span className="font-semibold text-navy">
                  {profile.education}
                </span>
              </p>
            ) : null}
          </div>
        )}

        {error ? (
          <p className="mt-3 text-[12.5px] text-red-700">{error}</p>
        ) : null}
      </div>
    </div>
  );
}
