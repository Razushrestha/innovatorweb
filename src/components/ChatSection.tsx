"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
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
import type { ChatConversation, ChatMessage } from "@/lib/types";
import { LiquidLoader } from "./ui/LiquidChrome";

function timeLabel(iso?: string | null) {
  if (!iso) return "";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  return new Date(t).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function ChatSection() {
  const me = AuthSession.load().userId;
  const [rooms, setRooms] = useState<ChatConversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [peerId, setPeerId] = useState("");
  const [peerName, setPeerName] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

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

  async function openRoom(id: string) {
    setActiveId(id);
    setBusy(true);
    try {
      const msgs = await listMessages(id);
      setMessages([...msgs].reverse());
      void markRead(id);
      setRooms((prev) =>
        prev.map((r) => (r.id === id ? { ...r, unreadCount: 0 } : r)),
      );
    } catch (e) {
      setError(e instanceof ApiException ? e.message : "Could not open chat");
    } finally {
      setBusy(false);
    }
  }

  async function onSend(e: FormEvent) {
    e.preventDefault();
    if (!activeId || !draft.trim()) return;
    const text = draft.trim();
    setDraft("");
    try {
      const msg = await sendMessage(activeId, text);
      setMessages((prev) => [...prev, msg]);
      void refreshRooms();
    } catch {
      setDraft(text);
    }
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!peerId.trim()) return;
    setBusy(true);
    try {
      const room = await createConversation({
        participantUserId: peerId.trim(),
        participantUsername: peerName.trim() || undefined,
      });
      setShowNew(false);
      setPeerId("");
      setPeerName("");
      await refreshRooms();
      await openRoom(room.id);
    } catch (err) {
      setError(err instanceof ApiException ? err.message : "Could not start chat");
    } finally {
      setBusy(false);
    }
  }

  const filtered = rooms.filter((r) => {
    const p = peerOf(r, me);
    const name = (p?.username || "").toLowerCase();
    return name.includes(query.toLowerCase());
  });

  if (loading) {
    return <LiquidLoader label="Loading conversations…" />;
  }

  return (
    <div className="space-y-4 pb-6">
    <div className="liquid-glass flex h-[min(72vh,680px)] flex-col overflow-hidden md:flex-row">
      {/* List */}
      <div
        className={`flex w-full flex-col border-white/50 md:w-[300px] md:border-r ${
          activeId ? "hidden md:flex" : "flex"
        }`}
      >
        <div className="flex items-center justify-between gap-2 border-b border-white/50 px-4 py-3">
          <p className="font-display text-[17px] font-bold text-navy">Messages</p>
          <button
            type="button"
            onClick={() => setShowNew(true)}
            className="liquid-chip liquid-chip-active !py-1.5"
          >
            New
          </button>
        </div>
        <div className="px-3 py-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search chats…"
            className="glass-field py-2.5 text-[13.5px]"
          />
        </div>
        {error ? (
          <p className="px-4 py-2 text-[12.5px] text-red-600">{error}</p>
        ) : null}
        <ul className="flex-1 overflow-y-auto px-2 pb-3">
          {filtered.length === 0 ? (
            <li className="mx-2 my-3 rounded-[18px] border border-dashed border-navy/15 bg-white/35 px-3 py-10 text-center">
              <p className="font-display text-[15px] font-bold text-navy">
                No conversations yet
              </p>
              <p className="mt-1 text-[12.5px] text-muted">
                Tap New to start a direct message.
              </p>
            </li>
          ) : (
            filtered.map((room) => {
              const p = peerOf(room, me);
              const selected = room.id === activeId;
              return (
                <li key={room.id}>
                  <button
                    type="button"
                    onClick={() => void openRoom(room.id)}
                    className={`liquid-press mb-1 flex w-full items-center gap-3 rounded-[18px] px-3 py-2.5 text-left ${
                      selected
                        ? "bg-navy text-white"
                        : "hover:bg-white/55"
                    }`}
                  >
                    <span
                      className={`grid h-11 w-11 place-items-center rounded-[14px] font-display font-bold ${
                        selected
                          ? "bg-gold text-navy"
                          : "bg-white/70 text-navy"
                      }`}
                    >
                      {(p?.username || "?").slice(0, 1).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate font-semibold">
                          {p?.username || "Chat"}
                        </span>
                        <span
                          className={`text-[11px] ${
                            selected ? "text-white/60" : "text-muted"
                          }`}
                        >
                          {timeLabel(room.lastMessage?.createdAt)}
                        </span>
                      </span>
                      <span
                        className={`mt-0.5 block truncate text-[12.5px] ${
                          selected ? "text-white/70" : "text-muted"
                        }`}
                      >
                        {room.lastMessage?.content || "Say hello"}
                      </span>
                    </span>
                    {room.unreadCount > 0 ? (
                      <span className="rounded-full bg-gold px-2 py-0.5 text-[11px] font-bold text-navy">
                        {room.unreadCount}
                      </span>
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
        className={`min-w-0 flex-1 flex-col ${
          activeId ? "flex" : "hidden md:flex"
        }`}
      >
        {!active ? (
          <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
            <p className="font-display text-xl font-bold text-navy">
              Your conversations
            </p>
            <p className="mt-1 max-w-[28ch] text-[13.5px] text-muted">
              Pick a chat or start a new one with a user id.
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 border-b border-white/50 px-3 py-3">
              <button
                type="button"
                className="liquid-chip md:hidden"
                onClick={() => setActiveId(null)}
              >
                ←
              </button>
              <div className="min-w-0 flex-1">
                <p className="truncate font-display text-[16px] font-bold text-navy">
                  {peer?.username || "Chat"}
                </p>
              </div>
              <button
                type="button"
                className="liquid-chip text-red-600"
                onClick={() => {
                  if (!activeId) return;
                  void deleteConversation(activeId).then(() => {
                    setActiveId(null);
                    setMessages([]);
                    void refreshRooms();
                  });
                }}
              >
                Delete
              </button>
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto px-3 py-4">
              {busy && messages.length === 0 ? (
                <p className="text-center text-[13px] text-muted">Loading…</p>
              ) : (
                messages.map((m) => {
                  const mine = m.senderId === me;
                  return (
                    <div
                      key={m.id}
                      className={`flex ${mine ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[78%] rounded-[20px] px-3.5 py-2.5 text-[14px] leading-relaxed shadow-soft ${
                          mine
                            ? "rounded-br-[8px] bg-navy text-white"
                            : "rounded-bl-[8px] border border-white/70 bg-white/70 text-ink"
                        }`}
                      >
                        {m.content}
                        <div
                          className={`mt-1 text-[10.5px] ${
                            mine ? "text-white/50" : "text-muted"
                          }`}
                        >
                          {timeLabel(m.createdAt)}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            <form
              onSubmit={onSend}
              className="flex gap-2 border-t border-white/50 p-3"
            >
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Type a message…"
                className="glass-field flex-1 py-2.5"
              />
              <button
                type="submit"
                disabled={!draft.trim()}
                className="liquid-btn liquid-btn-dark !min-h-0 px-4 py-2.5 text-[13px] disabled:opacity-45"
              >
                Send
              </button>
            </form>
          </>
        )}
      </div>

      {showNew ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-navy/35 p-4 backdrop-blur-sm">
          <form
            onSubmit={onCreate}
            className="liquid-glass w-full max-w-md space-y-3 p-5"
          >
            <p className="font-display text-lg font-bold text-navy">New chat</p>
            <input
              value={peerId}
              onChange={(e) => setPeerId(e.target.value)}
              placeholder="Peer user id (UUID)"
              required
              className="glass-field"
            />
            <input
              value={peerName}
              onChange={(e) => setPeerName(e.target.value)}
              placeholder="Display name (optional)"
              className="glass-field"
            />
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
                Start
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
    </div>
  );
}
