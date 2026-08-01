import { ApiConfig } from "./api-config";
import { apiRequest } from "./api-client";
import { toProxiedMediaUrlOrNull } from "./media-url";
import { getProfileByAuthUserId } from "./profile-api";
import type { SearchPostHit, SearchUserHit } from "./types";

function pickAvatar(raw: Record<string, unknown>): string | null {
  const nested =
    (raw.profile as Record<string, unknown> | undefined) ||
    (raw.user as Record<string, unknown> | undefined);
  const candidates = [
    raw.avatar,
    raw.avatar_url,
    raw.avatarUrl,
    raw.profile_photo,
    raw.profilePhoto,
    raw.photo,
    raw.photo_url,
    raw.photoUrl,
    raw.image,
    raw.image_url,
    raw.imageUrl,
    nested?.avatar,
    nested?.avatar_url,
    nested?.profile_photo,
    nested?.photo,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) {
      return toProxiedMediaUrlOrNull(c.trim(), "profile");
    }
  }
  return null;
}

function asUser(raw: Record<string, unknown>): SearchUserHit {
  return {
    id: String(raw.id || raw.auth_user_id || raw.authUserId || raw.user_id || ""),
    username: String(raw.username ?? raw.name ?? "User"),
    avatar: pickAvatar(raw),
    bio: (raw.bio as string | null) ?? (raw.about as string | null) ?? null,
  };
}

function asUsers(raw: unknown): SearchUserHit[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((u): u is Record<string, unknown> => !!u && typeof u === "object")
    .map(asUser)
    .filter((u) => Boolean(u.id || u.username));
}

function unwrapUserList(data: unknown): unknown {
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object") {
    const rec = data as Record<string, unknown>;
    if (Array.isArray(rec.users)) return rec.users;
    if (Array.isArray(rec.Users)) return rec.Users;
    if (Array.isArray(rec.data)) return rec.data;
    if (Array.isArray(rec.results)) return rec.results;
    if (Array.isArray(rec.suggested)) return rec.suggested;
  }
  return [];
}

function asPosts(raw: unknown): SearchPostHit[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((p): p is Record<string, unknown> => !!p && typeof p === "object")
    .map((p) => ({
      id: String(p.id ?? p.post_id ?? ""),
      content: String(p.content ?? p.text ?? ""),
      username: (p.username as string | null) ?? null,
    }));
}

/** Fill missing avatars from the profile service (search often omits photos). */
async function enrichUserAvatars(
  users: SearchUserHit[],
  limit = 12,
): Promise<SearchUserHit[]> {
  const slice = users.slice(0, limit);
  const rest = users.slice(limit);
  const enriched = await Promise.all(
    slice.map(async (user) => {
      if (user.avatar || !user.id) return user;
      try {
        const profile = await getProfileByAuthUserId(user.id);
        return {
          ...user,
          avatar: profile.avatar || user.avatar,
          bio: user.bio?.trim() ? user.bio : profile.bio || user.bio,
          username: user.username || profile.username || "User",
        };
      } catch {
        return user;
      }
    }),
  );
  return [...enriched, ...rest];
}

export async function searchAll(q: string) {
  const data = await apiRequest<Record<string, unknown>>(
    ApiConfig.searchBaseUrl,
    "/api/search",
    { query: { q, type: "all" } },
  );
  const users = asUsers(data.users ?? data.Users);
  return {
    users: await enrichUserAvatars(users, 16),
    posts: asPosts(data.posts ?? data.Posts),
  };
}

export async function suggestedUsers() {
  let list: SearchUserHit[] = [];
  try {
    const data = await apiRequest<unknown>(
      ApiConfig.searchBaseUrl,
      "/api/suggested-users",
    );
    list = asUsers(unwrapUserList(data));
  } catch {
    try {
      const data = await apiRequest<unknown>(
        ApiConfig.searchBaseUrl,
        "/api/users/suggested",
      );
      list = asUsers(unwrapUserList(data));
    } catch {
      list = [];
    }
  }
  return enrichUserAvatars(list, 12);
}
