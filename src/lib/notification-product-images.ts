import { normalizeShopImageUrl } from "./media-url";
import { findShopProductImage, listShopProductsBasic } from "./shop-api";
import type { AppNotification } from "./types";

function productNameHint(n: AppNotification) {
  const fromMessage = n.message
    .replace(/\s+is now available.*$/i, "")
    .replace(/\s+was added.*$/i, "")
    .replace(/\s+added to.*$/i, "")
    .trim();
  return fromMessage || n.title || "";
}

function isProductNotif(n: AppNotification) {
  const blob = `${n.type ?? ""} ${n.title} ${n.targetTab ?? ""}`;
  return (
    !!n.relatedProductId ||
    n.targetTab === "shop" ||
    /(product|shop)/i.test(blob)
  );
}

/**
 * Attach shop cover images to product notifications.
 * Uses the basic catalog (no gallery probing) so HTTPS mixed-content
 * probes cannot wipe valid covers.
 */
export async function attachProductImagesToNotifications(
  items: AppNotification[],
): Promise<AppNotification[]> {
  const productNotifs = items.filter(isProductNotif);
  if (!productNotifs.length) return items;

  const catalog = await listShopProductsBasic().catch(() => []);
  const byId = new Map(catalog.map((p) => [p.id, p]));
  const resolved = new Map<string, string>();

  const out = await Promise.all(
    items.map(async (n) => {
      if (!isProductNotif(n)) return n;

      const productId =
        n.relatedProductId?.trim() ||
        n.id.match(/^local:product:(.+)$/i)?.[1] ||
        "";
      const hint = productNameHint(n);
      const cacheKey = `${productId}|${hint.toLowerCase()}`;

      // Always prefer a same-origin proxied cover when one already exists.
      const existing = normalizeShopImageUrl(n.senderAvatar) || "";
      if (existing) {
        return {
          ...n,
          relatedProductId: productId || n.relatedProductId,
          senderAvatar: existing,
          type: n.type || "product",
          targetTab: "shop" as const,
        };
      }

      if (resolved.has(cacheKey)) {
        const image = resolved.get(cacheKey) || "";
        return image
          ? {
              ...n,
              relatedProductId: productId || n.relatedProductId,
              senderAvatar: image,
              type: n.type || "product",
              targetTab: "shop" as const,
            }
          : n;
      }

      // Fast path from already-loaded catalog.
      if (productId && byId.get(productId)?.image) {
        const image = byId.get(productId)!.image;
        resolved.set(cacheKey, image);
        return {
          ...n,
          relatedProductId: productId,
          senderAvatar: image,
          type: n.type || "product",
          targetTab: "shop" as const,
        };
      }

      const found = await findShopProductImage({
        productId: productId || null,
        nameHint: hint,
      });
      resolved.set(cacheKey, found.image || "");
      if (!found.image) return n;

      return {
        ...n,
        relatedProductId: found.productId || productId || n.relatedProductId,
        senderAvatar: found.image,
        type: n.type || "product",
        targetTab: "shop" as const,
      };
    }),
  );

  return out;
}
