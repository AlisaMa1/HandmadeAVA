import { Link, createFileRoute } from "@tanstack/react-router";
import { useSyncExternalStore } from "react";
import { getStoreSettings } from "~/server/catalog";
import { EmptyState } from "~/components/ui";
import { cartSnapshot, parseCart, removeLine, setQuantity, subscribeCart, cartSubtotal } from "~/lib/cart";
import { formatEuro, toNumber } from "~/lib/format";

export const Route = createFileRoute("/shporta")({
  loader: async () => await getStoreSettings(),
  head: () => ({
    meta: [
      { title: "Shporta — HandmadeAVA" },
      {
        name: "description",
        content: "Shporta juaj me bizhuteri HandmadeAVA. Pago në dorëzim, dërgesa 2–4 ditë pune.",
      },
    ],
  }),
  component: CartPage,
});

function CartPage() {
  const settings = Route.useLoaderData();
  const snapshot = useSyncExternalStore(subscribeCart, cartSnapshot, () => "[]");
  const lines = parseCart(snapshot);

  const subtotal = cartSubtotal(lines);
  const threshold = toNumber(settings.free_delivery_threshold_eur);
  const deliveryBase = toNumber(settings.delivery_cost_eur);
  const delivery = lines.length === 0 || (threshold > 0 && subtotal >= threshold) ? 0 : deliveryBase;
  const total = subtotal + delivery;

  return (
    <main className="container-shop py-12">
      <p className="eyebrow">Shporta</p>
      <h1 className="mt-3 font-display text-4xl text-ink sm:text-5xl">Pjesët e zgjedhura</h1>

      {lines.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            title="Shporta është bosh"
            description="Nuk keni shtuar ende asnjë pjesë. Shikoni koleksionin dhe zgjidhni diçka të veçantë."
            actionLabel="Shko në dyqan"
          />
        </div>
      ) : (
        <div className="mt-8 grid gap-8 lg:grid-cols-[1.6fr_1fr]">
          <ul className="space-y-4">
            {lines.map((line) => (
              <li key={`${line.productId}-${line.variant ?? ""}`} className="card-soft flex gap-4 p-4">
                <div className="h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-beige">
                  {line.imageUrl ? (
                    <img src={line.imageUrl} alt={line.name} className="h-full w-full object-cover" />
                  ) : null}
                </div>
                <div className="flex flex-1 flex-col justify-between gap-2">
                  <div>
                    <Link
                      to="/produkti/$slug"
                      params={{ slug: line.slug }}
                      className="font-display text-lg text-ink hover:text-gold-deep"
                    >
                      {line.name}
                    </Link>
                    <p className="text-sm text-ink-soft">{formatEuro(line.price)} / copë</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <label htmlFor={`sasia-${line.productId}`} className="sr-only">
                      Sasia për {line.name}
                    </label>
                    <input
                      id={`sasia-${line.productId}`}
                      type="number"
                      min={1}
                      max={Math.max(1, line.stock)}
                      value={line.quantity}
                      onChange={(e) =>
                        setQuantity(line.productId, line.variant, Math.max(1, Number(e.target.value) || 1))
                      }
                      className="input-soft w-20"
                    />
                    <button
                      type="button"
                      onClick={() => removeLine(line.productId, line.variant)}
                      className="text-sm text-ink-soft underline underline-offset-4 hover:text-gold-deep"
                    >
                      Hiq
                    </button>
                    <span className="ml-auto font-medium text-ink">{formatEuro(line.price * line.quantity)}</span>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          <aside className="card-soft h-fit p-6">
            <h2 className="font-display text-2xl text-ink">Përmbledhje</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-ink-soft">Nëntotali</dt>
                <dd className="text-ink">{formatEuro(subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-soft">Dërgesa</dt>
                <dd className="text-ink">{delivery === 0 ? "Falas" : formatEuro(delivery)}</dd>
              </div>
              <div className="flex justify-between border-t border-gold/25 pt-3 text-base">
                <dt className="font-medium text-ink">Totali</dt>
                <dd className="font-medium text-gold-deep">{formatEuro(total)}</dd>
              </div>
            </dl>
            {threshold > 0 && subtotal < threshold ? (
              <p className="mt-3 text-xs text-ink-soft">
                Shtoni edhe {formatEuro(threshold - subtotal)} për dërgesë falas.
              </p>
            ) : null}
            <Link to="/dyqani" className="btn-gold mt-6 w-full">
              Vazhdo blerjen
            </Link>
            <p className="mt-4 text-xs leading-relaxed text-ink-soft">
              Pagesa bëhet në dorëzim. Hapi i porosisë vjen së shpejti — kontaktoni telefonin {settings.contact_phone}{" "}
              për çdo pyetje.
            </p>
          </aside>
        </div>
      )}
    </main>
  );
}
