"use client";

import Image from "next/image";
import { FormEvent, useEffect, useState } from "react";
import { ApiException } from "@/lib/api-client";
import {
  getMyProfile,
  updateProfile,
  uploadAvatar,
} from "@/lib/profile-api";
import type { UserProfile } from "@/lib/types";
import {
  LiquidError,
  LiquidLoader,
  SectionLabel,
} from "./ui/LiquidChrome";

export function ProfileSection() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [fullName, setFullName] = useState("");
  const [bio, setBio] = useState("");
  const [phone, setPhone] = useState("");
  const [gender, setGender] = useState("");
  const [occupation, setOccupation] = useState("");
  const [education, setEducation] = useState("");
  const [address, setAddress] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        const p = await getMyProfile();
        setProfile(p);
        setFullName(p.fullName ?? "");
        setBio(p.bio ?? "");
        setPhone(p.phone ?? "");
        setGender(p.gender ?? "");
        setOccupation(p.occupation ?? "");
        setEducation(p.education ?? "");
        setAddress(p.address ?? "");
      } catch (e) {
        setError(
          e instanceof ApiException ? e.message : "Could not load profile",
        );
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function onSave(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setSaved(false);
    setError(null);
    try {
      const p = await updateProfile({
        fullName,
        bio,
        phone,
        gender,
        occupation,
        education,
        address,
      });
      setProfile(p);
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiException ? err.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  async function onAvatar(file: File | null) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      await uploadAvatar(file);
      const refreshed = await getMyProfile();
      setProfile(refreshed);
    } catch (err) {
      setError(
        err instanceof ApiException ? err.message : "Avatar upload failed",
      );
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <LiquidLoader label="Loading profile…" />;
  if (!profile) {
    return <LiquidError message={error || "Profile unavailable"} />;
  }

  const letter = (profile.fullName || profile.username || "I")
    .slice(0, 1)
    .toUpperCase();

  return (
    <div className="space-y-4 pb-6">
      <div className="liquid-glass p-5">
        <div className="flex items-center gap-4">
          <label className="liquid-press relative h-20 w-20 cursor-pointer overflow-hidden rounded-[22px] bg-navy p-[2px] shadow-soft">
            <span className="relative block h-full w-full overflow-hidden rounded-[20px] bg-white">
              {profile.avatar ? (
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
            </span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => void onAvatar(e.target.files?.[0] ?? null)}
            />
          </label>
          <div className="min-w-0">
            <h2 className="truncate font-display text-[22px] font-extrabold tracking-[-0.03em] text-navy">
              {profile.fullName || profile.username || "Innovator"}
            </h2>
            <p className="text-[13px] text-muted">@{profile.username || "user"}</p>
            <div className="mt-2 flex gap-2">
              <span className="liquid-chip !py-1">
                {profile.followersCount} followers
              </span>
              <span className="liquid-chip !py-1">
                {profile.followingCount} following
              </span>
            </div>
          </div>
        </div>
        <p className="mt-3 text-[12.5px] text-muted">Tap avatar to change photo</p>
      </div>

      <form onSubmit={onSave} className="liquid-glass space-y-3.5 p-5">
        <SectionLabel>Details</SectionLabel>
        <Field label="Full name" value={fullName} onChange={setFullName} />
        <label className="block space-y-1.5">
          <span className="pl-1 text-[12.5px] font-semibold text-muted">Bio</span>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={3}
            className="glass-field min-h-[96px] resize-none"
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
                className={`liquid-chip ${
                  gender === g ? "liquid-chip-active" : ""
                }`}
              >
                {g}
              </button>
            ))}
          </div>
        </div>

        {error ? (
          <p className="liquid-panel px-3 py-2 text-[12.5px] text-red-700">
            {error}
          </p>
        ) : null}
        {saved ? (
          <p className="text-[13px] font-semibold text-[var(--repost)]">
            Profile saved
          </p>
        ) : null}

        <button
          type="submit"
          disabled={busy}
          className="liquid-btn liquid-btn-dark w-full"
        >
          {busy ? "Saving…" : "Save profile"}
        </button>
      </form>
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
