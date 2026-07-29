"use client";

import { useEffect, useState } from "react";
import { ApiException } from "@/lib/api-client";
import { AuthSession } from "@/lib/auth-session";
import { getProfileByAuthUserId } from "@/lib/profile-api";
import type { UserProfile } from "@/lib/types";
import { ProfileView } from "./ProfileView";
import { LiquidError, LiquidLoader } from "./ui/LiquidChrome";

type Props = {
  authUserId: string;
  fallbackName?: string | null;
  onBack: () => void;
  onOpenAuthor?: (userId: string, name?: string | null) => void;
};

export function AuthorProfileSection({
  authUserId,
  fallbackName,
  onBack,
  onOpenAuthor,
}: Props) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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

  if (!profile) {
    return (
      <LiquidError
        message={
          fallbackName
            ? `Could not load ${fallbackName}`
            : "Profile unavailable"
        }
      />
    );
  }

  return (
    <ProfileView
      profile={profile}
      isOwn={isOwn}
      onBack={onBack}
      onProfileChange={setProfile}
      onOpenAuthor={onOpenAuthor}
      onBlocked={onBack}
    />
  );
}
