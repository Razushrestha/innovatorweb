import { listFollowers, listFollowing } from "./profile-api";
import type { ProfileListUser } from "./types";

/**
 * Mutual collaborators = people who appear in both
 * Collaborators (followers) and Collaborating (following).
 * Matched by auth user id (username used only as display fallback).
 */
export async function listMutualCollaborators(): Promise<ProfileListUser[]> {
  const [followers, following] = await Promise.all([
    listFollowers(null),
    listFollowing(null),
  ]);

  const followingById = new Map(
    following.filter((u) => u.id).map((u) => [u.id, u]),
  );

  const seen = new Set<string>();
  const mutual: ProfileListUser[] = [];

  for (const follower of followers) {
    if (!follower.id || seen.has(follower.id)) continue;
    const alsoFollowing =
      followingById.has(follower.id) || follower.isFollowed === true;
    if (!alsoFollowing) continue;
    seen.add(follower.id);
    const fromFollowing = followingById.get(follower.id);
    mutual.push({
      ...follower,
      isFollowed: true,
      username: follower.username || fromFollowing?.username || null,
      fullName: follower.fullName || fromFollowing?.fullName || null,
      avatar: follower.avatar || fromFollowing?.avatar || null,
    });
  }

  // Include anyone in following who is marked followed-back via isFollowed
  // on the following list if the followers payload omitted them.
  for (const person of following) {
    if (!person.id || seen.has(person.id)) continue;
    if (!person.isFollowed) continue;
    seen.add(person.id);
    mutual.push({ ...person, isFollowed: true });
  }

  return mutual;
}

export async function isMutualCollaborator(userId: string): Promise<boolean> {
  if (!userId.trim()) return false;
  const mutual = await listMutualCollaborators();
  return mutual.some((u) => u.id === userId);
}
