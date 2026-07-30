import { ApiConfig } from "./api-config";
import { ApiException, apiRequest, refreshAccessToken } from "./api-client";
import { AuthSession } from "./auth-session";
import { ensureProfile } from "./profile-api";
import type { AuthResult, AuthUser } from "./types";

function asAuthResult(raw: unknown): AuthResult {
  const data = (raw ?? {}) as Record<string, unknown>;
  const userRaw = (data.user ?? {}) as Record<string, unknown>;
  const user: AuthUser = {
    id: String(userRaw.id ?? ""),
    username: (userRaw.username as string | null) ?? null,
    email: (userRaw.email as string | null) ?? null,
    role: (userRaw.role as string | null) ?? null,
    isEmailVerified:
      userRaw.is_email_verified === true ||
      userRaw.isEmailVerified === true,
  };
  return {
    accessToken: String(
      data.accessToken ?? data.access_token ?? "",
    ),
    refreshToken: String(
      data.refreshToken ?? data.refresh_token ?? "",
    ),
    expiresIn: Number(data.expiresIn ?? data.expires_in ?? 0),
    user,
  };
}

function persist(result: AuthResult, fallbackEmail?: string) {
  if (!result.accessToken || !result.user.id) {
    throw new ApiException("Login response missing token or user");
  }
  AuthSession.save({
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
    userId: result.user.id,
    username: result.user.username ?? "",
    email: result.user.email ?? fallbackEmail ?? "",
  });
}

async function afterAuth(result: AuthResult, fallbackEmail?: string) {
  persist(result, fallbackEmail);
  await ensureProfile({
    authUserId: result.user.id,
    username: result.user.username ?? undefined,
    email: result.user.email ?? fallbackEmail,
    role: result.user.role ?? "user",
  });
  return result;
}

export async function login(email: string, password: string) {
  const data = await apiRequest<unknown>(
    ApiConfig.authBaseUrl,
    "/api/auth/sso/login",
    {
      method: "POST",
      auth: false,
      body: { email, password },
    },
  );
  return afterAuth(asAuthResult(data), email);
}

export async function register(input: {
  username: string;
  email: string;
  password: string;
}) {
  const data = await apiRequest<unknown>(
    ApiConfig.authBaseUrl,
    "/api/auth/register",
    {
      method: "POST",
      auth: false,
      body: {
        username: input.username,
        email: input.email,
        password: input.password,
        phone: null,
        role: "user",
      },
    },
  );
  return afterAuth(asAuthResult(data), input.email);
}

/** Send Google ID token (JWT / credential), not an OAuth access token. */
export async function loginWithGoogle(googleIdToken: string) {
  const data = await apiRequest<unknown>(
    ApiConfig.authBaseUrl,
    "/api/auth/sso/google",
    {
      method: "POST",
      auth: false,
      body: { google_token: googleIdToken },
    },
  );
  return afterAuth(asAuthResult(data));
}

export async function refreshSession() {
  const ok = await refreshAccessToken();
  if (!ok) {
    throw new ApiException("Unable to refresh session");
  }
}

export async function logout() {
  try {
    const postLogout = () => {
      const { refreshToken } = AuthSession.load();
      return apiRequest(ApiConfig.authBaseUrl, "/api/auth/logout", {
        method: "POST",
        // Logout needs Bearer; skipRefresh so we control token rotation ourselves.
        auth: true,
        skipRefresh: true,
        body: { refreshToken },
      });
    };

    try {
      await postLogout();
    } catch (e) {
      // Stale access token (or rotated refresh) — refresh once, then retry with
      // the latest tokens from storage.
      if (!(e instanceof ApiException) || e.status !== 401) throw e;
      const refreshed = await refreshAccessToken();
      if (refreshed) await postLogout();
    }
  } catch {
    // Always clear local session even if the server rejects logout.
  } finally {
    AuthSession.clear();
  }
}
