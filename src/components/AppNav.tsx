"use client";

import Image from "next/image";

export type AppTab =
  | "feed"
  | "chat"
  | "learn"
  | "search"
  | "post"
  | "shop"
  | "profile"
  | "notifications"
  | "menu";

type NavItem = {
  id: AppTab;
  label: string;
  icon: React.ReactNode;
};

const items: NavItem[] = [
  { id: "feed", label: "Home", icon: <IconHome /> },
  { id: "search", label: "Search", icon: <IconSearch /> },
  { id: "post", label: "Create", icon: <IconPlus /> },
  { id: "chat", label: "Chat", icon: <IconChat /> },
  { id: "learn", label: "Learn", icon: <IconLearn /> },
  { id: "shop", label: "Shop", icon: <IconShop /> },
  { id: "notifications", label: "Alerts", icon: <IconBell /> },
  { id: "profile", label: "Profile", icon: <IconUser /> },
  { id: "menu", label: "More", icon: <IconMore /> },
];

type Props = {
  active: AppTab;
  onChange: (tab: AppTab) => void;
  email?: string | null;
  onLogout?: () => void;
};

export function SideNav({ active, onChange, email, onLogout }: Props) {
  return (
    <aside className="liquid-nav-shell hidden h-dvh w-[248px] shrink-0 flex-col overflow-y-auto px-4 py-6 lg:flex xl:w-[272px]">
      <button
        type="button"
        onClick={() => onChange("feed")}
        className="liquid-press group mb-8 flex items-center gap-3 px-2 text-left"
      >
        <span className="relative h-12 w-12 overflow-hidden rounded-[18px] bg-white/90 shadow-soft ring-1 ring-white transition duration-300 group-hover:scale-[1.03]">
          <Image
            src="/center_logo.png"
            alt=""
            fill
            sizes="48px"
            className="object-contain p-1.5"
            priority
          />
        </span>
        <span>
          <span className="block font-display text-[28px] font-extrabold leading-none tracking-[-0.05em] text-navy">
            Innovator
          </span>
          <span className="mt-1 block text-[12px] font-medium text-muted">
            Your creative network
          </span>
        </span>
      </button>

      <nav className="flex flex-1 flex-col gap-1.5">
        {items.map((item) => {
          const selected = active === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onChange(item.id)}
              className={`nav-item relative flex items-center gap-3 rounded-[20px] px-3 py-3 text-left ${
                selected
                  ? "nav-item-liquid-active"
                  : "nav-item-liquid text-ink/75"
              }`}
            >
              {selected ? (
                <span className="absolute left-0 top-1/2 h-7 w-1 -translate-y-1/2 rounded-r-full bg-gold" />
              ) : null}
              <span
                className={`grid h-9 w-9 place-items-center rounded-[14px] transition ${
                  selected
                    ? "bg-white/10 text-gold"
                    : "bg-white/55 text-navy shadow-soft"
                }`}
              >
                {item.icon}
              </span>
              <span className="font-display text-[16px] font-semibold tracking-[-0.02em]">
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>

      <div className="liquid-glass mt-4 p-4">
        <p className="truncate text-[13px] font-semibold text-navy">
          {email || "Signed in"}
        </p>
        <p className="mt-0.5 text-[12px] text-muted">Account</p>
        {onLogout ? (
          <button
            type="button"
            onClick={onLogout}
            className="mt-3 text-[13px] font-semibold text-navy/70 underline-offset-2 hover:text-navy hover:underline"
          >
            Log out
          </button>
        ) : null}
      </div>
    </aside>
  );
}

export function MobileTopBar({
  title,
  onLogoClick,
}: {
  title: string;
  onLogoClick: () => void;
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-white/50 bg-white/45 px-4 py-3 backdrop-blur-2xl lg:hidden">
      <div className="mx-auto flex max-w-[720px] items-center gap-3">
        <button
          type="button"
          onClick={onLogoClick}
          className="liquid-press relative h-10 w-10 shrink-0 overflow-hidden rounded-[14px] bg-white/90 shadow-soft ring-1 ring-white"
          aria-label="Innovator home"
        >
          <Image
            src="/center_logo.png"
            alt="Innovator"
            fill
            sizes="40px"
            className="object-contain p-1"
            priority
          />
        </button>
        <div className="min-w-0">
          <p className="font-display text-[20px] font-extrabold leading-none tracking-[-0.04em] text-navy">
            Innovator
          </p>
          <p className="mt-0.5 truncate text-[12px] text-muted">{title}</p>
        </div>
      </div>
    </header>
  );
}

export function MobileBottomNav({ active, onChange }: Props) {
  const primary = items.filter((i) =>
    ["feed", "search", "post", "chat", "profile"].includes(i.id),
  );

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden">
      <div className="liquid-glass mx-auto flex max-w-[520px] items-center justify-between gap-1 !rounded-[28px] px-2 py-2">
        {primary.map((item) => {
          const selected = active === item.id;
          const isCreate = item.id === "post";
          if (isCreate) {
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onChange(item.id)}
                className="liquid-press -mt-5 grid h-14 w-14 place-items-center rounded-[20px] bg-navy text-gold shadow-soft ring-1 ring-gold/60"
                aria-label="Create"
              >
                {item.icon}
              </button>
            );
          }
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onChange(item.id)}
              className={`liquid-press flex min-w-0 flex-1 flex-col items-center gap-1 rounded-[16px] px-1 py-1.5 ${
                selected ? "text-navy" : "text-ink/45"
              }`}
            >
              <span
                className={`grid h-9 w-9 place-items-center rounded-[14px] transition ${
                  selected
                    ? "bg-gold/30 text-navy shadow-soft ring-1 ring-gold/40"
                    : ""
                }`}
              >
                {item.icon}
              </span>
              <span className="text-[10.5px] font-semibold tracking-[-0.01em]">
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

function IconHome() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconSearch() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M16 16l4 4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconPlus() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 5v14M5 12h14"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconChat() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 6.5A2.5 2.5 0 0 1 7.5 4h9A2.5 2.5 0 0 1 19 6.5v7A2.5 2.5 0 0 1 16.5 16H10l-4 3v-3.2A2.5 2.5 0 0 1 5 13.5v-7Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconLearn() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M3 8.5 12 4l9 4.5-9 4.5L3 8.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M7 11.5v4.2c0 1.2 2.2 2.8 5 2.8s5-1.6 5-2.8v-4.2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconShop() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6 8h12l-1 11H7L6 8Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M9 8a3 3 0 0 1 6 0"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconUser() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M5 19.5c1.4-3 3.8-4.5 7-4.5s5.6 1.5 7 4.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconBell() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6 9.5a6 6 0 1 1 12 0c0 3.2.8 4.5 1.5 5.5H4.5C5.2 14 6 12.7 6 9.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M10 18.5a2 2 0 0 0 4 0"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconMore() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="6" cy="12" r="1.6" fill="currentColor" />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" />
      <circle cx="18" cy="12" r="1.6" fill="currentColor" />
    </svg>
  );
}
