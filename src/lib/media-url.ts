/**
 * Rewrite backend media URLs so the browser loads them same-origin.
 *
 * On Vercel (HTTPS), raw `http://36.253.137.34:...` image/video URLs are
 * blocked as mixed content. Map them to `/api/backend/{service}/...` which
 * the existing Next.js proxy fetches server-side.
 */

const BACKEND_ORIGINS: { origin: string; service: string }[] = [
  {
    origin: (process.env.NEXT_PUBLIC_AUTH_URL || "http://36.253.137.34:8010").replace(
      /\/$/,
      "",
    ),
    service: "auth",
  },
  {
    origin: (
      process.env.NEXT_PUBLIC_PROFILE_URL || "http://36.253.137.34:8011"
    ).replace(/\/$/, ""),
    service: "profile",
  },
  {
    origin: (process.env.NEXT_PUBLIC_FEED_URL || "http://36.253.137.34:8012").replace(
      /\/$/,
      "",
    ),
    service: "feed",
  },
  {
    origin: (process.env.NEXT_PUBLIC_CHAT_URL || "http://36.253.137.34:8014").replace(
      /\/$/,
      "",
    ),
    service: "chat",
  },
  {
    origin: (
      process.env.NEXT_PUBLIC_SEARCH_URL || "http://36.253.137.34:8015"
    ).replace(/\/$/, ""),
    service: "search",
  },
];

const PORT_SERVICE: Record<string, string> = {
  "8010": "auth",
  "8011": "profile",
  "8012": "feed",
  "8014": "chat",
  "8015": "search",
};

function serviceForUrl(u: URL): string | null {
  const rawOrigin = `${u.protocol}//${u.host}`.replace(/\/$/, "");
  for (const entry of BACKEND_ORIGINS) {
    try {
      const base = new URL(entry.origin);
      if (
        base.host === u.host ||
        rawOrigin === entry.origin ||
        u.href.startsWith(`${entry.origin}/`)
      ) {
        return entry.service;
      }
    } catch {
      // ignore invalid env overrides
    }
  }
  if (u.hostname === "36.253.137.34" && PORT_SERVICE[u.port]) {
    return PORT_SERVICE[u.port];
  }
  return null;
}

/**
 * Convert an absolute backend media URL (or leave non-backend URLs alone).
 * Relative `/media/...` paths default to `fallbackService` (usually feed/profile).
 */
export function toProxiedMediaUrl(
  url: string | null | undefined,
  fallbackService: "feed" | "profile" | "chat" | "auth" | "search" = "feed",
): string {
  if (!url?.trim()) return "";
  const raw = url.trim();

  if (
    raw.startsWith("blob:") ||
    raw.startsWith("data:") ||
    raw.startsWith("/api/backend/")
  ) {
    return raw;
  }

  // Protocol-relative
  if (raw.startsWith("//")) {
    return toProxiedMediaUrl(`https:${raw}`, fallbackService);
  }

  // Site-relative media path from API (no host) → proxy via known service
  if (raw.startsWith("/")) {
    return `/api/backend/${fallbackService}${raw}`;
  }

  try {
    const u = new URL(raw);
    const service = serviceForUrl(u);
    if (!service) {
      // External https CDN / sample assets — keep as-is
      return raw;
    }
    return `/api/backend/${service}${u.pathname}${u.search}`;
  } catch {
    return raw;
  }
}

export function toProxiedMediaUrlOrNull(
  url: string | null | undefined,
  fallbackService: "feed" | "profile" | "chat" | "auth" | "search" = "feed",
): string | null {
  const proxied = toProxiedMediaUrl(url, fallbackService);
  return proxied || null;
}
