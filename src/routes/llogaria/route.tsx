import { Link, Outlet, createFileRoute, redirect } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { LogoutControl } from "~/components/ui";
import { getSessionState, type SessionUser } from "~/server/auth";

/**
 * Layout for the whole account area. The gate lives HERE: the loader runs before any child
 * renders, so a signed-out visitor is redirected to /hyrje and never sees a protected page
 * (or an empty shell of one). Every child loader repeats the check server-side and scopes
 * its queries with the session user's id, so the guard is not merely cosmetic.
 */
export const Route = createFileRoute("/llogaria")({
  loader: async (): Promise<SessionUser> => {
    const session = await getSessionState();
    if (!session.user) {
      throw redirect({ to: "/hyrje", search: { arsye: "seancë" } });
    }
    return session.user;
  },
  component: AccountLayout,
});

const TABS = [
  { to: "/llogaria", label: "Profili dhe adresat" },
  { to: "/llogaria/porosite", label: "Porositë e mia" },
] as const;

export function AccountTabs({ current }: { current: "/llogaria" | "/llogaria/porosite" }) {
  return (
    <nav aria-label="Seksionet e llogarisë" className="border-b border-gold/20">
      <ul className="container-shop flex flex-wrap gap-6">
        {TABS.map((tab) => {
          const active = tab.to === current;
          return (
            <li key={tab.to}>
              <Link
                to={tab.to}
                aria-current={active ? "page" : undefined}
                className={`-mb-px inline-block border-b-2 pb-3 pt-1 text-sm transition-colors ${
                  active
                    ? "border-gold-deep font-medium text-gold-deep"
                    : "border-transparent text-ink-soft hover:text-gold-deep"
                }`}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function AccountLayout() {
  const user = Route.useLoaderData();
  return (
    <main>
      <AccountTabs current={"/llogaria"} />
      <div className="container-shop flex flex-col gap-2 py-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Llogaria juaj</p>
            <h1 className="mt-1 font-display text-3xl text-ink sm:text-4xl">
              Përshëndetje, {user.fullName?.split(" ")[0] ?? "e mirë"}
            </h1>
            <p className="mt-1 text-sm text-ink-soft">{user.email}</p>
          </div>
          <LogoutControl />
        </div>
      </div>
      <Outlet />
    </main>
  );
}

/** Shared page section used by the account pages. */
export function AccountSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="card-soft p-6 sm:p-8">
      <h2 className="font-display text-2xl text-ink">{title}</h2>
      {description ? <p className="mt-2 text-sm leading-relaxed text-ink-soft">{description}</p> : null}
      <div className="mt-6">{children}</div>
    </section>
  );
}
