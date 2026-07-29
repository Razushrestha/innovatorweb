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
import { logout } from "@/lib/auth-api";
import { AuthSession } from "@/lib/auth-session";

export default function AppShellPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<AppTab>("feed");
  const [email, setEmail] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [feedKey, setFeedKey] = useState(0);
  const [authorView, setAuthorView] = useState<{
    userId: string;
    name?: string | null;
  } | null>(null);

  useEffect(() => {
    if (!AuthSession.isSignedIn()) {
      router.replace("/login");
      return;
    }
    const session = AuthSession.load();
    setEmail(session.email);
    setUsername(session.username);
    setReady(true);
  }, [router]);

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
      <div className="mx-auto flex h-dvh w-full max-w-[1280px] overflow-hidden">
        <SideNav
          active={tab}
          onChange={(next) => {
            setAuthorView(null);
            setTab(next);
          }}
          email={email}
          onLogout={() => void onLogout()}
        />

        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <MobileTopBar
            title={authorView ? "Profile" : tabLabel(tab)}
            onLogoClick={() => {
              setAuthorView(null);
              setTab("feed");
            }}
          />

          <div className="flex min-h-0 flex-1 justify-center gap-8 overflow-hidden px-4 pt-4 sm:px-6 lg:px-8 lg:pt-6">
            <main
              className={`liquid-scroll min-h-0 w-full min-w-0 flex-1 overflow-y-auto overscroll-contain pb-28 lg:pb-8 ${
                tab === "chat" && !authorView
                  ? "max-w-[920px]"
                  : "max-w-[680px]"
              }`}
            >
              {authorView ? (
                <AuthorProfileSection
                  authUserId={authorView.userId}
                  fallbackName={authorView.name}
                  onBack={() => setAuthorView(null)}
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

              {!authorView && tab === "search" ? <SearchSection /> : null}
              {!authorView && tab === "chat" ? <ChatSection /> : null}
              {!authorView && tab === "learn" ? <LearnSection /> : null}
              {!authorView && tab === "shop" ? <ShopSection /> : null}
              {!authorView && tab === "profile" ? <ProfileSection /> : null}
              {!authorView && tab === "notifications" ? (
                <NotificationsSection />
              ) : null}

              {!authorView && tab === "menu" ? (
                <div className="max-w-md space-y-4 pb-6">
                  <section className="liquid-glass space-y-3 p-5">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gold">
                        Account
                      </p>
                      <h2 className="mt-1 truncate font-display text-[22px] font-extrabold tracking-[-0.03em] text-navy">
                        {username || "Member"}
                      </h2>
                      <p className="mt-0.5 truncate text-[13px] text-muted">
                        {email}
                      </p>
                    </div>
                    <div className="liquid-divider" />
                    <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-muted">
                      Jump to
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {(
                        [
                          ["profile", "Profile"],
                          ["notifications", "Alerts"],
                          ["learn", "Learn"],
                          ["shop", "Shop"],
                          ["chat", "Chat"],
                          ["search", "Search"],
                        ] as const
                      ).map(([id, label]) => (
                        <button
                          key={id}
                          type="button"
                          onClick={() => {
                            setAuthorView(null);
                            setTab(id);
                          }}
                          className="liquid-chip justify-center py-2.5"
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <div className="liquid-divider" />
                    <button
                      type="button"
                      onClick={() => void onLogout()}
                      className="liquid-btn liquid-btn-dark w-full"
                    >
                      Log out
                    </button>
                  </section>
                </div>
              ) : null}
            </main>

            <aside className="hidden h-full w-[280px] shrink-0 overflow-y-auto overscroll-contain pb-8 xl:block">
              <div className="space-y-4">
                <div className="liquid-glass p-5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gold">
                    Innovator
                  </p>
                  <p className="mt-1 font-display text-[20px] font-extrabold tracking-[-0.03em] text-navy">
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
                    className="liquid-btn liquid-btn-dark mt-4 !min-h-0 px-4 py-2.5 text-[13px]"
                  >
                    Create post
                  </button>
                </div>

                <div className="liquid-glass p-4">
                  <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-muted">
                    Shortcuts
                  </p>
                  <div className="mt-3 space-y-1">
                    {(
                      [
                        ["search", "Find people & posts"],
                        ["notifications", "Check alerts"],
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
                        className="liquid-press flex w-full items-center justify-between rounded-[16px] border border-transparent px-2.5 py-2.5 text-left text-[14px] font-medium text-navy/80 hover:border-white/70 hover:bg-white/55"
                      >
                        {label}
                        <span className="text-muted">→</span>
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
    case "menu":
      return "More";
  }
}

