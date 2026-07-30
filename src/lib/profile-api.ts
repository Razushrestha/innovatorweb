import { ApiConfig } from "./api-config";
import { apiMultipart, apiRequest } from "./api-client";
import { toProxiedMediaUrl, toProxiedMediaUrlOrNull } from "./media-url";
import type { ProfileListUser, UserProfile } from "./types";

function asProfile(raw: Record<string, unknown>): UserProfile {
  const interests = Array.isArray(raw.interests)
    ? raw.interests.map(String)
    : [];
  return {
    id: String(raw.id ?? ""),
    authUserId: String(raw.auth_user_id ?? raw.authUserId ?? ""),
    username: (raw.username as string | null) ?? null,
    fullName: (raw.full_name as string | null) ?? (raw.fullName as string | null) ?? null,
    email: (raw.email as string | null) ?? null,
    role: (raw.role as string | null) ?? null,
    bio: (raw.bio as string | null) ?? null,
    avatar: toProxiedMediaUrlOrNull(
      (raw.avatar as string | null) ?? null,
      "profile",
    ),
    dateOfBirth:
      (raw.date_of_birth as string | null) ??
      (raw.dateOfBirth as string | null) ??
      null,
    phone: (raw.phone as string | null) ?? null,
    gender: (raw.gender as string | null) ?? null,
    address: (raw.address as string | null) ?? null,
    education: (raw.education as string | null) ?? null,
    occupation: (raw.occupation as string | null) ?? null,
    interests,
    followersCount: Number(raw.followers_count ?? raw.followersCount ?? 0),
    followingCount: Number(raw.following_count ?? raw.followingCount ?? 0),
    isFollowed: raw.is_followed === true || raw.isFollowed === true,
  };
}

export async function getMyProfile() {
  const data = await apiRequest<Record<string, unknown>>(
    ApiConfig.profileBaseUrl,
    "/api/users/me",
  );
  return asProfile(data);
}

export async function ensureProfile(input: {
  authUserId: string;
  username?: string;
  email?: string;
  role?: string;
}) {
  try {
    await apiRequest(ApiConfig.profileBaseUrl, "/api/internal/profiles/ensure", {
      method: "POST",
      body: {
        auth_user_id: input.authUserId,
        username: input.username,
        email: input.email,
        role: input.role ?? "user",
      },
    });
  } catch {
    // best-effort
  }
}

export async function updateProfile(input: {
  fullName?: string;
  bio?: string;
  dateOfBirth?: string;
  phone?: string;
  gender?: string;
  address?: string;
  education?: string;
  occupation?: string;
  interests?: string[];
}) {
  const data = await apiRequest<Record<string, unknown>>(
    ApiConfig.profileBaseUrl,
    "/api/profile",
    {
      method: "PATCH",
      body: {
        full_name: input.fullName,
        bio: input.bio,
        date_of_birth: input.dateOfBirth,
        phone: input.phone,
        gender: input.gender,
        address: input.address,
        education: input.education,
        occupation: input.occupation,
        interests: input.interests,
      },
    },
  );
  return asProfile(data);
}

export async function uploadAvatar(file: File) {
  const form = new FormData();
  form.append("file", file, file.name);
  const data = await apiMultipart<unknown>(
    ApiConfig.profileBaseUrl,
    "/api/users/me/avatar",
    form,
  );
  if (typeof data === "string") return toProxiedMediaUrl(data, "profile");
  if (data && typeof data === "object" && "avatar" in data) {
    return toProxiedMediaUrl(
      String((data as { avatar: string }).avatar),
      "profile",
    );
  }
  return toProxiedMediaUrl(String(data ?? ""), "profile");
}

export async function getProfileByAuthUserId(authUserId: string) {
  const data = await apiRequest<Record<string, unknown>>(
    ApiConfig.profileBaseUrl,
    `/api/users/${encodeURIComponent(authUserId)}`,
  );
  return asProfile(data);
}

export async function toggleFollow(targetAuthUserId: string) {
  const data = await apiRequest<Record<string, unknown> | null>(
    ApiConfig.profileBaseUrl,
    `/api/users/${encodeURIComponent(targetAuthUserId)}/follow`,
    { method: "POST" },
  );
  const raw = (data ?? {}) as Record<string, unknown>;
  return {
    isFollowing: raw.is_following === true || raw.isFollowing === true,
    message: (raw.message as string | null) ?? null,
  };
}

export async function blockUser(targetAuthUserId: string) {
  const data = await apiRequest<Record<string, unknown> | null>(
    ApiConfig.profileBaseUrl,
    `/api/users/${encodeURIComponent(targetAuthUserId)}/block`,
    { method: "POST" },
  );
  const raw = (data ?? {}) as Record<string, unknown>;
  return {
    isBlocked: raw.is_blocked === true || raw.isBlocked === true,
    message: (raw.message as string | null) ?? null,
  };
}

function asListUser(raw: Record<string, unknown>): ProfileListUser {
  return {
    id: String(raw.id ?? ""),
    username: (raw.username as string | null) ?? null,
    fullName:
      (raw.full_name as string | null) ??
      (raw.fullName as string | null) ??
      null,
    avatar: toProxiedMediaUrlOrNull(
      (raw.avatar as string | null) ?? null,
      "profile",
    ),
    role: (raw.role as string | null) ?? null,
    isFollowed:
      raw.is_followed === true ||
      raw.isFollowed === true ||
      raw.is_following === true ||
      raw.isFollowing === true,
  };
}

async function listUsers(path: string) {
  const data = await apiRequest<unknown>(ApiConfig.profileBaseUrl, path);
  if (!Array.isArray(data)) return [] as ProfileListUser[];
  return data
    .filter((u): u is Record<string, unknown> => !!u && typeof u === "object")
    .map(asListUser);
}

export async function listFollowers(authUserId?: string | null) {
  const path =
    authUserId && authUserId.trim()
      ? `/api/users/${encodeURIComponent(authUserId)}/followers`
      : "/api/users/followers";
  return listUsers(path);
}

export async function listFollowing(authUserId?: string | null) {
  const path =
    authUserId && authUserId.trim()
      ? `/api/users/${encodeURIComponent(authUserId)}/following`
      : "/api/users/following";
  return listUsers(path);
}
