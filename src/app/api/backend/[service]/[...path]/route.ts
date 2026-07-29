import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SERVICES: Record<string, string> = {
  auth: process.env.AUTH_URL ?? "http://36.253.137.34:8010",
  profile: process.env.PROFILE_URL ?? "http://36.253.137.34:8011",
  feed: process.env.FEED_URL ?? "http://36.253.137.34:8012",
  chat: process.env.CHAT_URL ?? "http://36.253.137.34:8014",
  search: process.env.SEARCH_URL ?? "http://36.253.137.34:8015",
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
  "content-length",
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
  const target = new URL(`${base.replace(/\/$/, "")}/${path}`);
  req.nextUrl.searchParams.forEach((value, key) => {
    target.searchParams.set(key, value);
  });

  const headers = new Headers();
  req.headers.forEach((value, key) => {
    if (!HOP_BY_HOP.has(key.toLowerCase())) {
      headers.set(key, value);
    }
  });
  headers.set("Accept", "application/json");

  const method = req.method.toUpperCase();
  const hasBody = method !== "GET" && method !== "HEAD";
  const body = hasBody ? await req.arrayBuffer() : undefined;

  let upstream: Response;
  try {
    upstream = await fetch(target.toString(), {
      method,
      headers,
      body,
      cache: "no-store",
      redirect: "manual",
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Upstream request failed";
    return NextResponse.json(
      { success: false, message: `Backend unreachable: ${message}` },
      { status: 502 },
    );
  }

  const responseHeaders = new Headers();
  upstream.headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (!HOP_BY_HOP.has(lower) && lower !== "content-encoding") {
      responseHeaders.set(key, value);
    }
  });

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
