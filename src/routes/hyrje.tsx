import { Link, createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { AuthShell, FormField, FormMessage, SideNote } from "~/components/form";
import { loginCustomer } from "~/server/accounts";
import { getSessionState } from "~/server/auth";

type LoginSearch = { ridrejtim?: string; arsye?: string };

export const Route = createFileRoute("/hyrje")({
  validateSearch: (search: Record<string, unknown>): LoginSearch => ({
    ridrejtim: typeof search.ridrejtim === "string" ? search.ridrejtim : undefined,
    arsye: typeof search.arsye === "string" ? search.arsye : undefined,
  }),
  loader: async () => {
    const session = await getSessionState();
    if (session.user) throw redirect({ to: "/llogaria" });
    return { dbReady: session.dbReady };
  },
  head: () => ({ meta: [{ title: "Hyrje — HandmadeAVA" }] }),
  component: LoginPage,
});

/** Only in-app paths are honoured, so `?ridrejtim=` can never bounce to another origin. */
function safeRedirect(target: string | undefined): string {
  if (!target) return "/llogaria";
  const path = target.replace(/^https?:\/\/[^/]+/, "");
  return path.startsWith("/") && !path.startsWith("//") ? path : "/llogaria";
}

function LoginPage() {
  const { dbReady } = Route.useLoaderData();
  const { ridrejtim, arsye } = Route.useSearch();
  const router = useRouter();
  const login = useServerFn(loginCustomer);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const result = await login({ data: { email, password } });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      const target = safeRedirect(ridrejtim);
      await router.invalidate();
      // Full navigation so the loader runs again with the freshly issued session cookie.
      window.location.assign(target);
    } catch {
      setError("Nuk mundëm të kryejmë hyrjen. Provoni përsëri.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      eyebrow="Llogaria"
      title="Hyr në llogarinë tënde"
      intro={arsye === "seancë" ? "Seanca juaj skadoi ose u mbyll. Hyni përsëri për të vazhduar." : undefined}
      aside={
        <>
          <SideNote title="E re në HandmadeAVA?">
            <Link to="/regjistrohu" className="text-gold-deep underline-offset-4 hover:underline">
              Krijoni një llogari
            </Link>{" "}
            për të ruajtur adresat dhe për të ndjekur porositë.
          </SideNote>
          <SideNote title="Keni harruar fjalëkalimin?">
            Dyqani nuk dërgon email.{" "}
            <Link
              to="/rivendos-fjalekalimin"
              className="text-gold-deep underline-offset-4 hover:underline"
            >
              Kërkoni një kod rivendosjeje
            </Link>{" "}
            nga HandmadeAVA dhe përdoreni në faqen e rivendosjes.
          </SideNote>
          {!dbReady ? (
            <SideNote title="Hyrja hapet së shpejti">
              Baza e të dhënave nuk është lidhur ende, prandaj llogaritë nuk janë të disponueshme në
              këtë moment.
            </SideNote>
          ) : null}
        </>
      }
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <FormField
          label="Email"
          name="email"
          type="email"
          inputMode="email"
          value={email}
          onChange={setEmail}
          autoComplete="email"
          required
        />
        <FormField
          label="Fjalëkalimi"
          name="password"
          type="password"
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
          required
        />
        {error ? <FormMessage tone="error">{error}</FormMessage> : null}
        <button type="submit" className="btn-gold mt-2 w-full sm:w-auto" disabled={busy}>
          {busy ? "Po hyni…" : "Hyr"}
        </button>
      </form>
    </AuthShell>
  );
}
