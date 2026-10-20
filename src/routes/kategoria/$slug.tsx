import { Link, createFileRoute, notFound } from "@tanstack/react-router";
import { getCategoryPage } from "~/server/catalog";
import { EmptyState, ProductCard } from "~/components/ui";

export const Route = createFileRoute("/kategoria/$slug")({
  loader: async ({ params }) => {
    const data = await getCategoryPage({ data: { slug: params.slug } });
    if (data.dbReady && data.category === null) throw notFound();
    return data;
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.category?.name ?? "Kategoria"} — HandmadeAVA` },
      {
        name: "description",
        content:
          loaderData?.category?.description ??
          "Bizhuteri me perla të bëra me dorë nga HandmadeAVA. Pago në dorëzim.",
      },
    ],
  }),
  component: CategoryPage,
});

function CategoryPage() {
  const data = Route.useLoaderData();
  const category = data.category;

  return (
    <main>
      <section className="border-b border-gold/20 bg-cream-deep">
        <div className="container-shop py-12">
          <nav aria-label="Rruga" className="text-xs text-ink-soft">
            <Link to="/" className="hover:text-gold-deep">
              Ballina
            </Link>
            <span aria-hidden> / </span>
            <Link to="/dyqani" className="hover:text-gold-deep">
              Dyqani
            </Link>
            {category ? (
              <>
                <span aria-hidden> / </span>
                <span className="text-ink">{category.name}</span>
              </>
            ) : null}
          </nav>
          <h1 className="mt-4 font-display text-4xl text-ink sm:text-5xl">{category?.name ?? "Kategoria"}</h1>
          {category?.description ? (
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-soft">{category.description}</p>
          ) : null}
          <p className="mt-2 text-xs uppercase tracking-[0.18em] text-gold-deep">
            {data.products.length} {data.products.length === 1 ? "produkt" : "produkte"}
          </p>
        </div>
      </section>

      <section className="container-shop py-12">
        {!data.dbReady ? (
          <EmptyState
            title="Katalogu po përgatitet"
            description="Kategoria do të shfaqet sapo katalogu të lidhet me bazën e të dhënave."
            actionLabel="Kthehu në ballinë"
            actionTo="/"
          />
        ) : data.products.length === 0 ? (
          <EmptyState
            title="Kjo kategori është bosh për momentin"
            description="Po shtojmë pjesë të reja. Shikoni produktet e tjera ndërkaq."
            actionLabel="Të gjitha produktet"
          />
        ) : (
          <div className="grid grid-cols-2 gap-x-5 gap-y-10 lg:grid-cols-4">
            {data.products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
