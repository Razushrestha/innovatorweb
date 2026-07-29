"use client";

import { BrandMark } from "@/components/BrandMark";

type EmptyProps = {
  title: string;
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function LiquidEmpty({ title, body, actionLabel, onAction }: EmptyProps) {
  return (
    <div className="liquid-glass px-6 py-14 text-center">
      <div className="mx-auto mb-4 grid place-items-center">
        <BrandMark size={56} variant="navy" />
      </div>
      <p className="font-display text-[22px] font-extrabold tracking-[-0.03em] text-navy">
        {title}
      </p>
      {body ? (
        <p className="mx-auto mt-2 max-w-[36ch] text-[14px] leading-relaxed text-muted">
          {body}
        </p>
      ) : null}
      {actionLabel && onAction ? (
        <button
          type="button"
          onClick={onAction}
          className="liquid-btn liquid-btn-dark mx-auto mt-5 max-w-[200px]"
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}

export function LiquidError({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="liquid-glass space-y-3 px-5 py-10 text-center">
      <p className="font-display text-lg font-bold text-navy">Something went wrong</p>
      <p className="text-[13.5px] text-muted">{message}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="liquid-btn liquid-btn-dark mx-auto max-w-[180px]"
        >
          Try again
        </button>
      ) : null}
    </div>
  );
}

export function LiquidLoader({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="liquid-glass flex h-56 flex-col items-center justify-center gap-3">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-navy/15 border-t-gold" />
      <p className="text-[13px] font-medium text-muted">{label}</p>
    </div>
  );
}

export type TrustItem = {
  label: string;
  icon?: "secure" | "instant" | "refund" | "certificate" | "mentor" | "star";
};

export function TrustStrip({
  items,
}: {
  items: Array<string | TrustItem>;
}) {
  const normalized = items.map((item) =>
    typeof item === "string"
      ? { label: item, icon: iconForLabel(item) }
      : { label: item.label, icon: item.icon ?? iconForLabel(item.label) },
  );

  return (
    <div className="hub-card flex flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-full px-4 py-3 sm:px-5">
      {normalized.map((item) => (
        <span
          key={item.label}
          className="inline-flex items-center gap-2 text-[12.5px] font-semibold text-navy/80"
        >
          <span className="grid h-7 w-7 place-items-center rounded-full bg-navy text-gold ring-1 ring-gold/40">
            <TrustIcon name={item.icon} />
          </span>
          {item.label}
        </span>
      ))}
    </div>
  );
}

function iconForLabel(label: string): TrustItem["icon"] {
  const t = label.toLowerCase();
  if (t.includes("secure") || t.includes("checkout")) return "secure";
  if (t.includes("instant") || t.includes("access")) return "instant";
  if (t.includes("refund") || t.includes("return")) return "refund";
  if (t.includes("certificate") || t.includes("cert")) return "certificate";
  if (t.includes("mentor") || t.includes("expert")) return "mentor";
  return "star";
}

function TrustIcon({ name }: { name?: TrustItem["icon"] }) {
  switch (name) {
    case "secure":
      return (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M7 10V8a5 5 0 0 1 10 0v2"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
          />
          <rect
            x="5"
            y="10"
            width="14"
            height="10"
            rx="2.5"
            stroke="currentColor"
            strokeWidth="1.9"
          />
          <circle cx="12" cy="15" r="1.3" fill="currentColor" />
        </svg>
      );
    case "instant":
      return (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M13 3 5.5 13.5H12l-1 7.5L19.5 10H13L13 3Z"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "refund":
      return (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M8.5 8.5H4.5V4.5"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M4.8 8.8A8 8 0 1 1 4 12"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
          />
        </svg>
      );
    case "certificate":
      return (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle cx="12" cy="10" r="5.5" stroke="currentColor" strokeWidth="1.9" />
          <path
            d="M9.5 14.5 8 21l4-2.2L16 21l-1.5-6.5"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "mentor":
      return (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle cx="12" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.9" />
          <path
            d="M5.5 19c1.3-3 3.6-4.5 6.5-4.5s5.2 1.5 6.5 4.5"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
          />
        </svg>
      );
    default:
      return (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M12 3.5 13.8 9h5.7l-4.6 3.4 1.8 5.6L12 14.8 7.3 18l1.8-5.6L4.5 9h5.7L12 3.5Z"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinejoin="round"
          />
        </svg>
      );
  }
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2 text-[12px] font-semibold uppercase tracking-[0.14em] text-muted">
      {children}
    </p>
  );
}

