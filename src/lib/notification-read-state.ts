/**
 * Local override so "Mark all read" / mark-read stay applied even when a
 * backend (especially shop) ignores mark-all or omits is_read in list responses.
 */

const KEY = "innovator_notification_read_ids_v1";

function load(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as unknown;
    return new Set(Array.isArray(arr) ? arr.map(String) : []);
  } catch {
    return new Set();
  }
}

function save(ids: Set<string>) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(Array.from(ids).slice(-500)));
  } catch {
    /* ignore */
  }
}

export function rememberNotificationsRead(ids: string[]) {
  const set = load();
  for (const id of ids) {
    if (id?.trim()) set.add(id.trim());
  }
  save(set);
}

export function rememberAllNotificationsRead(
  items: { id: string; isRead: boolean }[],
) {
  rememberNotificationsRead(items.filter((n) => !n.isRead).map((n) => n.id));
}

export function applyNotificationReadOverrides<
  T extends { id: string; isRead: boolean },
>(items: T[]): T[] {
  const set = load();
  if (set.size === 0) return items;
  return items.map((n) => (set.has(n.id) ? { ...n, isRead: true } : n));
}
