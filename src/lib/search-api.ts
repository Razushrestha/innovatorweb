import { ApiConfig } from "./api-config";
import { apiRequest } from "./api-client";
import type { SearchPostHit, SearchUserHit } from "./types";

function asUsers(raw: unknown): SearchUserHit[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((u): u is Record<string, unknown> => !!u && typeof u === "object")
    .map((u) => ({
      id: String(u.id ?? u.auth_user_id ?? u.authUserId ?? ""),
      username: String(u.username ?? u.name ?? "User"),
      avatar: (u.avatar as string | null) ?? null,
      bio: (u.bio as string | null) ?? null,
    }));
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

export async function searchAll(q: string) {
  const data = await apiRequest<Record<string, unknown>>(
    ApiConfig.searchBaseUrl,
    "/api/search",
    { query: { q, type: "all" } },
  );
  return {
    users: asUsers(data.users ?? data.Users),
    posts: asPosts(data.posts ?? data.Posts),
  };
}

export async function suggestedUsers() {
  try {
    const data = await apiRequest<unknown>(
      ApiConfig.searchBaseUrl,
      "/api/suggested-users",
    );
    return asUsers(data);
  } catch {
    const data = await apiRequest<unknown>(
      ApiConfig.searchBaseUrl,
      "/api/users/suggested",
    );
    return asUsers(data);
  }
}
