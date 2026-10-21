import { Link, createFileRoute } from "@tanstack/react-router";
import { formatEuro } from "~/lib/format";
import { getOrderByToken } from "~/server/checkout";
/**
 * /porosia/$token — the real order confirmation.
 *
 * The URL carries a 32-byte random view token, never a sequential id, so an order can
 * only be opened by someone holding the link. Every value on this page was read back
 * from the database after the order was written — nothing here is invented: no payment
 * confirmation (the shop takes cash on delivery), no delivery date, no tracking number.
 */
export const Route = createFileRoute("/porosia/$token")({
  loader: async ({ params }) => await getOrderByToken({ data: { token: params.token } }),
  head: () => ({
    meta: [
      { title: "Konfirmimi i porosisë — HandmadeAVA" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: ConfirmationPage,
});

function ConfirmationPage() {
  const view = Route.useLoaderData();

  if (!view.dbReady) {
    return (
      <main className="container-shop py-16">
        <div className="card-soft mx-auto max-w-xl p-8 text-center">
          <h1 className="font-display text-2xl text-ink">Porosia nuk mund të shfaqet tani</h1>
          <p className="mt-3 text-sm leading-relaxed text-ink-soft">
            Lidhja me bazën e të dhënave dështoi. Provoni të rifreskoni faqen pas pak.
          </p>
        </div>
      </main>
    );
  }

  if (!view.found || !view.order) {
    return (
      <main className="container-shop py-16">
        <div className="card-soft mx-auto max-w-xl p-8 text-center">
          <p aria-hidden className="font-display text-3xl text-gold">
            ✿
          </p>
          <h1 className="mt-2 font-display text-2xl text-ink">Kjo porosi nuk u gjet</h1>
          <p className="mt-3 text-sm leading-relaxed text-ink-soft">
            Lidhja e konfirmimit nuk është e vlefshme ose porosia nuk ekziston. Nëse sapo porositët, kontrolloni
            lidhjen në faqen e konfirmimit që u hap pas dërgimit.
          </p>
          <Link to="/dyqani" className="btn-outline mt-6 inline-flex">
            Kthehu në dyqan
          </Link>
        </div>
      </main>
    );
  }

  const order = view.order;
  const placed = new Date(order.createdAt);

  return (
    <main className="container-shop py-12">
      <div className="card-soft mx-auto max-w-3xl p-6 sm:p-10">
        <p className="eyebrow">Porosia u regjistrua</p>
        <h1 className="mt-3 font-display text-3xl text-ink sm:text-4xl">Faleminderit, {order.customerName.split(" ")[0]}!</h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-soft">
          Porosia juaj është ruajtur me numrin{" "}
          <strong className="font-medium text-ink">{order.orderNumber}</strong>. Do të telefonojmë në{" "}
          {order.customerPhone} për ta vërtetuar. Ruajeni këtë lidhje për t'u kthyer te porosia.
        </p>

        <dl className="mt-6 grid gap-3 rounded-[var(--radius-card)] border border-gold/25 bg-cream-deep p-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-ink-soft">Numri i porosisë</dt>
            <dd className="font-medium text-ink">{order.orderNumber}</dd>
          </div>
          <div>
            <dt className="text-ink-soft">Data e porosisë</dt>
            <dd className="font-medium text-ink">
              {Number.isNaN(placed.getTime())
                ? order.createdAt
                : placed.toLocaleString("sq-AL", { dateStyle: "long", timeStyle: "short" })}
            </dd>
          </div>
          <div>
            <dt className="text-ink-soft">Statusi</dt>
            <dd className="font-medium text-ink">{order.statusLabel}</dd>
          </div>
          <div>
            <dt className="text-ink-soft">Mënyra e pagesës</dt>
            <dd className="font-medium text-ink">Paguaj me para në dorë</dd>
          </div>
        </dl>

        <h2 className="mt-8 font-display text-xl text-ink">Pjesët e porositura</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[26rem] text-left text-sm">
            <thead>
              <tr className="border-b border-gold/25 text-xs uppercase tracking-wide text-ink-soft">
                <th scope="col" className="py-2 pr-3 font-medium">
                  Pjesa
                </th>
                <th scope="col" className="py-2 pr-3 text-right font-medium">
                  Çmimi
                </th>
                <th scope="col" className="py-2 pr-3 text-right font-medium">
                  Sasia
                </th>
                <th scope="col" className="py-2 text-right font-medium">
                  Nëntotali
                </th>
              </tr>
            </thead>
            <tbody>
              {view.items.map((item, index) => (
                <tr key={`${item.name}-${index}`} className="border-b border-gold/15">
                  <td className="py-3 pr-3 text-ink">
                    {item.name}
                    {item.variant ? <span className="block text-xs text-ink-soft">{item.variant}</span> : null}
                  </td>
                  <td className="py-3 pr-3 text-right text-ink">{formatEuro(item.unitPrice)}</td>
                  <td className="py-3 pr-3 text-right text-ink">{item.quantity}</td>
                  <td className="py-3 text-right text-ink">{formatEuro(item.lineTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <dl className="mt-5 space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-ink-soft">Nëntotali</dt>
            <dd className="text-ink">{formatEuro(order.subtotal)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-soft">Dërgesa</dt>
            <dd className="text-ink">{Number(order.deliveryCost) === 0 ? "Falas" : formatEuro(order.deliveryCost)}</dd>
          </div>
          <div className="flex justify-between border-t border-gold/25 pt-3 text-base">
            <dt className="font-medium text-ink">Totali për t'u paguar në dorëzim</dt>
            <dd className="font-medium text-gold-deep">{formatEuro(order.total)}</dd>
          </div>
        </dl>

        <div className="mt-8 grid gap-6 sm:grid-cols-2">
          <div>
            <h2 className="font-display text-xl text-ink">Adresa e dërgesës</h2>
            <address className="mt-2 text-sm not-italic leading-relaxed text-ink-soft">
              {order.customerName}
              <br />
              {order.customerPhone}
              {order.addressLines.map((line) => (
                <span key={line} className="block">
                  {line}
                </span>
              ))}
            </address>
          </div>
          <div>
            <h2 className="font-display text-xl text-ink">Pagesa</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">
              Paguani {formatEuro(order.total)} kurierit kur pakoja të mbërrijë. Nuk kërkohet pagesë online dhe nuk
              ruhet asnjë e dhënë karte.
            </p>
          </div>
        </div>

        {order.notes ? (
          <div className="mt-6 rounded-[var(--radius-card)] border border-gold/25 bg-cream-deep p-4">
            <h2 className="text-sm font-medium text-ink">Shënimi juaj</h2>
            <p className="mt-1 text-sm text-ink-soft">{order.notes}</p>
          </div>
        ) : null}

        <div className="mt-8 flex flex-wrap gap-3">
          <Link to="/dyqani" className="btn-gold">
            Vazhdo blerjen
          </Link>
          {order.isOwner ? (
            <Link to="/llogaria/porosite" className="btn-outline">
              Porositë e mia
            </Link>
          ) : (
            <Link to="/regjistrohu" className="btn-outline">
              Krijo llogari
            </Link>
          )}
        </div>
        <p className="mt-6 text-xs leading-relaxed text-ink-soft">
          Për çdo pyetje për porosinë, citoni numrin {order.orderNumber}.
        </p>
      </div>
    </main>
  );
}
