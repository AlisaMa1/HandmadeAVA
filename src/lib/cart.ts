/**
 * Client-side cart, persisted in localStorage.
 * Server-side carts arrive with customer accounts in a later step.
 */
export type CartLine = {
  productId: string;
  slug: string;
  name: string;
  price: number;
  imageUrl: string | null;
  quantity: number;
  /** Human label of the chosen variant (shown in the cart). */
  variant?: string | null;
  /** Id of the chosen variant — the only variant information checkout may send. */
  variantId?: string | null;
  stock: number;
};

const KEY = "handmadeava.cart.v1";
let lines: CartLine[] = [];
let loaded = false;
const listeners = new Set<() => void>();

function read(): CartLine[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CartLine[];
    return Array.isArray(parsed) ? parsed.filter((l) => l && typeof l.productId === "string" && l.quantity > 0) : [];
  } catch {
    return [];
  }
}

function ensure() {
  if (!loaded && typeof window !== "undefined") {
    lines = read();
    loaded = true;
  }
}

function write(next: CartLine[]) {
  lines = next;
  loaded = true;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage full or blocked — cart stays in memory for this page view */
  }
  listeners.forEach((l) => l());
}

export function subscribeCart(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getCart(): CartLine[] {
  ensure();
  return lines;
}

export function cartSnapshot(): string {
  ensure();
  return JSON.stringify(lines);
}

export function parseCart(json: string): CartLine[] {
  try {
    return JSON.parse(json) as CartLine[];
  } catch {
    return [];
  }
}

export function addToCart(line: CartLine) {
  ensure();
  const key = (l: CartLine) => l.productId + "|" + (l.variantId ?? l.variant ?? "");
  const existing = lines.find((l) => key(l) === key(line));
  if (existing) {
    const max = existing.stock > 0 ? existing.stock : 99;
    write(lines.map((l) => (key(l) === key(line) ? { ...l, quantity: Math.min(l.quantity + line.quantity, max) } : l)));
  } else {
    write([...lines, { ...line, quantity: Math.max(1, Math.min(line.quantity, line.stock > 0 ? line.stock : 99)) }]);
  }
}

export function setQuantity(
  productId: string,
  variant: string | null | undefined,
  quantity: number,
  variantId?: string | null
) {
  ensure();
  if (quantity <= 0) return removeLine(productId, variant, variantId);
  write(
    lines.map((l) =>
      l.productId === productId && (l.variantId ?? l.variant ?? "") === (variantId ?? variant ?? "")
        ? { ...l, quantity }
        : l
    )
  );
}

export function removeLine(productId: string, variant: string | null | undefined, variantId?: string | null) {
  ensure();
  write(
    lines.filter(
      (l) => !(l.productId === productId && (l.variantId ?? l.variant ?? "") === (variantId ?? variant ?? ""))
    )
  );
}

export function clearCart() {
  write([]);
}

export function cartCount(list: CartLine[]): number {
  return list.reduce((sum, l) => sum + l.quantity, 0);
}

/** The only cart data that ever reaches the server: ids and quantities. */
export function checkoutItems(list: CartLine[]) {
  return list.map((l) => ({
    productId: l.productId,
    variantId: l.variantId ?? null,
    quantity: Math.max(1, Math.floor(l.quantity)),
  }));
}

export function cartSubtotal(list: CartLine[]): number {
  return list.reduce((sum, l) => sum + l.price * l.quantity, 0);
}
