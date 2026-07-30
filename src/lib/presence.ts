/** Client helpers for chat online presence (green dot). */

export async function sendPresenceHeartbeat(userId: string) {
  if (!userId.trim()) return;
  try {
    await fetch("/api/presence", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
      cache: "no-store",
      keepalive: true,
    });
  } catch {
    /* ignore */
  }
}

export async function fetchOnlineMap(
  userIds: string[],
): Promise<Record<string, boolean>> {
  const ids = Array.from(new Set(userIds.map((id) => id.trim()).filter(Boolean)));
  if (ids.length === 0) return {};
  try {
    const res = await fetch(
      `/api/presence?ids=${encodeURIComponent(ids.join(","))}`,
      { cache: "no-store" },
    );
    if (!res.ok) return {};
    const json = (await res.json()) as { online?: Record<string, boolean> };
    return json.online ?? {};
  } catch {
    return {};
  }
}
