import { Link, createFileRoute, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { getProduct } from "~/server/catalog";
import { EmptyState, PriceTag, ProductCard, StockBadge } from "~/components/ui";
import { addToCart } from "~/lib/cart";
import { formatEuro, toNumber } from "~/lib/format";

export const Route = createFileRoute("/produkti/$slug")({
  loader: async ({ params }) => {
    const data = await getProduct({ data: { slug: params.slug } });
    if (data.dbReady && !data.found) throw notFound();
    return data;
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.product?.name ?? "Produkti"} — HandmadeAVA` },
      {
        name: "description",
        content:
          (loaderData?.product?.description ?? "").slice(0, 155) ||
          "Bizhuteri me perla të bëra me dorë nga HandmadeAVA. Porosit online, paguaj në dorëzim.",
      },
    ],
  }),
  component: ProductPage,
});

function ProductPage() {
  const data = Route.useLoaderData();
  const product = data.product;
  const [activeImage, setActiveImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [variantId, setVariantId] = useState<string | null>(data.variants[0]?.id ?? null);
  const [added, setAdded] = useState(false);

  if (!product) {
    return (
      <main className="container-shop py-16">
        <EmptyState
          title="Katalogu po përgatitet"
          description="Produkti do të shfaqet sapo katalogu të lidhet me bazën e të dhënave."
          actionLabel="Kthehu në ballinë"
          actionTo="/"
        />
      </main>
    );
  }

  const variant = data.variants.find((v) => v.id === variantId) ?? null;
  const base = toNumber(product.salePrice ?? product.price);
  const unit = base + (variant ? toNumber(variant.priceDelta) : 0);
  const inStock = (variant ? variant.stock : product.stock) > 0;
  const image = data.images[activeImage];

  return (
    <main className="container-shop py-10">
      <nav aria-label="Rruga" className="text-xs text-ink-soft">
        <Link to="/" className="hover:text-gold-deep">
          Ballina
        </Link>
        <span aria-hidden> / </span>
        <Link to="/kategoria/$slug" params={{ slug: product.categorySlug }} className="hover:text-gold-deep">
          {product.categoryName}
        </Link>
        <span aria-hidden> / </span>
        <span className="text-ink">{product.name}</span>
      </nav>

      <div className="mt-6 grid gap-10 lg:grid-cols-2">
        <div>
          <div className="aspect-square overflow-hidden rounded-[var(--radius-card)] border border-gold/20 bg-beige">
            {image ? (
              <img src={image.url} alt={image.alt ?? product.name} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-ink-soft">Foto së shpejti</div>
            )}
          </div>
          {data.images.length > 1 ? (
            <ul className="mt-3 flex gap-3" aria-label="Galeria e fotove">
              {data.images.map((img, index) => (
                <li key={img.url}>
                  <button
                    type="button"
                    onClick={() => setActiveImage(index)}
                    aria-label={`Shiko foton ${index + 1}`}
                    aria-pressed={index === activeImage}
                    className={`h-20 w-20 overflow-hidden rounded-xl border ${
                      index === activeImage ? "border-gold-deep" : "border-gold/25"
                    }`}
                  >
                    <img src={img.url} alt={img.alt ?? ""} className="h-full w-full object-cover" loading="lazy" />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <div>
          <p className="eyebrow">{product.categoryName}</p>
          <h1 className="mt-2 font-display text-3xl text-ink sm:text-4xl">{product.name}</h1>
          <div className="mt-4 flex items-center gap-4">
            <PriceTag price={product.price} salePrice={product.salePrice} className="text-xl" />
            <StockBadge stock={variant ? variant.stock : product.stock} />
          </div>
          {product.description ? (
            <p className="mt-5 text-sm leading-relaxed text-ink-soft">{product.description}</p>
          ) : null}
          {product.sku ? <p className="mt-4 text-xs text-ink-soft">Kodi: {product.sku}</p> : null}

          {data.variants.length > 0 ? (
            <fieldset className="mt-6">
              <legend className="mb-2 text-xs uppercase tracking-wider text-ink-soft">Zgjidh variantin</legend>
              <div className="flex flex-wrap gap-2">
                {data.variants.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setVariantId(v.id)}
                    aria-pressed={variantId === v.id}
                    className={`rounded-full border px-4 py-2 text-sm transition-colors ${
                      variantId === v.id
                        ? "border-gold-deep bg-gold-deep text-white"
                        : "border-gold/40 text-ink-soft hover:border-gold-deep"
                    }`}
                  >
                    {v.value}
                    {toNumber(v.priceDelta) > 0 ? ` (+${formatEuro(v.priceDelta)})` : ""}
                  </button>
                ))}
              </div>
            </fieldset>
          ) : null}

          <div className="mt-6 flex flex-wrap items-end gap-4">
            <div>
              <label htmlFor="sasia" className="mb-1.5 block text-xs uppercase tracking-wider text-ink-soft">
                Sasia
              </label>
              <input
                id="sasia"
                type="number"
                min={1}
                max={Math.max(1, variant ? variant.stock : product.stock)}
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
                className="input-soft w-24"
                disabled={!inStock}
              />
            </div>
            <button
              type="button"
              disabled={!inStock}
              onClick={() => {
                addToCart({
                  productId: product.id,
                  slug: product.slug,
                  name: product.name + (variant ? ` — ${variant.value}` : ""),
                  price: unit,
                  imageUrl: image?.url ?? null,
                  quantity,
                  variant: variant?.value ?? null,
                  stock: variant ? variant.stock : product.stock,
                });
                setAdded(true);
              }}
              className="btn-gold"
            >
              {inStock ? "Shto në shportë" : "Nuk ka stok"}
            </button>
            <Link to="/shporta" className="btn-outline">
              Shiko shportën
            </Link>
          </div>
          <p className="mt-3 min-h-5 text-sm text-gold-deep" role="status" aria-live="polite">
            {added ? "U shtua në shportë ✓" : ""}
          </p>

          <div className="card-soft mt-8 space-y-2 p-5 text-sm text-ink-soft">
            <p>✓ Paguaj në dorëzim, kur pakoja të mbërrijë.</p>
            <p>✓ Dërgesa 2–4 ditë pune në të gjithë Shqipërinë.</p>
            <p>✓ E paketuar me kujdes, gati për dhuratë.</p>
          </div>
        </div>
      </div>

      {data.related.length > 0 ? (
        <section className="mt-16">
          <h2 className="font-display text-2xl text-ink">Mund të pëlqejnë edhe</h2>
          <div className="mt-6 grid grid-cols-2 gap-x-5 gap-y-10 lg:grid-cols-4">
            {data.related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}
