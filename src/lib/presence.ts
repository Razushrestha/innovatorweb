/** Client helpers for chat online presence (green dot). */

export async function sendPresenceHeartbeat(
  userId: string,
  username?: string | null,
) {
  if (!userId.trim()) return;
  try {
    await fetch("/api/presence", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        username: username?.trim() || undefined,
      }),
      cache: "no-store",
      keepalive: true,
    });
  } catch {
    /* ignore */
  }
}

export async function fetchOnlineMap(input: {
  userIds: string[];
  usernames?: string[];
}): Promise<Record<string, boolean>> {
  const ids = Array.from(
    new Set(input.userIds.map((id) => id.trim()).filter(Boolean)),
  );
  const usernames = Array.from(
    new Set(
      (input.usernames ?? [])
        .map((u) => u.trim().toLowerCase())
        .filter(Boolean),
    ),
  );
  if (ids.length === 0 && usernames.length === 0) return {};

  const params = new URLSearchParams();
  if (ids.length) params.set("ids", ids.join(","));
  if (usernames.length) params.set("usernames", usernames.join(","));

  try {
    const res = await fetch(`/api/presence?${params.toString()}`, {
      cache: "no-store",
    });
    if (!res.ok) return {};
    const json = (await res.json()) as { online?: Record<string, boolean> };
    return json.online ?? {};
  } catch {
    return {};
  }
}

/** True if the peer is in the presence map (by id or username). */
export function isPeerOnline(
  onlineMap: Record<string, boolean>,
  peer?: { userId?: string | null; username?: string | null } | null,
): boolean {
  if (!peer) return false;
  if (peer.userId && onlineMap[peer.userId]) return true;
  const uname = peer.username?.trim().toLowerCase();
  if (uname && onlineMap[`user:${uname}`]) return true;
  return false;
}

/** Recently messaged peers count as online (fallback when presence misses). */
export function isRecentlyActive(
  lastMessage?: {
    senderId?: string | null;
    createdAt?: string | null;
  } | null,
  peerUserId?: string | null,
  withinMs = 5 * 60 * 1000,
): boolean {
  if (!lastMessage?.createdAt || !peerUserId) return false;
  if (lastMessage.senderId !== peerUserId) return false;
  const t = Date.parse(lastMessage.createdAt);
  if (Number.isNaN(t)) return false;
  return Date.now() - t <= withinMs;
}
