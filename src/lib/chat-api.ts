import { ApiConfig } from "./api-config";
import { apiRequest } from "./api-client";
import type { ChatConversation, ChatMessage } from "./types";

function asParticipant(raw: Record<string, unknown>) {
  return {
    userId: String(raw.user_id ?? raw.userId ?? ""),
    username: (raw.username as string | null) ?? null,
    avatar: (raw.avatar as string | null) ?? null,
  };
}

function asMessage(raw: Record<string, unknown>): ChatMessage {
  return {
    id: String(raw.id ?? ""),
    conversationId: String(raw.conversation_id ?? raw.conversationId ?? ""),
    senderId: String(raw.sender_id ?? raw.senderId ?? ""),
    senderUsername: (raw.sender_username as string | null) ?? null,
    senderAvatar: (raw.sender_avatar as string | null) ?? null,
    content: (raw.content as string | null) ?? null,
    messageType: (raw.message_type as string | null) ?? "text",
    mediaUrl: (raw.media_url as string | null) ?? null,
    createdAt:
      (raw.created_at as string | null) ??
      (raw.createdAt as string | null) ??
      null,
  };
}

function asConversation(raw: Record<string, unknown>): ChatConversation {
  const participants = Array.isArray(raw.participants)
    ? raw.participants
        .filter((p): p is Record<string, unknown> => !!p && typeof p === "object")
        .map(asParticipant)
    : [];
  const last = raw.last_message ?? raw.lastMessage;
  return {
    id: String(raw.id ?? ""),
    type: (raw.type as string | null) ?? null,
    participants,
    lastMessage:
      last && typeof last === "object"
        ? asMessage(last as Record<string, unknown>)
        : null,
    unreadCount: Number(raw.unread_count ?? raw.unreadCount ?? 0),
    createdAt:
      (raw.created_at as string | null) ??
      (raw.createdAt as string | null) ??
      null,
  };
}

export async function listConversations() {
  const data = await apiRequest<unknown>(
    ApiConfig.chatBaseUrl,
    "/api/chat/conversations",
  );
  if (!Array.isArray(data)) return [] as ChatConversation[];
  return data
    .filter((c): c is Record<string, unknown> => !!c && typeof c === "object")
    .map(asConversation);
}

export async function createConversation(input: {
  participantUserId: string;
  participantUsername?: string;
}) {
  const data = await apiRequest<Record<string, unknown>>(
    ApiConfig.chatBaseUrl,
    "/api/chat/conversations",
    {
      method: "POST",
      body: {
        participant_user_id: input.participantUserId,
        participant_username: input.participantUsername,
      },
    },
  );
  return asConversation(data);
}

export async function listMessages(conversationId: string, page = 1) {
  const data = await apiRequest<unknown>(
    ApiConfig.chatBaseUrl,
    `/api/chat/conversations/${conversationId}/messages`,
    { query: { page: String(page) } },
  );
  if (!Array.isArray(data)) return [] as ChatMessage[];
  return data
    .filter((m): m is Record<string, unknown> => !!m && typeof m === "object")
    .map(asMessage);
}

export async function sendMessage(conversationId: string, content: string) {
  const data = await apiRequest<Record<string, unknown>>(
    ApiConfig.chatBaseUrl,
    `/api/chat/conversations/${conversationId}/messages`,
    {
      method: "POST",
      body: { content, message_type: "text" },
    },
  );
  return asMessage(data);
}

export async function markRead(conversationId: string) {
  try {
    await apiRequest(
      ApiConfig.chatBaseUrl,
      `/api/chat/conversations/${conversationId}/read`,
      { method: "POST" },
    );
  } catch {
    // optional
  }
}

export async function deleteConversation(conversationId: string) {
  await apiRequest(
    ApiConfig.chatBaseUrl,
    `/api/chat/conversations/${conversationId}`,
    { method: "DELETE" },
  );
}

export function peerOf(
  conversation: ChatConversation,
  myUserId: string | null,
) {
  const other = conversation.participants.find((p) => p.userId !== myUserId);
  return other ?? conversation.participants[0] ?? null;
}
