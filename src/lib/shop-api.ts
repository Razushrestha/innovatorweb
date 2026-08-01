import { ApiConfig } from "./api-config";
import { apiRequest } from "./api-client";
import {
  normalizeShopImageUrl,
  pickShopImageUrl,
} from "./media-url";

export type ShopCategory = {
  id: string;
  name: string;
  slug: string;
  description: string;
};

export type ShopProduct = {
  id: string;
  name: string;
  description: string;
  price: number;
  stock: number;
  isActive: boolean;
  categoryId: string;
  category: string;
  categorySlug: string;
  image: string;
  images: string[];
};

export type ShopCartItem = {
  id: string;
  cartId: string;
  productId: string;
  productName: string;
  price: number;
  quantity: number;
  total: number;
  image: string;
};

export type CheckoutResult = {
  message: string;
  orderId: string;
  fullName: string;
  address: string;
  phoneNumber: string;
  paymentType: string;
  items: {
    productId: string;
    productName: string;
    image: string;
    price: number;
    quantity: number;
    lineTotal: number;
  }[];
  totalItems: number;
  totalAmount: number;
  shippingCharge: number;
  grandTotal: number;
  status: string;
  requiresKhaltiPayment: boolean;
};

export type KhaltiInitResult = {
  pidx: string;
  paymentUrl: string;
  orderId: string;
  amount: number;
};

function asNumber(v: unknown, fallback = 0) {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function asProduct(raw: Record<string, unknown>): ShopProduct {
  const details = (raw.category_details ?? raw.categoryDetails ?? {}) as Record<
    string,
    unknown
  >;
  const galleryRaw = Array.isArray(raw.images) ? raw.images : [];
  const gallerySources = galleryRaw
    .filter((g): g is Record<string, unknown> => !!g && typeof g === "object")
    .map((g) => String(g.image ?? g.url ?? ""))
    .filter(Boolean);
  const coverSource = String(raw.image ?? "");
  const image = pickShopImageUrl(coverSource, gallerySources);
  const gallery = gallerySources
    .map((u) => normalizeShopImageUrl(u))
    .filter(Boolean);

  return {
    id: String(raw.id ?? ""),
    name: String(raw.name ?? "Product"),
    description: String(raw.description ?? ""),
    price: asNumber(raw.price),
    stock: asNumber(raw.stock),
    isActive: raw.is_active !== false && raw.isActive !== false,
    categoryId: String(raw.category ?? details.id ?? ""),
    category: String(details.name ?? raw.category_name ?? "Shop"),
    categorySlug: String(details.slug ?? ""),
    image,
    images: gallery.length ? gallery : image ? [image] : [],
  };
}

/**
 * Pull gallery details for a specific batch of products (used by shop lazy pages).
 * Mutates and returns the same product objects with enriched images.
 */
export async function enrichShopProductBatch(products: ShopProduct[]) {
  const targets = products.filter((p) => p.images.length <= 1);
  if (!targets.length) return products;

  const concurrency = 4;
  for (let i = 0; i < targets.length; i += concurrency) {
    const batch = targets.slice(i, i + concurrency);
    await Promise.all(
      batch.map(async (p) => {
        try {
          const detail = await getShopProduct(p.id);
          const sources = uniqueImages([
            ...detail.images,
            detail.image,
            p.image,
          ]);
          const working = await resolveWorkingShopImages(sources);
          if (working.length) {
            p.images = working;
            p.image = working[0] ?? p.image;
          } else if (detail.image) {
            p.image = detail.image;
            p.images = detail.images.length ? detail.images : [detail.image];
          }
        } catch {
          // keep list cover
        }
      }),
    );
  }
  return products;
}

/** @deprecated Prefer enrichShopProductBatch for paged shop UIs. */
async function enrichProductImages(products: ShopProduct[], limit = 12) {
  return enrichShopProductBatch(products.slice(0, limit));
}

function uniqueImages(urls: Array<string | null | undefined>) {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of urls) {
    const u = (raw ?? "").trim();
    if (!u || seen.has(u)) continue;
    seen.add(u);
    out.push(u);
  }
  return out;
}

/** Alternate casings — some hosts are case-sensitive on extensions. */
function shopImageCandidates(url: string) {
  const u = url.trim();
  if (!u) return [] as string[];
  const alts = new Set<string>([u]);
  alts.add(u.replace(/\.JPG$/i, ".jpg"));
  alts.add(u.replace(/\.JPEG$/i, ".jpeg"));
  alts.add(u.replace(/\.PNG$/i, ".png"));
  alts.add(u.replace(/\.WEBP$/i, ".webp"));
  alts.add(u.replace(/\.GIF$/i, ".gif"));
  return [...alts];
}

function probeShopImage(url: string) {
  if (typeof window === "undefined") return Promise.resolve(true);
  return new Promise<boolean>((resolve) => {
    const img = new window.Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = url;
  });
}

/** Keep only media URLs that actually load (drops missing API files). */
export async function resolveWorkingShopImages(urls: string[]) {
  const out: string[] = [];
  const tried = new Set<string>();
  for (const raw of urls) {
    for (const candidate of shopImageCandidates(raw)) {
      if (!candidate || tried.has(candidate)) continue;
      tried.add(candidate);
      // Probe the proxied HTTPS URL so mixed-content doesn't false-fail on Vercel.
      const proxied = normalizeShopImageUrl(candidate) || candidate;
      if (await probeShopImage(proxied)) {
        out.push(proxied);
        break;
      }
    }
  }
  return out;
}

function asCategory(raw: Record<string, unknown>): ShopCategory {
  return {
    id: String(raw.id ?? ""),
    name: String(raw.name ?? ""),
    slug: String(raw.slug ?? ""),
    description: String(raw.description ?? ""),
  };
}

function asCartItem(
  raw: Record<string, unknown>,
  imageByProduct?: Map<string, string>,
): ShopCartItem {
  const productId = String(raw.product ?? raw.product_id ?? raw.productId ?? "");
  return {
    id: String(raw.id ?? ""),
    cartId: String(raw.cart ?? raw.cart_id ?? raw.cartId ?? ""),
    productId,
    productName: String(raw.product_name ?? raw.productName ?? "Product"),
    price: asNumber(raw.price),
    quantity: asNumber(raw.quantity, 1),
    total: asNumber(raw.total),
    image:
      imageByProduct?.get(productId) ||
      normalizeShopImageUrl(String(raw.image ?? "")) ||
      "",
  };
}

function unwrapList(raw: unknown): Record<string, unknown>[] {
  if (Array.isArray(raw)) {
    return raw.filter(
      (x): x is Record<string, unknown> => !!x && typeof x === "object",
    );
  }
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    const nested = obj.data ?? obj.results ?? obj.value ?? obj.items;
    if (Array.isArray(nested)) {
      return nested.filter(
        (x): x is Record<string, unknown> => !!x && typeof x === "object",
      );
    }
  }
  return [];
}

export function formatRs(n: number) {
  return `Rs ${Math.round(n).toLocaleString("en-IN")}`;
}

export async function listShopCategories() {
  const data = await apiRequest<unknown>(
    ApiConfig.shopBaseUrl,
    "/api/categories",
    { auth: false },
  );
  return unwrapList(data).map(asCategory).filter((c) => c.id && c.name);
}

async function fetchShopProductList(opts?: {
  categorySlug?: string;
  search?: string;
}) {
  const query: Record<string, string> = {};
  if (opts?.categorySlug?.trim()) query.category = opts.categorySlug.trim();
  if (opts?.search?.trim()) query.search = opts.search.trim();

  const data = await apiRequest<unknown>(ApiConfig.shopBaseUrl, "/api/products", {
    auth: false,
    query: Object.keys(query).length ? query : undefined,
  });

  return unwrapList(data)
    .map(asProduct)
    .filter((p) => p.id && p.isActive);
}

/** Fast catalog list with cover images (no per-item gallery probing). */
export async function listShopProductsBasic(opts?: {
  categorySlug?: string;
  search?: string;
}) {
  return fetchShopProductList(opts);
}

export async function listShopProducts(opts?: {
  categorySlug?: string;
  search?: string;
}) {
  const products = await fetchShopProductList(opts);
  return enrichProductImages(products);
}

/** Resolve a product cover by id or fuzzy name for notifications / cards. */
export async function findShopProductImage(input: {
  productId?: string | null;
  nameHint?: string | null;
}): Promise<{ productId?: string; image: string; name?: string }> {
  const productId = input.productId?.trim() || "";
  const hint = (input.nameHint || "").trim();

  if (productId) {
    try {
      const detail = await getShopProduct(productId);
      const image =
        detail.image?.trim() ||
        detail.images.find((u) => !!u?.trim()) ||
        "";
      if (image) {
        return {
          productId: detail.id,
          name: detail.name,
          image: normalizeShopImageUrl(image) || image,
        };
      }
    } catch {
      /* fall through to catalog */
    }
  }

  const products = await listShopProductsBasic().catch(() => [] as ShopProduct[]);
  if (productId) {
    const byId = products.find((p) => p.id === productId);
    if (byId?.image) {
      return {
        productId: byId.id,
        name: byId.name,
        image: byId.image,
      };
    }
  }

  const needle = hint
    .replace(/\s+is now available.*$/i, "")
    .replace(/\s+was added.*$/i, "")
    .replace(/\s+added to.*$/i, "")
    .trim()
    .toLowerCase();

  if (needle) {
    const exact = products.find((p) => p.name.trim().toLowerCase() === needle);
    if (exact?.image) {
      return { productId: exact.id, name: exact.name, image: exact.image };
    }

    // Token overlap fuzzy match (handles long hardware product titles).
    const tokens = needle.split(/[^a-z0-9]+/).filter((t) => t.length > 2);
    let best: ShopProduct | null = null;
    let bestScore = 0;
    for (const p of products) {
      const name = p.name.toLowerCase();
      if (!p.image) continue;
      if (name.includes(needle) || needle.includes(name)) {
        return { productId: p.id, name: p.name, image: p.image };
      }
      if (!tokens.length) continue;
      const nameTokens = new Set(
        name.split(/[^a-z0-9]+/).filter((t) => t.length > 2),
      );
      let hit = 0;
      for (const t of tokens) if (nameTokens.has(t)) hit += 1;
      const score = hit / tokens.length;
      if (score > bestScore) {
        bestScore = score;
        best = p;
      }
    }
    if (best?.image && bestScore >= 0.55) {
      return { productId: best.id, name: best.name, image: best.image };
    }
  }

  return { image: "" };
}

export async function getShopProduct(productId: string) {
  const data = await apiRequest<Record<string, unknown>>(
    ApiConfig.shopBaseUrl,
    `/api/products/${encodeURIComponent(productId)}`,
    { auth: false },
  );
  return asProduct(data);
}

/** Detail with gallery filtered to images that actually exist on the media host. */
export async function getShopProductWithGallery(productId: string) {
  const detail = await getShopProduct(productId);
  const sources = uniqueImages([...detail.images, detail.image]);
  const working = await resolveWorkingShopImages(sources);
  return {
    ...detail,
    images: working,
    image: working[0] ?? "",
  } satisfies ShopProduct;
}

export async function getShopCart(imageByProduct?: Map<string, string>) {
  const data = await apiRequest<unknown>(
    ApiConfig.shopBaseUrl,
    "/api/cart-items",
  );
  return unwrapList(data).map((row) => asCartItem(row, imageByProduct));
}

export async function addShopCartItem(productId: string) {
  const data = await apiRequest<Record<string, unknown>>(
    ApiConfig.shopBaseUrl,
    "/api/cart-items",
    {
      method: "POST",
      body: { product: productId },
    },
  );
  return asCartItem(data);
}

export async function updateShopCartItem(cartItemId: string, quantity: number) {
  if (quantity <= 0) {
    await removeShopCartItem(cartItemId);
    return null;
  }
  const data = await apiRequest<Record<string, unknown>>(
    ApiConfig.shopBaseUrl,
    `/api/cart-items/${encodeURIComponent(cartItemId)}`,
    {
      method: "PATCH",
      body: { quantity },
    },
  );
  return asCartItem(data);
}

export async function removeShopCartItem(cartItemId: string) {
  await apiRequest(
    ApiConfig.shopBaseUrl,
    `/api/cart-items/${encodeURIComponent(cartItemId)}`,
    { method: "DELETE" },
  );
}

export async function checkoutShop(input: {
  fullName: string;
  address: string;
  phoneNumber: string;
  notes?: string;
  paymentType?: string;
}) {
  const data = await apiRequest<Record<string, unknown>>(
    ApiConfig.shopBaseUrl,
    "/api/checkout/summary",
    {
      method: "POST",
      body: {
        full_name: input.fullName,
        address: input.address,
        phone_number: input.phoneNumber,
        notes: input.notes ?? "",
        payment_type: input.paymentType ?? "khalti",
      },
    },
  );

  const itemsRaw = Array.isArray(data.items) ? data.items : [];
  return {
    message: String(data.message ?? "Order placed"),
    orderId: String(data.order_id ?? data.orderId ?? ""),
    fullName: String(data.full_name ?? data.fullName ?? input.fullName),
    address: String(data.address ?? input.address),
    phoneNumber: String(data.phone_number ?? data.phoneNumber ?? input.phoneNumber),
    paymentType: String(data.payment_type ?? data.paymentType ?? "khalti"),
    items: itemsRaw
      .filter((x): x is Record<string, unknown> => !!x && typeof x === "object")
      .map((x) => ({
        productId: String(x.product_id ?? x.productId ?? ""),
        productName: String(x.product_name ?? x.productName ?? ""),
        image: normalizeShopImageUrl(String(x.image ?? "")),
        price: asNumber(x.price),
        quantity: asNumber(x.quantity, 1),
        lineTotal: asNumber(x.line_total ?? x.lineTotal),
      })),
    totalItems: asNumber(data.total_items ?? data.totalItems),
    totalAmount: asNumber(data.total_amount ?? data.totalAmount),
    shippingCharge: asNumber(data.shipping_charge ?? data.shippingCharge),
    grandTotal: asNumber(data.grand_total ?? data.grandTotal),
    status: String(data.status ?? "pending"),
    requiresKhaltiPayment:
      data.requires_khalti_payment === true ||
      data.requiresKhaltiPayment === true,
  } satisfies CheckoutResult;
}

export async function initiateKhaltiPayment(orderId: string) {
  const data = await apiRequest<Record<string, unknown>>(
    ApiConfig.shopBaseUrl,
    "/api/payments/initiate",
    {
      method: "POST",
      body: { order_id: orderId },
    },
  );
  return {
    pidx: String(data.pidx ?? ""),
    paymentUrl: String(data.payment_url ?? data.paymentUrl ?? ""),
    orderId: String(data.order_id ?? data.orderId ?? orderId),
    amount: asNumber(data.amount),
  } satisfies KhaltiInitResult;
}
