"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import {
  formatRs,
  shopCategories,
  shopProducts,
  type ShopProduct,
} from "@/lib/catalog";
import { CartStore, type CartLine } from "@/lib/cart";
import { HubCarousel } from "./HubCarousel";
import { LiquidEmpty, TrustStrip } from "./ui/LiquidChrome";

export function ShopSection() {
  const [category, setCategory] = useState<(typeof shopCategories)[number]>(
    "All",
  );
  const [q, setQ] = useState("");
  const [active, setActive] = useState<ShopProduct | null>(null);
  const [showCart, setShowCart] = useState(false);
  const [items, setItems] = useState<CartLine[]>([]);
  const [added, setAdded] = useState<Record<string, boolean>>({});
  const [khaltiStep, setKhaltiStep] = useState<"idle" | "pay" | "done">(
    "idle",
  );
  const [phone, setPhone] = useState("");
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    setItems(CartStore.getItems());
  }, []);

  const filtered = useMemo(() => {
    return shopProducts.filter((p) => {
      const catOk = category === "All" || p.category === category;
      const qOk =
        !q.trim() ||
        p.name.toLowerCase().includes(q.toLowerCase()) ||
        p.description.toLowerCase().includes(q.toLowerCase()) ||
        p.category.toLowerCase().includes(q.toLowerCase());
      return catOk && qOk;
    });
  }, [category, q]);

  const count = items.reduce((n, i) => n + i.quantity, 0);

  const slides = shopProducts.slice(0, 3).map((p, i) => ({
    id: p.id,
    image: p.image,
    badge: i === 0 ? "Featured" : i === 1 ? "Popular" : "New",
    title: p.name,
    subtitle: p.description.slice(0, 64) + (p.description.length > 64 ? "…" : ""),
    priceLabel: formatRs(p.price),
  }));

  function refresh(next: CartLine[]) {
    setItems([...next]);
    setKhaltiStep("idle");
  }

  function addProduct(p: ShopProduct) {
    refresh(CartStore.add(p));
    setAdded((prev) => ({ ...prev, [p.id]: true }));
    window.setTimeout(() => {
      setAdded((prev) => ({ ...prev, [p.id]: false }));
    }, 1200);
  }

  async function payKhalti() {
    const digits = phone.replace(/\D/g, "");
    if (!(digits.length === 10 && digits.startsWith("9"))) {
      alert("Enter a valid Nepal mobile (10 digits, starts with 9).");
      return;
    }
    setPaying(true);
    await new Promise((r) => window.setTimeout(r, 1400));
    CartStore.clear();
    setItems([]);
    setPaying(false);
    setKhaltiStep("done");
  }

  if (showCart) {
    const subtotal = CartStore.subtotal(items);
    const vat = CartStore.vat(items);
    const delivery = CartStore.delivery(items);
    const total = CartStore.grandTotal(items);

    return (
      <div className="animate-fade-up space-y-4 pb-8">
        <button
          type="button"
          onClick={() => {
            setShowCart(false);
            setKhaltiStep("idle");
          }}
          className="liquid-chip"
        >
          ← Continue shopping
        </button>

        <p className="hub-title">Your cart</p>

        <div className="liquid-glass p-4 sm:p-5">
          {items.length === 0 && khaltiStep !== "done" ? (
            <LiquidEmpty
              title="Cart is empty"
              body="Browse the shop and add something you love."
              actionLabel="Browse shop"
              onAction={() => setShowCart(false)}
            />
          ) : null}

          {khaltiStep === "done" ? (
            <div className="py-10 text-center">
              <div className="mx-auto mb-3 grid h-16 w-16 place-items-center rounded-full bg-[var(--repost)] text-2xl text-white shadow-soft">
                ✓
              </div>
              <p className="font-display text-[22px] font-extrabold text-navy">
                Payment successful
              </p>
              <p className="mt-1 text-[13.5px] text-muted">
                Demo Khalti checkout complete.
              </p>
              <button
                type="button"
                className="liquid-btn liquid-btn-dark mx-auto mt-5 max-w-[200px]"
                onClick={() => {
                  setShowCart(false);
                  setKhaltiStep("idle");
                }}
              >
                Back to shop
              </button>
            </div>
          ) : null}

          {items.length > 0 && khaltiStep !== "done" ? (
            <>
              <ul className="space-y-2.5">
                {items.map((line, idx) => (
                  <li
                    key={line.product.id}
                    className="liquid-panel flex items-center gap-3 p-2.5"
                  >
                    <span className="w-5 text-center text-[12px] font-bold text-muted">
                      {idx + 1}
                    </span>
                    <div className="relative h-14 w-14 overflow-hidden rounded-[14px]">
                      <Image
                        src={line.product.image}
                        alt=""
                        fill
                        className="object-cover"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-navy">
                        {line.product.name}
                      </p>
                      <p className="text-[12.5px] text-muted">
                        {formatRs(line.product.price)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        className="liquid-chip !px-2.5"
                        onClick={() =>
                          refresh(
                            CartStore.setQty(
                              line.product.id,
                              line.quantity - 1,
                            ),
                          )
                        }
                      >
                        −
                      </button>
                      <span className="w-6 text-center text-sm font-bold">
                        {line.quantity}
                      </span>
                      <button
                        type="button"
                        className="liquid-chip !px-2.5"
                        onClick={() =>
                          refresh(
                            CartStore.setQty(
                              line.product.id,
                              line.quantity + 1,
                            ),
                          )
                        }
                      >
                        +
                      </button>
                    </div>
                  </li>
                ))}
              </ul>

              <div className="mt-5 space-y-1.5 border-t border-white/55 pt-4 text-[13.5px]">
                <Row label="Subtotal" value={formatRs(subtotal)} />
                <Row label="VAT (13%)" value={formatRs(vat)} />
                <Row label="Delivery (Nepal)" value={formatRs(delivery)} />
                <Row label="Total" value={formatRs(total)} bold />
              </div>

              {khaltiStep === "idle" ? (
                <button
                  type="button"
                  className="liquid-btn khalti-btn mt-4 w-full"
                  onClick={() => setKhaltiStep("pay")}
                >
                  Pay with Khalti
                </button>
              ) : (
                <div className="mt-4 space-y-3">
                  <label className="block space-y-1.5">
                    <span className="pl-1 text-[12.5px] font-semibold text-muted">
                      Khalti mobile
                    </span>
                    <input
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="98XXXXXXXX"
                      inputMode="tel"
                      className="glass-field"
                    />
                  </label>
                  <button
                    type="button"
                    disabled={paying}
                    className="liquid-btn khalti-btn w-full"
                    onClick={() => void payKhalti()}
                  >
                    {paying ? "Processing…" : `Confirm · ${formatRs(total)}`}
                  </button>
                </div>
              )}
            </>
          ) : null}
        </div>
      </div>
    );
  }

  if (active) {
    const justAdded = !!added[active.id];
    return (
      <div className="animate-fade-up space-y-4 pb-8">
        <button
          type="button"
          onClick={() => setActive(null)}
          className="liquid-chip"
        >
          ← Shop
        </button>

        <div className="liquid-glass overflow-hidden">
          <div className="relative aspect-[16/10]">
            <Image
              src={active.image}
              alt={active.name}
              fill
              className="object-cover"
            />
          </div>
          <div className="p-5 sm:p-6">
            <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-muted">
              {active.category}
            </p>
            <h2 className="mt-1 font-display text-[26px] font-extrabold tracking-[-0.03em] text-navy">
              {active.name}
            </h2>
            <div className="mt-2 flex items-center gap-2">
              <span className="liquid-chip !py-1">★ {active.rating}</span>
              <span className="liquid-chip !py-1">Instant delivery</span>
            </div>
            <p className="mt-3 text-[14.5px] leading-relaxed text-ink/80">
              {active.description}
            </p>
            <ul className="mt-4 space-y-1.5 text-[13px]">
              {active.specs.map((s) => (
                <li
                  key={s.label}
                  className="liquid-panel flex justify-between gap-3 px-3 py-2"
                >
                  <span className="text-muted">{s.label}</span>
                  <span className="font-semibold text-navy">{s.value}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="liquid-glass sticky bottom-24 z-20 flex items-center justify-between gap-3 p-3.5 lg:bottom-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
              Price
            </p>
            <p
              className={`font-display text-[22px] font-extrabold ${
                justAdded ? "text-[var(--repost)]" : "text-navy"
              }`}
            >
              {formatRs(active.price)}
            </p>
          </div>
          <button
            type="button"
            onClick={() => addProduct(active)}
            className={`liquid-btn max-w-[200px] ${
              justAdded ? "khalti-btn !bg-[var(--repost)]" : "liquid-btn-dark"
            }`}
          >
            {justAdded ? "Added ✓" : "Add to cart"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="hub-list relative space-y-5 pb-24 lg:pb-8">
      <div className="stagger-in" style={{ animationDelay: "0ms" }}>
        <HubCarousel
          slides={slides}
          onOpen={(id) => {
            const p = shopProducts.find((x) => x.id === id);
            if (p) setActive(p);
          }}
        />
      </div>

      <div className="stagger-in" style={{ animationDelay: "60ms" }}>
        <TrustStrip
          items={[
            { label: "Secure checkout", icon: "secure" },
            { label: "Instant access", icon: "instant" },
            { label: "7 days refund", icon: "refund" },
          ]}
        />
      </div>

      <div className="stagger-in relative" style={{ animationDelay: "100ms" }}>
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-navy/35">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
            <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8" />
            <path d="M16 16l4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </span>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search products…"
          className="w-full rounded-full border border-navy/[0.07] bg-white py-3 pl-10 pr-4 text-[14px] text-navy outline-none transition placeholder:text-muted focus:border-gold/50 focus:ring-2 focus:ring-gold/20"
        />
      </div>

      <div className="stagger-in" style={{ animationDelay: "140ms" }}>
        <p className="hub-title mb-3">Categories</p>
        <div className="flex flex-wrap gap-2">
          {shopCategories.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              className={`liquid-chip ${
                category === c ? "liquid-chip-active" : ""
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="stagger-in" style={{ animationDelay: "180ms" }}>
        <div className="mb-3 flex items-end justify-between gap-2">
          <p className="hub-title !text-left">Products</p>
          <p className="text-[12.5px] font-semibold text-muted">
            {filtered.length} item{filtered.length === 1 ? "" : "s"}
          </p>
        </div>

        {filtered.length === 0 ? (
          <LiquidEmpty
            title="No products"
            body="Try another category or keyword."
            actionLabel={q ? "Clear search" : undefined}
            onAction={q ? () => setQ("") : undefined}
          />
        ) : (
          <div className="hub-grid">
            {filtered.map((p, i) => {
              const justAdded = !!added[p.id];
              return (
                <article
                  key={p.id}
                  className="hub-card stagger-in overflow-hidden rounded-[22px]"
                  style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
                >
                  <button
                    type="button"
                    onClick={() => setActive(p)}
                    className="liquid-press w-full text-left"
                  >
                    <div className="relative aspect-[0.95] p-2">
                      <div className="relative h-full overflow-hidden rounded-[17px]">
                        <Image
                          src={p.image}
                          alt={p.name}
                          fill
                          className="object-cover"
                        />
                      </div>
                      <span className="absolute right-3.5 top-3.5 rounded-full bg-white/92 px-2 py-0.5 text-[10px] font-bold text-navy shadow-soft">
                        ★ {p.rating}
                      </span>
                    </div>
                    <div className="px-3 pb-2">
                      <p className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted">
                        {p.category}
                      </p>
                      <h3 className="mt-0.5 line-clamp-2 font-display text-[14.5px] font-bold leading-snug text-navy">
                        {p.name}
                      </h3>
                    </div>
                  </button>
                  <div className="flex items-center justify-between gap-2 px-3 pb-3">
                    <span
                      className={`text-[13.5px] font-bold ${
                        justAdded ? "text-[var(--repost)]" : "text-navy"
                      }`}
                    >
                      {formatRs(p.price)}
                    </span>
                    <button
                      type="button"
                      aria-label="Add to cart"
                      onClick={() => addProduct(p)}
                      className={`liquid-press grid h-8 w-8 place-items-center rounded-[10px] text-[16px] font-bold text-white shadow-soft ${
                        justAdded ? "bg-[var(--repost)]" : "bg-navy"
                      }`}
                    >
                      {justAdded ? "✓" : "+"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => setShowCart(true)}
        className="hub-float-cart liquid-press"
        aria-label="Open cart"
      >
        <BagIcon />
        {count > 0 ? (
          <span className="hub-badge">{count > 99 ? "99+" : count}</span>
        ) : null}
      </button>
    </div>
  );
}

function Row({
  label,
  value,
  bold,
}: {
  label: string;
  value: string;
  bold?: boolean;
}) {
  return (
    <div
      className={`flex justify-between gap-3 ${
        bold
          ? "pt-1 font-display text-[16px] font-bold text-navy"
          : "text-ink/75"
      }`}
    >
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

function BagIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M7 8V7a5 5 0 0 1 10 0v1"
        stroke="#071323"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M5.5 8h13l-.8 11.2A2 2 0 0 1 15.7 21H8.3a2 2 0 0 1-2-1.8L5.5 8Z"
        stroke="#071323"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}
