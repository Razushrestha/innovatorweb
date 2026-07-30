"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  MobileBottomNav,
  MobileTopBar,
  SideNav,
  type AppTab,
} from "@/components/AppNav";
import { AuthorProfileSection } from "@/components/AuthorProfileSection";
import { BlobBackground } from "@/components/BlobBackground";
import { ChatSection } from "@/components/ChatSection";
import { ComposePost } from "@/components/ComposePost";
import { FeedSection } from "@/components/FeedSection";
import { LearnSection } from "@/components/LearnSection";
import { NotificationsSection } from "@/components/NotificationsSection";
import { ProfileSection } from "@/components/ProfileSection";
import { SearchSection } from "@/components/SearchSection";
import { ShopSection } from "@/components/ShopSection";
import { BrandMark } from "@/components/BrandMark";
import { logout } from "@/lib/auth-api";
import { AuthSession } from "@/lib/auth-session";
import { getUnreadNotificationCount } from "@/lib/notifications-api";
import { sendPresenceHeartbeat } from "@/lib/presence";
import type { ChatPeerRequest } from "@/lib/types";
import type { NotificationOpenTarget } from "@/components/NotificationsSection";

export default function AppShellPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<AppTab>("feed");
  const [email, setEmail] = useState<string | null>(null);
  const [feedKey, setFeedKey] = useState(0);
  const [chatPeer, setChatPeer] = useState<ChatPeerRequest | null>(null);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [authorView, setAuthorView] = useState<{
    userId: string;
    name?: string | null;
  } | null>(null);

  function startChat(peer: ChatPeerRequest) {
    setAuthorView(null);
    setChatPeer(peer);
    setTab("chat");
  }

  function openNotificationTarget(target: NotificationOpenTarget) {
    setAuthorView(null);
    if (target.userId && (target.tab === "profile" || !target.tab)) {
      setAuthorView({ userId: target.userId });
      return;
    }
    if (target.userId && target.tab === "chat") {
      startChat({ userId: target.userId });
      return;
    }
    if (target.tab === "feed" || target.tab === "shop" || target.tab === "learn") {
      setTab(target.tab);
      return;
    }
    if (target.tab) setTab(target.tab as AppTab);
  }

  useEffect(() => {
    if (!AuthSession.isSignedIn()) {
      router.replace("/login");
      return;
    }
    const session = AuthSession.load();
    setEmail(session.email);
    setReady(true);
  }, [router]);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    const refresh = () => {
      void getUnreadNotificationCount().then((n) => {
        if (!cancelled) setUnreadNotifications(n);
      });
    };
    refresh();
    const timer = window.setInterval(refresh, 60000);
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [ready]);

  // Presence heartbeat so chat peers can show a green online dot.
  useEffect(() => {
    if (!ready) return;
    const userId = AuthSession.load().userId;
    if (!userId) return;
    void sendPresenceHeartbeat(userId);
    const beat = window.setInterval(() => {
      void sendPresenceHeartbeat(userId);
    }, 25000);
    const onFocus = () => void sendPresenceHeartbeat(userId);
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(beat);
      window.removeEventListener("focus", onFocus);
    };
  }, [ready]);

  async function onLogout() {
    await logout();
    router.replace("/login");
  }

  if (!ready) {
    return (
      <BlobBackground animate={false}>
        <div className="flex min-h-dvh items-center justify-center">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-navy/20 border-t-gold" />
        </div>
      </BlobBackground>
    );
  }

  return (
    <BlobBackground animate={false} className="!h-dvh !min-h-0 !overflow-hidden">
      <div className="app-surface mx-auto flex h-dvh w-full max-w-[1360px] items-stretch gap-5 overflow-hidden px-3 sm:px-4 lg:gap-7 lg:px-6 xl:gap-8 xl:px-8">
        <SideNav
          active={tab}
          onChange={(next) => {
            setAuthorView(null);
            setTab(next);
          }}
          email={email}
          onLogout={() => void onLogout()}
          unreadNotifications={unreadNotifications}
        />

        <div className="app-surface flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <MobileTopBar
            title={authorView ? "Profile" : tabLabel(tab)}
            onLogoClick={() => {
              setAuthorView(null);
              setTab("feed");
            }}
          />

          <div className="app-surface flex min-h-0 flex-1 justify-center gap-6 overflow-hidden pt-3 lg:gap-8 lg:pt-5 xl:gap-10">
            <main
              className={`app-surface liquid-scroll min-h-0 w-full min-w-0 flex-1 overflow-y-auto overscroll-contain px-1 pb-28 sm:px-0 lg:pb-8 ${
                tab === "chat" && !authorView
                  ? "max-w-[980px]"
                  : "max-w-[640px]"
              }`}
            >
              {authorView ? (
                <AuthorProfileSection
                  authUserId={authorView.userId}
                  fallbackName={authorView.name}
                  onBack={() => setAuthorView(null)}
                  onOpenAuthor={(userId, name) =>
                    setAuthorView({ userId, name })
                  }
                  onStartChat={startChat}
                />
              ) : null}

              {!authorView && tab === "feed" ? (
                <FeedSection
                  refreshKey={feedKey}
                  onCompose={() => setTab("post")}
                  onOpenAuthor={(userId, name) =>
                    setAuthorView({ userId, name })
                  }
                />
              ) : null}

              {!authorView && tab === "post" ? (
                <ComposePost
                  onPublished={() => {
                    setFeedKey((k) => k + 1);
                    setTab("feed");
                  }}
                />
              ) : null}

              {!authorView && tab === "search" ? (
                <SearchSection
                  onOpenAuthor={(userId, name) =>
                    setAuthorView({ userId, name })
                  }
                />
              ) : null}
              {!authorView && tab === "chat" ? (
                <ChatSection
                  pendingPeer={chatPeer}
                  onPendingPeerConsumed={() => setChatPeer(null)}
                />
              ) : null}
              {!authorView && tab === "learn" ? <LearnSection /> : null}
              {!authorView && tab === "shop" ? <ShopSection /> : null}
              {!authorView && tab === "profile" ? (
                <ProfileSection
                  onOpenAuthor={(userId, name) =>
                    setAuthorView({ userId, name })
                  }
                  onStartChat={startChat}
                />
              ) : null}
              {!authorView && tab === "notifications" ? (
                <NotificationsSection
                  onOpenTarget={openNotificationTarget}
                  onUnreadChange={setUnreadNotifications}
                />
              ) : null}
            </main>

            <aside className="app-surface hidden h-full w-[268px] shrink-0 py-5 xl:block">
              <div className="liquid-rail liquid-scroll flex h-full min-h-0 flex-col overflow-y-auto overscroll-contain p-4">
                <div className="px-1 pb-4">
                  <div className="mb-3 flex items-center gap-2.5">
                    <BrandMark size={36} variant="soft" />
                    <div className="min-w-0">
                      <p className="font-display text-[16px] font-extrabold tracking-[-0.03em] text-navy">
                        Innovator
                      </p>
                      <p className="text-[11px] font-medium text-muted">
                        Workspace
                      </p>
                    </div>
                  </div>
                  <p className="mt-1.5 font-display text-[19px] font-extrabold leading-snug tracking-[-0.03em] text-navy">
                    Build with the community
                  </p>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
                    Share ideas, learn faster, and grow with makers.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setAuthorView(null);
                      setTab("post");
                    }}
                    className="liquid-btn liquid-btn-dark mt-4 !min-h-0 w-full px-4 py-2.5 text-[13px]"
                  >
                    Create post
                  </button>
                </div>

                <div className="liquid-divider" />

                <div className="pt-4">
                  <p className="px-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
                    Shortcuts
                  </p>
                  <div className="mt-2 space-y-0.5">
                    {(
                      [
                        ["search", "Find people & posts"],
                        ["notifications", "Check notifications"],
                        ["learn", "Browse courses"],
                        ["shop", "Explore shop"],
                        ["chat", "Open messages"],
                        ["profile", "Edit profile"],
                      ] as const
                    ).map(([id, label]) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => {
                          setAuthorView(null);
                          setTab(id);
                        }}
                        className="liquid-press flex w-full items-center justify-between rounded-[14px] px-2.5 py-2.5 text-left text-[13.5px] font-medium text-navy/75 transition hover:bg-white/75 hover:text-navy"
                      >
                        {label}
                        <span className="text-[12px] text-muted/70">→</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </div>

      <MobileBottomNav
        active={tab}
        onChange={(next) => {
          setAuthorView(null);
          setTab(next);
        }}
      />
    </BlobBackground>
  );
}

function tabLabel(tab: AppTab) {
  switch (tab) {
    case "feed":
      return "Home";
    case "chat":
      return "Chat";
    case "learn":
      return "E-learning";
    case "search":
      return "Search";
    case "post":
      return "Create";
    case "shop":
      return "Shop";
    case "profile":
      return "Profile";
    case "notifications":
      return "Notifications";
  }
}

