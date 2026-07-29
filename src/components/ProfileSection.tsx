"use client";

import { useEffect, useState } from "react";
import { ApiException } from "@/lib/api-client";
import { getMyProfile } from "@/lib/profile-api";
import type { UserProfile } from "@/lib/types";
import { ProfileView } from "./ProfileView";
import { LiquidError, LiquidLoader } from "./ui/LiquidChrome";

type Props = {
  onOpenAuthor?: (userId: string, name?: string | null) => void;
};

export function ProfileSection({ onOpenAuthor }: Props) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        setProfile(await getMyProfile());
      } catch (e) {
        setError(
          e instanceof ApiException ? e.message : "Could not load profile",
        );
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <LiquidLoader label="Loading profile…" />;
  if (!profile) {
    return <LiquidError message={error || "Profile unavailable"} />;
  }

  return (
    <ProfileView
      profile={profile}
      isOwn
      onProfileChange={setProfile}
      onOpenAuthor={onOpenAuthor}
    />
  );
}
