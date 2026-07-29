import { ApiConfig } from "./api-config";
import { apiRequest } from "./api-client";
import { AuthSession } from "./auth-session";
import { ensureProfile } from "./profile-api";
import type { AuthResult } from "./types";

function persist(result: AuthResult, fallbackEmail?: string) {
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
  const data = await apiRequest<AuthResult>(
    ApiConfig.authBaseUrl,
    "/api/auth/sso/login",
    {
      method: "POST",
      auth: false,
      body: { email, password },
    },
  );
  return afterAuth(data, email);
}

export async function register(input: {
  username: string;
  email: string;
  password: string;
}) {
  const data = await apiRequest<AuthResult>(
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
  return afterAuth(data, input.email);
}

export async function loginWithGoogle(googleToken: string) {
  const data = await apiRequest<AuthResult>(
    ApiConfig.authBaseUrl,
    "/api/auth/sso/google",
    {
      method: "POST",
      auth: false,
      body: { google_token: googleToken },
    },
  );
  return afterAuth(data);
}

export async function logout() {
  try {
    await apiRequest(ApiConfig.authBaseUrl, "/api/auth/logout", {
      method: "POST",
    });
  } catch {
    // ignore network logout failures
  } finally {
    AuthSession.clear();
  }
}
