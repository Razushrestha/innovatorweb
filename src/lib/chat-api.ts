import { ApiConfig } from "./api-config";
import { ApiException, apiMultipart, apiRequest } from "./api-client";
import { toProxiedMediaUrlOrNull } from "./media-url";
import type { ChatConversation, ChatMessage } from "./types";

export type ChatMediaKind = "image" | "video" | "audio" | "pdf" | "file";

export function chatMediaKindFromFile(file: File): ChatMediaKind {
  const type = (file.type || "").toLowerCase();
  const name = file.name.toLowerCase();
  if (type.startsWith("image/") || /\.(png|jpe?g|gif|webp|heic)$/i.test(name)) {
    return "image";
  }
  if (type.startsWith("video/") || /\.(mp4|webm|mov|m4v)$/i.test(name)) {
    return "video";
  }
  if (type.startsWith("audio/") || /\.(mp3|wav|m4a|aac|ogg)$/i.test(name)) {
    return "audio";
  }
  if (type === "application/pdf" || name.endsWith(".pdf")) return "pdf";
  return "file";
}

export function chatMediaKindFromMessage(
  messageType?: string | null,
  mediaUrl?: string | null,
  content?: string | null,
): ChatMediaKind | "text" {
  const blob = `${messageType ?? ""} ${mediaUrl ?? ""} ${content ?? ""}`.toLowerCase();
  if (!mediaUrl && (messageType === "text" || !messageType)) return "text";
  if (/(image|photo|png|jpe?g|gif|webp)/.test(blob)) return "image";
  if (/(video|mp4|webm|mov)/.test(blob)) return "video";
  if (/(audio|mp3|wav|m4a|voice)/.test(blob)) return "audio";
  if (/(pdf|document)/.test(blob)) return "pdf";
  if (mediaUrl) return "file";
  return "text";
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}

function asParticipant(raw: Record<string, unknown>) {
  return {
    userId: String(raw.user_id ?? raw.userId ?? ""),
    username: (raw.username as string | null) ?? null,
    avatar: toProxiedMediaUrlOrNull(
      (raw.avatar as string | null) ?? null,
      "profile",
    ),
  };
}

function asMessage(raw: Record<string, unknown>): ChatMessage {
  return {
    id: String(raw.id ?? ""),
    conversationId: String(raw.conversation_id ?? raw.conversationId ?? ""),
    senderId: String(raw.sender_id ?? raw.senderId ?? ""),
    senderUsername: (raw.sender_username as string | null) ?? null,
    senderAvatar: toProxiedMediaUrlOrNull(
      (raw.sender_avatar as string | null) ?? null,
      "profile",
    ),
    content: (raw.content as string | null) ?? null,
    messageType: (raw.message_type as string | null) ?? "text",
    mediaUrl: toProxiedMediaUrlOrNull(
      (raw.media_url as string | null) ?? null,
      "chat",
    ),
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

/**
 * Send image / video / audio / PDF (or other file) with optional caption.
 * Tries multipart upload first, then JSON with media_url (data URL) as fallback.
 */
export async function sendMediaMessage(
  conversationId: string,
  file: File,
  caption = "",
) {
  const kind = chatMediaKindFromFile(file);
  const messageType = kind === "file" ? "file" : kind;
  const content =
    caption.trim() ||
    (kind === "image"
      ? "Photo"
      : kind === "video"
        ? "Video"
        : kind === "audio"
          ? "Audio"
          : kind === "pdf"
            ? file.name || "PDF"
            : file.name || "Attachment");

  const path = `/api/chat/conversations/${encodeURIComponent(conversationId)}/messages`;

  // 1) Multipart — preferred when the chat service accepts binary media.
  try {
    const form = new FormData();
    form.append("content", content);
    form.append("message_type", messageType);
    form.append("media", file, file.name);
    form.append("file", file, file.name);
    form.append("media_file", file, file.name);
    const data = await apiMultipart<Record<string, unknown>>(
      ApiConfig.chatBaseUrl,
      path,
      form,
    );
    return asMessage(data);
  } catch (err) {
    // Continue to JSON fallback for APIs that only accept media_url.
    if (err instanceof ApiException && err.status && err.status >= 500) {
      throw err;
    }
  }

  // 2) JSON + media_url (data URL) — works with swagger SendMessageRequest.
  const maxBytes = 4.5 * 1024 * 1024;
  if (file.size > maxBytes) {
    throw new ApiException(
      "File is too large to send this way (max ~4.5 MB). Try a smaller file.",
    );
  }
  const mediaUrl = await readFileAsDataUrl(file);
  if (!mediaUrl) {
    throw new ApiException("Could not prepare the attachment");
  }

  const data = await apiRequest<Record<string, unknown>>(
    ApiConfig.chatBaseUrl,
    path,
    {
      method: "POST",
      body: {
        content,
        message_type: messageType,
        media_url: mediaUrl,
      },
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
