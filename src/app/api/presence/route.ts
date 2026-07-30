import { NextResponse } from "next/server";

const TTL_MS = 90_000;

type PresenceStore = Map<string, number>;

function store(): PresenceStore {
  const g = globalThis as typeof globalThis & {
    __innovatorPresence?: PresenceStore;
  };
  if (!g.__innovatorPresence) {
    g.__innovatorPresence = new Map();
  }
  return g.__innovatorPresence;
}

function prune(map: PresenceStore, now: number) {
  for (const [id, at] of map) {
    if (now - at > TTL_MS * 2) map.delete(id);
  }
}

/** Heartbeat — marks the signed-in user as online. */
export async function POST(req: Request) {
  let body: { userId?: string } = {};
  try {
    body = (await req.json()) as { userId?: string };
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const userId = String(body.userId ?? "").trim();
  if (!userId) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const now = Date.now();
  const map = store();
  prune(map, now);
  map.set(userId, now);
  return NextResponse.json({ ok: true });
}

/** Query online flags for one or more user ids (`?ids=a,b,c`). */
export async function GET(req: Request) {
  const ids = (new URL(req.url).searchParams.get("ids") ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  const now = Date.now();
  const map = store();
  prune(map, now);
  const online: Record<string, boolean> = {};
  for (const id of ids) {
    const at = map.get(id);
    online[id] = typeof at === "number" && now - at < TTL_MS;
  }
  return NextResponse.json({ online });
}
