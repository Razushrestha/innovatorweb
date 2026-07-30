import { ApiConfig } from "./api-config";
import { AuthSession } from "./auth-session";
import type { ApiEnvelope } from "./types";

export class ApiException extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "ApiException";
    this.status = status;
  }
}

type RequestOpts = {
  method?: string;
  body?: unknown;
  auth?: boolean;
  query?: Record<string, string>;
  /** Skip 401 → refresh → retry (used by the refresh call itself). */
  skipRefresh?: boolean;
};

function buildUrl(
  baseUrl: string,
  path: string,
  query?: Record<string, string>,
) {
  const endpoint = `${baseUrl.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
  // Relative proxy paths (e.g. /api/backend/auth) need an origin.
  const finalUrl =
    endpoint.startsWith("http://") || endpoint.startsWith("https://")
      ? new URL(endpoint)
      : new URL(
          endpoint,
          typeof window !== "undefined"
            ? window.location.origin
            : "http://localhost",
        );
  if (query) {
    Object.entries(query).forEach(([k, v]) => finalUrl.searchParams.set(k, v));
  }
  return finalUrl;
}

/** Single-flight refresh so parallel 401s share one refresh request. */
let refreshInFlight: Promise<boolean> | null = null;

/**
 * Exchange the stored refresh token for a new access token.
 * Returns true if tokens were updated successfully.
 */
export async function refreshAccessToken(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    const { refreshToken } = AuthSession.load();
    if (!refreshToken) return false;

    const url = buildUrl(ApiConfig.authBaseUrl, "/api/auth/token/refresh");
    let res: Response;
    try {
      res = await fetch(url.toString(), {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ refreshToken }),
        cache: "no-store",
      });
    } catch {
      return false;
    }

    if (!res.ok) return false;

    const text = await res.text();
    if (!text) return false;

    let json: ApiEnvelope<Record<string, unknown>>;
    try {
      json = JSON.parse(text) as ApiEnvelope<Record<string, unknown>>;
    } catch {
      return false;
    }

    if (json.success === false) return false;

    const data = (json.data ?? json) as Record<string, unknown>;
    const accessToken = String(
      data.accessToken ?? data.access_token ?? "",
    );
    if (!accessToken) return false;

    const nextRefresh = String(
      data.refreshToken ?? data.refresh_token ?? "",
    );
    AuthSession.updateTokens({
      accessToken,
      refreshToken: nextRefresh || undefined,
    });
    return true;
  })().finally(() => {
    refreshInFlight = null;
  });

  return refreshInFlight;
}

async function parseJsonEnvelope<T>(
  res: Response,
  text: string,
): Promise<T> {
  if (!text) {
    if (!res.ok) throw new ApiException(`Request failed (${res.status})`, res.status);
    return null as T;
  }

  let json: ApiEnvelope<T>;
  try {
    json = JSON.parse(text) as ApiEnvelope<T>;
  } catch {
    if (!res.ok) throw new ApiException(`Request failed (${res.status})`, res.status);
    throw new ApiException("Invalid response", res.status);
  }

  if (!res.ok || json.success === false) {
    throw new ApiException(
      json.message || `Request failed (${res.status})`,
      res.status,
    );
  }

  if (json.data === undefined) {
    return json as unknown as T;
  }
  return json.data as T;
}

async function withAuthRetry<T>(
  auth: boolean,
  skipRefresh: boolean,
  execute: () => Promise<{ res: Response; text: string }>,
  parse: (res: Response, text: string) => Promise<T>,
): Promise<T> {
  let { res, text } = await execute();

  if (res.status === 401 && auth && !skipRefresh) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      ({ res, text } = await execute());
    } else {
      AuthSession.clear();
      throw new ApiException("Session expired. Please sign in again.", 401);
    }
  }

  return parse(res, text);
}

export async function apiRequest<T>(
  baseUrl: string,
  path: string,
  opts: RequestOpts = {},
): Promise<T> {
  const {
    method = "GET",
    body,
    auth = true,
    query,
    skipRefresh = false,
  } = opts;
  const finalUrl = buildUrl(baseUrl, path, query);

  return withAuthRetry(
    auth,
    skipRefresh,
    async () => {
      const headers: Record<string, string> = {
        Accept: "application/json",
      };
      if (body !== undefined) headers["Content-Type"] = "application/json";
      if (auth) headers.Authorization = AuthSession.authorizationHeader();

      let res: Response;
      try {
        res = await fetch(finalUrl.toString(), {
          method,
          headers,
          body: body === undefined ? undefined : JSON.stringify(body),
          cache: "no-store",
        });
      } catch {
        throw new ApiException(
          "Network error — cannot reach the API. Check connection or try again.",
        );
      }

      if (res.status === 204) {
        return { res, text: "" };
      }

      const text = await res.text();
      return { res, text };
    },
    async (res, text) => {
      if (res.status === 204) return null as T;
      return parseJsonEnvelope<T>(res, text);
    },
  );
}

export async function apiMultipart<T>(
  baseUrl: string,
  path: string,
  form: FormData,
  opts: { auth?: boolean; method?: string; skipRefresh?: boolean } = {},
): Promise<T> {
  const { auth = true, method = "POST", skipRefresh = false } = opts;
  const finalUrl = buildUrl(baseUrl, path);

  return withAuthRetry(
    auth,
    skipRefresh,
    async () => {
      const headers: Record<string, string> = {
        Accept: "application/json",
      };
      if (auth) headers.Authorization = AuthSession.authorizationHeader();

      let res: Response;
      try {
        res = await fetch(finalUrl.toString(), {
          method,
          headers,
          body: form,
          cache: "no-store",
        });
      } catch {
        throw new ApiException(
          "Network error — cannot reach the API. Check connection or try again.",
        );
      }

      const text = await res.text();
      return { res, text };
    },
    async (res, text) => {
      if (!text) {
        if (!res.ok) {
          throw new ApiException(`Request failed (${res.status})`, res.status);
        }
        return null as T;
      }

      let json: ApiEnvelope<T>;
      try {
        json = JSON.parse(text) as ApiEnvelope<T>;
      } catch {
        throw new ApiException(
          res.ok ? "Invalid response" : `Request failed (${res.status})`,
          res.status,
        );
      }

      if (!res.ok || json.success === false) {
        throw new ApiException(
          json.message || `Request failed (${res.status})`,
          res.status,
        );
      }

      if (json.data !== undefined && json.data !== null) {
        return json.data;
      }

      // Some services return the entity at the root (no `data` envelope).
      if (json && typeof json === "object" && "id" in (json as object)) {
        return json as unknown as T;
      }

      throw new ApiException(json.message || "Empty response", res.status);
    },
  );
}
