"use client";

import type { ShopProduct } from "./catalog";

export type CartLine = {
  product: ShopProduct;
  quantity: number;
};

const VAT = 0.13;
const DELIVERY = 200;
const KEY = "innovator_cart_v1";

function read(): CartLine[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    return JSON.parse(raw) as CartLine[];
  } catch {
    return [];
  }
}

function write(items: CartLine[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(items));
}

export const CartStore = {
  vatRate: VAT,
  deliveryCharge: DELIVERY,

  getItems(): CartLine[] {
    return read();
  },

  count(): number {
    return read().reduce((n, i) => n + i.quantity, 0);
  },

  subtotal(items = read()) {
    return items.reduce((n, i) => n + i.product.price * i.quantity, 0);
  },

  vat(items = read()) {
    return this.subtotal(items) * VAT;
  },

  delivery(items = read()) {
    return items.length ? DELIVERY : 0;
  },

  grandTotal(items = read()) {
    return this.subtotal(items) + this.vat(items) + this.delivery(items);
  },

  add(product: ShopProduct) {
    const items = read();
    const existing = items.find((i) => i.product.id === product.id);
    if (existing) existing.quantity += 1;
    else items.push({ product, quantity: 1 });
    write(items);
    return items;
  },

  setQty(productId: string, quantity: number) {
    let items = read();
    if (quantity <= 0) {
      items = items.filter((i) => i.product.id !== productId);
    } else {
      items = items.map((i) =>
        i.product.id === productId ? { ...i, quantity } : i,
      );
    }
    write(items);
    return items;
  },

  clear() {
    write([]);
  },
};
