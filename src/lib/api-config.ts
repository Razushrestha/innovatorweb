export const ApiConfig = {
  authBaseUrl: process.env.NEXT_PUBLIC_AUTH_URL ?? "http://36.253.137.34:8010",
  profileBaseUrl:
    process.env.NEXT_PUBLIC_PROFILE_URL ?? "http://36.253.137.34:8011",
  feedBaseUrl: process.env.NEXT_PUBLIC_FEED_URL ?? "http://36.253.137.34:8012",
  chatBaseUrl: process.env.NEXT_PUBLIC_CHAT_URL ?? "http://36.253.137.34:8014",
  searchBaseUrl:
    process.env.NEXT_PUBLIC_SEARCH_URL ?? "http://36.253.137.34:8015",
  feedPageSize: 15,
  googleClientId:
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ??
    "565447947765-2n94vokrmnc8p6c8k4c8as3krqc8qmgk.apps.googleusercontent.com",
} as const;
