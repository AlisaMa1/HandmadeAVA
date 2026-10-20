import { HeadContent, Outlet, Scripts, createRootRoute } from "@tanstack/react-router";
import type { ReactNode } from "react";
import appCss from "~/styles/app.css?url";
import { Footer, Header } from "~/components/ui";
import { getStoreSettings } from "~/server/catalog";

export const Route = createRootRoute({
  loader: async () => ({ settings: await getStoreSettings() }),
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "HandmadeAVA — bizhuteri të bëra me dorë" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600&family=Inter:wght@300;400;500;600&display=swap",
      },
    ],
  }),
  notFoundComponent: NotFound,
  component: RootComponent,
});

function NotFound() {
  return (
    <main className="container-shop flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <p className="eyebrow">Gabim 404</p>
      <h1 className="font-display text-4xl text-ink">Faqja nuk u gjet</h1>
      <p className="max-w-md text-sm text-ink-soft">
        Faqja që kërkuat nuk ekziston ose është zhvendosur. Kthehuni në ballinë ose shikoni dyqanin.
      </p>
      <a href="/" className="btn-gold mt-2">
        Kthehu në ballinë
      </a>
    </main>
  );
}

function RootComponent() {
  const { settings } = Route.useLoaderData();
  return (
    <RootDocument>
      <Header />
      <Outlet />
      <Footer settings={settings} />
    </RootDocument>
  );
}

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="sq">
      <head>
        <HeadContent />
      </head>
      <body className="min-h-dvh bg-cream">
        {children}
        <Scripts />
      </body>
    </html>
  );
}
