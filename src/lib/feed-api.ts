import { ApiConfig } from "./api-config";
import { apiMultipart, apiRequest } from "./api-client";
import { toProxiedMediaUrl, toProxiedMediaUrlOrNull } from "./media-url";
import type {
  FeedCategory,
  FeedComment,
  FeedMediaItem,
  FeedPage,
  FeedPost,
} from "./types";

function asMedia(raw: unknown): FeedMediaItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((m): m is Record<string, unknown> => !!m && typeof m === "object")
    .map((m) => ({
      id: String(m.id ?? ""),
      file: toProxiedMediaUrl(String(m.file ?? ""), "feed"),
      mediaType: (m.media_type ?? m.mediaType ?? m.type) as string | null,
      thumbnail: toProxiedMediaUrlOrNull(
        (m.thumbnail as string | null) ?? null,
        "feed",
      ),
    }));
}

export function asPost(raw: Record<string, unknown>): FeedPost {
  return {
    id: String(raw.id ?? ""),
    userId: String(raw.user_id ?? raw.userId ?? ""),
    username: (raw.username as string | null) ?? null,
    avatar: toProxiedMediaUrlOrNull(
      (raw.avatar as string | null) ?? null,
      "profile",
    ),
    content: (raw.content as string | null) ?? null,
    media: asMedia(raw.media),
    reactionsCount: Number(raw.reactions_count ?? raw.reactionsCount ?? 0),
    commentsCount: Number(raw.comments_count ?? raw.commentsCount ?? 0),
    shareCount: Number(raw.share_count ?? raw.shareCount ?? 0),
    viewsCount: Number(raw.views_count ?? raw.viewsCount ?? 0),
    currentUserReaction:
      (raw.current_user_reaction as string | null) ??
      (raw.currentUserReaction as string | null) ??
      null,
    isFollowed: raw.is_followed === true || raw.isFollowed === true,
    createdAt:
      (raw.created_at as string | null) ??
      (raw.createdAt as string | null) ??
      null,
  };
}

function asFeedPage(data: Record<string, unknown>): FeedPage {
  const resultsRaw = Array.isArray(data.results) ? data.results : [];
  return {
    results: resultsRaw
      .filter((r): r is Record<string, unknown> => !!r && typeof r === "object")
      .map(asPost),
    count: Number(data.count ?? 0),
    next: (data.next as string | null) ?? null,
    previous: (data.previous as string | null) ?? null,
  };
}

export async function getFeed(page = 1, pageSize = ApiConfig.feedPageSize) {
  const data = await apiRequest<Record<string, unknown>>(
    ApiConfig.feedBaseUrl,
    "/api/feed",
    {
      query: { page: String(page), pageSize: String(pageSize) },
    },
  );
  return asFeedPage(data);
}

export async function getPostsByAuthor(
  authorId: string,
  page = 1,
  pageSize = ApiConfig.feedPageSize,
) {
  const data = await apiRequest<Record<string, unknown>>(
    ApiConfig.feedBaseUrl,
    `/api/users/${encodeURIComponent(authorId)}/posts`,
    {
      query: { page: String(page), pageSize: String(pageSize) },
    },
  );
  return asFeedPage(data);
}

export async function getCategories() {
  const data = await apiRequest<unknown>(
    ApiConfig.feedBaseUrl,
    "/api/categories",
  );
  if (!Array.isArray(data)) return [] as FeedCategory[];
  return data
    .filter((c): c is Record<string, unknown> => !!c && typeof c === "object")
    .map((c) => ({
      id: String(c.id ?? ""),
      name: String(c.name ?? ""),
      description: (c.description as string | null) ?? null,
    }));
}

export async function createPost(input: {
  content: string;
  categoryIds?: string[];
  files?: File[];
  sharedPostId?: string;
}) {
  const form = new FormData();
  form.append("content", input.content);
  if (input.sharedPostId?.trim()) {
    form.append("sharedPostId", input.sharedPostId.trim());
  }
  for (const id of input.categoryIds ?? []) {
    form.append("categoryIds", id);
  }
  for (const file of input.files ?? []) {
    form.append("media", file, file.name);
  }
  const data = await apiMultipart<Record<string, unknown>>(
    ApiConfig.feedBaseUrl,
    "/api/posts",
    form,
  );
  return asPost(data);
}

export async function deletePost(postId: string) {
  await apiRequest<null>(ApiConfig.feedBaseUrl, `/api/posts/${postId}`, {
    method: "DELETE",
  });
}

export async function repostPost(postId: string) {
  return createPost({ content: "Reposted", sharedPostId: postId });
}

export async function reactToPost(postId: string, type = "like") {
  return apiRequest<Record<string, unknown> | null>(
    ApiConfig.feedBaseUrl,
    "/api/reactions",
    {
      method: "POST",
      body: { post: postId, type },
    },
  );
}

export async function getComments(postId: string, page = 1) {
  const data = await apiRequest<unknown>(
    ApiConfig.feedBaseUrl,
    "/api/comments",
    {
      query: { post: postId, page: String(page) },
    },
  );
  if (!Array.isArray(data)) return [] as FeedComment[];
  return data
    .filter((c): c is Record<string, unknown> => !!c && typeof c === "object")
    .map((c) => ({
      id: String(c.id ?? ""),
      username: (c.username as string | null) ?? null,
      avatar: toProxiedMediaUrlOrNull(
        (c.avatar as string | null) ?? null,
        "profile",
      ),
      content: (c.content as string | null) ?? null,
      createdAt:
        (c.created_at as string | null) ??
        (c.createdAt as string | null) ??
        null,
    }));
}

export async function createComment(postId: string, content: string) {
  const data = await apiRequest<Record<string, unknown>>(
    ApiConfig.feedBaseUrl,
    "/api/comments",
    {
      method: "POST",
      body: { content, post: postId },
    },
  );
  return {
    id: String(data.id ?? ""),
    username: (data.username as string | null) ?? null,
    avatar: toProxiedMediaUrlOrNull(
      (data.avatar as string | null) ?? null,
      "profile",
    ),
    content: (data.content as string | null) ?? null,
    createdAt:
      (data.created_at as string | null) ??
      (data.createdAt as string | null) ??
      null,
  } satisfies FeedComment;
}

export function mediaIsVideo(m: FeedMediaItem) {
  const type = (m.mediaType ?? "").toLowerCase();
  if (type.includes("video")) return true;
  const path = m.file.toLowerCase().split("?")[0] ?? "";
  return (
    path.endsWith(".mp4") ||
    path.endsWith(".mov") ||
    path.endsWith(".webm") ||
    path.endsWith(".m4v")
  );
}

export function mediaPreviewUrl(m: FeedMediaItem) {
  if (mediaIsVideo(m) && m.thumbnail?.trim()) return m.thumbnail.trim();
  if (mediaIsVideo(m)) return "";
  return (m.thumbnail?.trim() || m.file.trim()) ?? "";
}
