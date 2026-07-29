export type AuthUser = {
  id: string;
  username?: string | null;
  email?: string | null;
  role?: string | null;
  isEmailVerified?: boolean;
};

export type AuthResult = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: AuthUser;
};

export type FeedMediaItem = {
  id: string;
  file: string;
  mediaType?: string | null;
  thumbnail?: string | null;
};

export type FeedPost = {
  id: string;
  userId: string;
  username?: string | null;
  avatar?: string | null;
  content?: string | null;
  media: FeedMediaItem[];
  reactionsCount: number;
  commentsCount: number;
  shareCount: number;
  viewsCount: number;
  currentUserReaction?: string | null;
  isFollowed: boolean;
  createdAt?: string | null;
};

export type FeedPage = {
  results: FeedPost[];
  count: number;
  next?: string | null;
  previous?: string | null;
};

export type FeedCategory = {
  id: string;
  name: string;
  description?: string | null;
};

export type FeedComment = {
  id: string;
  username?: string | null;
  avatar?: string | null;
  content?: string | null;
  createdAt?: string | null;
};

export type SearchUserHit = {
  id: string;
  username: string;
  avatar?: string | null;
  bio?: string | null;
};

export type SearchPostHit = {
  id: string;
  content: string;
  username?: string | null;
};

export type ChatParticipant = {
  userId: string;
  username?: string | null;
  avatar?: string | null;
};

export type ChatMessage = {
  id: string;
  conversationId: string;
  senderId: string;
  senderUsername?: string | null;
  senderAvatar?: string | null;
  content?: string | null;
  messageType?: string | null;
  mediaUrl?: string | null;
  createdAt?: string | null;
};

export type ChatConversation = {
  id: string;
  type?: string | null;
  participants: ChatParticipant[];
  lastMessage?: ChatMessage | null;
  unreadCount: number;
  createdAt?: string | null;
};

export type UserProfile = {
  id: string;
  authUserId: string;
  username?: string | null;
  fullName?: string | null;
  email?: string | null;
  role?: string | null;
  bio?: string | null;
  avatar?: string | null;
  dateOfBirth?: string | null;
  phone?: string | null;
  gender?: string | null;
  address?: string | null;
  education?: string | null;
  occupation?: string | null;
  interests: string[];
  followersCount: number;
  followingCount: number;
  isFollowed: boolean;
};

export type AppNotification = {
  id: string;
  title: string;
  message: string;
  type?: string | null;
  senderUsername?: string | null;
  senderAvatar?: string | null;
  relatedPostId?: string | null;
  isRead: boolean;
  createdAt?: string | null;
};

export type ApiEnvelope<T> = {
  success?: boolean;
  message?: string | null;
  data?: T | null;
};
