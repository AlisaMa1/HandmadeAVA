import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { getShop } from "~/server/catalog";
import { EmptyState, ProductCard, SkeletonGrid } from "~/components/ui";

export type ShopSearch = {
  q?: string;
  kategoria?: string;
  min?: string;
  max?: string;
  stok?: string;
  renditja?: "newest" | "price_asc" | "price_desc" | "name";
};

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() !== "" ? v : undefined;
}

export const Route = createFileRoute("/dyqani")({
  validateSearch: (search: Record<string, unknown>): ShopSearch => ({
    q: str(search.q),
    kategoria: str(search.kategoria),
    min: str(search.min),
    max: str(search.max),
    stok: search.stok === "1" ? "1" : undefined,
    renditja: ["newest", "price_asc", "price_desc", "name"].includes(String(search.renditja))
      ? (search.renditja as ShopSearch["renditja"])
      : undefined,
  }),
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) =>
    getShop({
      data: {
        q: deps.q,
        category: deps.kategoria,
        minPrice: deps.min ? Number(deps.min) : null,
        maxPrice: deps.max ? Number(deps.max) : null,
        inStock: deps.stok === "1",
        sort: deps.renditja ?? "newest",
      },
    }),
  pendingComponent: () => (
    <div className="container-shop py-16">
      <SkeletonGrid />
    </div>
  ),
  head: () => ({
    meta: [
      { title: "Dyqani — HandmadeAVA" },
      {
        name: "description",
        content: "Të gjitha bizhuteritë me perla të HandmadeAVA: gjerdanë, byzylykë, vathë, komplete dhe aksesorë.",
      },
    ],
  }),
  component: Shop,
});

function Shop() {
  const data = Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const [q, setQ] = useState(search.q ?? "");

  const update = (next: Partial<ShopSearch>) => {
    void navigate({ to: "/dyqani", search: { ...search, ...next } as ShopSearch });
  };

  return (
    <main className="container-shop py-12">
      <p className="eyebrow">Dyqani</p>
      <h1 className="mt-3 font-display text-4xl text-ink sm:text-5xl">Koleksioni i plotë</h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-soft">
        Çdo pjesë punohet me dorë, në sasi të kufizuar. Përdorni filtrat për të gjetur shpejt atë që kërkoni.
      </p>

      <form
        className="card-soft mt-8 flex flex-col gap-4 p-5 sm:p-6"
        onSubmit={(event) => {
          event.preventDefault();
          update({ q: q.trim() === "" ? undefined : q.trim() });
        }}
        role="search"
      >
        <div className="grid gap-4 md:grid-cols-[2fr_1.2fr_1.2fr]">
          <div>
            <label htmlFor="kerko" className="mb-1.5 block text-xs uppercase tracking-wider text-ink-soft">
              Kërko produkt
            </label>
            <input
              id="kerko"
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="p.sh. gjerdan me perla"
              className="input-soft"
            />
          </div>
          <div>
            <label htmlFor="kategoria" className="mb-1.5 block text-xs uppercase tracking-wider text-ink-soft">
              Kategoria
            </label>
            <select
              id="kategoria"
              value={search.kategoria ?? ""}
              onChange={(e) => update({ kategoria: e.target.value || undefined })}
              className="input-soft"
            >
              <option value="">Të gjitha kategoritë</option>
              {data.categories.map((c) => (
                <option key={c.id} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="renditja" className="mb-1.5 block text-xs uppercase tracking-wider text-ink-soft">
              Rendit sipas
            </label>
            <select
              id="renditja"
              value={search.renditja ?? "newest"}
              onChange={(e) => update({ renditja: e.target.value as ShopSearch["renditja"] })}
              className="input-soft"
            >
              <option value="newest">Më të rejat</option>
              <option value="price_asc">Çmimi: nga më i ulëti</option>
              <option value="price_desc">Çmimi: nga më i larti</option>
              <option value="name">Emri (A–Z)</option>
            </select>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end">
          <div>
            <label htmlFor="min" className="mb-1.5 block text-xs uppercase tracking-wider text-ink-soft">
              Çmimi nga (€)
            </label>
            <input
              id="min"
              type="number"
              min={0}
              step="1"
              value={search.min ?? ""}
              onChange={(e) => update({ min: e.target.value || undefined })}
              className="input-soft"
            />
          </div>
          <div>
            <label htmlFor="max" className="mb-1.5 block text-xs uppercase tracking-wider text-ink-soft">
              Çmimi deri (€)
            </label>
            <input
              id="max"
              type="number"
              min={0}
              step="1"
              value={search.max ?? ""}
              onChange={(e) => update({ max: e.target.value || undefined })}
              className="input-soft"
            />
          </div>
          <label className="flex items-center gap-2 pb-2.5 text-sm text-ink-soft">
            <input
              type="checkbox"
              checked={search.stok === "1"}
              onChange={(e) => update({ stok: e.target.checked ? "1" : undefined })}
              className="h-4 w-4 rounded border-gold/50 text-gold-deep"
            />
            Vetëm në stok
          </label>
          <div className="flex gap-2 pb-0.5">
            <button type="submit" className="btn-gold">
              Kërko
            </button>
            <button
              type="button"
              className="btn-outline"
              onClick={() => {
                setQ("");
                void navigate({ to: "/dyqani", search: {} });
              }}
            >
              Pastro
            </button>
          </div>
        </div>
      </form>

      <div className="mt-8">
        {!data.dbReady ? (
          <EmptyState
            title="Katalogu po përgatitet"
            description="Dyqani po lidhet me bazën e të dhënave. Sapo katalogu të jetë gati, produktet do të shfaqen këtu automatikisht."
            actionLabel="Kthehu në ballinë"
            actionTo="/"
          />
        ) : data.products.length === 0 ? (
          <EmptyState
            title="Asnjë produkt nuk përputhet"
            description="Provoni një kërkim tjetër ose hiqni filtrat për të parë të gjithë koleksionin."
          />
        ) : (
          <>
            <p className="mb-5 text-sm text-ink-soft" aria-live="polite">
              {data.total} {data.total === 1 ? "produkt" : "produkte"}
              {search.q ? ` për “${search.q}”` : ""}
            </p>
            <div className="grid grid-cols-2 gap-x-5 gap-y-10 lg:grid-cols-4">
              {data.products.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </>
        )}
      </div>

      <p className="mt-12 text-sm text-ink-soft">
        Kërkoni një kategori të veçantë?{" "}
        <Link to="/" hash="kategorite" className="text-gold-deep hover:underline">
          Shikoni kategoritë
        </Link>
        .
      </p>
    </main>
  );
}
