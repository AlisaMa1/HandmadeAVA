/**
 * Server-only catalogue access for the HandmadeAVA storefront.
 *
 * Every function here is a `createServerFn()` — the TanStack Start plugin strips the
 * handlers from the client bundle, so `sql()` and `DATABASE_URL` never reach the
 * browser. Reads are wrapped in `safe()` so the site still renders (with honest
 * empty states) when no database is connected yet: no mock data is ever substituted.
 */
import { createServerFn } from "@tanstack/react-start";
import { sql } from "~/db";

export type ProductCard = {
  id: string;
  slug: string;
  name: string;
  price: string;
  salePrice: string | null;
  stock: number;
  imageUrl: string | null;
  imageAlt: string | null;
  categorySlug: string;
  categoryName: string;
  isFeatured: boolean;
  isNew: boolean;
  isBestSeller: boolean;
  createdAt: string;
};

export type CategoryLink = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  productCount: number;
};

export type StoreSettings = {
  hero_title: string;
  hero_subtitle: string;
  hero_image_url: string;
  promo_title: string;
  promo_text: string;
  contact_phone: string;
  contact_email: string;
  whatsapp_number: string;
  instagram_url: string;
  delivery_cost_eur: string;
  free_delivery_threshold_eur: string;
  delivery_returns_text: string;
};

export type SettingsMap = Record<string, string>;

export const DEFAULT_SETTINGS: StoreSettings = {
  hero_title: "Perla të bëra me dorë, për momente që mbahen mend",
  hero_subtitle:
    "Koleksion i kufizuar nga HandmadeAVA — gjerdanë, byzylykë dhe aksesorë të punuar një nga një.",
  hero_image_url: "/images/_sample-gjerdan-perla.png",
  promo_title: "Dërgesa falas mbi 60 €",
  promo_text: "Porosit tani dhe paguaj në dorëzim, sapo pakoja të mbërrijë në adresën tënde.",
  contact_phone: "+355 69 000 0000",
  contact_email: "porosi@handmadeava.al",
  whatsapp_number: "355690000000",
  instagram_url: "https://www.instagram.com/handmadeava",
  delivery_cost_eur: "4.90",
  free_delivery_threshold_eur: "60.00",
  delivery_returns_text:
    "Dërgesa kryhet brenda 2–4 ditëve pune në të gjithë Shqipërinë. Porositë mbi 60 € kanë dërgesë falas. Çdo pjesë është e paketuar me kujdes, gati për dhuratë.",
};

export type HomeData = {
  dbReady: boolean;
  settings: StoreSettings;
  categories: CategoryLink[];
  featured: ProductCard[];
  newArrivals: ProductCard[];
};

export type ShopQuery = {
  q?: string;
  category?: string | null;
  minPrice?: number | null;
  maxPrice?: number | null;
  inStock?: boolean;
  sort?: "newest" | "price_asc" | "price_desc" | "name";
};

export type ShopData = {
  dbReady: boolean;
  products: ProductCard[];
  total: number;
  categories: CategoryLink[];
};

export type Variant = {
  id: string;
  kind: "colour" | "size";
  value: string;
  priceDelta: string;
  stock: number;
};

export type ProductImage = { url: string; alt: string | null; isPrimary: boolean };

export type ProductDetail = {
  dbReady: boolean;
  found: boolean;
  product: {
    id: string;
    slug: string;
    name: string;
    description: string | null;
    price: string;
    salePrice: string | null;
    sku: string | null;
    stock: number;
    categorySlug: string;
    categoryName: string;
    createdAt: string;
  } | null;
  images: ProductImage[];
  variants: Variant[];
  related: ProductCard[];
};

export type CategoryPage = {
  dbReady: boolean;
  category: CategoryLink | null;
  products: ProductCard[];
};

type Row = Record<string, unknown>;

const hasDb = () => Boolean(process.env.DATABASE_URL);

/** Run a query, returning `fallback` instead of throwing when no DB is connected. */
async function safe<T>(run: () => Promise<T>, fallback: T): Promise<T> {
  if (!hasDb()) return fallback;
  try {
    return await run();
  } catch (error) {
    console.error("[catalog] query failed:", error instanceof Error ? error.message : error);
    return fallback;
  }
}

function mapProduct(r: Row): ProductCard {
  return {
    id: String(r.id),
    slug: String(r.slug),
    name: String(r.name_sq),
    price: String(r.price_eur),
    salePrice: r.sale_price_eur == null ? null : String(r.sale_price_eur),
    stock: Number(r.stock_quantity),
    imageUrl: r.image_url == null ? null : String(r.image_url),
    imageAlt: r.image_alt == null ? null : String(r.image_alt),
    categorySlug: String(r.category_slug),
    categoryName: String(r.category_name),
    isFeatured: Boolean(r.is_featured),
    isNew: Boolean(r.is_new_arrival),
    isBestSeller: Boolean(r.is_best_seller),
    createdAt: r.created_at == null ? "" : String(r.created_at),
  };
}

function mapCategory(r: Row): CategoryLink {
  return {
    id: String(r.id),
    slug: String(r.slug),
    name: String(r.name_sq),
    description: r.description == null ? null : String(r.description),
    imageUrl: r.image_url == null ? null : String(r.image_url),
    productCount: Number(r.product_count ?? 0),
  };
}

export function withDefaults(map: SettingsMap): StoreSettings {
  const out: StoreSettings = { ...DEFAULT_SETTINGS };
  for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof StoreSettings)[]) {
    const value = map[key];
    if (typeof value === "string" && value.trim() !== "") out[key] = value;
  }
  return out;
}

async function listCategories(): Promise<CategoryLink[]> {
  return safe(async () => {
    const rows = (await sql()`
      select c.id, c.slug, c.name_sq, c.description, c.image_url,
             (select count(*)::int from products p
               where p.category_id = c.id and p.is_active) as product_count
      from categories c
      where c.is_active
      order by c.sort_order asc, c.name_sq asc
    `) as Row[];
    return rows.map(mapCategory);
  }, [] as CategoryLink[]);
}

async function loadSettings(): Promise<SettingsMap> {
  return safe(async () => {
    const rows = (await sql()`select key, value from store_settings`) as Row[];
    const map: SettingsMap = {};
    for (const r of rows) map[String(r.key)] = String(r.value ?? "");
    return map;
  }, {} as SettingsMap);
}

export const getHome = createServerFn({ method: "GET" }).handler(async (): Promise<HomeData> => {
  const [settings, categories, featured, newArrivals] = await Promise.all([
    loadSettings(),
    listCategories(),
    safe(async () => {
      const rows = (await sql()`
        select p.id, p.slug, p.name_sq, p.price_eur::text as price_eur,
               p.sale_price_eur::text as sale_price_eur, p.stock_quantity,
               p.is_featured, p.is_new_arrival, p.is_best_seller, p.created_at,
               c.slug as category_slug, c.name_sq as category_name,
               (select pi.url from product_images pi where pi.product_id = p.id
                 order by pi.is_primary desc, pi.sort_order asc limit 1) as image_url,
               (select pi.alt_sq from product_images pi where pi.product_id = p.id
                 order by pi.is_primary desc, pi.sort_order asc limit 1) as image_alt
        from products p
        join categories c on c.id = p.category_id
        where p.is_active and c.is_active and p.is_featured
        order by p.created_at desc
        limit 4
      `) as Row[];
      return rows.map(mapProduct);
    }, [] as ProductCard[]),
    safe(async () => {
      const rows = (await sql()`
        select p.id, p.slug, p.name_sq, p.price_eur::text as price_eur,
               p.sale_price_eur::text as sale_price_eur, p.stock_quantity,
               p.is_featured, p.is_new_arrival, p.is_best_seller, p.created_at,
               c.slug as category_slug, c.name_sq as category_name,
               (select pi.url from product_images pi where pi.product_id = p.id
                 order by pi.is_primary desc, pi.sort_order asc limit 1) as image_url,
               (select pi.alt_sq from product_images pi where pi.product_id = p.id
                 order by pi.is_primary desc, pi.sort_order asc limit 1) as image_alt
        from products p
        join categories c on c.id = p.category_id
        where p.is_active and c.is_active and p.is_new_arrival
        order by p.created_at desc
        limit 4
      `) as Row[];
      return rows.map(mapProduct);
    }, [] as ProductCard[]),
  ]);
  return { dbReady: hasDb(), settings: withDefaults(settings), categories, featured, newArrivals };
});

export const getShop = createServerFn({ method: "GET" })
  .inputValidator((input: ShopQuery): ShopQuery => {
    const q = typeof input?.q === "string" ? input.q.trim().slice(0, 80) : "";
    const category = typeof input?.category === "string" && input.category !== "" ? input.category : null;
    const min = typeof input?.minPrice === "number" && Number.isFinite(input.minPrice) ? input.minPrice : null;
    const max = typeof input?.maxPrice === "number" && Number.isFinite(input.maxPrice) ? input.maxPrice : null;
    const sort = ["newest", "price_asc", "price_desc", "name"].includes(String(input?.sort))
      ? (input.sort as ShopQuery["sort"])
      : "newest";
    return { q, category, minPrice: min, maxPrice: max, inStock: Boolean(input?.inStock), sort };
  })
  .handler(async ({ data }): Promise<ShopData> => {
    const categories = await listCategories();
    if (!hasDb()) return { dbReady: false, products: [], total: 0, categories };
    const search = data.q && data.q.length > 0 ? data.q : null;
    try {
      const rows = (await sql()`
        select p.id, p.slug, p.name_sq, p.price_eur::text as price_eur,
               p.sale_price_eur::text as sale_price_eur, p.stock_quantity,
               p.is_featured, p.is_new_arrival, p.is_best_seller, p.created_at,
               c.slug as category_slug, c.name_sq as category_name,
               (select pi.url from product_images pi where pi.product_id = p.id
                 order by pi.is_primary desc, pi.sort_order asc limit 1) as image_url,
               (select pi.alt_sq from product_images pi where pi.product_id = p.id
                 order by pi.is_primary desc, pi.sort_order asc limit 1) as image_alt,
               count(*) over ()::int as total_count
        from products p
        join categories c on c.id = p.category_id
        where p.is_active and c.is_active
          and (${search}::text is null or p.name_sq ilike '%' || ${search}::text || '%'
               or coalesce(p.description_sq, '') ilike '%' || ${search}::text || '%')
          and (${data.category}::text is null or c.slug = ${data.category}::text)
          and (${data.minPrice}::numeric is null or coalesce(p.sale_price_eur, p.price_eur) >= ${data.minPrice}::numeric)
          and (${data.maxPrice}::numeric is null or coalesce(p.sale_price_eur, p.price_eur) <= ${data.maxPrice}::numeric)
          and (${data.inStock}::boolean is not true or p.stock_quantity > 0)
        order by
          case when ${data.sort}::text = 'price_asc' then coalesce(p.sale_price_eur, p.price_eur) end asc nulls last,
          case when ${data.sort}::text = 'price_desc' then coalesce(p.sale_price_eur, p.price_eur) end desc nulls last,
          case when ${data.sort}::text = 'name' then p.name_sq end asc,
          p.created_at desc
        limit 60
      `) as Row[];
      const total = rows.length > 0 ? Number(rows[0].total_count) : 0;
      return { dbReady: true, products: rows.map(mapProduct), total, categories };
    } catch (error) {
      console.error("[catalog] shop query failed:", error instanceof Error ? error.message : error);
      return { dbReady: true, products: [], total: 0, categories };
    }
  });

export const getCategoryPage = createServerFn({ method: "GET" })
  .inputValidator((input: { slug: string }) => ({ slug: String(input?.slug ?? "") }))
  .handler(async ({ data }): Promise<CategoryPage> => {
    if (!hasDb()) return { dbReady: false, category: null, products: [] };
    const categories = await listCategories();
    const category = categories.find((c) => c.slug === data.slug) ?? null;
    if (!category) return { dbReady: true, category: null, products: [] };
    const products = await safe(async () => {
      const rows = (await sql()`
        select p.id, p.slug, p.name_sq, p.price_eur::text as price_eur,
               p.sale_price_eur::text as sale_price_eur, p.stock_quantity,
               p.is_featured, p.is_new_arrival, p.is_best_seller, p.created_at,
               c.slug as category_slug, c.name_sq as category_name,
               (select pi.url from product_images pi where pi.product_id = p.id
                 order by pi.is_primary desc, pi.sort_order asc limit 1) as image_url,
               (select pi.alt_sq from product_images pi where pi.product_id = p.id
                 order by pi.is_primary desc, pi.sort_order asc limit 1) as image_alt
        from products p
        join categories c on c.id = p.category_id
        where p.is_active and c.slug = ${data.slug}
        order by p.created_at desc
      `) as Row[];
      return rows.map(mapProduct);
    }, [] as ProductCard[]);
    return { dbReady: true, category, products };
  });

export const getProduct = createServerFn({ method: "GET" })
  .inputValidator((input: { slug: string }) => ({ slug: String(input?.slug ?? "") }))
  .handler(async ({ data }): Promise<ProductDetail> => {
    const empty: ProductDetail = { dbReady: hasDb(), found: false, product: null, images: [], variants: [], related: [] };
    if (!hasDb()) return empty;
    const rows = await safe(async () => {
      return (await sql()`
        select p.id, p.slug, p.name_sq, p.description_sq, p.price_eur::text as price_eur,
               p.sale_price_eur::text as sale_price_eur, p.sku, p.stock_quantity, p.created_at,
               c.slug as category_slug, c.name_sq as category_name
        from products p
        join categories c on c.id = p.category_id
        where p.is_active and p.slug = ${data.slug}
        limit 1
      `) as Row[];
    }, [] as Row[]);
    const row = rows[0];
    if (!row) return empty;

    const [images, variants, related] = await Promise.all([
      safe(async () => {
        const r = (await sql()`
          select url, alt_sq, is_primary from product_images
          where product_id = ${String(row.id)}
          order by is_primary desc, sort_order asc
        `) as Row[];
        return r.map((x) => ({
          url: String(x.url),
          alt: x.alt_sq == null ? null : String(x.alt_sq),
          isPrimary: Boolean(x.is_primary),
        }));
      }, [] as ProductImage[]),
      safe(async () => {
        const r = (await sql()`
          select id, kind, value_sq, price_delta::text as price_delta, stock_quantity
          from product_variants where product_id = ${String(row.id)}
          order by kind asc, value_sq asc
        `) as Row[];
        return r.map((x) => ({
          id: String(x.id),
          kind: String(x.kind) as "colour" | "size",
          value: String(x.value_sq),
          priceDelta: String(x.price_delta),
          stock: Number(x.stock_quantity),
        }));
      }, [] as Variant[]),
      safe(async () => {
        const r = (await sql()`
          select p.id, p.slug, p.name_sq, p.price_eur::text as price_eur,
                 p.sale_price_eur::text as sale_price_eur, p.stock_quantity,
                 p.is_featured, p.is_new_arrival, p.is_best_seller, p.created_at,
                 c.slug as category_slug, c.name_sq as category_name,
                 (select pi.url from product_images pi where pi.product_id = p.id
                   order by pi.is_primary desc, pi.sort_order asc limit 1) as image_url,
                 (select pi.alt_sq from product_images pi where pi.product_id = p.id
                   order by pi.is_primary desc, pi.sort_order asc limit 1) as image_alt
          from products p
          join categories c on c.id = p.category_id
          where p.is_active and c.slug = ${String(row.category_slug)} and p.id <> ${String(row.id)}
          order by p.created_at desc
          limit 4
        `) as Row[];
        return r.map(mapProduct);
      }, [] as ProductCard[]),
    ]);

    return {
      dbReady: true,
      found: true,
      product: {
        id: String(row.id),
        slug: String(row.slug),
        name: String(row.name_sq),
        description: row.description_sq == null ? null : String(row.description_sq),
        price: String(row.price_eur),
        salePrice: row.sale_price_eur == null ? null : String(row.sale_price_eur),
        sku: row.sku == null ? null : String(row.sku),
        stock: Number(row.stock_quantity),
        categorySlug: String(row.category_slug),
        categoryName: String(row.category_name),
        createdAt: String(row.created_at),
      },
      images,
      variants,
      related,
    };
  });

/** Store settings only (used by the cart for delivery cost). */
export const getStoreSettings = createServerFn({ method: "GET" }).handler(async (): Promise<StoreSettings> => {
  return withDefaults(await loadSettings());
});
