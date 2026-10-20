import { Link, createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { AuthShell, FormField, FormMessage, SideNote } from "~/components/form";
import { completePasswordReset, getResetPageState } from "~/server/accounts";

/**
 * /rivendos-fjalekalimin — enter a reset code issued BY THE SHOP plus a new password.
 *
 * This shop has no email capability, so this page never says "we sent you a link" or
 * "check your inbox". The code comes from HandmadeAVA (in person or by phone); the shop
 * issues it with `bun run reset:code -- <email>`, which stores only a hash with an expiry.
 */
export const Route = createFileRoute("/rivendos-fjalekalimin")({
  loader: async () => getResetPageState(),
  head: () => ({ meta: [{ title: "Rivendosje e fjalëkalimit — HandmadeAVA" }] }),
  component: ResetPage,
});

function ResetPage() {
  const { dbReady, signedInEmail } = Route.useLoaderData();
  const reset = useServerFn(completePasswordReset);

  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  return (
    <AuthShell
      eyebrow="Siguria e llogarisë"
      title="Rivendos fjalëkalimin"
      intro={
        <>
          Për sigurinë e llogarisë, kodi i rivendosjes jepet nga vetë dyqani HandmadeAVA — nuk
          dërgohet me email. Kërkoni kodin duke na shkruar ose telefonuar dhe më pas plotësoni
          formularin më poshtë.
        </>
      }
      aside={
        <>
          <SideNote title="Si funksionon">
            <ol className="ml-4 list-decimal space-y-2">
              <li>Kërkoni kodin e rivendosjes nga HandmadeAVA (telefon ose dyqan).</li>
              <li>Shkruani kodin dhe fjalëkalimin tuaj të re.</li>
              <li>Kodi përdoret vetëm një herë dhe skadon brenda një ore.</li>
            </ol>
          </SideNote>
          <SideNote title="Jeni i kyçur?">
            Nëse ju kujtohet fjalëkalimi aktual, ndryshojeni direkt nga{" "}
            <Link to="/llogaria" className="text-gold-deep underline-offset-4 hover:underline">
              llogaria juaj
            </Link>{" "}
            — është mënyra më e shpejtë.
          </SideNote>
          {signedInEmail ? (
            <SideNote title="Vini re">
              Jeni i kyçur si {signedInEmail}. Rivendosja e fjalëkalimit do të mbyllë të gjitha
              sesionet e kësaj llogarie.
            </SideNote>
          ) : null}
          {!dbReady ? (
            <SideNote title="E padisponueshme">
              Baza e të dhënave nuk është lidhur ende, prandaj rivendosja nuk është e disponueshme në
              këtë moment.
            </SideNote>
          ) : null}
        </>
      }
    >
      {done ? (
        <div className="flex flex-col gap-4">
          <FormMessage tone="success">
            Fjalëkalimi u ndryshua. Të gjitha sesionet e vjetra u mbyllën. Mund të hyni tani me
            fjalëkalimin e re.
          </FormMessage>
          <Link to="/hyrje" className="btn-gold w-full sm:w-auto">
            Hyr në llogari
          </Link>
        </div>
      ) : (
        <form
          noValidate
          className="flex flex-col gap-4"
          onSubmit={async (event) => {
            event.preventDefault();
            setStatus(null);
            if (password !== confirm) {
              setStatus({ tone: "error", text: "Fjalëkalimet nuk përputhen." });
              return;
            }
            setBusy(true);
            const result = await reset({ data: { token, newPassword: password } });
            setBusy(false);
            if (!result.ok) {
              setStatus({ tone: "error", text: result.error });
              return;
            }
            setDone(true);
          }}
        >
          <FormField
            label="Kodi i rivendosjes"
            name="resetToken"
            value={token}
            onChange={setToken}
            required
            autoComplete="one-time-code"
            placeholder="ABC12-DEF34-GHI56-JKL78"
            hint="Kodi që ju dha HandmadeAVA."
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              label="Fjalëkalimi i re"
              name="newPassword"
              type="password"
              value={password}
              onChange={setPassword}
              autoComplete="new-password"
              required
              hint="Të paktën 8 karaktere."
            />
            <FormField
              label="Përsërit fjalëkalimin"
              name="confirmResetPassword"
              type="password"
              value={confirm}
              onChange={setConfirm}
              autoComplete="new-password"
              required
            />
          </div>
          {status ? <FormMessage tone={status.tone}>{status.text}</FormMessage> : null}
          <button type="submit" className="btn-gold w-full sm:w-auto" disabled={busy}>
            {busy ? "Po ruhet…" : "Ndrysho fjalëkalimin"}
          </button>
        </form>
      )}
    </AuthShell>
  );
}
