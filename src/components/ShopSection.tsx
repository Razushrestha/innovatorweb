"use client";

import Image from "next/image";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { ApiException } from "@/lib/api-client";
import {
  addShopCartItem,
  checkoutShop,
  formatRs,
  getShopCart,
  getShopProductWithGallery,
  initiateKhaltiPayment,
  listShopCategories,
  listShopProducts,
  removeShopCartItem,
  updateShopCartItem,
  type ShopCartItem,
  type ShopCategory,
  type ShopProduct,
} from "@/lib/shop-api";
import { HubCarousel } from "./HubCarousel";
import { LiquidEmpty, TrustStrip } from "./ui/LiquidChrome";

type CheckoutForm = {
  fullName: string;
  address: string;
  phoneNumber: string;
  notes: string;
};

export function ShopSection() {
  const [categories, setCategories] = useState<ShopCategory[]>([]);
  const [categorySlug, setCategorySlug] = useState("all");
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [products, setProducts] = useState<ShopProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<ShopProduct | null>(null);
  const [showCart, setShowCart] = useState(false);
  const [items, setItems] = useState<ShopCartItem[]>([]);
  const [cartBusy, setCartBusy] = useState(false);
  const [added, setAdded] = useState<Record<string, boolean>>({});
  const [step, setStep] = useState<"cart" | "checkout" | "done">("cart");
  const [form, setForm] = useState<CheckoutForm>({
    fullName: "",
    address: "",
    phoneNumber: "",
    notes: "",
  });
  const [paying, setPaying] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [orderTotal, setOrderTotal] = useState(0);

  const imageByProduct = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of products) {
      if (p.image) map.set(p.id, p.image);
    }
    if (active?.image) map.set(active.id, active.image);
    return map;
  }, [products, active]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const cats = await listShopCategories();
        if (!cancelled) setCategories(cats);
      } catch {
        if (!cancelled) setCategories([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => setSearch(q.trim()), 280);
    return () => window.clearTimeout(t);
  }, [q]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const list = await listShopProducts({
          categorySlug: categorySlug === "all" ? undefined : categorySlug,
          search: search || undefined,
        });
        if (!cancelled) setProducts(list);
      } catch (e) {
        if (!cancelled) {
          setProducts([]);
          setError(
            e instanceof ApiException ? e.message : "Failed to load products",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [categorySlug, search]);

  async function refreshCart() {
    const next = await getShopCart(imageByProduct);
    setItems(
      next.map((line) => ({
        ...line,
        image: line.image || imageByProduct.get(line.productId) || "",
      })),
    );
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const next = await getShopCart(imageByProduct);
        if (!cancelled) {
          setItems(
            next.map((line) => ({
              ...line,
              image: line.image || imageByProduct.get(line.productId) || "",
            })),
          );
        }
      } catch {
        // Cart requires auth — ignore until user is signed in.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [imageByProduct]);

  const count = items.reduce((n, i) => n + i.quantity, 0);
  const subtotal = items.reduce((n, i) => n + i.price * i.quantity, 0);

  const slides = products
    .filter((p) => !!p.image)
    .slice(0, 3)
    .map((p, i) => ({
      id: p.id,
      image: p.image,
      badge: i === 0 ? "Featured" : i === 1 ? "Popular" : "New",
      title: p.name,
      subtitle:
        p.description.slice(0, 64) + (p.description.length > 64 ? "…" : ""),
      priceLabel: formatRs(p.price),
    }));

  function flashAdded(productId: string) {
    setAdded((prev) => ({ ...prev, [productId]: true }));
    window.setTimeout(() => {
      setAdded((prev) => ({ ...prev, [productId]: false }));
    }, 1200);
  }

  async function addProduct(p: ShopProduct) {
    setCartBusy(true);
    setError(null);
    try {
      await addShopCartItem(p.id);
      await refreshCart();
      flashAdded(p.id);
    } catch (e) {
      setError(e instanceof ApiException ? e.message : "Could not add to cart");
    } finally {
      setCartBusy(false);
    }
  }

  async function changeQty(line: ShopCartItem, quantity: number) {
    setCartBusy(true);
    setError(null);
    try {
      if (quantity <= 0) await removeShopCartItem(line.id);
      else await updateShopCartItem(line.id, quantity);
      await refreshCart();
    } catch (e) {
      setError(e instanceof ApiException ? e.message : "Could not update cart");
    } finally {
      setCartBusy(false);
    }
  }

  async function openProduct(id: string) {
    setError(null);
    const cached = products.find((p) => p.id === id);
    if (cached) setActive(cached);
    try {
      const detail = await getShopProductWithGallery(id);
      setActive(detail);
      setProducts((prev) =>
        prev.map((p) =>
          p.id === id
            ? { ...p, image: detail.image, images: detail.images }
            : p,
        ),
      );
    } catch (e) {
      if (!cached) {
        setError(
          e instanceof ApiException ? e.message : "Could not open product",
        );
      }
    }
  }

  async function placeOrder() {
    const phone = form.phoneNumber.replace(/\D/g, "");
    if (!form.fullName.trim() || !form.address.trim()) {
      alert("Enter your full name and delivery address.");
      return;
    }
    if (!(phone.length === 10 && phone.startsWith("9"))) {
      alert("Enter a valid Nepal mobile (10 digits, starts with 9).");
      return;
    }

    setPaying(true);
    setError(null);
    try {
      const order = await checkoutShop({
        fullName: form.fullName.trim(),
        address: form.address.trim(),
        phoneNumber: phone,
        notes: form.notes.trim(),
        paymentType: "khalti",
      });
      setOrderId(order.orderId);
      setOrderTotal(order.grandTotal);

      if (order.requiresKhaltiPayment && order.orderId) {
        const pay = await initiateKhaltiPayment(order.orderId);
        if (pay.paymentUrl) {
          window.open(pay.paymentUrl, "_blank", "noopener,noreferrer");
        }
      }

      setItems([]);
      setStep("done");
    } catch (e) {
      setError(
        e instanceof ApiException ? e.message : "Checkout failed. Try again.",
      );
    } finally {
      setPaying(false);
    }
  }

  if (showCart) {
    return (
      <div className="animate-fade-up space-y-4 pb-8">
        <button
          type="button"
          onClick={() => {
            setShowCart(false);
            setStep("cart");
          }}
          className="liquid-chip"
        >
          ← Continue shopping
        </button>

        <p className="hub-title">
          {step === "checkout"
            ? "Checkout"
            : step === "done"
              ? "Order placed"
              : "Your cart"}
        </p>

        {error ? (
          <p className="rounded-[16px] bg-red-50 px-3 py-2 text-[13px] text-red-700">
            {error}
          </p>
        ) : null}

        <div className="liquid-glass p-4 sm:p-5">
          {step === "done" ? (
            <div className="py-10 text-center">
              <div className="mx-auto mb-3 grid h-16 w-16 place-items-center rounded-full bg-[var(--repost)] text-2xl text-white shadow-soft">
                ✓
              </div>
              <p className="font-display text-[22px] font-extrabold text-navy">
                Order placed
              </p>
              <p className="mt-1 text-[13.5px] text-muted">
                {orderId
                  ? `Order ${orderId.slice(0, 8)}… · ${formatRs(orderTotal)}`
                  : "Complete payment in the Khalti tab if it opened."}
              </p>
              <button
                type="button"
                className="liquid-btn liquid-btn-dark mx-auto mt-5 max-w-[200px]"
                onClick={() => {
                  setShowCart(false);
                  setStep("cart");
                  setOrderId(null);
                }}
              >
                Back to shop
              </button>
            </div>
          ) : null}

          {step === "cart" && items.length === 0 ? (
            <LiquidEmpty
              title="Cart is empty"
              body="Browse the shop and add something you love."
              actionLabel="Browse shop"
              onAction={() => setShowCart(false)}
            />
          ) : null}

          {step === "cart" && items.length > 0 ? (
            <>
              <ul className="space-y-2.5">
                {items.map((line, idx) => (
                  <li
                    key={line.id}
                    className="liquid-panel flex items-center gap-3 p-2.5"
                  >
                    <span className="w-5 text-center text-[12px] font-bold text-muted">
                      {idx + 1}
                    </span>
                    <div className="relative h-14 w-14 overflow-hidden rounded-[14px]">
                      <ProductImage
                        sources={[line.image]}
                        alt=""
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-navy">
                        {line.productName}
                      </p>
                      <p className="text-[12.5px] text-muted">
                        {formatRs(line.price)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={cartBusy}
                        className="liquid-chip !px-2.5"
                        onClick={() => void changeQty(line, line.quantity - 1)}
                      >
                        −
                      </button>
                      <span className="w-6 text-center text-sm font-bold">
                        {line.quantity}
                      </span>
                      <button
                        type="button"
                        disabled={cartBusy}
                        className="liquid-chip !px-2.5"
                        onClick={() => void changeQty(line, line.quantity + 1)}
                      >
                        +
                      </button>
                    </div>
                  </li>
                ))}
              </ul>

              <div className="mt-5 space-y-1.5 border-t border-white/55 pt-4 text-[13.5px]">
                <Row label="Subtotal" value={formatRs(subtotal)} />
                <Row label="Shipping" value={formatRs(0)} />
                <Row label="Total" value={formatRs(subtotal)} bold />
              </div>

              <button
                type="button"
                className="liquid-btn khalti-btn mt-4 w-full"
                onClick={() => setStep("checkout")}
              >
                Checkout with Khalti
              </button>
            </>
          ) : null}

          {step === "checkout" ? (
            <div className="space-y-3">
              <Field
                label="Full name"
                value={form.fullName}
                onChange={(v) => setForm((f) => ({ ...f, fullName: v }))}
                placeholder="Your name"
              />
              <Field
                label="Delivery address"
                value={form.address}
                onChange={(v) => setForm((f) => ({ ...f, address: v }))}
                placeholder="City, street, landmark"
              />
              <Field
                label="Mobile (Khalti)"
                value={form.phoneNumber}
                onChange={(v) => setForm((f) => ({ ...f, phoneNumber: v }))}
                placeholder="98XXXXXXXX"
                inputMode="tel"
              />
              <Field
                label="Notes (optional)"
                value={form.notes}
                onChange={(v) => setForm((f) => ({ ...f, notes: v }))}
                placeholder="Delivery notes"
              />
              <div className="space-y-1.5 border-t border-white/55 pt-4 text-[13.5px]">
                <Row label="Total" value={formatRs(subtotal)} bold />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="liquid-chip flex-1"
                  onClick={() => setStep("cart")}
                >
                  Back
                </button>
                <button
                  type="button"
                  disabled={paying || items.length === 0}
                  className="liquid-btn khalti-btn flex-[2]"
                  onClick={() => void placeOrder()}
                >
                  {paying ? "Processing…" : `Pay · ${formatRs(subtotal)}`}
                </button>
              </div>
            </div>
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
          <ProductGallery
            key={active.id}
            images={active.images.length ? active.images : [active.image]}
            alt={active.name}
          />
          <div className="p-5 sm:p-6">
            <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-muted">
              {active.category}
            </p>
            <h2 className="mt-1 font-display text-[26px] font-extrabold tracking-[-0.03em] text-navy">
              {active.name}
            </h2>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="liquid-chip !py-1">
                Stock {active.stock}
              </span>
              {active.stock > 0 ? (
                <span className="liquid-chip !py-1">In stock</span>
              ) : (
                <span className="liquid-chip !py-1">Out of stock</span>
              )}
            </div>
            <p className="mt-3 whitespace-pre-wrap text-[14.5px] leading-relaxed text-ink/80">
              {active.description}
            </p>
            <ul className="mt-4 space-y-1.5 text-[13px]">
              <li className="liquid-panel flex justify-between gap-3 px-3 py-2">
                <span className="text-muted">Category</span>
                <span className="font-semibold text-navy">{active.category}</span>
              </li>
              <li className="liquid-panel flex justify-between gap-3 px-3 py-2">
                <span className="text-muted">Stock</span>
                <span className="font-semibold text-navy">{active.stock}</span>
              </li>
              <li className="liquid-panel flex justify-between gap-3 px-3 py-2">
                <span className="text-muted">Price</span>
                <span className="font-semibold text-navy">
                  {formatRs(active.price)}
                </span>
              </li>
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
            disabled={cartBusy || active.stock <= 0}
            onClick={() => void addProduct(active)}
            className={`liquid-btn max-w-[200px] ${
              justAdded ? "khalti-btn !bg-[var(--repost)]" : "liquid-btn-dark"
            }`}
          >
            {active.stock <= 0
              ? "Out of stock"
              : justAdded
                ? "Added ✓"
                : "Add to cart"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="hub-list relative space-y-5 pb-24 lg:pb-8">
      {error ? (
        <p className="rounded-[16px] bg-red-50 px-3 py-2 text-[13px] text-red-700">
          {error}
        </p>
      ) : null}

      {slides.length > 0 ? (
        <div className="stagger-in" style={{ animationDelay: "0ms" }}>
          <HubCarousel
            slides={slides}
            onOpen={(id) => void openProduct(id)}
          />
        </div>
      ) : null}

      <div className="stagger-in" style={{ animationDelay: "60ms" }}>
        <TrustStrip
          items={[
            { label: "Secure checkout", icon: "secure" },
            { label: "Khalti payments", icon: "instant" },
            { label: "Nepal delivery", icon: "refund" },
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
          <button
            type="button"
            onClick={() => setCategorySlug("all")}
            className={`liquid-chip ${
              categorySlug === "all" ? "liquid-chip-active" : ""
            }`}
          >
            All
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategorySlug(c.slug || c.id)}
              className={`liquid-chip ${
                categorySlug === (c.slug || c.id) ? "liquid-chip-active" : ""
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>

      <div className="stagger-in" style={{ animationDelay: "180ms" }}>
        <div className="mb-3 flex items-end justify-between gap-2">
          <p className="hub-title !text-left">Products</p>
          <p className="text-[12.5px] font-semibold text-muted">
            {loading
              ? "Loading…"
              : `${products.length} item${products.length === 1 ? "" : "s"}`}
          </p>
        </div>

        {loading ? (
          <div className="grid place-items-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-navy/15 border-t-gold" />
          </div>
        ) : products.length === 0 ? (
          <LiquidEmpty
            title="No products"
            body="Try another category or keyword."
            actionLabel={q ? "Clear search" : undefined}
            onAction={q ? () => setQ("") : undefined}
          />
        ) : (
          <div className="hub-grid">
            {products.map((p, i) => {
              const justAdded = !!added[p.id];
              return (
                <article
                  key={p.id}
                  className="hub-card stagger-in overflow-hidden rounded-[22px]"
                  style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
                >
                  <button
                    type="button"
                    onClick={() => void openProduct(p.id)}
                    className="liquid-press w-full text-left"
                  >
                    <div className="relative aspect-[0.95] p-2">
                      <div className="relative h-full overflow-hidden rounded-[17px]">
                        <ProductCardScroller
                          images={[...p.images, p.image]}
                          alt={p.name}
                        />
                      </div>
                      <span className="absolute right-3.5 top-3.5 rounded-full bg-white/92 px-2 py-0.5 text-[10px] font-bold text-navy shadow-soft">
                        {p.stock > 0 ? `${p.stock} left` : "Sold out"}
                      </span>
                      {p.images.length > 1 ? (
                        <span className="absolute bottom-3.5 left-3.5 rounded-full bg-navy/80 px-2 py-0.5 text-[10px] font-bold text-white shadow-soft">
                          {p.images.length} photos
                        </span>
                      ) : null}
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
                      disabled={cartBusy || p.stock <= 0}
                      onClick={() => void addProduct(p)}
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
        onClick={() => {
          setShowCart(true);
          setStep("cart");
          void refreshCart().catch(() => undefined);
        }}
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

function normalizeImageList(sources: Array<string | null | undefined>) {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of sources) {
    const u = (raw ?? "").trim();
    if (!u || seen.has(u)) continue;
    seen.add(u);
    out.push(u);
  }
  return out;
}

function MediaFallback({ label = "No photo" }: { label?: string }) {
  return (
    <div className="absolute inset-0 grid place-items-center bg-[var(--media-fallback)] text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
      {label}
    </div>
  );
}

/** Detail gallery: transform carousel with swipe, arrows, dots, thumbs. */
function ProductGallery({
  images,
  alt,
}: {
  images: Array<string | null | undefined>;
  alt: string;
}) {
  const imageKey = (images ?? []).map((x) => String(x ?? "")).join("|");
  const list = useMemo(
    () => normalizeImageList(images),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [imageKey],
  );
  const [index, setIndex] = useState(0);
  const [failed, setFailed] = useState<Record<string, boolean>>({});
  const [paused, setPaused] = useState(false);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{ x: number; active: boolean } | null>(null);
  const [dragX, setDragX] = useState(0);

  const slides = useMemo(
    () => list.filter((src) => !failed[src]),
    [list, failed],
  );
  const multi = slides.length > 1;
  const safeIndex = slides.length
    ? Math.min(index, slides.length - 1)
    : 0;

  useEffect(() => {
    setIndex(0);
    setFailed({});
    setDragX(0);
    setDragging(false);
  }, [imageKey]);

  useEffect(() => {
    if (index > slides.length - 1) setIndex(Math.max(0, slides.length - 1));
  }, [slides.length, index]);

  useEffect(() => {
    if (!multi || paused || dragging) return;
    const t = window.setInterval(() => {
      setIndex((i) => (i + 1) % slides.length);
    }, 3600);
    return () => window.clearInterval(t);
  }, [multi, paused, dragging, slides.length]);

  function goTo(i: number) {
    if (!slides.length) return;
    const next = ((i % slides.length) + slides.length) % slides.length;
    setIndex(next);
    setDragX(0);
    setDragging(false);
    setPaused(true);
    window.setTimeout(() => setPaused(false), 5000);
  }

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (!multi) return;
    dragRef.current = { x: e.clientX, active: true };
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
    setPaused(true);
  }

  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (!dragRef.current?.active) return;
    setDragX(e.clientX - dragRef.current.x);
  }

  function onPointerUp(e: ReactPointerEvent<HTMLDivElement>) {
    if (!dragRef.current?.active) return;
    const dx = e.clientX - dragRef.current.x;
    dragRef.current = null;
    setDragging(false);
    const threshold = 48;
    if (dx <= -threshold) goTo(safeIndex + 1);
    else if (dx >= threshold) goTo(safeIndex - 1);
    else {
      setDragX(0);
      window.setTimeout(() => setPaused(false), 5000);
    }
  }

  if (!slides.length) {
    return (
      <div className="relative aspect-[16/10]">
        <MediaFallback />
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      <div
        className="relative aspect-[16/10] cursor-grab overflow-hidden bg-[var(--media-fallback)] select-none active:cursor-grabbing"
        style={{ touchAction: "none" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => {
          if (!dragRef.current?.active) setPaused(false);
        }}
      >
        <div
          className="relative h-full w-full ease-out"
          style={{
            transform: `translate3d(calc(${-safeIndex * 100}% + ${dragX}px), 0, 0)`,
            transition: dragging
              ? "none"
              : "transform 320ms cubic-bezier(0.22, 1, 0.36, 1)",
          }}
        >
          {slides.map((src, slide) => (
            <div
              key={`${src}-${slide}`}
              className="absolute inset-0"
              style={{ transform: `translate3d(${slide * 100}%, 0, 0)` }}
            >
              {/* Only mount nearby slides so missing API files aren't all requested at once. */}
              {Math.abs(slide - safeIndex) <= 1 ? (
                <Image
                  src={src}
                  alt={`${alt} ${slide + 1}`}
                  fill
                  draggable={false}
                  unoptimized
                  className="pointer-events-none object-cover"
                  onError={() =>
                    setFailed((prev) => ({ ...prev, [src]: true }))
                  }
                />
              ) : null}
            </div>
          ))}
        </div>

        {multi ? (
          <>
            <button
              type="button"
              aria-label="Previous image"
              className="absolute left-2 top-1/2 z-[2] grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-white/92 text-lg font-bold text-navy shadow-soft"
              onClick={(e) => {
                e.stopPropagation();
                goTo(safeIndex - 1);
              }}
            >
              ‹
            </button>
            <button
              type="button"
              aria-label="Next image"
              className="absolute right-2 top-1/2 z-[2] grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-white/92 text-lg font-bold text-navy shadow-soft"
              onClick={(e) => {
                e.stopPropagation();
                goTo(safeIndex + 1);
              }}
            >
              ›
            </button>
            <span className="pointer-events-none absolute bottom-2.5 right-2.5 z-[2] rounded-full bg-navy/80 px-2.5 py-0.5 text-[11px] font-bold text-white">
              {safeIndex + 1}/{slides.length}
            </span>
          </>
        ) : null}
      </div>

      {multi ? (
        <>
          <div className="flex items-center justify-center gap-1.5 px-3">
            {slides.map((src, i) => (
              <button
                key={`dot-${src}-${i}`}
                type="button"
                aria-label={`Image ${i + 1}`}
                onClick={() => goTo(i)}
                className={`hub-dot ${i === safeIndex ? "hub-dot-active" : ""}`}
              />
            ))}
          </div>
          <div className="flex gap-2 overflow-x-auto px-3 pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {slides.map((src, i) => (
              <button
                key={`thumb-${src}-${i}`}
                type="button"
                onClick={() => goTo(i)}
                className={`relative h-14 w-14 shrink-0 overflow-hidden rounded-[12px] border-2 transition ${
                  i === safeIndex
                    ? "border-gold shadow-soft"
                    : "border-white/70 opacity-75"
                }`}
              >
                <Image
                  src={src}
                  alt=""
                  fill
                  unoptimized
                  className="object-cover"
                />
              </button>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

/** Grid card: cycles through product photos when multiple exist. */
function ProductCardScroller({
  images,
  alt,
}: {
  images: Array<string | null | undefined>;
  alt: string;
}) {
  const imageKey = (images ?? []).map((x) => String(x ?? "")).join("|");
  const list = useMemo(
    () => normalizeImageList(images),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [imageKey],
  );
  const [index, setIndex] = useState(0);
  const [failed, setFailed] = useState<Record<string, boolean>>({});

  const slides = useMemo(
    () => list.filter((src) => !failed[src]),
    [list, failed],
  );
  const multi = slides.length > 1;
  const safeIndex = slides.length ? Math.min(index, slides.length - 1) : 0;

  useEffect(() => {
    setIndex(0);
    setFailed({});
  }, [imageKey]);

  useEffect(() => {
    if (!multi) return;
    const t = window.setInterval(() => {
      setIndex((i) => (i + 1) % slides.length);
    }, 2800);
    return () => window.clearInterval(t);
  }, [multi, slides.length]);

  if (!slides.length) return <MediaFallback />;

  const src = slides[safeIndex]!;

  return (
    <>
      <Image
        key={src}
        src={src}
        alt={alt}
        fill
        unoptimized
        className="object-cover transition-opacity duration-500"
        onError={() => {
          setFailed((prev) => ({ ...prev, [src]: true }));
          if (multi) setIndex((i) => (i + 1) % slides.length);
        }}
      />
      {multi ? (
        <span className="absolute bottom-2 left-1/2 z-[1] flex -translate-x-1/2 gap-1">
          {slides.map((s, i) => (
            <span
              key={s}
              className={`h-1 rounded-full transition ${
                i === safeIndex ? "w-3 bg-white" : "w-1 bg-white/55"
              }`}
            />
          ))}
        </span>
      ) : null}
    </>
  );
}

function ProductImage({
  sources,
  alt,
}: {
  sources: Array<string | null | undefined>;
  alt: string;
}) {
  const list = useMemo(() => normalizeImageList(sources), [sources]);
  const [index, setIndex] = useState(0);
  const [exhausted, setExhausted] = useState(false);

  useEffect(() => {
    setIndex(0);
    setExhausted(false);
  }, [list.join("|")]);

  if (!list.length || exhausted) return <MediaFallback />;

  const current = list[Math.min(index, list.length - 1)]!;

  return (
    <Image
      src={current}
      alt={alt}
      fill
      unoptimized
      className="object-cover"
      onError={() => {
        if (index + 1 < list.length) setIndex((i) => i + 1);
        else setExhausted(true);
      }}
    />
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  inputMode?: "text" | "tel" | "email" | "search" | "numeric";
}) {
  return (
    <label className="block space-y-1.5">
      <span className="pl-1 text-[12.5px] font-semibold text-muted">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        inputMode={inputMode}
        className="glass-field"
      />
    </label>
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
