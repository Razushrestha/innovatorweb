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
  createConversation,
  deleteConversation,
  listConversations,
  listMessages,
  markRead,
  peerOf,
  sendMessage,
} from "@/lib/chat-api";
import type { ChatConversation, ChatMessage, ChatParticipant } from "@/lib/types";
import { BrandMark } from "./BrandMark";
import { LiquidLoader } from "./ui/LiquidChrome";

type LocalMessage = ChatMessage & { pending?: boolean };

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
}: {
  peer?: ChatParticipant | null;
  size?: number;
}) {
  const name = peerName(peer);
  const letter = name.slice(0, 1).toUpperCase();
  return (
    <span
      className="chat-avatar chat-avatar-ring relative"
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
  );
}

export function ChatSection() {
  const me = AuthSession.load().userId;
  const [rooms, setRooms] = useState<ChatConversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [peerId, setPeerId] = useState("");
  const [peerNameInput, setPeerNameInput] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);

  const active = useMemo(
    () => rooms.find((r) => r.id === activeId) ?? null,
    [rooms, activeId],
  );
  const peer = active ? peerOf(active, me) : null;

  const refreshRooms = useCallback(async () => {
    try {
      const list = await listConversations();
      setRooms(list);
      setError(null);
    } catch (e) {
      setError(e instanceof ApiException ? e.message : "Could not load chats");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshRooms();
  }, [refreshRooms]);

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
        } catch {
          /* ignore poll errors */
        }
      })();
    }, 8000);
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
    try {
      const msgs = await listMessages(id);
      setMessages([...msgs].reverse());
      void markRead(id);
      setRooms((prev) =>
        prev.map((r) => (r.id === id ? { ...r, unreadCount: 0 } : r)),
      );
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

  async function onSend(e?: FormEvent) {
    e?.preventDefault();
    if (!activeId || !draft.trim() || sending) return;
    const text = draft.trim();
    const tempId = `tmp-${Date.now()}`;
    const optimistic: LocalMessage = {
      id: tempId,
      conversationId: activeId,
      senderId: me || "",
      content: text,
      createdAt: new Date().toISOString(),
      pending: true,
    };
    setDraft("");
    setMessages((prev) => [...prev, optimistic]);
    setSending(true);
    window.setTimeout(resizeComposer, 0);
    try {
      const msg = await sendMessage(activeId, text);
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? { ...msg, pending: false } : m)),
      );
      void refreshRooms();
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setDraft(text);
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

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!peerId.trim()) return;
    setBusy(true);
    try {
      const room = await createConversation({
        participantUserId: peerId.trim(),
        participantUsername: peerNameInput.trim() || undefined,
      });
      setShowNew(false);
      setPeerId("");
      setPeerNameInput("");
      await refreshRooms();
      await openRoom(room.id);
    } catch (err) {
      setError(
        err instanceof ApiException ? err.message : "Could not start chat",
      );
    } finally {
      setBusy(false);
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
                <p className="mx-auto mt-1 max-w-[26ch] text-[12.5px] text-muted">
                  {query
                    ? "Try another name."
                    : "Start a chat to message someone."}
                </p>
                {!query ? (
                  <button
                    type="button"
                    onClick={() => setShowNew(true)}
                    className="liquid-btn liquid-btn-dark mx-auto mt-4 !min-h-0 px-4 py-2.5 text-[13px]"
                  >
                    New chat
                  </button>
                ) : null}
              </li>
            ) : (
              filtered.map((room) => {
                const p = peerOf(room, me);
                const selected = room.id === activeId;
                const unread = room.unreadCount > 0;
                return (
                  <li key={room.id}>
                    <button
                      type="button"
                      onClick={() => void openRoom(room.id)}
                      className={`chat-tile liquid-press ${
                        selected ? "chat-tile-active" : ""
                      }`}
                    >
                      <PeerAvatar peer={p} size={46} />
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
                          {room.lastMessage?.content || "No messages yet"}
                        </span>
                      </span>
                      {unread ? (
                        <span className="chat-unread">{room.unreadCount}</span>
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
                Choose someone from the left, or start a new chat.
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
                <PeerAvatar peer={peer} size={40} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-[16px] font-bold tracking-[-0.02em] text-navy">
                    {peerName(peer)}
                  </p>
                  <p className="text-[11.5px] text-muted">Direct message</p>
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
                    <PeerAvatar peer={peer} size={68} />
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
                              <p className="whitespace-pre-wrap">{m.content}</p>
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
                <form
                  onSubmit={(e) => void onSend(e)}
                  className="chat-composer"
                >
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
                    disabled={!draft.trim() || sending}
                    className="chat-send liquid-press"
                    aria-label="Send"
                  >
                    <IconSend />
                  </button>
                </form>
                <p className="chat-hint">Enter to send · Shift+Enter for new line</p>
              </div>
            </>
          )}
        </div>
      </div>

      {showNew ? (
        <div
          className="profile-sheet"
          role="dialog"
          aria-modal="true"
          onClick={() => setShowNew(false)}
        >
          <form
            onSubmit={onCreate}
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
            <div className="space-y-3 px-5 py-4">
              <label className="block space-y-1.5">
                <span className="pl-1 text-[12.5px] font-semibold text-muted">
                  Peer user id
                </span>
                <input
                  value={peerId}
                  onChange={(e) => setPeerId(e.target.value)}
                  placeholder="UUID of the person"
                  required
                  className="glass-field"
                  autoFocus
                />
              </label>
              <label className="block space-y-1.5">
                <span className="pl-1 text-[12.5px] font-semibold text-muted">
                  Display name
                </span>
                <input
                  value={peerNameInput}
                  onChange={(e) => setPeerNameInput(e.target.value)}
                  placeholder="Optional"
                  className="glass-field"
                />
              </label>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowNew(false)}
                  className="liquid-btn liquid-btn-light flex-1"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="liquid-btn liquid-btn-dark flex-1"
                >
                  {busy ? "Starting…" : "Start chat"}
                </button>
              </div>
            </div>
          </form>
        </div>
      ) : null}
    </div>
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
