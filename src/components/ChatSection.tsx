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
import {
  isMutualCollaborator,
  listMutualCollaborators,
} from "@/lib/mutual-collaborators";
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
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [attachFile, setAttachFile] = useState<File | null>(null);
  const [attachPreview, setAttachPreview] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [mutualPeers, setMutualPeers] = useState<ProfileListUser[]>([]);
  const [mutualLoading, setMutualLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [onlineMap, setOnlineMap] = useState<Record<string, boolean>>({});
  const [localUnread, setLocalUnread] = useState<Record<string, number>>({});
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingKey = pendingPeer?.userId ?? "";
  const myUsername = AuthSession.load().username;

  const active = useMemo(
    () => rooms.find((r) => r.id === activeId) ?? null,
    [rooms, activeId],
  );
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
        if (!cancelled) setOnlineMap(map);
      });
    };
    refresh();
    const timer = window.setInterval(refresh, 8000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [peerIds, peerUsernames]);

  /** Ensure every mutual collaborator has a conversation row in Messages. */
  const syncMutualRooms = useCallback(async () => {
    try {
      const [list, mutual] = await Promise.all([
        listConversations(),
        listMutualCollaborators(),
      ]);
      setMutualPeers(mutual);

      const existingPeerIds = new Set(
        list
          .map((room) => peerOf(room, me)?.userId)
          .filter((id): id is string => Boolean(id)),
      );
      const existingPeerNames = new Set(
        list
          .map((room) =>
            (peerOf(room, me)?.username ?? "").trim().toLowerCase(),
          )
          .filter(Boolean),
      );

      const missing = mutual.filter((u) => {
        if (!u.id) return false;
        if (existingPeerIds.has(u.id)) return false;
        const uname = (u.username ?? "").trim().toLowerCase();
        if (uname && existingPeerNames.has(uname)) return false;
        return true;
      });

      if (missing.length > 0) {
        await Promise.allSettled(
          missing.map((u) =>
            createConversation({
              participantUserId: u.id,
              participantUsername:
                u.username?.trim() || u.fullName?.trim() || undefined,
            }),
          ),
        );
      }

      const next = missing.length > 0 ? await listConversations() : list;
      // Prefer mutual usernames on participants when chat API omits them.
      const byId = new Map(mutual.map((u) => [u.id, u]));
      const enriched = next.map((room) => {
        const p = peerOf(room, me);
        if (!p?.userId) return room;
        const m = byId.get(p.userId);
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

      // Active threads first, then alphabetical by peer name.
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

      const unreadById = applyChatUnread(enriched, me, activeId);
      setLocalUnread(unreadById);
      setRooms(
        enriched.map((room) => ({
          ...room,
          unreadCount: unreadById[room.id] ?? room.unreadCount,
        })),
      );
      setError(null);
    } catch (e) {
      setError(e instanceof ApiException ? e.message : "Could not load chats");
    } finally {
      setLoading(false);
    }
  }, [me, activeId]);

  const refreshRooms = useCallback(async () => {
    await syncMutualRooms();
  }, [syncMutualRooms]);

  useEffect(() => {
    void syncMutualRooms();
  }, [syncMutualRooms]);

  // Poll inbox so new messages show +1 / +2 badges quickly.
  useEffect(() => {
    const timer = window.setInterval(() => {
      void syncMutualRooms();
    }, 4000);
    return () => window.clearInterval(timer);
  }, [syncMutualRooms]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, activeId]);

  // Soft refresh while a thread is open
  useEffect(() => {
    if (!activeId) return;
    const timer = window.setInterval(() => {
      void (async () => {
        try {
          const msgs = await listMessages(activeId);
          const next = [...msgs].reverse();
          setMessages((prev) => {
            const pending = prev.filter((m) => m.pending);
            if (pending.length === 0 && next.length === prev.length) {
              const lastPrev = prev[prev.length - 1]?.id;
              const lastNext = next[next.length - 1]?.id;
              if (lastPrev === lastNext) return prev;
            }
            return [...next, ...pending];
          });
          void markRead(activeId);
          const tip = next[next.length - 1]?.id;
          markChatRoomRead(activeId, tip);
          setLocalUnread((prev) => ({ ...prev, [activeId]: 0 }));
          setRooms((prev) =>
            prev.map((r) =>
              r.id === activeId ? { ...r, unreadCount: 0 } : r,
            ),
          );
        } catch {
          /* ignore poll errors */
        }
      })();
    }, 4000);
    return () => window.clearInterval(timer);
  }, [activeId]);

  function resizeComposer() {
    const el = composerRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 132)}px`;
  }

  async function openRoom(id: string) {
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

  async function startChatWith(userId: string, username?: string | null) {
    if (!userId) return;
    setBusy(true);
    setError(null);
    try {
      let list = await listConversations();
      setRooms(list);
      let room = list.find((r) => peerOf(r, me)?.userId === userId) ?? null;
      if (!room) {
        const mutual = await isMutualCollaborator(userId);
        if (!mutual) {
          setError("Chat is only available with mutual collaborators.");
          return;
        }
        room = await createConversation({
          participantUserId: userId,
          participantUsername: username?.trim() || undefined,
        });
        list = await listConversations();
        setRooms(list);
        room = list.find((r) => r.id === room!.id) ?? room;
      }

      setActiveId(room.id);
      setMessages([]);
      const msgs = await listMessages(room.id);
      setMessages([...msgs].reverse());
      void markRead(room.id);
      setRooms((prev) =>
        prev.map((r) => (r.id === room!.id ? { ...r, unreadCount: 0 } : r)),
      );
      window.setTimeout(() => {
        composerRef.current?.focus();
        resizeComposer();
      }, 80);
    } catch (err) {
      setError(
        err instanceof ApiException ? err.message : "Could not start chat",
      );
    } finally {
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

  useEffect(() => {
    if (!showNew) return;
    setMutualLoading(true);
    void (async () => {
      try {
        setMutualPeers(await listMutualCollaborators());
      } catch {
        setMutualPeers([]);
      } finally {
        setMutualLoading(false);
      }
    })();
  }, [showNew]);

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
    setMessages((prev) => [...prev, optimistic]);
    setSending(true);
    window.setTimeout(resizeComposer, 0);
    try {
      const msg = file
        ? await sendMediaMessage(activeId, file, text)
        : await sendMessage(activeId, text);
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
      setError(
        err instanceof ApiException
          ? err.message
          : "Could not send attachment",
      );
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
    setMessages([]);
    void refreshRooms();
  }

  const filtered = rooms.filter((r) => {
    const p = peerOf(r, me);
    const name = peerName(p).toLowerCase();
    const preview = (r.lastMessage?.content || "").toLowerCase();
    const q = query.toLowerCase().trim();
    if (!q) return true;
    return name.includes(q) || preview.includes(q);
  });

  if (loading) {
    return <LiquidLoader label="Loading conversations…" />;
  }

  return (
    <div className="animate-fade-up pb-4">
      <div className="chat-shell">
        {/* List */}
        <div
          className={`chat-pane-list ${
            activeId ? "hidden md:flex" : "flex"
          } min-h-0 flex-1 md:flex-none`}
        >
          <div className="px-4 pb-3 pt-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div>
                <p className="font-display text-[20px] font-extrabold tracking-[-0.03em] text-navy">
                  Messages
                </p>
                <p className="text-[12px] text-muted">
                  {rooms.length} conversation{rooms.length === 1 ? "" : "s"}
                  {mutualPeers.length > 0
                    ? ` · ${mutualPeers.length} mutual`
                    : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowNew(true)}
                className="liquid-press inline-flex h-9 w-9 items-center justify-center rounded-full bg-navy text-gold ring-1 ring-gold/45"
                aria-label="New chat"
                title="New chat"
              >
                <IconPlus />
              </button>
            </div>
            <div className="relative">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-navy/35">
                <IconSearch />
              </span>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search…"
                className="chat-search"
              />
            </div>
          </div>

          {error ? (
            <p className="px-4 pb-2 text-[12.5px] text-red-600">{error}</p>
          ) : null}

          <ul className="liquid-scroll flex-1 space-y-0.5 overflow-y-auto px-2 pb-3">
            {filtered.length === 0 ? (
              <li className="mx-1 my-4 rounded-[20px] border border-dashed border-navy/10 bg-white/50 px-4 py-10 text-center">
                <BrandMark size={44} variant="navy" className="mx-auto mb-3" />
                <p className="font-display text-[15px] font-bold text-navy">
                  {query ? "No matches" : "No conversations yet"}
                </p>
                <p className="mx-auto mt-1 max-w-[28ch] text-[12.5px] text-muted">
                  {query
                    ? "Try another name."
                    : "Mutual collaborators appear here automatically once you follow each other."}
                </p>
              </li>
            ) : (
              filtered.map((room) => {
                const p = peerOf(room, me);
                const selected = room.id === activeId;
                const unreadCount = selected
                  ? 0
                  : Math.max(room.unreadCount, localUnread[room.id] ?? 0);
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
                      <PeerAvatar peer={p} size={46} online={online} />
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
                            : "No messages yet"}
                        </span>
                      </span>
                      {unread ? (
                        <span className="chat-unread">+{unreadCount}</span>
                      ) : null}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>

        {/* Thread */}
        <div
          className={`chat-thread ${activeId ? "flex" : "hidden md:flex"}`}
        >
          {!active ? (
            <div className="chat-empty">
              <div className="mb-4 grid h-[84px] w-[84px] place-items-center rounded-[26px] border border-white/90 bg-white/80 shadow-soft">
                <BrandMark size={58} variant="plain" />
              </div>
              <p className="font-display text-[22px] font-extrabold tracking-[-0.03em] text-navy">
                Select a conversation
              </p>
              <p className="mt-1.5 max-w-[30ch] text-[14px] leading-relaxed text-muted">
                Choose a conversation, or message a mutual collaborator.
              </p>
              <button
                type="button"
                onClick={() => setShowNew(true)}
                className="liquid-btn liquid-btn-dark mt-5 !min-h-0 px-5 py-2.5 text-[13px]"
              >
                New chat
              </button>
            </div>
          ) : (
            <>
              <div className="chat-header">
                <button
                  type="button"
                  className="grid h-9 w-9 place-items-center rounded-full bg-canvas text-navy md:hidden"
                  onClick={() => setActiveId(null)}
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

      {showNew ? (
        <div
          className="profile-sheet"
          role="dialog"
          aria-modal="true"
          onClick={() => setShowNew(false)}
        >
          <div
            className="profile-sheet-panel p-0"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-navy/[0.06] px-5 py-4">
              <div className="flex items-center gap-3">
                <BrandMark size={40} variant="soft" />
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gold">
                    Messages
                  </p>
                  <h3 className="font-display text-[20px] font-extrabold tracking-[-0.03em] text-navy">
                    New chat
                  </h3>
                  <p className="mt-0.5 text-[12px] text-muted">
                    Mutual collaborators only
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowNew(false)}
                className="liquid-chip !py-1.5"
              >
                Close
              </button>
            </div>
            <div className="liquid-scroll max-h-[55vh] overflow-y-auto px-3 py-3">
              {mutualLoading ? <LiquidLoader label="Loading…" /> : null}
              {!mutualLoading && mutualPeers.length === 0 ? (
                <p className="px-3 py-10 text-center text-[13.5px] text-muted">
                  No mutual collaborators yet. Follow back someone in
                  Collaborators to unlock chat.
                </p>
              ) : null}
              {!mutualLoading &&
                mutualPeers.map((u) => {
                  const name =
                    u.fullName?.trim() || u.username?.trim() || "Innovator";
                  const letter = name.slice(0, 1).toUpperCase();
                  return (
                    <button
                      key={u.id}
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        setShowNew(false);
                        void startChatWith(u.id, u.username || name);
                      }}
                      className="liquid-press flex w-full items-center gap-3 rounded-[16px] px-3 py-2.5 text-left hover:bg-canvas"
                    >
                      <span className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-navy text-[14px] font-bold text-white">
                        {u.avatar ? (
                          <Image
                            src={u.avatar}
                            alt=""
                            fill
                            unoptimized
                            className="object-cover"
                          />
                        ) : (
                          letter
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] font-semibold text-navy">
                          {name}
                        </span>
                        {u.username ? (
                          <span className="block truncate text-[12px] text-muted">
                            @{u.username}
                          </span>
                        ) : null}
                      </span>
                      <span className="profile-chat !min-w-0 !px-3 !py-1.5 !text-[12px]">
                        Chat
                      </span>
                    </button>
                  );
                })}
            </div>
          </div>
        </div>
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

function IconPlus() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 5v14M5 12h14"
        stroke="currentColor"
        strokeWidth="2.2"
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
