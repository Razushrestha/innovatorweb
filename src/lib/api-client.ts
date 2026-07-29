import { AuthSession } from "./auth-session";
import type { ApiEnvelope } from "./types";

export class ApiException extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApiException";
  }
}

type RequestOpts = {
  method?: string;
  body?: unknown;
  auth?: boolean;
  query?: Record<string, string>;
};

function buildUrl(
  baseUrl: string,
  path: string,
  query?: Record<string, string>,
) {
  const endpoint = `${baseUrl.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
  const finalUrl = new URL(endpoint);
  if (query) {
    Object.entries(query).forEach(([k, v]) => finalUrl.searchParams.set(k, v));
  }
  return finalUrl;
}

export async function apiRequest<T>(
  baseUrl: string,
  path: string,
  opts: RequestOpts = {},
): Promise<T> {
  const { method = "GET", body, auth = true, query } = opts;
  const finalUrl = buildUrl(baseUrl, path, query);

  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (auth) headers.Authorization = AuthSession.authorizationHeader();

  const res = await fetch(finalUrl.toString(), {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });

  if (res.status === 204) {
    return null as T;
  }

  const text = await res.text();
  if (!text) {
    if (!res.ok) throw new ApiException(`Request failed (${res.status})`);
    return null as T;
  }

  let json: ApiEnvelope<T>;
  try {
    json = JSON.parse(text) as ApiEnvelope<T>;
  } catch {
    if (!res.ok) throw new ApiException(`Request failed (${res.status})`);
    throw new ApiException("Invalid response");
  }

  if (!res.ok || json.success === false) {
    throw new ApiException(json.message || `Request failed (${res.status})`);
  }

  if (json.data === undefined) {
    return json as unknown as T;
  }
  return json.data as T;
}

export async function apiMultipart<T>(
  baseUrl: string,
  path: string,
  form: FormData,
  opts: { auth?: boolean; method?: string } = {},
): Promise<T> {
  const { auth = true, method = "POST" } = opts;
  const finalUrl = buildUrl(baseUrl, path);
  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  if (auth) headers.Authorization = AuthSession.authorizationHeader();

  const res = await fetch(finalUrl.toString(), {
    method,
    headers,
    body: form,
    cache: "no-store",
  });

  const text = await res.text();
  if (!text) {
    if (!res.ok) throw new ApiException(`Request failed (${res.status})`);
    return null as T;
  }

  let json: ApiEnvelope<T>;
  try {
    json = JSON.parse(text) as ApiEnvelope<T>;
  } catch {
    throw new ApiException(
      res.ok ? "Invalid response" : `Request failed (${res.status})`,
    );
  }

  if (!res.ok || json.success === false) {
    throw new ApiException(json.message || `Request failed (${res.status})`);
  }

  if (json.data === undefined || json.data === null) {
    throw new ApiException(json.message || "Empty response");
  }
  return json.data;
}
