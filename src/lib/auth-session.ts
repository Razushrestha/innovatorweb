const KEYS = {
  access: "auth_access_token",
  refresh: "auth_refresh_token",
  userId: "auth_user_id",
  username: "auth_username",
  email: "auth_email",
} as const;

export type SessionSnapshot = {
  accessToken: string | null;
  refreshToken: string | null;
  userId: string | null;
  username: string | null;
  email: string | null;
};

function canUseStorage() {
  return typeof window !== "undefined" && !!window.localStorage;
}

export const AuthSession = {
  load(): SessionSnapshot {
    if (!canUseStorage()) {
      return {
        accessToken: null,
        refreshToken: null,
        userId: null,
        username: null,
        email: null,
      };
    }
    return {
      accessToken: localStorage.getItem(KEYS.access),
      refreshToken: localStorage.getItem(KEYS.refresh),
      userId: localStorage.getItem(KEYS.userId),
      username: localStorage.getItem(KEYS.username),
      email: localStorage.getItem(KEYS.email),
    };
  },

  isSignedIn(): boolean {
    const s = this.load();
    return Boolean(s.accessToken && s.userId);
  },

  save(input: {
    accessToken: string;
    refreshToken: string;
    userId: string;
    username: string;
    email: string;
  }) {
    if (!canUseStorage()) return;
    localStorage.setItem(KEYS.access, input.accessToken);
    localStorage.setItem(KEYS.refresh, input.refreshToken);
    localStorage.setItem(KEYS.userId, input.userId);
    localStorage.setItem(KEYS.username, input.username);
    localStorage.setItem(KEYS.email, input.email);
  },

  /** Update tokens after refresh; keeps existing refresh if the server omits a new one. */
  updateTokens(input: { accessToken: string; refreshToken?: string | null }) {
    if (!canUseStorage()) return;
    localStorage.setItem(KEYS.access, input.accessToken);
    if (input.refreshToken) {
      localStorage.setItem(KEYS.refresh, input.refreshToken);
    }
  },

  clear() {
    if (!canUseStorage()) return;
    Object.values(KEYS).forEach((k) => localStorage.removeItem(k));
  },

  authorizationHeader(): string {
    const token = this.load().accessToken ?? "";
    return `Bearer ${token}`;
  },
};
