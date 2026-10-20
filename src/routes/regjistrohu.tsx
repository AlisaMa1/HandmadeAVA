import { Link, createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { AuthShell, FormField, FormMessage, SideNote } from "~/components/form";
import { registerCustomer } from "~/server/accounts";
import { getSessionState } from "~/server/auth";

export const Route = createFileRoute("/regjistrohu")({
  loader: async () => {
    const session = await getSessionState();
    if (session.user) throw redirect({ to: "/llogaria" });
    return { dbReady: session.dbReady };
  },
  head: () => ({ meta: [{ title: "Regjistrohu — HandmadeAVA" }] }),
  component: RegisterPage,
});

function RegisterPage() {
  const { dbReady } = Route.useLoaderData();
  const router = useRouter();
  const register = useServerFn(registerCustomer);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Fjalëkalimet nuk përputhen. Shkruajini edhe një herë.");
      return;
    }
    setBusy(true);
    try {
      const result = await register({ data: { email, password, fullName, phone } });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      // Signed in by the server (session cookie is already set).
      await router.invalidate();
      await router.navigate({ to: "/llogaria" });
    } catch {
      setError("Nuk mundëm të përfundojmë regjistrimin. Provoni përsëri.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      eyebrow="Llogaria"
      title="Krijo llogarinë tënde"
      intro={
        <>
          Regjistrimi ju lejon të ruani adresat e dërgesës dhe të ndiqni porositë tuaja. Plotësoni të
          dhënat më poshtë — të gjitha të dhënat ruhen vetëm për porositë tuaja.
        </>
      }
      aside={
        <>
          <SideNote title="Keni llogari?">
            <Link to="/hyrje" className="text-gold-deep underline-offset-4 hover:underline">
              Hyni këtu
            </Link>{" "}
            për të vazhduar me adresat dhe porositë tuaja.
          </SideNote>
          <SideNote title="Fjalëkalimi juaj">
            Të paktën 8 karaktere. Ruajmë vetëm një formë të koduar të fjalëkalimit — askush në dyqan
            nuk mund ta lexojë atë.
          </SideNote>
          {!dbReady ? (
            <SideNote title="Regjistrimi hapet së shpejti">
              Baza e të dhënave nuk është lidhur ende, prandaj llogaritë nuk mund të krijohen në këtë
              moment.
            </SideNote>
          ) : null}
        </>
      }
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <FormField
          label="Emri dhe mbiemri"
          name="fullName"
          value={fullName}
          onChange={setFullName}
          autoComplete="name"
          required
        />
        <FormField
          label="Email"
          name="email"
          type="email"
          inputMode="email"
          value={email}
          onChange={setEmail}
          autoComplete="email"
          required
          hint="Do ta përdorni për të hyrë në llogari."
        />
        <FormField
          label="Telefoni"
          name="phone"
          type="tel"
          inputMode="tel"
          value={phone}
          onChange={setPhone}
          autoComplete="tel"
          hint="Për t'ju kontaktuar rreth porosisë (opsionale)."
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            label="Fjalëkalimi"
            name="password"
            type="password"
            value={password}
            onChange={setPassword}
            autoComplete="new-password"
            required
            hint="Të paktën 8 karaktere."
          />
          <FormField
            label="Përsëritni fjalëkalimin"
            name="confirm"
            type="password"
            value={confirm}
            onChange={setConfirm}
            autoComplete="new-password"
            required
          />
        </div>

        {error ? <FormMessage tone="error">{error}</FormMessage> : null}

        <button type="submit" className="btn-gold mt-2 w-full sm:w-auto" disabled={busy}>
          {busy ? "Po krijohet llogaria…" : "Krijo llogarinë"}
        </button>
        <p className="text-xs leading-relaxed text-ink-soft">
          Duke vazhduar pranoni që t'i përdorim të dhënat vetëm për përgatitjen dhe dërgimin e
          porosive tuaja.
        </p>
      </form>
    </AuthShell>
  );
}
