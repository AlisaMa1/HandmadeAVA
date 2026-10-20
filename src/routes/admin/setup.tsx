import { Link, createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { AuthShell, FormField, FormMessage, SideNote } from "~/components/form";
import { getAdminSetupState, submitAdminSetup } from "~/server/accounts";

/**
 * /admin/setup — one-time creation of the first administrator.
 *
 * Open ONLY while `profiles` contains zero admins; the server check runs on every render
 * of the page and again inside the submit handler, and the INSERT itself is guarded with
 * `where not exists (select 1 from profiles where role = 'admin')`.
 *
 * The code is either the ADMIN_SETUP_TOKEN environment value or a one-time code from
 * `bun run admin:code`. There is no default or hardcoded password anywhere.
 */
export const Route = createFileRoute("/admin/setup")({
  loader: async () => getAdminSetupState(),
  head: () => ({ meta: [{ title: "Konfigurimi i administratorit — HandmadeAVA" }] }),
  component: AdminSetupPage,
});

function AdminSetupPage() {
  const state = Route.useLoaderData();
  const submit = useServerFn(submitAdminSetup);

  const [code, setCode] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  if (state.dbReady && state.admins > 0) {
    return (
      <AuthShell
        eyebrow="Administrimi"
        title="Konfigurimi i administratorit është i mbyllur"
        intro={
          <>
            Kjo faqe përdoret vetëm një herë, për të krijuar llogarinë e parë të administratorit.
            Ekziston tashmë një administrator, prandaj konfigurimi nuk pranon më kërkesa.
          </>
        }
        aside={
          <SideNote title="Çfarë të bëj tani?">
            <Link to="/hyrje" className="text-gold-deep underline-offset-4 hover:underline">
              Hyni me llogarinë tuaj të administratorit
            </Link>{" "}
            për të vazhduar. Nëse keni harruar fjalëkalimin, dyqani mund t'ju japë një kod
            rivendosjeje.
          </SideNote>
        }
      >
        <FormMessage tone="info">
          Për arsye sigurie, asnjë llogari e dytë administratori nuk mund të krijohet nga kjo faqe.
        </FormMessage>
      </AuthShell>
    );
  }

  if (!state.dbReady) {
    return (
      <AuthShell
        eyebrow="Administrimi"
        title="Konfigurimi nuk është i disponueshëm"
        intro="Baza e të dhënave nuk është lidhur ende, prandaj administratori i parë nuk mund të krijohet."
      >
        <FormMessage tone="info">
          Sapo të lidhet baza e të dhënave, kjo faqe do të hapet automatikisht.
        </FormMessage>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      eyebrow="Administrimi · hap i sigurt"
      title="Krijo llogarinë e parë të administratorit"
      intro="Kjo faqe funksionon vetëm derisa të ekzistojë një administrator. Kodi i sigurisë jepet nga ekipi i dyqanit dhe përdoret vetëm një herë."
      aside={
        <>
          <SideNote title="Ku e gjej kodin?">
            Kodi është ose vlera e `ADMIN_SETUP_TOKEN`, ose një kod i krijuar me `bun run admin:code`
            (i vlefshëm 30 minuta, përdoret një herë).
          </SideNote>
          <SideNote title="Pas krijimit">
            Pasi kjo llogari të krijohet, faqja mbyllet përgjithmonë. Ruajeni fjalëkalimin dhe
            ndryshojeni kur të dëshironi nga llogaria juaj.
          </SideNote>
        </>
      }
    >
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
          const result = await submit({ data: { code, email, password, fullName } });
          setBusy(false);
          if (!result.ok) {
            setStatus({ tone: "error", text: result.error });
            return;
          }
          setStatus({ tone: "success", text: "Administratori u krijua. Po hapet llogaria…" });
          window.location.assign("/llogaria");
        }}
      >
        <FormField
          label="Kodi i sigurisë"
          name="setupCode"
          value={code}
          onChange={setCode}
          required
          autoComplete="one-time-code"
          hint="Kodi që ju dha ekipi i HandmadeAVA."
        />
        <FormField
          label="Emri dhe mbiemri"
          name="adminFullName"
          value={fullName}
          onChange={setFullName}
          autoComplete="name"
          required
        />
        <FormField
          label="Email"
          name="adminEmail"
          type="email"
          inputMode="email"
          value={email}
          onChange={setEmail}
          autoComplete="email"
          required
          hint="Do të përdoret për të hyrë në panel."
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            label="Fjalëkalimi"
            name="adminPassword"
            type="password"
            value={password}
            onChange={setPassword}
            autoComplete="new-password"
            required
            hint="Të paktën 8 karaktere."
          />
          <FormField
            label="Përsërit fjalëkalimin"
            name="adminConfirm"
            type="password"
            value={confirm}
            onChange={setConfirm}
            autoComplete="new-password"
            required
          />
        </div>
        {status ? <FormMessage tone={status.tone}>{status.text}</FormMessage> : null}
        <button type="submit" className="btn-gold w-full sm:w-auto" disabled={busy}>
          {busy ? "Po krijohet…" : "Krijo administratorin"}
        </button>
        <p className="text-xs leading-relaxed text-ink-soft">
          {state.envTokenConfigured
            ? "Një kod sigurie është konfiguruar në server."
            : state.liveCodes > 0
              ? `Kod aktiv: ${state.liveCodes}. Përdoret një herë.`
              : "Nuk ka kod aktiv — kërkoni nga ekipi i dyqanit që ta krijojë."}
        </p>
      </form>
    </AuthShell>
  );
}
