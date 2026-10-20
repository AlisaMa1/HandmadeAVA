/**
 * Seed HandmadeAVA's starter catalogue.
 *
 *   bun run db:seed
 *
 * Everything inserted here is ILLUSTRATIVE SAMPLE DATA (`is_sample = true`,
 * `_sample-` image files) so the owner can click through the shop before real products
 * and photos exist. Re-running deletes the previous sample rows and re-inserts them;
 * real (non-sample) products are never touched.
 */
import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set. Connect Neon Postgres and set DATABASE_URL, then re-run.");
  process.exit(1);
}
const sql = neon(url);

type SeedProduct = {
  slug: string;
  name: string;
  description: string;
  price: number;
  sale?: number;
  sku: string;
  stock: number;
  category: string;
  featured?: boolean;
  isNew?: boolean;
  best?: boolean;
  images: { url: string; alt: string }[];
  variants?: { kind: "colour" | "size"; value: string; delta?: number; stock?: number }[];
};

const categories = [
  {
    slug: "gjerdane-me-perla",
    name: "Gjerdanë me perla",
    description: "Gjerdanë me perla natyrale dhe deti, të lidhura me dorë një nga një.",
    image: "/images/_sample-gjerdan-perla.png",
    sort: 1,
  },
  {
    slug: "byzylike",
    name: "Byzylykë",
    description: "Byzylykë delikatë me perla, rruaza qelqi dhe detaje ari.",
    image: "/images/_sample-byzylyk-perla.png",
    sort: 2,
  },
  {
    slug: "vathe",
    name: "Vathë",
    description: "Vathë të lehtë për përdorim të përditshëm dhe për raste të veçanta.",
    image: "/images/_sample-vathe.svg",
    sort: 3,
  },
  {
    slug: "komplete",
    name: "Komplete",
    description: "Komplete gjerdan + byzylyk, të paketuara si dhuratë.",
    image: "/images/_sample-komplet.svg",
    sort: 4,
  },
  {
    slug: "aksesore",
    name: "Aksesorë",
    description: "Kapëse flokësh, rrathë qafe dhe detaje të vogla me perlë.",
    image: "/images/_sample-aksesore.svg",
    sort: 5,
  },
];

const products: SeedProduct[] = [
  {
    slug: "gjerdan-perla-e-detit",
    name: "Gjerdan “Perla e Detit”",
    description:
      "Gjerdan me perla deti të vërteta dhe një mbyllje të hollë ari. Rri butë në qafë dhe shkon njësoj mirë me një bluzë të bardhë ditën dhe me fustan në mbrëmje. Gjatësi 42 cm, e rregullueshme me 3 cm shtesë.",
    price: 42,
    sale: 36,
    sku: "HAVA-GJ-001",
    stock: 6,
    category: "gjerdane-me-perla",
    featured: true,
    best: true,
    images: [
      { url: "/images/_sample-gjerdan-perla.png", alt: "Gjerdan me perla deti dhe mbyllje ari mbi sfond krem" },
      { url: "/images/_sample-gjerdan-i-gjate.svg", alt: "Detaj i gjerdanit me perla të renditura" },
    ],
    variants: [
      { kind: "size", value: "40 cm", delta: 0, stock: 3 },
      { kind: "size", value: "45 cm", delta: 2.5, stock: 3 },
      { kind: "colour", value: "Perlë e bardhë", delta: 0, stock: 4 },
      { kind: "colour", value: "Perlë rozë", delta: 1.5, stock: 2 },
    ],
  },
  {
    slug: "gjerdan-i-gjate-hena",
    name: "Gjerdan i gjatë “Hëna”",
    description:
      "Gjerdan i gjatë me perla në madhësi të ndryshme, i lidhur me dorë. Vishet dy herë rreth qafës ose i lirshëm mbi një triko. Gjatësi 90 cm.",
    price: 54,
    sku: "HAVA-GJ-002",
    stock: 4,
    category: "gjerdane-me-perla",
    isNew: true,
    images: [{ url: "/images/_sample-gjerdan-i-gjate.svg", alt: "Gjerdan i gjatë me perla mbi sfond bezhë" }],
  },
  {
    slug: "byzylyk-deja-e-perlave",
    name: "Byzylyk “Deja e Perlave”",
    description:
      "Byzylyk me perla të vogla dhe një fije ari që shkëlqen nga larg. Elastic, mbahet pa mbyllje, i përshtatshëm për dhuratë të shpejtë.",
    price: 26,
    sku: "HAVA-BY-001",
    stock: 10,
    category: "byzylike",
    featured: true,
    images: [{ url: "/images/_sample-byzylyk-perla.png", alt: "Byzylyk me perla dhe rruaza ari mbi liri bezhë" }],
  },
  {
    slug: "byzylyk-i-arte-bleta",
    name: "Byzylyk i artë “Bleta”",
    description: "Byzylyk i hollë me zinxhir të praruar dhe një perlë të vetme si pikë fokusi. Gjatësi 17 cm + 3 cm zgjatim.",
    price: 22.5,
    sale: 18.9,
    sku: "HAVA-BY-002",
    stock: 8,
    category: "byzylike",
    best: true,
    images: [{ url: "/images/_sample-byzylyk-i-arte.svg", alt: "Byzylyk i hollë i praruar me një perlë" }],
  },
  {
    slug: "vathe-pika-perle",
    name: "Vathë “Pika Perlë”",
    description: "Vathë të vegjël me perlë të bardhë mbi argjend 925. Të lehtë sa harrohet që i ke veshur.",
    price: 19.9,
    sku: "HAVA-VA-001",
    stock: 12,
    category: "vathe",
    isNew: true,
    images: [{ url: "/images/_sample-vathe.svg", alt: "Vathë të vegjël me perlë mbi sfond rozë të lehtë" }],
  },
  {
    slug: "vathe-kaskada",
    name: "Vathë të gjatë “Kaskada”",
    description:
      "Vathë të gjatë me tri perla që bien njëra pas tjetrës. Për dasma, për ditëlindje, për çdo rast ku do të dukesh ndryshe.",
    price: 24,
    sku: "HAVA-VA-002",
    stock: 5,
    category: "vathe",
    featured: true,
    images: [{ url: "/images/_sample-vathe.svg", alt: "Vathë të gjatë me perla të varura" }],
  },
  {
    slug: "komplet-nusja-e-bardhe",
    name: "Komplet “Nusja e Bardhë”",
    description:
      "Gjerdan dhe byzylyk që përputhen, të punuar me perla të bardha. I paketuar në kuti dhurate me fjongo ari — gati për t’u dhuruar.",
    price: 78,
    sku: "HAVA-KO-001",
    stock: 3,
    category: "komplete",
    featured: true,
    best: true,
    images: [{ url: "/images/_sample-komplet.svg", alt: "Komplet gjerdani dhe byzylyku me perla në kuti dhurate" }],
  },
  {
    slug: "komplet-blush",
    name: "Komplet “Blush”",
    description: "Gjerdan i shkurtër dhe vathë me perla rozë. Kombinim i butë për një ditë të veçantë.",
    price: 65,
    sku: "HAVA-KO-002",
    stock: 2,
    category: "komplete",
    isNew: true,
    images: [{ url: "/images/_sample-komplet.svg", alt: "Komplet me perla rozë mbi sfond krem" }],
  },
  {
    slug: "kapse-flokesh-perle",
    name: "Kapëse flokësh me perlë",
    description: "Kapëse metalike e veshur me perla të vogla. Mban flokët në vend pa i shtrënguar.",
    price: 14.5,
    sku: "HAVA-AK-001",
    stock: 15,
    category: "aksesore",
    images: [{ url: "/images/_sample-aksesore.svg", alt: "Kapëse flokësh me perla të vogla" }],
  },
  {
    slug: "rreth-qafe-perle",
    name: "Rreth qafe me perlë",
    description: "Choker i hollë me perlë, 34 cm, me mbyllje ari. Vishet mbi këmishë ose me fustan të hapur.",
    price: 32,
    sku: "HAVA-AK-002",
    stock: 7,
    category: "aksesore",
    isNew: true,
    images: [{ url: "/images/_sample-aksesore.svg", alt: "Rreth qafe i hollë me perlë mbi sfond krem" }],
  },
];

const settings: [string, string][] = [
  ["hero_title", "Perla të bëra me dorë, për momente që mbahen mend"],
  [
    "hero_subtitle",
    "Koleksion i kufizuar nga HandmadeAVA — gjerdanë, byzylykë dhe aksesorë të punuar një nga një, me perla natyrale dhe detaje ari.",
  ],
  ["hero_image_url", "/images/_sample-gjerdan-perla.png"],
  ["promo_title", "Dërgesa falas mbi 60 €"],
  ["promo_text", "Porosit tani dhe paguaj në dorëzim, sapo pakoja të mbërrijë në adresën tënde."],
  ["contact_phone", "+355 69 000 0000"],
  ["contact_email", "porosi@handmadeava.al"],
  ["whatsapp_number", "355690000000"],
  ["instagram_url", "https://www.instagram.com/handmadeava"],
  ["delivery_cost_eur", "4.90"],
  ["free_delivery_threshold_eur", "60.00"],
  [
    "delivery_returns_text",
    "Dërgesa kryhet brenda 2–4 ditëve pune në të gjithë Shqipërinë. Porositë mbi 60 € kanë dërgesë falas. Çdo pjesë paketohet me kujdes, gati për dhuratë.",
  ],
];

// --- reset sample rows only -------------------------------------------------
await sql`delete from products where is_sample = true`;

const ids = new Map<string, string>();
for (const c of categories) {
  const rows = (await sql`
    insert into categories (slug, name_sq, description, image_url, sort_order, is_active)
    values (${c.slug}, ${c.name}, ${c.description}, ${c.image}, ${c.sort}, true)
    on conflict (slug) do update
      set name_sq = excluded.name_sq,
          description = excluded.description,
          image_url = excluded.image_url,
          sort_order = excluded.sort_order,
          is_active = true,
          updated_at = now()
    returning id
  `) as { id: string }[];
  ids.set(c.slug, rows[0].id);
}

for (const p of products) {
  const categoryId = ids.get(p.category);
  if (!categoryId) throw new Error(`unknown category ${p.category}`);
  const rows = (await sql`
    insert into products (slug, name_sq, description_sq, price_eur, sale_price_eur, sku,
                          stock_quantity, category_id, is_active, is_featured, is_new_arrival,
                          is_best_seller, is_sample, notes)
    values (${p.slug}, ${p.name}, ${p.description}, ${p.price}, ${p.sale ?? null}, ${p.sku},
            ${p.stock}, ${categoryId}, true, ${Boolean(p.featured)}, ${Boolean(p.isNew)},
            ${Boolean(p.best)}, true, 'Produkt ilustrues mostër — zëvendësohet nga pronarja.')
    returning id
  `) as { id: string }[];
  const productId = rows[0].id;
  let order = 0;
  for (const image of p.images) {
    await sql`
      insert into product_images (product_id, url, alt_sq, sort_order, is_primary, is_sample)
      values (${productId}, ${image.url}, ${image.alt}, ${order}, ${order === 0}, true)
    `;
    order += 1;
  }
  let variantOrder = 0;
  for (const v of p.variants ?? []) {
    await sql`
      insert into product_variants (product_id, kind, value_sq, price_delta, stock_quantity, sort_order)
      values (${productId}, ${v.kind}, ${v.value}, ${v.delta ?? 0}, ${v.stock ?? 0}, ${variantOrder})
    `;
    variantOrder += 1;
  }
}

for (const [key, value] of settings) {
  await sql`
    insert into store_settings (key, value) values (${key}, ${value})
    on conflict (key) do update set value = excluded.value, updated_at = now()
  `;
}

console.log(`seeded ${categories.length} categories, ${products.length} sample products, ${settings.length} settings`);
