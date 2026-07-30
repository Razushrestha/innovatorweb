import { ApiConfig } from "./api-config";
import { apiRequest } from "./api-client";
import { normalizeShopImageUrl } from "./media-url";

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
  const gallery = galleryRaw
    .filter((g): g is Record<string, unknown> => !!g && typeof g === "object")
    .map((g) => normalizeShopImageUrl(String(g.image ?? g.url ?? "")))
    .filter(Boolean);
  const cover = normalizeShopImageUrl(String(raw.image ?? "")) || gallery[0] || "";

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
    image: cover,
    images: gallery.length ? gallery : cover ? [cover] : [],
  };
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

export async function listShopProducts(opts?: {
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

export async function getShopProduct(productId: string) {
  const data = await apiRequest<Record<string, unknown>>(
    ApiConfig.shopBaseUrl,
    `/api/products/${encodeURIComponent(productId)}`,
    { auth: false },
  );
  return asProduct(data);
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
