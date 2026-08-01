"use client";

import Image from "next/image";
import {
  FormEvent,
  KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ApiException } from "@/lib/api-client";
import { AuthSession } from "@/lib/auth-session";
import {
  chatMediaKindFromFile,
  chatMediaKindFromMessage,
  createConversation,
  deleteConversation,
  listConversations,
  listMessages,
  markRead,
  peerOf,
  sendMediaMessage,
  sendMessage,
} from "@/lib/chat-api";
import { resolveChatPeer } from "@/lib/chat-peer";
import { listMutualCollaborators } from "@/lib/mutual-collaborators";
import { applyChatUnread, markChatRoomRead } from "@/lib/chat-unread";
import {
  fetchOnlineMap,
  isPeerOnline,
  isRecentlyActive,
  sendPresenceHeartbeat,
} from "@/lib/presence";
import type {
  ChatConversation,
  ChatMessage,
  ChatParticipant,
  ChatPeerRequest,
  ProfileListUser,
} from "@/lib/types";
import { BrandMark } from "./BrandMark";
import { LiquidLoader } from "./ui/LiquidChrome";

type LocalMessage = ChatMessage & {
  pending?: boolean;
  localPreviewUrl?: string | null;
};

const ATTACH_ACCEPT =
  "image/*,video/*,audio/*,.pdf,application/pdf";

function previewLabel(m: LocalMessage) {
  const kind = chatMediaKindFromMessage(
    m.messageType,
    m.mediaUrl || m.localPreviewUrl,
    m.content,
  );
  if (kind === "image") return "Photo";
  if (kind === "video") return "Video";
  if (kind === "audio") return "Audio";
  if (kind === "pdf") return m.content?.trim() || "PDF";
  if (kind === "file") return m.content?.trim() || "Attachment";
  return m.content || "No messages yet";
}

function timeLabel(iso?: string | null) {
  if (!iso) return "";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  return new Date(t).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function dayLabel(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startMsg = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = (startToday.getTime() - startMsg.getTime()) / 86400000;
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return d.toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function sameDay(a?: string | null, b?: string | null) {
  if (!a || !b) return false;
  const da = new Date(a);
  const db = new Date(b);
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
}

function peerName(p?: ChatParticipant | null) {
  return p?.username?.trim() || "Innovator";
}

function sameUserId(a?: string | null, b?: string | null) {
  return Boolean(a && b && a === b);
}

function sameUsername(a?: string | null, b?: string | null) {
  const left = (a ?? "").trim().toLowerCase();
  const right = (b ?? "").trim().toLowerCase();
  return Boolean(left && right && left === right);
}

function findRoomForPeer(
  list: ChatConversation[],
  myUserId: string | null,
  userId?: string | null,
  username?: string | null,
) {
  return (
    list.find((room) => {
      const p = peerOf(room, myUserId);
      if (sameUserId(p?.userId, userId)) return true;
      if (sameUsername(p?.username, username)) return true;
      return false;
    }) ?? null
  );
}

function PeerAvatar({
  peer,
  size = 44,
  online = false,
}: {
  peer?: ChatParticipant | null;
  size?: number;
  online?: boolean;
}) {
  const name = peerName(peer);
  const letter = name.slice(0, 1).toUpperCase();
  const dot = Math.max(10, Math.round(size * 0.24));
  return (
    <span
      className="relative inline-flex shrink-0"
      style={{ width: size, height: size }}
    >
      <span
        className="chat-avatar chat-avatar-ring"
        style={{ width: size, height: size, fontSize: size * 0.38 }}
      >
        {peer?.avatar ? (
          <Image
            src={peer.avatar}
            alt=""
            fill
            unoptimized
            className="object-cover"
          />
        ) : (
          letter
        )}
      </span>
      <span
        className={`chat-status-dot ${online ? "online" : "offline"}`}
        style={{ width: dot, height: dot }}
        title={online ? "Online" : "Offline"}
        aria-label={online ? "Online" : "Offline"}
      />
    </span>
  );
}

type Props = {
  pendingPeer?: ChatPeerRequest | null;
  onPendingPeerConsumed?: () => void;
};

export function ChatSection({
  pendingPeer = null,
  onPendingPeerConsumed,
}: Props) {
  const me = AuthSession.load().userId;
  const [rooms, setRooms] = useState<ChatConversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  /** Keeps the open thread visible even if a poll briefly omits the room. */
  const [pinnedRoom, setPinnedRoom] = useState<ChatConversation | null>(null);
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [attachFile, setAttachFile] = useState<File | null>(null);
  const [attachPreview, setAttachPreview] = useState<string | null>(null);
  const [mutualPeers, setMutualPeers] = useState<ProfileListUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [startingPeerId, setStartingPeerId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [onlineMap, setOnlineMap] = useState<Record<string, boolean>>({});
  const [localUnread, setLocalUnread] = useState<Record<string, number>>({});
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const startingRef = useRef(false);
  const activeIdRef = useRef<string | null>(null);
  const mutualPeersRef = useRef<ProfileListUser[]>([]);
  const roomsSigRef = useRef("");
  const mutualSigRef = useRef("");
  const pendingKey = pendingPeer?.userId ?? "";
  const myUsername = AuthSession.load().username;

  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

  useEffect(() => {
    mutualPeersRef.current = mutualPeers;
  }, [mutualPeers]);

  const active = useMemo(() => {
    if (!activeId) return null;
    return (
      rooms.find((r) => r.id === activeId) ??
      (pinnedRoom?.id === activeId ? pinnedRoom : null)
    );
  }, [rooms, activeId, pinnedRoom]);
  const peer = active ? peerOf(active, me) : null;

  const peerIds = useMemo(() => {
    const ids = rooms
      .map((room) => peerOf(room, me)?.userId)
      .filter((id): id is string => Boolean(id));
    if (peer?.userId) ids.push(peer.userId);
    return Array.from(new Set(ids));
  }, [rooms, me, peer?.userId]);

  const peerUsernames = useMemo(() => {
    const names = rooms
      .map((room) => peerOf(room, me)?.username)
      .filter((n): n is string => Boolean(n?.trim()));
    if (peer?.username) names.push(peer.username);
    return Array.from(new Set(names));
  }, [rooms, me, peer?.username]);

  function peerIsOnline(
    p?: ChatParticipant | null,
    room?: ChatConversation | null,
  ) {
    if (isPeerOnline(onlineMap, p)) return true;
    return isRecentlyActive(room?.lastMessage, p?.userId);
  }

  // Keep this user online while Chat is open; poll peers for green dots.
  useEffect(() => {
    if (!me) return;
    void sendPresenceHeartbeat(me, myUsername);
    const beat = window.setInterval(() => {
      void sendPresenceHeartbeat(me, myUsername);
    }, 15000);
    return () => window.clearInterval(beat);
  }, [me, myUsername]);

  useEffect(() => {
    if (peerIds.length === 0 && peerUsernames.length === 0) {
      setOnlineMap({});
      return;
    }
    let cancelled = false;
    const refresh = () => {
      void fetchOnlineMap({
        userIds: peerIds,
        usernames: peerUsernames,
      }).then((map) => {
        if (cancelled) return;
        setOnlineMap((prev) => {
          const keys = Object.keys(map);
          if (
            keys.length === Object.keys(prev).length &&
            keys.every((k) => prev[k] === map[k])
          ) {
            return prev;
          }
          return map;
        });
      });
    };
    refresh();
    const timer = window.setInterval(refresh, 20000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [peerIds, peerUsernames]);

  const enrichRooms = useCallback(
    (list: ChatConversation[], mutual: ProfileListUser[]) => {
      const byId = new Map(mutual.map((u) => [u.id, u]));
      const byName = new Map(
        mutual
          .filter((u) => u.username?.trim())
          .map((u) => [u.username!.trim().toLowerCase(), u] as const),
      );

      const enriched = list.map((room) => {
        const p = peerOf(room, me);
        if (!p) return room;
        const m =
          (p.userId ? byId.get(p.userId) : undefined) ||
          (p.username
            ? byName.get(p.username.trim().toLowerCase())
            : undefined);
        if (!m) return room;
        if (p.username && p.avatar) return room;
        return {
          ...room,
          participants: room.participants.map((part) =>
            part.userId === p.userId
              ? {
                  ...part,
                  username: part.username || m.username || m.fullName || null,
                  avatar: part.avatar || m.avatar || null,
                }
              : part,
          ),
        };
      });

      enriched.sort((a, b) => {
        const aMsg = a.lastMessage?.createdAt
          ? Date.parse(a.lastMessage.createdAt)
          : 0;
        const bMsg = b.lastMessage?.createdAt
          ? Date.parse(b.lastMessage.createdAt)
          : 0;
        if (aMsg !== bMsg) return bMsg - aMsg;
        return peerName(peerOf(a, me)).localeCompare(peerName(peerOf(b, me)));
      });

      const unreadById = applyChatUnread(enriched, me, activeIdRef.current);
      return enriched.map((room) => ({
        ...room,
        unreadCount: unreadById[room.id] ?? room.unreadCount,
      }));
    },
    [me],
  );

  const roomsSignature = useCallback((list: ChatConversation[]) => {
    return list
      .map((r) => {
        const p = peerOf(r, me);
        return [
          r.id,
          r.unreadCount,
          r.lastMessage?.id ?? "",
          r.lastMessage?.content ?? "",
          p?.userId ?? "",
          p?.username ?? "",
        ].join(":");
      })
      .join("|");
  }, [me]);

  /** Initial + rare full load (conversations + mutuals). Never mass-creates rooms. */
  const loadInbox = useCallback(async () => {
    if (startingRef.current) return;
    try {
      const [list, mutual] = await Promise.all([
        listConversations(),
        listMutualCollaborators(),
      ]);
      if (startingRef.current) return;

      const mutualSig = mutual.map((u) => u.id).join(",");
      if (mutualSig !== mutualSigRef.current) {
        mutualSigRef.current = mutualSig;
        setMutualPeers(mutual);
      }

      const next = enrichRooms(list, mutual);
      const sig = roomsSignature(next);
      if (sig !== roomsSigRef.current) {
        roomsSigRef.current = sig;
        const unreadById = applyChatUnread(next, me, activeIdRef.current);
        setLocalUnread(unreadById);
        setRooms(next);
      }
      setError(null);
    } catch (e) {
      setError(e instanceof ApiException ? e.message : "Could not load chats");
    } finally {
      setLoading(false);
    }
  }, [enrichRooms, roomsSignature, me]);

  /** Light poll: conversations only, skip setState when nothing changed. */
  const pollInbox = useCallback(async () => {
    if (startingRef.current || document.hidden) return;
    try {
      const list = await listConversations();
      if (startingRef.current) return;
      const next = enrichRooms(list, mutualPeersRef.current);
      const sig = roomsSignature(next);
      if (sig === roomsSigRef.current) return;
      roomsSigRef.current = sig;
      const unreadById = applyChatUnread(next, me, activeIdRef.current);
      setLocalUnread(unreadById);
      setRooms(next);
    } catch {
      /* ignore quiet poll errors */
    }
  }, [enrichRooms, roomsSignature, me]);

  const refreshRooms = useCallback(async () => {
    await loadInbox();
  }, [loadInbox]);

  useEffect(() => {
    void loadInbox();
  }, [loadInbox]);

  // Gentle inbox poll — no mutual re-fetch, no auto-create, no flicker.
  useEffect(() => {
    const timer = window.setInterval(() => {
      void pollInbox();
    }, 20000);
    return () => window.clearInterval(timer);
  }, [pollInbox]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, activeId]);

  // Soft refresh while a thread is open (messages only).
  useEffect(() => {
    if (!activeId) return;
    const timer = window.setInterval(() => {
      if (document.hidden || startingRef.current) return;
      void (async () => {
        try {
          const msgs = await listMessages(activeId);
          const next = [...msgs].reverse();
          let changed = false;
          setMessages((prev) => {
            const pending = prev.filter((m) => m.pending);
            if (pending.length === 0 && next.length === prev.length) {
              const lastPrev = prev[prev.length - 1]?.id;
              const lastNext = next[next.length - 1]?.id;
              if (lastPrev === lastNext) return prev;
            }
            changed = true;
            return [...next, ...pending];
          });
          if (!changed) return;
          void markRead(activeId);
          const tip = next[next.length - 1]?.id;
          markChatRoomRead(activeId, tip);
          setLocalUnread((prev) =>
            prev[activeId] === 0 ? prev : { ...prev, [activeId]: 0 },
          );
          setRooms((prev) => {
            const room = prev.find((r) => r.id === activeId);
            if (!room || room.unreadCount === 0) return prev;
            const updated = prev.map((r) =>
              r.id === activeId ? { ...r, unreadCount: 0 } : r,
            );
            roomsSigRef.current = roomsSignature(updated);
            return updated;
          });
        } catch {
          /* ignore poll errors */
        }
      })();
    }, 12000);
    return () => window.clearInterval(timer);
  }, [activeId]);

  function resizeComposer() {
    const el = composerRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 132)}px`;
  }

  async function openRoom(id: string) {
    const existing = rooms.find((r) => r.id === id) ?? null;
    if (existing) setPinnedRoom(existing);
    setActiveId(id);
    setBusy(true);
    setMessages([]);
    setLocalUnread((prev) => ({ ...prev, [id]: 0 }));
    setRooms((prev) =>
      prev.map((r) => (r.id === id ? { ...r, unreadCount: 0 } : r)),
    );
    try {
      const msgs = await listMessages(id);
      const ordered = [...msgs].reverse();
      setMessages(ordered);
      void markRead(id);
      markChatRoomRead(id, ordered[ordered.length - 1]?.id ?? null);
      window.setTimeout(() => {
        composerRef.current?.focus();
        resizeComposer();
      }, 80);
    } catch (e) {
      setError(e instanceof ApiException ? e.message : "Could not open chat");
    } finally {
      setBusy(false);
    }
  }

  async function startChatWith(
    userId: string,
    username?: string | null,
    avatar?: string | null,
  ) {
    if ((!userId && !username) || startingRef.current) return;
    startingRef.current = true;
    setStartingPeerId(userId || username || "peer");
    setError(null);
    setBusy(true);
    try {
      const resolved = await resolveChatPeer(userId, username, avatar);
      let list = rooms.length ? rooms : await listConversations();
      let room = findRoomForPeer(
        list,
        me,
        resolved.userId,
        resolved.username,
      );

      // Drop stale rooms whose participant id no longer matches (post-migration).
      if (room) {
        const p = peerOf(room, me);
        if (
          p?.userId &&
          resolved.userId &&
          p.userId !== resolved.userId
        ) {
          room = null;
        }
      }

      if (!room) {
        try {
          list = await listConversations();
          room = findRoomForPeer(
            list,
            me,
            resolved.userId,
            resolved.username,
          );
          if (room) {
            const p = peerOf(room, me);
            if (
              p?.userId &&
              resolved.userId &&
              p.userId !== resolved.userId
            ) {
              room = null;
            }
          }
        } catch {
          /* keep local list */
        }
      }

      if (!room) {
        room = await createConversation({
          participantUserId: resolved.userId,
          participantUsername: resolved.username,
          participantAvatar: resolved.avatar || undefined,
        });
        if (!room.id) {
          throw new ApiException("Could not create conversation");
        }
        if (!peerOf(room, me)?.userId) {
          room = {
            ...room,
            participants: [
              ...room.participants,
              {
                userId: resolved.userId,
                username: resolved.username ?? null,
                avatar: resolved.avatar ?? null,
              },
            ],
          };
        }
        try {
          const refreshed = await listConversations();
          room =
            findRoomForPeer(
              refreshed,
              me,
              resolved.userId,
              resolved.username,
            ) ??
            refreshed.find((r) => r.id === room!.id) ??
            room;
          list = refreshed;
        } catch {
          /* keep created room */
        }
      }

      const merged = [
        room,
        ...list.filter((r) => r.id !== room!.id),
      ].map((r) =>
        r.id === room!.id ? { ...r, unreadCount: 0 } : r,
      );
      roomsSigRef.current = roomsSignature(merged);
      setPinnedRoom(room);
      setRooms(merged);
      setActiveId(room.id);
      setMessages([]);

      try {
        const msgs = await listMessages(room.id);
        setMessages([...msgs].reverse());
        void markRead(room.id);
        markChatRoomRead(room.id, msgs[0]?.id ?? null);
      } catch {
        /* thread can still open empty */
      }

      window.setTimeout(() => {
        composerRef.current?.focus();
        resizeComposer();
      }, 80);
    } catch (err) {
      setError(
        err instanceof ApiException ? err.message : "Could not start chat",
      );
    } finally {
      startingRef.current = false;
      setStartingPeerId(null);
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!pendingKey) return;
    void (async () => {
      await startChatWith(pendingKey, pendingPeer?.username);
      onPendingPeerConsumed?.();
    })();
    // Intentionally only when a new pending peer arrives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingKey]);

  function clearAttachment() {
    if (attachPreview?.startsWith("blob:")) {
      URL.revokeObjectURL(attachPreview);
    }
    setAttachFile(null);
    setAttachPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function onPickFile(file: File | null) {
    if (!file) return;
    const kind = chatMediaKindFromFile(file);
    const ok =
      kind === "image" ||
      kind === "video" ||
      kind === "audio" ||
      kind === "pdf";
    if (!ok) {
      setError("Only image, video, audio, or PDF files are supported.");
      return;
    }
    if (attachPreview?.startsWith("blob:")) {
      URL.revokeObjectURL(attachPreview);
    }
    setError(null);
    setAttachFile(file);
    setAttachPreview(
      kind === "image" || kind === "video" ? URL.createObjectURL(file) : null,
    );
  }

  function isAccessDenied(err: unknown) {
    if (!(err instanceof ApiException)) return false;
    const msg = (err.message || "").toLowerCase();
    return (
      err.status === 403 ||
      msg.includes("access denied") ||
      msg.includes("forbidden") ||
      msg.includes("not allowed") ||
      msg.includes("permission")
    );
  }

  /**
   * After follower migrations, old rooms can still show history but reject
   * sends. Recreate the DM with the peer's current auth id and retry once.
   */
  async function recreateActiveConversation() {
    const current = active;
    const p = current ? peerOf(current, me) : peer;
    const mutual =
      mutualPeers.find(
        (u) =>
          sameUserId(u.id, p?.userId) ||
          sameUsername(u.username, p?.username),
      ) ?? null;
    const resolved = await resolveChatPeer(
      mutual?.id || p?.userId,
      mutual?.username || p?.username,
      mutual?.avatar || p?.avatar,
    );
    // Drop the broken room locally and on the server when possible.
    if (current?.id) {
      setRooms((prev) => prev.filter((r) => r.id !== current.id));
      try {
        await deleteConversation(current.id);
      } catch {
        /* still try to create a fresh DM */
      }
    }
    const room = await createConversation({
      participantUserId: resolved.userId,
      participantUsername: resolved.username,
      participantAvatar: resolved.avatar || undefined,
    });
    if (!room.id) {
      throw new ApiException("Could not refresh this conversation.");
    }
    const enrichedRoom: ChatConversation = {
      ...room,
      participants:
        room.participants.length > 0
          ? room.participants.map((part) =>
              part.userId === me
                ? part
                : {
                    ...part,
                    userId: part.userId || resolved.userId,
                    username: part.username || resolved.username || null,
                    avatar: part.avatar || resolved.avatar || null,
                  },
            )
          : [
              {
                userId: resolved.userId,
                username: resolved.username ?? null,
                avatar: resolved.avatar ?? null,
              },
            ],
      unreadCount: 0,
    };
    setPinnedRoom(enrichedRoom);
    setRooms((prev) => {
      const next = [
        enrichedRoom,
        ...prev.filter(
          (r) =>
            r.id !== enrichedRoom.id &&
            r.id !== current?.id &&
            peerOf(r, me)?.userId !== resolved.userId,
        ),
      ];
      roomsSigRef.current = roomsSignature(next);
      return next;
    });
    setActiveId(enrichedRoom.id);
    return enrichedRoom.id;
  }

  async function onSend(e?: FormEvent) {
    e?.preventDefault();
    if (!activeId || sending) return;
    const text = draft.trim();
    const file = attachFile;
    if (!text && !file) return;

    const tempId = `tmp-${Date.now()}`;
    const kind = file ? chatMediaKindFromFile(file) : "text";
    const optimistic: LocalMessage = {
      id: tempId,
      conversationId: activeId,
      senderId: me || "",
      content:
        text ||
        (file
          ? kind === "image"
            ? "Photo"
            : kind === "video"
              ? "Video"
              : kind === "audio"
                ? "Audio"
                : file.name
          : ""),
      messageType: file ? kind : "text",
      mediaUrl: null,
      localPreviewUrl: attachPreview,
      createdAt: new Date().toISOString(),
      pending: true,
    };
    setDraft("");
    clearAttachment();
    setError(null);
    setMessages((prev) => [...prev, optimistic]);
    setSending(true);
    window.setTimeout(resizeComposer, 0);

    let conversationId = activeId;
    try {
      // If this room doesn't include the signed-in user, refresh it first.
      const roomNow =
        rooms.find((r) => r.id === conversationId) ||
        (pinnedRoom?.id === conversationId ? pinnedRoom : null);
      if (
        roomNow &&
        me &&
        roomNow.participants.length > 0 &&
        !roomNow.participants.some((p) => p.userId === me)
      ) {
        conversationId = await recreateActiveConversation();
      }

      const sendOnce = (id: string) =>
        file
          ? sendMediaMessage(id, file, text)
          : sendMessage(id, text);

      let msg: ChatMessage;
      try {
        msg = await sendOnce(conversationId);
      } catch (err) {
        if (!isAccessDenied(err)) throw err;
        conversationId = await recreateActiveConversation();
        msg = await sendOnce(conversationId);
      }

      setMessages((prev) =>
        prev.map((m) =>
          m.id === tempId
            ? {
                ...msg,
                pending: false,
                localPreviewUrl: m.localPreviewUrl,
              }
            : m,
        ),
      );
      void refreshRooms();
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setDraft(text);
      if (file) {
        setAttachFile(file);
        setAttachPreview(optimistic.localPreviewUrl ?? null);
      }
      if (isAccessDenied(err)) {
        setError(
          "Can't send in this chat right now. Make sure you still collaborate with each other, then open Message again from their profile.",
        );
      } else {
        setError(
          err instanceof ApiException
            ? err.message
            : "Could not send message",
        );
      }
    } finally {
      setSending(false);
      composerRef.current?.focus();
    }
  }

  function onComposerKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void onSend();
    }
  }

  async function onDelete() {
    if (!activeId) return;
    if (!window.confirm("Delete this conversation?")) return;
    await deleteConversation(activeId);
    setActiveId(null);
    setPinnedRoom(null);
    setMessages([]);
    void refreshRooms();
  }

  const qNorm = query.toLowerCase().trim();

  const filtered = rooms.filter((r) => {
    const p = peerOf(r, me);
    const name = peerName(p).toLowerCase();
    const preview = (r.lastMessage?.content || "").toLowerCase();
    if (!qNorm) return true;
    return name.includes(qNorm) || preview.includes(qNorm);
  });

  const roomPeerIds = useMemo(() => {
    const ids = new Set<string>();
    for (const room of rooms) {
      const id = peerOf(room, me)?.userId;
      if (id) ids.add(id);
    }
    return ids;
  }, [rooms, me]);

  const roomPeerNames = useMemo(() => {
    const names = new Set<string>();
    for (const room of rooms) {
      const name = (peerOf(room, me)?.username ?? "").trim().toLowerCase();
      if (name) names.add(name);
    }
    return names;
  }, [rooms, me]);

  const startableMutuals = useMemo(() => {
    return mutualPeers.filter((u) => {
      if (!u.id) return false;
      if (roomPeerIds.has(u.id)) return false;
      const uname = (u.username ?? "").trim().toLowerCase();
      if (uname && roomPeerNames.has(uname)) return false;
      if (!qNorm) return true;
      const name = (u.fullName || u.username || "").toLowerCase();
      return name.includes(qNorm) || uname.includes(qNorm);
    });
  }, [mutualPeers, roomPeerIds, roomPeerNames, qNorm]);

  if (loading) {
    return <LiquidLoader label="Loading conversations…" />;
  }

  const metaParts = [
    `${rooms.length} conversation${rooms.length === 1 ? "" : "s"}`,
  ];
  if (mutualPeers.length > 0) {
    metaParts.push(`${mutualPeers.length} mutual`);
  }

  return (
    <div className="chat-page animate-fade-up">
      <div className="chat-shell">
        {/* List */}
        <div
          className={`chat-pane-list ${
            activeId ? "hidden md:flex" : "flex"
          } min-h-0 flex-1 md:flex-none`}
        >
          <div className="chat-list-head">
            <p className="chat-list-kicker">Inbox</p>
            <h2 className="chat-list-title">Messages</h2>
            <p className="chat-list-meta">{metaParts.join(" · ")}</p>
            <div className="chat-search-wrap">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-navy/35">
                <IconSearch />
              </span>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search people or messages"
                className="chat-search"
              />
            </div>
          </div>

          {error ? (
            <p className="px-4 pb-2 text-[12.5px] text-red-600">{error}</p>
          ) : null}

          <div className="chat-list-scroll liquid-scroll">
            {filtered.length === 0 && startableMutuals.length === 0 ? (
              <div className="chat-list-empty">
                <div className="chat-list-empty-mark">
                  <BrandMark size={34} variant="plain" />
                </div>
                <p className="font-display text-[16px] font-extrabold tracking-[-0.03em] text-navy">
                  {qNorm ? "No matches" : "Your inbox is clear"}
                </p>
                <p className="mx-auto mt-1.5 max-w-[30ch] text-[13px] leading-relaxed text-muted">
                  {qNorm
                    ? "Try another name or message."
                    : "When you and another innovator follow each other, they’ll show up here ready to message."}
                </p>
              </div>
            ) : (
              <ul className="space-y-0.5">
                {filtered.length > 0 ? (
                  <>
                    {startableMutuals.length > 0 ? (
                      <li className="chat-section-label">Recent</li>
                    ) : null}
                    {filtered.map((room) => {
                      const p = peerOf(room, me);
                      const selected = room.id === activeId;
                      const unreadCount = selected
                        ? 0
                        : Math.max(
                            room.unreadCount,
                            localUnread[room.id] ?? 0,
                          );
                      const unread = unreadCount > 0;
                      const online = peerIsOnline(p, room);
                      return (
                        <li key={room.id}>
                          <button
                            type="button"
                            onClick={() => void openRoom(room.id)}
                            className={`chat-tile liquid-press ${
                              selected ? "chat-tile-active" : ""
                            }`}
                          >
                            <PeerAvatar peer={p} size={38} online={online} />
                            <span className="min-w-0 flex-1">
                              <span className="flex items-center justify-between gap-2">
                                <span
                                  className={`truncate text-[14.5px] tracking-[-0.015em] ${
                                    unread && !selected
                                      ? "font-bold text-navy"
                                      : "font-semibold"
                                  }`}
                                >
                                  {peerName(p)}
                                </span>
                                <span
                                  className={`shrink-0 text-[11px] ${
                                    selected ? "text-white/50" : "text-muted"
                                  }`}
                                >
                                  {timeLabel(room.lastMessage?.createdAt)}
                                </span>
                              </span>
                              <span
                                className={`mt-0.5 block truncate text-[12.5px] ${
                                  selected
                                    ? "text-white/60"
                                    : unread
                                      ? "font-medium text-navy/70"
                                      : "text-muted"
                                }`}
                              >
                                {room.lastMessage
                                  ? previewLabel(room.lastMessage)
                                  : "Say hello"}
                              </span>
                            </span>
                            {unread ? (
                              <span className="chat-unread">
                                +{unreadCount}
                              </span>
                            ) : null}
                          </button>
                        </li>
                      );
                    })}
                  </>
                ) : null}

                {startableMutuals.length > 0 ? (
                  <>
                    <li className="chat-section-label">
                      {filtered.length > 0 ? "Start a chat" : "Mutual collaborators"}
                    </li>
                    {startableMutuals.map((u) => {
                      const name =
                        u.fullName?.trim() ||
                        u.username?.trim() ||
                        "Innovator";
                      const participant: ChatParticipant = {
                        userId: u.id,
                        username: u.username ?? null,
                        avatar: u.avatar ?? null,
                      };
                      const opening = startingPeerId === u.id;
                      return (
                        <li key={u.id}>
                          <button
                            type="button"
                            disabled={Boolean(startingPeerId)}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              void startChatWith(
                                u.id,
                                u.username || name,
                                u.avatar,
                              );
                            }}
                            className="chat-tile liquid-press"
                          >
                            <PeerAvatar peer={participant} size={38} />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[14.5px] font-semibold tracking-[-0.015em] text-navy">
                                {name}
                              </span>
                              <span className="mt-0.5 block truncate text-[12.5px] text-muted">
                                {u.username
                                  ? `@${u.username}`
                                  : "Mutual · tap to message"}
                              </span>
                            </span>
                            <span className="chat-tile-cta">
                              {opening ? "…" : "Message"}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </>
                ) : null}
              </ul>
            )}
          </div>
        </div>

        {/* Thread */}
        <div
          className={`chat-thread ${activeId ? "flex" : "hidden md:flex"}`}
        >
          {!active ? (
            <div className="chat-empty">
              <div className="chat-empty-mark">
                <BrandMark size={58} variant="plain" />
              </div>
              <h3>Your conversations</h3>
              <p>
                Pick someone from the left to open a thread. Mutual
                collaborators can message anytime.
              </p>
            </div>
          ) : (
            <>
              <div className="chat-header">
                <button
                  type="button"
                  className="grid h-9 w-9 place-items-center rounded-full bg-canvas text-navy md:hidden"
                  onClick={() => {
                    setActiveId(null);
                    setPinnedRoom(null);
                  }}
                  aria-label="Back"
                >
                  <IconBack />
                </button>
                <PeerAvatar
                  peer={peer}
                  size={40}
                  online={peerIsOnline(peer, active)}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-[16px] font-bold tracking-[-0.02em] text-navy">
                    {peerName(peer)}
                  </p>
                  <p className="text-[11.5px] text-muted">
                    {peerIsOnline(peer, active) ? "Online" : "Direct message"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void onDelete()}
                  className="liquid-press rounded-full px-3 py-1.5 text-[12px] font-semibold text-navy/50 hover:bg-canvas hover:text-red-600"
                >
                  Delete
                </button>
              </div>

              <div className="chat-messages liquid-scroll">
                {busy && messages.length === 0 ? (
                  <div className="flex h-full items-center justify-center">
                    <div className="h-7 w-7 animate-spin rounded-full border-2 border-navy/15 border-t-gold" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center px-6 text-center">
                    <PeerAvatar
                      peer={peer}
                      size={68}
                      online={peerIsOnline(peer, active)}
                    />
                    <p className="mt-3.5 font-display text-[18px] font-bold text-navy">
                      {peerName(peer)}
                    </p>
                    <p className="mt-1 max-w-[28ch] text-[13px] text-muted">
                      You’re connected. Send a message to begin.
                    </p>
                  </div>
                ) : (
                  <div>
                    {messages.map((m, i) => {
                      const mine = m.senderId === me;
                      const prev = messages[i - 1];
                      const showDay =
                        !prev || !sameDay(prev.createdAt, m.createdAt);
                      const grouped =
                        !!prev &&
                        prev.senderId === m.senderId &&
                        sameDay(prev.createdAt, m.createdAt);
                      return (
                        <div key={m.id}>
                          {showDay ? (
                            <div className="chat-day">
                              <span>{dayLabel(m.createdAt)}</span>
                            </div>
                          ) : null}
                          <div
                            className={`flex ${mine ? "justify-end" : "justify-start"}`}
                          >
                            <div
                              className={`chat-bubble ${
                                mine ? "chat-bubble-mine" : "chat-bubble-theirs"
                              } ${grouped ? "tight" : "spaced"} ${
                                m.pending ? "chat-bubble-pending" : ""
                              }`}
                            >
                              <ChatMediaBody
                                message={m}
                                mine={mine}
                                onOpenImage={(url) => setLightboxSrc(url)}
                              />
                              <div
                                className={`mt-1 text-right text-[10.5px] ${
                                  mine ? "text-white/45" : "text-muted"
                                }`}
                              >
                                {m.pending ? "Sending…" : timeLabel(m.createdAt)}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={bottomRef} />
                  </div>
                )}
              </div>

              <div className="chat-composer-wrap">
                {attachFile ? (
                  <div className="chat-attach-preview">
                    <span className="chat-attach-preview-thumb">
                      {attachPreview &&
                      chatMediaKindFromFile(attachFile) === "image" ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={attachPreview} alt="" />
                      ) : attachPreview &&
                        chatMediaKindFromFile(attachFile) === "video" ? (
                        <video src={attachPreview} muted />
                      ) : (
                        <span className="text-[11px] font-bold uppercase tracking-[0.08em]">
                          {chatMediaKindFromFile(attachFile)}
                        </span>
                      )}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-navy">
                      {attachFile.name}
                    </span>
                    <button
                      type="button"
                      onClick={clearAttachment}
                      className="liquid-chip !py-1 !text-[11px]"
                    >
                      Remove
                    </button>
                  </div>
                ) : null}
                <form
                  onSubmit={(e) => void onSend(e)}
                  className="chat-composer"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={ATTACH_ACCEPT}
                    className="hidden"
                    onChange={(e) =>
                      onPickFile(e.target.files?.[0] ?? null)
                    }
                  />
                  <button
                    type="button"
                    disabled={sending}
                    onClick={() => fileInputRef.current?.click()}
                    className="chat-attach liquid-press"
                    aria-label="Attach image, video, audio, or PDF"
                    title="Attach image, video, audio, or PDF"
                  >
                    <IconAttach />
                  </button>
                  <textarea
                    ref={composerRef}
                    value={draft}
                    onChange={(e) => {
                      setDraft(e.target.value);
                      resizeComposer();
                    }}
                    onKeyDown={onComposerKey}
                    placeholder="Write a message…"
                    rows={1}
                    className="chat-composer-input"
                  />
                  <button
                    type="submit"
                    disabled={(!draft.trim() && !attachFile) || sending}
                    className="chat-send liquid-press"
                    aria-label="Send"
                  >
                    <IconSend />
                  </button>
                </form>
                <p className="chat-hint">
                  Attach photo, video, audio, or PDF · Enter to send
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {lightboxSrc ? (
        <ChatImageLightbox
          src={lightboxSrc}
          onClose={() => setLightboxSrc(null)}
        />
      ) : null}
    </div>
  );
}

function ChatImageLightbox({
  src,
  onClose,
}: {
  src: string;
  onClose: () => void;
}) {
  useEffect(() => {
    function onKey(e: globalThis.KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div
      className="chat-image-lightbox"
      role="dialog"
      aria-modal="true"
      aria-label="Image preview"
      onClick={onClose}
    >
      <button
        type="button"
        className="chat-image-lightbox-close"
        onClick={onClose}
        aria-label="Close"
      >
        Close
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        className="chat-image-lightbox-img"
        sizes="100vw"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}

function ChatMediaBody({
  message,
  mine,
  onOpenImage,
}: {
  message: LocalMessage;
  mine: boolean;
  onOpenImage?: (url: string) => void;
}) {
  const src = message.mediaUrl || message.localPreviewUrl || "";
  const kind = chatMediaKindFromMessage(
    message.messageType,
    src,
    message.content,
  );
  const caption = message.content?.trim() || "";
  const showCaption =
    caption &&
    !["photo", "video", "audio", "pdf", "attachment"].includes(
      caption.toLowerCase(),
    );

  return (
    <div className="space-y-1.5">
      {kind === "image" && src ? (
        <button
          type="button"
          className="chat-media-image-btn"
          onClick={() => onOpenImage?.(src)}
          aria-label="View full screen image"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt="" className="chat-media-image" />
        </button>
      ) : null}
      {kind === "video" && src ? (
        <video src={src} controls playsInline className="chat-media-video" />
      ) : null}
      {kind === "audio" && src ? (
        <audio src={src} controls className="chat-media-audio" />
      ) : null}
      {kind === "pdf" || (kind === "file" && src) ? (
        <a
          href={src || undefined}
          target="_blank"
          rel="noreferrer"
          className={`chat-media-file ${mine ? "mine" : ""}`}
        >
          <IconFile />
          <span className="min-w-0 truncate">
            {caption || (kind === "pdf" ? "PDF document" : "Attachment")}
          </span>
        </a>
      ) : null}
      {(kind === "text" || showCaption) && caption ? (
        <p className="whitespace-pre-wrap">{caption}</p>
      ) : null}
      {kind !== "text" && !src && caption ? (
        <p className="whitespace-pre-wrap">{caption}</p>
      ) : null}
    </div>
  );
}

function IconAttach() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M9.5 16.5V8.2a2.7 2.7 0 015.4 0v9.1a4.2 4.2 0 01-8.4 0V8.8"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconFile() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M7 3.5h7l4 4V20a1.5 1.5 0 01-1.5 1.5h-9.5A1.5 1.5 0 015.5 20V5A1.5 1.5 0 017 3.5z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path
        d="M14 3.5V8h4.5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconSearch() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M16 16l4 4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconBack() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M15 6 9 12l6 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconSend() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4.5 12 19 5l-4.2 14-3.3-5.2L4.5 12Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M11.5 13.8 19 5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}
