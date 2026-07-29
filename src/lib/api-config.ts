/**
 * On Vercel (HTTPS), the browser cannot call plain `http://` backends
 * (mixed content). Use same-origin Next.js proxies by default.
 *
 * Override with NEXT_PUBLIC_*_URL for local direct access if needed.
 */
const DIRECT = {
  auth: "http://36.253.137.34:8010",
  profile: "http://36.253.137.34:8011",
  feed: "http://36.253.137.34:8012",
  chat: "http://36.253.137.34:8014",
  search: "http://36.253.137.34:8015",
} as const;

function resolveUrl(
  envValue: string | undefined,
  proxyPath: string,
  directFallback: string,
) {
  if (envValue?.trim()) return envValue.trim().replace(/\/$/, "");

  // Prefer proxy in the browser so HTTPS deploys work.
  if (typeof window !== "undefined") return proxyPath;

  // Server-side (SSR / route handlers) can hit HTTP directly.
  return directFallback;
}

export const ApiConfig = {
  authBaseUrl: resolveUrl(
    process.env.NEXT_PUBLIC_AUTH_URL,
    "/api/backend/auth",
    DIRECT.auth,
  ),
  profileBaseUrl: resolveUrl(
    process.env.NEXT_PUBLIC_PROFILE_URL,
    "/api/backend/profile",
    DIRECT.profile,
  ),
  feedBaseUrl: resolveUrl(
    process.env.NEXT_PUBLIC_FEED_URL,
    "/api/backend/feed",
    DIRECT.feed,
  ),
  chatBaseUrl: resolveUrl(
    process.env.NEXT_PUBLIC_CHAT_URL,
    "/api/backend/chat",
    DIRECT.chat,
  ),
  searchBaseUrl: resolveUrl(
    process.env.NEXT_PUBLIC_SEARCH_URL,
    "/api/backend/search",
    DIRECT.search,
  ),
  feedPageSize: 15,
  googleClientId:
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ??
    "565447947765-2n94vokrmnc8p6c8k4c8as3krqc8qmgk.apps.googleusercontent.com",
} as const;
