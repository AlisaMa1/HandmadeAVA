import { Link, createFileRoute } from "@tanstack/react-router";
import { FormMessage } from "~/components/form";
import { listMyOrders } from "~/server/accounts";

/**
 * /llogaria/porosite — the signed-in customer's OWN orders. The query is filtered by
 * `profile_id = <session user id>`, so it can only ever return that customer's rows.
 * Checkout ships in step 3, so today this is genuinely empty: we show an honest empty
 * state rather than inventing sample orders.
 */
export const Route = createFileRoute("/llogaria/porosite")({
  loader: async () => {
    const orders = await listMyOrders();
    return {
      orders: orders.ok ? orders.data : [],
      error: orders.ok ? null : orders.error,
    };
  },
  head: () => ({ meta: [{ title: "Porositë e mia — HandmadeAVA" }] }),
  component: MyOrdersPage,
});

function MyOrdersPage() {
  const { orders, error } = Route.useLoaderData();

  return (
    <div className="container-shop flex flex-col gap-6 pb-16">
      <section className="card-soft p-6 sm:p-8">
        <h2 className="font-display text-2xl text-ink">Porositë e mia</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">
          Këtu shfaqen vetëm porositë e kryer me këtë llogari, bashkë me statusin e tyre.
        </p>

        <div className="mt-6">
          {error ? <FormMessage tone="error">{error}</FormMessage> : null}

          {!error && orders.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-[var(--radius-card)] border border-gold/25 bg-cream-deep px-6 py-12 text-center">
              <span aria-hidden className="font-display text-3xl text-gold">
                ✿
              </span>
              <p className="font-display text-xl text-ink">Nuk keni ende porosi</p>
              <p className="max-w-md text-sm leading-relaxed text-ink-soft">
                Sapo të kryeni porosinë tuaj të parë, ajo do të shfaqet këtu me statusin përkatës.
                Porositë paguhen në dorëzim, kur pakoja mbërrin.
              </p>
              <Link to="/dyqani" className="btn-gold mt-2">
                Shiko dyqanin
              </Link>
            </div>
          ) : null}

          {orders.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[34rem] border-collapse text-left text-sm">
                <caption className="sr-only">Lista e porosive tuaja</caption>
                <thead>
                  <tr className="border-b border-gold/25 text-xs uppercase tracking-[0.15em] text-ink-soft">
                    <th scope="col" className="py-3 pr-4 font-medium">
                      Numri
                    </th>
                    <th scope="col" className="py-3 pr-4 font-medium">
                      Data
                    </th>
                    <th scope="col" className="py-3 pr-4 font-medium">
                      Artikuj
                    </th>
                    <th scope="col" className="py-3 pr-4 font-medium">
                      Totali
                    </th>
                    <th scope="col" className="py-3 font-medium">
                      Statusi
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr key={order.id} className="border-b border-gold/15 text-ink-soft">
                      <td className="py-3 pr-4 font-medium text-ink">{order.orderNumber}</td>
                      <td className="py-3 pr-4">{formatDate(order.createdAt)}</td>
                      <td className="py-3 pr-4">{order.itemCount}</td>
                      <td className="py-3 pr-4">{order.total} €</td>
                      <td className="py-3">
                        <span className="rounded-full bg-beige px-3 py-1 text-xs text-gold-deep">
                          {order.statusLabel}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("sq-AL", { day: "2-digit", month: "long", year: "numeric" }).format(date);
}
