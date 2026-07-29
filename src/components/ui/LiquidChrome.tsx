"use client";

type EmptyProps = {
  title: string;
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function LiquidEmpty({ title, body, actionLabel, onAction }: EmptyProps) {
  return (
    <div className="liquid-glass px-6 py-14 text-center">
      <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-[18px] bg-navy text-gold shadow-soft ring-1 ring-gold/40">
        ✦
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

export function TrustStrip({ items }: { items: string[] }) {
  return (
    <div className="liquid-glass flex flex-wrap items-center justify-between gap-2 px-4 py-3">
      {items.map((item) => (
        <span
          key={item}
          className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-navy/75"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-gold" />
          {item}
        </span>
      ))}
    </div>
  );
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2 text-[12px] font-semibold uppercase tracking-[0.14em] text-muted">
      {children}
    </p>
  );
}

