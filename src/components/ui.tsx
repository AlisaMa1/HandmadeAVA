import { Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useSyncExternalStore, useState, type ReactNode } from "react";
import { logoutCustomer, type SessionUser } from "~/server/auth";
import { cartSnapshot, parseCart, subscribeCart, cartCount } from "~/lib/cart";
import { formatEuro, toNumber } from "~/lib/format";
import type { ProductCard as ProductCardType, StoreSettings } from "~/server/catalog";

/* ------------------------------------------------------------------ header --- */

const NAV = [
  { to: "/", label: "Ballina" },
  { to: "/dyqani", label: "Dyqani" },
  { to: "/shporta", label: "Shporta" },
] as const;

function useCartCount(): number {
  const snapshot = useSyncExternalStore(subscribeCart, cartSnapshot, () => "[]");
  return cartCount(parseCart(snapshot));
}

export function Header({ user = null }: { user?: SessionUser | null }) {
  const [open, setOpen] = useState(false);
  const count = useCartCount();
  return (
    <header className="sticky top-0 z-40 border-b border-gold/20 bg-cream/90 backdrop-blur">
      <div className="container-shop flex h-[72px] items-center justify-between gap-4">
        <Link to="/" className="flex items-baseline gap-2" aria-label="HandmadeAVA — ballina">
          <span className="font-display text-2xl tracking-wide text-ink">HandmadeAVA</span>
          <span className="hidden text-[0.6rem] uppercase tracking-[0.3em] text-gold-deep sm:inline">handmade</span>
        </Link>

        <nav aria-label="Navigimi kryesor" className="hidden items-center gap-7 md:flex">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="text-sm tracking-wide text-ink-soft transition-colors hover:text-gold-deep"
              activeProps={{ className: "text-gold-deep font-medium" }}
            >
              {item.label}
              {item.to === "/shporta" && count > 0 ? (
                <span className="ml-2 rounded-full bg-gold-deep px-2 py-0.5 text-[0.65rem] text-white">{count}</span>
              ) : null}
            </Link>
          ))}
          {user ? (
            <Link
              to="/llogaria"
              className="text-sm tracking-wide text-ink-soft transition-colors hover:text-gold-deep"
              activeProps={{ className: "text-gold-deep font-medium" }}
            >
              Llogaria
            </Link>
          ) : null}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          {user ? (
            <>
              <Link
                to="/llogaria"
                className="max-w-[12rem] truncate text-sm text-ink hover:text-gold-deep"
                title={user.email}
              >
                Përshëndetje, {user.fullName?.split(" ")[0] || user.email}
              </Link>
              <LogoutControl />
            </>
          ) : (
            <>
              <Link to="/hyrje" className="btn-outline px-5 py-2">
                Hyr
              </Link>
              <Link to="/regjistrohu" className="btn-gold px-5 py-2">
                Regjistrohu
              </Link>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="mobile-menu"
          aria-label={open ? "Mbyll menunë" : "Hap menunë"}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-gold/40 text-gold-deep md:hidden"
        >
          <span aria-hidden className="text-lg leading-none">{open ? "✕" : "☰"}</span>
        </button>
      </div>

      {open ? (
        <nav id="mobile-menu" aria-label="Navigimi për telefon" className="border-t border-gold/20 bg-cream md:hidden">
          <ul className="container-shop flex flex-col py-3">
            {NAV.map((item) => (
              <li key={item.to}>
                <Link
                  to={item.to}
                  onClick={() => setOpen(false)}
                  className="block py-3 text-sm tracking-wide text-ink-soft"
                  activeProps={{ className: "text-gold-deep font-medium" }}
                >
                  {item.label}
                  {item.to === "/shporta" && count > 0 ? <span className="ml-2 text-gold-deep">({count})</span> : null}
                </Link>
              </li>
            ))}
            {user ? (
              <>
                <li>
                  <Link
                    to="/llogaria"
                    onClick={() => setOpen(false)}
                    className="block py-3 text-sm tracking-wide text-ink-soft"
                  >
                    Llogaria ({user.fullName?.split(" ")[0] || user.email})
                  </Link>
                </li>
                <li>
                  <Link
                    to="/llogaria/porosite"
                    onClick={() => setOpen(false)}
                    className="block py-3 text-sm tracking-wide text-ink-soft"
                  >
                    Porositë e mia
                  </Link>
                </li>
                <li className="pt-2">
                  <LogoutControl className="btn-outline w-full" />
                </li>
              </>
            ) : (
              <>
                <li className="pt-1">
                  <Link to="/hyrje" onClick={() => setOpen(false)} className="block py-3 text-sm tracking-wide text-ink-soft">
                    Hyr
                  </Link>
                </li>
                <li className="pb-2">
                  <Link to="/regjistrohu" onClick={() => setOpen(false)} className="btn-gold w-full">
                    Regjistrohu
                  </Link>
                </li>
              </>
            )}
          </ul>
        </nav>
      ) : null}
    </header>
  );
}

/** Sign-out control: destroys the session server-side, then refreshes the page state. */
export function LogoutControl({ className = "btn-outline px-5 py-2" }: { className?: string }) {
  const router = useRouter();
  const logout = useServerFn(logoutCustomer);
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className={className}
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await logout();
          await router.invalidate();
          await router.navigate({ to: "/" });
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? "Po dilni…" : "Shkëputu"}
    </button>
  );
}

/* ------------------------------------------------------------------ footer --- */

export function Footer({ settings }: { settings: StoreSettings }) {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-24 border-t border-gold/25 bg-cream-deep">
      <div className="container-shop grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="font-display text-2xl text-ink">HandmadeAVA</p>
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-ink-soft">
            Bizhuteri të bëra me dorë me perla dhe detaje ari. Një pjesë, një histori.
          </p>
        </div>
        <div>
          <h2 className="eyebrow">Kontakt</h2>
          <ul className="mt-3 space-y-2 text-sm text-ink-soft">
            <li>
              <a className="hover:text-gold-deep" href={`tel:${settings.contact_phone.replace(/\s/g, "")}`}>
                {settings.contact_phone}
              </a>
            </li>
            <li>
              <a className="hover:text-gold-deep" href={`mailto:${settings.contact_email}`}>
                {settings.contact_email}
              </a>
            </li>
            <li>
              <a
                className="hover:text-gold-deep"
                href={settings.instagram_url}
                target="_blank"
                rel="noreferrer noopener"
              >
                Instagram
              </a>
            </li>
          </ul>
        </div>
        <div>
          <h2 className="eyebrow">Dërgesa</h2>
          <p className="mt-3 text-sm leading-relaxed text-ink-soft">{settings.delivery_returns_text}</p>
        </div>
        <div>
          <h2 className="eyebrow">Faqet</h2>
          <ul className="mt-3 space-y-2 text-sm text-ink-soft">
            <li>
              <Link to="/dyqani" className="hover:text-gold-deep">
                Dyqani
              </Link>
            </li>
            <li>
              <Link to="/shporta" className="hover:text-gold-deep">
                Shporta
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-gold/20">
        <p className="container-shop py-6 text-xs text-ink-soft">
          © {year} HandmadeAVA. Të gjitha të drejtat e rezervuara.
        </p>
      </div>
    </footer>
  );
}

/* ------------------------------------------------------------- product card --- */

export function PriceTag({
  price,
  salePrice,
  className = "",
}: {
  price: string | number;
  salePrice?: string | number | null;
  className?: string;
}) {
  const full = toNumber(price);
  const sale = salePrice == null || salePrice === "" ? null : toNumber(salePrice);
  if (sale !== null && sale > 0 && sale < full) {
    return (
      <p className={`flex flex-wrap items-baseline gap-2 ${className}`}>
        <span className="font-medium text-gold-deep">{formatEuro(sale)}</span>
        <span className="text-sm text-ink-soft line-through">{formatEuro(full)}</span>
      </p>
    );
  }
  return <p className={`font-medium text-ink ${className}`}>{formatEuro(full)}</p>;
}

export function StockBadge({ stock }: { stock: number }) {
  if (stock <= 0) {
    return (
      <span className="inline-flex rounded-full bg-beige px-2.5 py-1 text-[0.65rem] uppercase tracking-wider text-ink-soft">
        Nuk ka stok
      </span>
    );
  }
  if (stock <= 3) {
    return (
      <span className="inline-flex rounded-full bg-blush px-2.5 py-1 text-[0.65rem] uppercase tracking-wider text-ink">
        Vetëm {stock} të mbetura
      </span>
    );
  }
  return (
    <span className="inline-flex rounded-full bg-beige/80 px-2.5 py-1 text-[0.65rem] uppercase tracking-wider text-gold-deep">
      Në stok
    </span>
  );
}

export function ProductCard({ product }: { product: ProductCardType }) {
  return (
    <article className="group flex flex-col">
      <Link to="/produkti/$slug" params={{ slug: product.slug }} className="block overflow-hidden rounded-[var(--radius-card)]">
        <div className="relative aspect-square overflow-hidden rounded-[var(--radius-card)] bg-beige">
          {product.imageUrl ? (
            <img
              src={product.imageUrl}
              alt={product.imageAlt ?? product.name}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            />
          ) : (
            <div className="flex h-full items-center justify-center px-6 text-center text-sm text-ink-soft">
              Foto së shpejti
            </div>
          )}
          <div className="absolute left-3 top-3 flex flex-col gap-1.5">
            {product.salePrice ? (
              <span className="rounded-full bg-gold-deep px-2.5 py-1 text-[0.6rem] uppercase tracking-[0.15em] text-white">
                Zbritje
              </span>
            ) : null}
            {product.isNew ? (
              <span className="rounded-full bg-white/90 px-2.5 py-1 text-[0.6rem] uppercase tracking-[0.15em] text-gold-deep">
                E re
              </span>
            ) : null}
            {product.isBestSeller && !product.isNew ? (
              <span className="rounded-full bg-blush px-2.5 py-1 text-[0.6rem] uppercase tracking-[0.15em] text-ink">
                Më e shitur
              </span>
            ) : null}
          </div>
        </div>
      </Link>
      <div className="mt-3 flex flex-col gap-1">
        <p className="text-[0.65rem] uppercase tracking-[0.18em] text-ink-soft">{product.categoryName}</p>
        <h3 className="font-display text-lg leading-snug text-ink">
          <Link to="/produkti/$slug" params={{ slug: product.slug }} className="hover:text-gold-deep">
            {product.name}
          </Link>
        </h3>
        <PriceTag price={product.price} salePrice={product.salePrice} className="text-sm" />
      </div>
    </article>
  );
}

/* ------------------------------------------------------------ shared states --- */

export function EmptyState({
  title,
  description,
  actionLabel,
  actionTo = "/dyqani",
}: {
  title: string;
  description: string;
  actionLabel?: string;
  actionTo?: string;
}) {
  return (
    <div className="card-soft flex flex-col items-center gap-4 px-6 py-14 text-center">
      <span aria-hidden className="font-display text-4xl text-gold">
        ✿
      </span>
      <h2 className="font-display text-2xl text-ink">{title}</h2>
      <p className="max-w-md text-sm leading-relaxed text-ink-soft">{description}</p>
      {actionLabel ? (
        <Link to={actionTo} className="btn-outline mt-2">
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2 className="mt-2 font-display text-3xl text-ink sm:text-4xl">{title}</h2>
      </div>
      {children}
    </div>
  );
}

export function SkeletonGrid({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-5 lg:grid-cols-4" aria-busy="true" aria-live="polite">
      <p className="sr-only">Po ngarkohet…</p>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="animate-pulse">
          <div className="aspect-square rounded-[var(--radius-card)] bg-beige" />
          <div className="mt-3 h-3 w-1/2 rounded bg-beige" />
          <div className="mt-2 h-3 w-2/3 rounded bg-beige" />
        </div>
      ))}
    </div>
  );
}
