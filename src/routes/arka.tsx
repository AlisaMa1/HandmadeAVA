import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { FormField, FormMessage } from "~/components/form";
import { EmptyState } from "~/components/ui";
import { checkoutItems, cartSnapshot, clearCart, parseCart, subscribeCart } from "~/lib/cart";
import { formatEuro, toNumber } from "~/lib/format";
import { getCheckoutPrefill, placeOrder } from "~/server/checkout";
/**
 * /arka — cash-on-delivery checkout.
 *
 * The browser only sends product ids, variant ids and quantities. Prices, the
 * subtotal, the delivery cost and the stock levels on this page are an ESTIMATE for
 * the customer's comfort; the order that gets stored is priced and stock-checked
 * entirely on the server (see src/server/checkout.ts), and the confirmation page
 * shows the numbers that were actually recorded.
 */
export const Route = createFileRoute("/arka")({
  loader: async () => await getCheckoutPrefill(),
  head: () => ({
    meta: [
      { title: "Arka — përfundoni porosinë | HandmadeAVA" },
      {
        name: "description",
        content: "Plotësoni të dhënat e dërgesës dhe përfundoni porosinë. Pagesa bëhet me para në dorë.",
      },
    ],
  }),
  component: CheckoutPage,
});

type Fields = {
  name: string;
  phone: string;
  line1: string;
  line2: string;
  city: string;
  postalCode: string;
  notes: string;
};

function newIdempotencyKey(): string {
  try {
    return `ord_${crypto.randomUUID().replace(/-/g, "")}`;
  } catch {
    return `ord_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  }
}

function CheckoutPage() {
  const prefill = Route.useLoaderData();
  const navigate = useNavigate();
  const snapshot = useSyncExternalStore(subscribeCart, cartSnapshot, () => "[]");
  const lines = parseCart(snapshot);

  const [fields, setFields] = useState<Fields>({
    name: prefill.name,
    phone: prefill.phone,
    line1: prefill.line1,
    line2: prefill.line2,
    city: prefill.city,
    postalCode: prefill.postalCode,
    notes: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // One key per checkout attempt: a double click or a retry reuses it, so the server
  // returns the order it already created instead of creating a second one.
  const idempotencyKey = useRef<string>("");
  useEffect(() => {
    idempotencyKey.current = newIdempotencyKey();
  }, []);

  const set = (key: keyof Fields) => (value: string) => setFields((f) => ({ ...f, [key]: value }));

  const subtotal = useMemo(
    () => lines.reduce((sum, l) => sum + toNumber(l.price) * l.quantity, 0),
    [snapshot] // eslint-disable-line react-hooks/exhaustive-deps
  );
  const deliveryBase = toNumber(prefill.deliveryCost);
  const threshold = toNumber(prefill.freeDeliveryThreshold);
  const delivery = lines.length === 0 || (threshold > 0 && subtotal >= threshold) ? 0 : deliveryBase;
  const estimatedTotal = subtotal + delivery;

  if (lines.length === 0) {
    return (
      <main className="container-shop py-12">
        <p className="eyebrow">Arka</p>
        <h1 className="mt-3 font-display text-4xl text-ink sm:text-5xl">Shporta është bosh</h1>
        <div className="mt-8">
          <EmptyState
            title="Nuk ka çfarë të porositet"
            description="Shtoni një pjesë në shportë dhe kthehuni këtu për të përfunduar porosinë."
            actionLabel="Shko në dyqan"
          />
        </div>
      </main>
    );
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      if (!idempotencyKey.current) idempotencyKey.current = newIdempotencyKey();
      const result = await placeOrder({
        data: {
          items: checkoutItems(lines),
          customer: { name: fields.name, phone: fields.phone, email: prefill.email || null },
          address: {
            line1: fields.line1,
            line2: fields.line2 || null,
            city: fields.city,
            postalCode: fields.postalCode || null,
            country: prefill.country || "AL",
            notes: fields.notes || null,
          },
          idempotencyKey: idempotencyKey.current,
        },
      });
      if (!result.ok) {
        // Honest failure: the cart stays exactly as it was, nothing is pretended.
        setError(result.error);
        setSubmitting(false);
        return;
      }
      clearCart();
      await navigate({ to: "/porosia/$token", params: { token: result.order.token } });
    } catch {
      setError("Porosia nuk u regjistrua. Lidhja me dyqanin dështoi — shporta juaj është ruajtur, provoni përsëri.");
      setSubmitting(false);
    }
  }

  return (
    <main className="container-shop py-12">
      <p className="eyebrow">Arka</p>
      <h1 className="mt-3 font-display text-4xl text-ink sm:text-5xl">Përfundoni porosinë</h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-soft">
        Plotësoni të dhënat e dërgesës. Pagesa bëhet vetëm me para në dorë, kur pakoja të mbërrijë — nuk kërkohet
        kartë dhe nuk kryhet pagesë online.
      </p>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1.4fr_1fr]">
        <form onSubmit={submit} noValidate className="card-soft p-6 sm:p-8">
          <h2 className="font-display text-2xl text-ink">Të dhënat e dërgimit</h2>
          {!prefill.signedIn ? (
            <p className="mt-2 text-sm text-ink-soft">
              Porositni si vizitor.{" "}
              <Link to="/hyrje" className="underline underline-offset-4 hover:text-gold-deep">
                Hyni në llogari
              </Link>{" "}
              për të plotësuar të dhënat automatikisht.
            </p>
          ) : null}

          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <FormField
                label="Emri dhe mbiemri"
                name="name"
                value={fields.name}
                onChange={set("name")}
                autoComplete="name"
                required
              />
            </div>
            <div className="sm:col-span-2">
              <FormField
                label="Numri i telefonit"
                name="phone"
                type="tel"
                inputMode="tel"
                value={fields.phone}
                onChange={set("phone")}
                autoComplete="tel"
                hint="P.sh. +355 69 123 4567 — kurieri ju telefonon në këtë numër."
                required
              />
            </div>
            <div className="sm:col-span-2">
              <FormField
                label="Adresa (rruga dhe numri)"
                name="line1"
                value={fields.line1}
                onChange={set("line1")}
                autoComplete="address-line1"
                required
              />
            </div>
            <div className="sm:col-span-2">
              <FormField
                label="Banesa / shënim adrese (opsionale)"
                name="line2"
                value={fields.line2}
                onChange={set("line2")}
                autoComplete="address-line2"
              />
            </div>
            <FormField
              label="Qyteti"
              name="city"
              value={fields.city}
              onChange={set("city")}
              autoComplete="address-level2"
              required
            />
            <FormField
              label="Kodi postar (opsional)"
              name="postalCode"
              inputMode="numeric"
              value={fields.postalCode}
              onChange={set("postalCode")}
              autoComplete="postal-code"
            />
            <div className="sm:col-span-2">
              <label htmlFor="arkë-vendi" className="mb-2 block text-sm font-medium text-ink">
                Vendi
              </label>
              <input id="arkë-vendi" value="Shqipëri (AL)" readOnly disabled className="input-soft w-full" />
              <p className="mt-1 text-xs text-ink-soft">Dërgojmë në të gjithë Shqipërinë.</p>
            </div>
            <div className="sm:col-span-2">
              <FormField
                label="Shënim për porosinë (opsional)"
                name="notes"
                value={fields.notes}
                onChange={set("notes")}
                multiline
                rows={3}
                hint="P.sh. orari më i mirë për telefonatë, ose që paketa është dhuratë."
              />
            </div>
          </div>

          <fieldset className="mt-8 rounded-[var(--radius-card)] border border-gold/25 bg-cream-deep p-4">
            <legend className="px-1 text-sm font-medium text-ink">Mënyra e pagesës</legend>
            <label className="mt-1 flex items-start gap-3 text-sm text-ink">
              <input type="radio" name="pagesa" value="cod" checked readOnly className="mt-1 accent-[var(--gold-deep)]" />
              <span>
                <span className="font-medium">Paguaj me para në dorë</span>
                <span className="mt-1 block text-ink-soft">
                  Paguani kurierit kur të mbërrijë pakoja. E vetmja mënyrë pagese që ofron dyqani.
                </span>
              </span>
            </label>
          </fieldset>

          <div aria-live="polite" className="mt-5">
            {error ? <FormMessage tone="error">{error}</FormMessage> : null}
          </div>

          <button
            type="submit"
            disabled={submitting}
            aria-busy={submitting}
            className="btn-gold mt-5 w-full disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Po dërgohet porosia…" : "Konfirmo porosinë — paguaj në dorëzim"}
          </button>
          <p className="mt-3 text-center text-xs text-ink-soft">
            Duke konfirmuar, porosia regjistrohet dhe ju telefonojmë për ta vërtetuar. Nuk paguhet asgjë tani.
          </p>
        </form>

        <aside className="card-soft h-fit p-6" aria-label="Përmbledhje e porosisë">
          <h2 className="font-display text-2xl text-ink">Porosia juaj</h2>
          <ul className="mt-4 space-y-3 text-sm">
            {lines.map((line) => (
              <li key={`${line.productId}-${line.variantId ?? line.variant ?? ""}`} className="flex gap-3">
                <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-beige">
                  {line.imageUrl ? (
                    <img src={line.imageUrl} alt={line.name} className="h-full w-full object-cover" />
                  ) : null}
                </div>
                <div className="flex-1">
                  <p className="text-ink">{line.name}</p>
                  <p className="text-xs text-ink-soft">
                    {line.quantity} × {formatEuro(line.price)}
                  </p>
                </div>
                <span className="text-ink">{formatEuro(toNumber(line.price) * line.quantity)}</span>
              </li>
            ))}
          </ul>
          <dl className="mt-5 space-y-3 border-t border-gold/25 pt-4 text-sm">
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
              <dd className="font-medium text-gold-deep">{formatEuro(estimatedTotal)}</dd>
            </div>
          </dl>
          <p className="mt-3 text-xs leading-relaxed text-ink-soft">
            {threshold > 0
              ? `Dërgesa falas mbi ${formatEuro(threshold)}. ${
                  subtotal >= threshold ? "Kjo porosi ka dërgesë falas." : ""
                }`
              : null}{" "}
            Çmimet, dërgesa dhe stoku konfirmohen nga dyqani kur porosia regjistrohet; totali përfundimtar shfaqet në
            faqen e konfirmimit.
          </p>
          <Link to="/shporta" className="mt-4 block text-center text-sm text-ink-soft underline underline-offset-4 hover:text-gold-deep">
            Ndrysho shportën
          </Link>
        </aside>
      </div>
    </main>
  );
}
