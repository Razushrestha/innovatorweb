const KEY = "innovator_chat_unread_v1";

export type ChatUnreadState = {
  /** Last message id the user has opened/read in this room. */
  lastReadMessageId: string | null;
  /** Last inbox tip we already counted toward the badge. */
  lastTipId: string | null;
  /** Local unread badge count for the inbox row. */
  unread: number;
};

type Store = Record<string, ChatUnreadState>;

function load(): Store {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Store;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function save(store: Store) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    /* ignore */
  }
}

export function markChatRoomRead(
  conversationId: string,
  lastMessageId?: string | null,
) {
  const store = load();
  store[conversationId] = {
    lastReadMessageId: lastMessageId ?? null,
    lastTipId: lastMessageId ?? store[conversationId]?.lastTipId ?? null,
    unread: 0,
  };
  save(store);
  return store;
}

/**
 * Merge server rooms with local unread tracking.
 * New peer messages on inactive rooms bump the badge (+1, +2, …).
 */
export function applyChatUnread(
  rooms: {
    id: string;
    unreadCount: number;
    lastMessage?: {
      id: string;
      senderId: string;
      createdAt?: string | null;
    } | null;
  }[],
  myUserId: string | null,
  activeId: string | null,
): Record<string, number> {
  const store = load();
  const unreadById: Record<string, number> = {};

  for (const room of rooms) {
    const last = room.lastMessage;
    const prev = store[room.id];
    const serverUnread = Math.max(0, Number(room.unreadCount) || 0);

    if (room.id === activeId) {
      store[room.id] = {
        lastReadMessageId: last?.id ?? null,
        lastTipId: last?.id ?? null,
        unread: 0,
      };
      unreadById[room.id] = 0;
      continue;
    }

    if (!prev) {
      const seed = serverUnread;
      store[room.id] = {
        lastReadMessageId: null,
        lastTipId: last?.id ?? null,
        unread: seed,
      };
      unreadById[room.id] = seed;
      continue;
    }

    let unread = Math.max(prev.unread, serverUnread);

    if (
      last?.id &&
      last.id !== prev.lastTipId &&
      myUserId &&
      last.senderId &&
      last.senderId !== myUserId
    ) {
      unread = Math.max(serverUnread, prev.unread + 1, 1);
      store[room.id] = {
        lastReadMessageId: prev.lastReadMessageId,
        lastTipId: last.id,
        unread,
      };
    } else {
      store[room.id] = {
        ...prev,
        lastTipId: last?.id ?? prev.lastTipId,
        unread,
      };
    }

    unreadById[room.id] = store[room.id].unread;
  }

  save(store);
  return unreadById;
}
