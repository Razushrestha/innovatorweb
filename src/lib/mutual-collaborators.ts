import { listFollowers, listFollowing } from "./profile-api";
import type { ProfileListUser } from "./types";

function usernameKey(u: ProfileListUser) {
  return (u.username ?? "").trim().toLowerCase();
}

function mergeUser(a: ProfileListUser, b?: ProfileListUser): ProfileListUser {
  return {
    id: a.id || b?.id || "",
    username: a.username || b?.username || null,
    fullName: a.fullName || b?.fullName || null,
    avatar: a.avatar || b?.avatar || null,
    role: a.role || b?.role || null,
    isFollowed: true,
  };
}

/**
 * Mutual collaborators = same person in both Collaborators (followers)
 * and Collaborating (following). Match by user id, or by username when
 * both lists share the same @handle.
 */
export async function listMutualCollaborators(): Promise<ProfileListUser[]> {
  const [followers, following] = await Promise.all([
    listFollowers(null),
    listFollowing(null),
  ]);

  const followingById = new Map(
    following.filter((u) => u.id).map((u) => [u.id, u]),
  );
  const followingByUsername = new Map(
    following
      .filter((u) => usernameKey(u))
      .map((u) => [usernameKey(u), u] as const),
  );

  const seenIds = new Set<string>();
  const seenUsernames = new Set<string>();
  const mutual: ProfileListUser[] = [];

  for (const follower of followers) {
    const uname = usernameKey(follower);
    const byId = follower.id ? followingById.get(follower.id) : undefined;
    const byName = uname ? followingByUsername.get(uname) : undefined;
    const match = byId || byName;
    if (!match && !follower.isFollowed) continue;

    const merged = mergeUser(follower, match);
    if (!merged.id) continue;
    if (seenIds.has(merged.id)) continue;
    if (uname && seenUsernames.has(uname)) continue;

    seenIds.add(merged.id);
    if (uname) seenUsernames.add(uname);
    mutual.push(merged);
  }

  for (const person of following) {
    if (!person.id || seenIds.has(person.id)) continue;
    const uname = usernameKey(person);
    if (uname && seenUsernames.has(uname)) continue;
    if (!person.isFollowed) continue;
    seenIds.add(person.id);
    if (uname) seenUsernames.add(uname);
    mutual.push(mergeUser(person));
  }

  return mutual;
}

export async function isMutualCollaborator(userId: string): Promise<boolean> {
  if (!userId.trim()) return false;
  const mutual = await listMutualCollaborators();
  return mutual.some((u) => u.id === userId);
}
