import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { NextResponse } from "next/server";

const TTL_MS = 120_000;
const FILE = path.join(os.tmpdir(), "innovator-presence.json");

type PresenceMap = Record<string, number>;

async function readMap(): Promise<PresenceMap> {
  try {
    const raw = await fs.readFile(FILE, "utf8");
    const parsed = JSON.parse(raw) as PresenceMap;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

async function writeMap(map: PresenceMap) {
  try {
    await fs.writeFile(FILE, JSON.stringify(map), "utf8");
  } catch {
    /* ignore */
  }
}

function prune(map: PresenceMap, now: number) {
  for (const [id, at] of Object.entries(map)) {
    if (typeof at !== "number" || now - at > TTL_MS * 2) {
      delete map[id];
    }
  }
}

/** Heartbeat — marks the signed-in user as online. */
export async function POST(req: Request) {
  let body: { userId?: string; username?: string } = {};
  try {
    body = (await req.json()) as { userId?: string; username?: string };
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const userId = String(body.userId ?? "").trim();
  const username = String(body.username ?? "")
    .trim()
    .toLowerCase();
  if (!userId) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const now = Date.now();
  const map = await readMap();
  prune(map, now);
  map[userId] = now;
  // Also index by username so chat peers matched by handle still resolve.
  if (username) map[`user:${username}`] = now;
  await writeMap(map);
  return NextResponse.json({ ok: true });
}

/** Query online flags (`?ids=a,b` and optional `&usernames=x,y`). */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const ids = (url.searchParams.get("ids") ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  const usernames = (url.searchParams.get("usernames") ?? "")
    .split(",")
    .map((u) => u.trim().toLowerCase())
    .filter(Boolean);

  const now = Date.now();
  const map = await readMap();
  prune(map, now);

  const online: Record<string, boolean> = {};
  for (const id of ids) {
    const at = map[id];
    online[id] = typeof at === "number" && now - at < TTL_MS;
  }
  for (const name of usernames) {
    const at = map[`user:${name}`];
    online[`user:${name}`] = typeof at === "number" && now - at < TTL_MS;
  }

  await writeMap(map);
  return NextResponse.json({ online });
}
