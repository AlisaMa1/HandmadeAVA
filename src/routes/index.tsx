import { Link, createFileRoute } from "@tanstack/react-router";
import { getHome } from "~/server/catalog";
import { EmptyState, ProductCard, SectionHeading } from "~/components/ui";

export const Route = createFileRoute("/")({
  loader: async () => await getHome(),
  head: () => ({
    meta: [
      { title: "HandmadeAVA — bizhuteri me perla të bëra me dorë" },
      {
        name: "description",
        content:
          "Gjerdanë, byzylykë, vathë dhe komplete me perla, të punuar me dorë nga HandmadeAVA. Porosit online, paguaj në dorëzim.",
      },
    ],
  }),
  component: Home,
});

function Home() {
  const data = Route.useLoaderData();
  const { settings, categories, featured, newArrivals } = data;

  return (
    <main>
      {/* hero */}
      <section className="border-b border-gold/20 bg-gradient-to-b from-cream via-cream to-beige/50">
        <div className="container-shop grid items-center gap-10 py-14 md:grid-cols-2 md:py-20">
          <div>
            <p className="eyebrow">Koleksion i ri</p>
            <h1 className="mt-4 font-display text-4xl leading-[1.1] text-ink sm:text-5xl lg:text-6xl">
              {settings.hero_title}
            </h1>
            <p className="mt-5 max-w-md text-base leading-relaxed text-ink-soft">{settings.hero_subtitle}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/dyqani" className="btn-gold">
                Shiko koleksionin
              </Link>
              <a href="#kategorite" className="btn-outline">
                Kategoritë
              </a>
            </div>
          </div>
          <div className="relative">
            <div className="absolute -inset-3 rounded-[calc(var(--radius-card)+0.75rem)] bg-blush/40" aria-hidden />
            <img
              src={settings.hero_image_url}
              alt="Gjerdan me perla të bëra me dorë, i vendosur mbi sfond krem"
              className="relative aspect-[4/3] w-full rounded-[var(--radius-card)] object-cover shadow-sm"
            />
          </div>
        </div>
      </section>

      {/* featured */}
      <section className="container-shop py-16">
        <SectionHeading eyebrow="Të zgjedhura" title="Pjesët tona më të dashura">
          <Link to="/dyqani" className="text-sm text-gold-deep hover:underline">
            Shiko të gjitha →
          </Link>
        </SectionHeading>
        {featured.length > 0 ? (
          <div className="grid grid-cols-2 gap-5 lg:grid-cols-4">
            {featured.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        ) : (
          <EmptyState
            title="Katalogu po përgatitet"
            description="Pjesët e para po fotografohen dhe po shtohen. Kthehuni së shpejti për të parë koleksionin e plotë."
          />
        )}
      </section>

      {/* categories */}
      <section id="kategorite" className="border-y border-gold/20 bg-cream-deep py-16">
        <div className="container-shop">
          <SectionHeading eyebrow="Kategoritë" title="Gjej stilin tënd" />
          {categories.length > 0 ? (
            <div className="grid grid-cols-2 gap-5 md:grid-cols-3 lg:grid-cols-5">
              {categories.map((c) => (
                <Link
                  key={c.id}
                  to="/kategoria/$slug"
                  params={{ slug: c.slug }}
                  className="group card-soft overflow-hidden"
                >
                  <div className="aspect-square overflow-hidden bg-beige">
                    {c.imageUrl ? (
                      <img
                        src={c.imageUrl}
                        alt={`Kategoria ${c.name}`}
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : null}
                  </div>
                  <div className="p-4">
                    <p className="font-display text-lg text-ink group-hover:text-gold-deep">{c.name}</p>
                    <p className="mt-1 text-xs text-ink-soft">{c.productCount} produkte</p>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState
              title="Kategoritë po shtohen"
              description="Sapo katalogu të lidhet me bazën e të dhënave, kategoritë do të shfaqen këtu."
            />
          )}
        </div>
      </section>

      {/* new arrivals */}
      <section className="container-shop py-16">
        <SectionHeading eyebrow="Të reja" title="Sapo mbërritur">
          <Link to="/dyqani" className="text-sm text-gold-deep hover:underline">
            Shiko dyqanin →
          </Link>
        </SectionHeading>
        {newArrivals.length > 0 ? (
          <div className="grid grid-cols-2 gap-5 lg:grid-cols-4">
            {newArrivals.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        ) : (
          <EmptyState
            title="Pa produkte të reja për momentin"
            description="Po punojmë për pjesët e ardhshme. Ndërkohë, shikoni gjithçka në dyqan."
            actionLabel="Shko në dyqan"
          />
        )}
      </section>

      {/* promo */}
      <section className="container-shop pb-16">
        <div className="card-soft grid gap-6 border-gold/30 bg-white px-6 py-10 sm:px-10 md:grid-cols-[1.4fr_1fr] md:items-center">
          <div>
            <p className="eyebrow">Dërgesa & pagesa</p>
            <h2 className="mt-3 font-display text-3xl text-ink">{settings.promo_title}</h2>
            <p className="mt-3 max-w-lg text-sm leading-relaxed text-ink-soft">{settings.promo_text}</p>
          </div>
          <div className="md:justify-self-end">
            <a
              className="btn-gold w-full md:w-auto"
              href={settings.instagram_url}
              target="_blank"
              rel="noreferrer noopener"
            >
              Na ndiq në Instagram
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
