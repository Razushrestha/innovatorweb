import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SERVICES: Record<string, string> = {
  auth: process.env.AUTH_URL ?? "http://36.253.137.34:8010",
  profile: process.env.PROFILE_URL ?? "http://36.253.137.34:8011",
  feed: process.env.FEED_URL ?? "http://36.253.137.34:8012",
  chat: process.env.CHAT_URL ?? "http://36.253.137.34:8014",
  search: process.env.SEARCH_URL ?? "http://36.253.137.34:8015",
  shop: process.env.SHOP_URL ?? "http://36.253.137.34:8016",
  shopmedia: process.env.SHOP_MEDIA_URL ?? "http://36.253.137.34:8004",
};

const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailers",
  "transfer-encoding",
  "upgrade",
  "host",
]);

async function proxy(
  req: NextRequest,
  service: string,
  pathParts: string[],
) {
  const base = SERVICES[service];
  if (!base) {
    return NextResponse.json(
      { success: false, message: `Unknown service: ${service}` },
      { status: 404 },
    );
  }

  const path = pathParts.map(encodeURIComponent).join("/");
  const search = req.nextUrl.search; // includes leading "?" when present
  const primary = `${base.replace(/\/$/, "")}/${path}${search}`;

  // Shop product files are published on :8004 and also mirrored on :8016.
  // If shopmedia 404s, retry the same path on the shop service.
  const fallbackBase =
    service === "shopmedia" ? SERVICES.shop : undefined;
  const fallback = fallbackBase
    ? `${fallbackBase.replace(/\/$/, "")}/${path}${search}`
    : undefined;

  const headers = new Headers();
  req.headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    // Drop content-length on the outbound request; fetch sets it from body.
    if (!HOP_BY_HOP.has(lower) && lower !== "content-length") {
      headers.set(key, value);
    }
  });
  // Do not force application/json — media (<img>/<video>) sends image/*, */*, etc.
  if (!headers.has("Accept")) {
    headers.set("Accept", "*/*");
  }

  const method = req.method.toUpperCase();
  const hasBody = method !== "GET" && method !== "HEAD";
  const body = hasBody ? await req.arrayBuffer() : undefined;

  async function upstreamFetch(url: string) {
    return fetch(url, {
      method,
      headers,
      body,
      cache: "no-store",
      redirect: "manual",
    });
  }

  let upstream: Response;
  try {
    upstream = await upstreamFetch(primary);
    if (
      fallback &&
      (method === "GET" || method === "HEAD") &&
      upstream.status === 404
    ) {
      const retry = await upstreamFetch(fallback);
      if (retry.ok || retry.status === 206) {
        upstream = retry;
      }
    }
  } catch (err) {
    if (fallback && (method === "GET" || method === "HEAD")) {
      try {
        upstream = await upstreamFetch(fallback);
      } catch (fallbackErr) {
        const message =
          fallbackErr instanceof Error
            ? fallbackErr.message
            : "Upstream request failed";
        return NextResponse.json(
          { success: false, message: `Backend unreachable: ${message}` },
          { status: 502 },
        );
      }
    } else {
      const message =
        err instanceof Error ? err.message : "Upstream request failed";
      return NextResponse.json(
        { success: false, message: `Backend unreachable: ${message}` },
        { status: 502 },
      );
    }
  }

  const responseHeaders = new Headers();
  upstream.headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    // Keep Content-Length for media/players; drop hop-by-hop + encoding.
    if (!HOP_BY_HOP.has(lower) && lower !== "content-encoding") {
      responseHeaders.set(key, value);
    }
  });

  // Help browsers play proxied video (Range).
  if (!responseHeaders.has("Accept-Ranges") && method === "GET") {
    responseHeaders.set("Accept-Ranges", "bytes");
  }

  const contentType = (responseHeaders.get("Content-Type") ?? "").toLowerCase();
  const pathJoined = pathParts.join("/").toLowerCase();
  const isMediaPath =
    pathJoined.includes("/media/") ||
    pathJoined.includes("avatars/") ||
    pathJoined.startsWith("products/") ||
    pathJoined.includes("/products/") ||
    /\.(jpe?g|png|gif|webp|avif|mp4|webm|mov|m4v)(\?|$)/i.test(pathJoined);
  const isMediaType =
    contentType.startsWith("image/") ||
    contentType.startsWith("video/") ||
    contentType.startsWith("audio/") ||
    contentType === "application/octet-stream";

  // Long-cache hashed media so the browser does not keep revalidating (304 spam).
  if (isMediaPath || isMediaType) {
    responseHeaders.set(
      "Cache-Control",
      "public, max-age=604800, stale-while-revalidate=86400, immutable",
    );
  }

  return new NextResponse(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
}

type Ctx = { params: Promise<{ service: string; path: string[] }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  const { service, path } = await ctx.params;
  return proxy(req, service, path);
}

export async function HEAD(req: NextRequest, ctx: Ctx) {
  const { service, path } = await ctx.params;
  return proxy(req, service, path);
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const { service, path } = await ctx.params;
  return proxy(req, service, path);
}

export async function PUT(req: NextRequest, ctx: Ctx) {
  const { service, path } = await ctx.params;
  return proxy(req, service, path);
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { service, path } = await ctx.params;
  return proxy(req, service, path);
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const { service, path } = await ctx.params;
  return proxy(req, service, path);
}
