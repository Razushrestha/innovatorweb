import { courses } from "./catalog";
import { getFeed } from "./feed-api";
import { listMutualCollaborators } from "./mutual-collaborators";
import { listFollowers, listFollowing } from "./profile-api";
import { listShopProducts } from "./shop-api";
import type { AppNotification } from "./types";

const STORE_KEY = "innovator_activity_notifications_v1";

type Snapshot = {
  followerIds: string[];
  followingIds: string[];
  mutualIds: string[];
  seenPostIds: string[];
  seenProductIds: string[];
  seenCourseIds: string[];
};

type ActivityStore = {
  initialized: boolean;
  items: AppNotification[];
  snapshot: Snapshot;
};

function emptySnapshot(): Snapshot {
  return {
    followerIds: [],
    followingIds: [],
    mutualIds: [],
    seenPostIds: [],
    seenProductIds: [],
    seenCourseIds: [],
  };
}

function canUseStorage() {
  return typeof window !== "undefined" && !!window.localStorage;
}

function loadStore(): ActivityStore {
  if (!canUseStorage()) {
    return { initialized: false, items: [], snapshot: emptySnapshot() };
  }
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) {
      return { initialized: false, items: [], snapshot: emptySnapshot() };
    }
    const parsed = JSON.parse(raw) as ActivityStore;
    return {
      initialized: parsed.initialized === true,
      items: Array.isArray(parsed.items) ? parsed.items : [],
      snapshot: { ...emptySnapshot(), ...(parsed.snapshot ?? {}) },
    };
  } catch {
    return { initialized: false, items: [], snapshot: emptySnapshot() };
  }
}

function saveStore(store: ActivityStore) {
  if (!canUseStorage()) return;
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(store));
  } catch {
    /* ignore quota */
  }
}

function makeId(prefix: string, key: string) {
  return `local:${prefix}:${key}`;
}

function upsert(
  items: AppNotification[],
  next: AppNotification,
): AppNotification[] {
  if (items.some((n) => n.id === next.id)) return items;
  return [next, ...items].slice(0, 200);
}

function displayName(user: {
  username?: string | null;
  fullName?: string | null;
}) {
  return user.fullName?.trim() || user.username?.trim() || "Someone";
}

/** Push a learn enrollment alert (called from Learn UI). */
export function recordLearnEnrollment(input: {
  courseId: string;
  courseName: string;
}) {
  const store = loadStore();
  const id = makeId("learn-enroll", input.courseId);
  store.items = upsert(store.items, {
    id,
    title: "Enrolled in a course",
    message: `You joined “${input.courseName}”. Keep learning in E-learning.`,
    type: "learn",
    isRead: false,
    createdAt: new Date().toISOString(),
    source: "local",
    targetTab: "learn",
    relatedCourseId: input.courseId,
  });
  if (!store.snapshot.seenCourseIds.includes(input.courseId)) {
    store.snapshot.seenCourseIds.push(input.courseId);
  }
  saveStore(store);
}

export function getLocalNotifications(): AppNotification[] {
  return loadStore().items;
}

export function markLocalNotificationRead(id: string) {
  const store = loadStore();
  store.items = store.items.map((n) =>
    n.id === id ? { ...n, isRead: true } : n,
  );
  saveStore(store);
}

export function markAllLocalNotificationsRead() {
  const store = loadStore();
  store.items = store.items.map((n) => ({ ...n, isRead: true }));
  saveStore(store);
}

export function deleteLocalNotification(id: string) {
  const store = loadStore();
  store.items = store.items.filter((n) => n.id !== id);
  saveStore(store);
}

/**
 * Detect collaborate / mutual posts / new shop products / new courses
 * and materialize local notifications. First run seeds baselines only
 * (no flood of historical alerts).
 */
export async function syncActivityNotifications(): Promise<AppNotification[]> {
  const store = loadStore();

  const [followersRes, followingRes, mutualRes, feedRes, productsRes] =
    await Promise.allSettled([
      listFollowers(null),
      listFollowing(null),
      listMutualCollaborators(),
      getFeed(1),
      listShopProducts(),
    ]);

  const followers =
    followersRes.status === "fulfilled" ? followersRes.value : [];
  const following =
    followingRes.status === "fulfilled" ? followingRes.value : [];
  const mutual = mutualRes.status === "fulfilled" ? mutualRes.value : [];
  const feedPosts =
    feedRes.status === "fulfilled" ? feedRes.value.results : [];
  const products =
    productsRes.status === "fulfilled" ? productsRes.value : [];

  const followerIds = followers.map((u) => u.id).filter(Boolean);
  const followingIds = following.map((u) => u.id).filter(Boolean);
  const mutualIds = mutual.map((u) => u.id).filter(Boolean);
  const postIds = feedPosts.map((p) => p.id).filter(Boolean);
  const productIds = products.map((p) => p.id).filter(Boolean);
  const courseIds = courses.map((c) => c.id);

  if (!store.initialized) {
    store.initialized = true;
    store.snapshot = {
      followerIds,
      followingIds,
      mutualIds,
      seenPostIds: postIds,
      seenProductIds: productIds,
      seenCourseIds: courseIds,
    };
    saveStore(store);
    return store.items;
  }

  const now = new Date().toISOString();
  let items = store.items;

  // New collaborators (people who started following you)
  for (const user of followers) {
    if (!user.id || store.snapshot.followerIds.includes(user.id)) continue;
    const name = displayName(user);
    items = upsert(items, {
      id: makeId("collab-in", user.id),
      title: "New collaborator",
      message: `${name} started collaborating with you.`,
      type: "collaborate",
      senderUsername: user.username,
      senderAvatar: user.avatar,
      isRead: false,
      createdAt: now,
      source: "local",
      targetTab: "profile",
      relatedUserId: user.id,
    });
  }

  // New people you started collaborating with
  for (const user of following) {
    if (!user.id || store.snapshot.followingIds.includes(user.id)) continue;
    const name = displayName(user);
    items = upsert(items, {
      id: makeId("collab-out", user.id),
      title: "Now collaborating",
      message: `You started collaborating with ${name}.`,
      type: "collaborate",
      senderUsername: user.username,
      senderAvatar: user.avatar,
      isRead: false,
      createdAt: now,
      source: "local",
      targetTab: "profile",
      relatedUserId: user.id,
    });
  }

  // Newly mutual (in both Collaborators + Collaborating)
  for (const user of mutual) {
    if (!user.id || store.snapshot.mutualIds.includes(user.id)) continue;
    const name = displayName(user);
    items = upsert(items, {
      id: makeId("mutual", user.id),
      title: "Mutual collaborators",
      message: `You and ${name} collaborate with each other — chat is unlocked.`,
      type: "collaborate",
      senderUsername: user.username,
      senderAvatar: user.avatar,
      isRead: false,
      createdAt: now,
      source: "local",
      targetTab: "chat",
      relatedUserId: user.id,
    });
  }

  const mutualSet = new Set(mutualIds);
  for (const post of feedPosts) {
    if (!post.id || store.snapshot.seenPostIds.includes(post.id)) continue;
    if (!mutualSet.has(post.userId)) continue;
    const who = post.username?.trim() || "A collaborator";
    const preview = (post.content ?? "").trim().slice(0, 120);
    items = upsert(items, {
      id: makeId("post", post.id),
      title: "New post from a collaborator",
      message: preview
        ? `${who}: ${preview}`
        : `${who} shared a new innovation.`,
      type: "post",
      senderUsername: post.username,
      senderAvatar: post.avatar,
      relatedPostId: post.id,
      isRead: false,
      createdAt: post.createdAt || now,
      source: "local",
      targetTab: "feed",
      relatedUserId: post.userId,
    });
  }

  for (const product of products) {
    if (!product.id || store.snapshot.seenProductIds.includes(product.id)) {
      continue;
    }
    if (!product.isActive) continue;
    items = upsert(items, {
      id: makeId("product", product.id),
      title: "New shop product",
      message: `${product.name} was added to the shop${
        product.category ? ` · ${product.category}` : ""
      }.`,
      type: "product",
      isRead: false,
      createdAt: now,
      source: "local",
      targetTab: "shop",
      relatedProductId: product.id,
    });
  }

  for (const course of courses) {
    if (store.snapshot.seenCourseIds.includes(course.id)) continue;
    items = upsert(items, {
      id: makeId("course", course.id),
      title: "New e-learning course",
      message: `${course.name} is now available in E-learning.`,
      type: "learn",
      isRead: false,
      createdAt: now,
      source: "local",
      targetTab: "learn",
      relatedCourseId: course.id,
    });
  }

  store.items = items;
  store.snapshot = {
    followerIds,
    followingIds,
    mutualIds,
    seenPostIds: Array.from(
      new Set([...store.snapshot.seenPostIds, ...postIds]),
    ).slice(-300),
    seenProductIds: Array.from(
      new Set([...store.snapshot.seenProductIds, ...productIds]),
    ),
    seenCourseIds: Array.from(
      new Set([...store.snapshot.seenCourseIds, ...courseIds]),
    ),
  };
  saveStore(store);
  return store.items;
}
