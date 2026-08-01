import { ApiException } from "./api-client";
import { getProfileByAuthUserId } from "./profile-api";
import { searchAll } from "./search-api";

export type ResolvedChatPeer = {
  userId: string;
  username?: string;
  avatar?: string | null;
};

/**
 * Resolve a chat participant to the auth user id the chat service expects.
 * Prefer username lookup after follower migrations, when stored ids go stale.
 */
export async function resolveChatPeer(
  userId?: string | null,
  username?: string | null,
  avatar?: string | null,
): Promise<ResolvedChatPeer> {
  const uid = (userId ?? "").trim();
  const uname = (username ?? "").trim().replace(/^@/, "");

  if (uid) {
    try {
      const profile = await getProfileByAuthUserId(uid);
      const authId = (profile.authUserId || uid).trim();
      if (authId) {
        return {
          userId: authId,
          username: profile.username?.trim() || uname || undefined,
          avatar: profile.avatar || avatar || null,
        };
      }
    } catch {
      /* try username next */
    }
  }

  if (uname) {
    try {
      const { users } = await searchAll(uname);
      const needle = uname.toLowerCase();
      const hit =
        users.find((u) => u.username.toLowerCase() === needle) ||
        users.find((u) => u.username.toLowerCase().includes(needle));
      if (hit?.id) {
        try {
          const profile = await getProfileByAuthUserId(hit.id);
          return {
            userId: (profile.authUserId || hit.id).trim(),
            username: profile.username?.trim() || hit.username || uname,
            avatar: profile.avatar || hit.avatar || avatar || null,
          };
        } catch {
          return {
            userId: hit.id,
            username: hit.username || uname,
            avatar: hit.avatar || avatar || null,
          };
        }
      }
    } catch {
      /* fall through */
    }
  }

  if (uid) {
    return { userId: uid, username: uname || undefined, avatar: avatar ?? null };
  }

  throw new ApiException(
    "Could not find this collaborator for chat. Try again from their profile.",
  );
}
