import { createFileRoute, getRouteApi, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { FormField, FormMessage } from "~/components/form";
import {
  changeMyPassword,
  deleteMyAddress,
  listMyAddresses,
  saveMyAddress,
  setDefaultAddress,
  updateMyProfile,
  type Address,
} from "~/server/accounts";
import { AccountSection } from "~/routes/llogaria/route";

/**
 * /llogaria — the signed-in customer's own profile, password and delivery addresses.
 * The parent loader guarantees a session; every server function below re-checks it and
 * scopes its SQL with the session user's id, so a forged `id` in a request can only ever
 * come back as "not found in your account".
 */
export const Route = createFileRoute("/llogaria/")({
  loader: async () => {
    const addresses = await listMyAddresses();
    return {
      addresses: addresses.ok ? addresses.data : [],
      addressesError: addresses.ok ? null : addresses.error,
    };
  },
  head: () => ({ meta: [{ title: "Llogaria ime — HandmadeAVA" }] }),
  component: AccountPage,
});

const parentApi = getRouteApi("/llogaria");

function AccountPage() {
  return (
    <div className="container-shop flex flex-col gap-6 pb-16">
      <ProfileCard />
      <PasswordCard />
      <AddressesCard />
    </div>
  );
}

/* ----------------------------------------------------------------- profile --- */

function ProfileCard() {
  const user = parentApi.useLoaderData();
  const router = useRouter();
  const save = useServerFn(updateMyProfile);

  const [fullName, setFullName] = useState(user.fullName ?? "");
  const [phone, setPhone] = useState(user.phone ?? "");
  const [status, setStatus] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <AccountSection
      title="Të dhënat personale"
      description="Emri dhe telefoni që përdorim për porositë tuaja."
    >
      <p className="mb-5 text-sm text-ink-soft">
        Email: <span className="text-ink">{user.email}</span>
      </p>
      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={async (event) => {
          event.preventDefault();
          setStatus(null);
          setBusy(true);
          const result = await save({ data: { fullName, phone } });
          setBusy(false);
          if (!result.ok) {
            setStatus({ tone: "error", text: result.error });
            return;
          }
          setStatus({ tone: "success", text: "Të dhënat u ruajtën." });
          await router.invalidate();
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            label="Emri dhe mbiemri"
            name="fullName"
            value={fullName}
            onChange={setFullName}
            autoComplete="name"
            required
          />
          <FormField
            label="Telefoni"
            name="phone"
            type="tel"
            value={phone}
            onChange={setPhone}
            autoComplete="tel"
          />
        </div>
        {status ? <FormMessage tone={status.tone}>{status.text}</FormMessage> : null}
        <button type="submit" className="btn-gold w-full sm:w-auto" disabled={busy}>
          {busy ? "Po ruhet…" : "Ruaj të dhënat"}
        </button>
      </form>
    </AccountSection>
  );
}

/* ---------------------------------------------------------------- password --- */

function PasswordCard() {
  const router = useRouter();
  const change = useServerFn(changeMyPassword);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <AccountSection
      title="Fjalëkalimi"
      description="Ndryshoni fjalëkalimin tuaj kur të dëshironi. Për siguri, sesionet e tjera tuajat do të mbyllen."
    >
      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={async (event) => {
          event.preventDefault();
          setStatus(null);
          if (newPassword !== confirm) {
            setStatus({ tone: "error", text: "Fjalëkalimet e reja nuk përputhen." });
            return;
          }
          setBusy(true);
          const result = await change({ data: { currentPassword, newPassword } });
          setBusy(false);
          if (!result.ok) {
            setStatus({ tone: "error", text: result.error });
            return;
          }
          setCurrentPassword("");
          setNewPassword("");
          setConfirm("");
          setStatus({
            tone: "success",
            text: "Fjalëkalimi u ndryshua. Sesionet e tjera tuaja u mbyllën.",
          });
          await router.invalidate();
        }}
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <FormField
            label="Fjalëkalimi aktual"
            name="currentPassword"
            type="password"
            value={currentPassword}
            onChange={setCurrentPassword}
            autoComplete="current-password"
            required
          />
          <FormField
            label="Fjalëkalimi i re"
            name="newPassword"
            type="password"
            value={newPassword}
            onChange={setNewPassword}
            autoComplete="new-password"
            required
            hint="Të paktën 8 karaktere."
          />
          <FormField
            label="Përsërit fjalëkalimin"
            name="confirmPassword"
            type="password"
            value={confirm}
            onChange={setConfirm}
            autoComplete="new-password"
            required
          />
        </div>
        {status ? <FormMessage tone={status.tone}>{status.text}</FormMessage> : null}
        <button type="submit" className="btn-gold w-full sm:w-auto" disabled={busy}>
          {busy ? "Po ndryshohet…" : "Ndrysho fjalëkalimin"}
        </button>
      </form>
    </AccountSection>
  );
}

/* --------------------------------------------------------------- addresses --- */

type Draft = {
  id?: string;
  fullName: string;
  phone: string;
  line1: string;
  line2: string;
  city: string;
  postalCode: string;
  isDefault: boolean;
};

const EMPTY_DRAFT: Draft = {
  fullName: "",
  phone: "",
  line1: "",
  line2: "",
  city: "",
  postalCode: "",
  isDefault: false,
};

function AddressesCard() {
  const { addresses, addressesError } = Route.useLoaderData();
  const router = useRouter();
  const save = useServerFn(saveMyAddress);
  const remove = useServerFn(deleteMyAddress);
  const makeDefault = useServerFn(setDefaultAddress);

  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [status, setStatus] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));

  function edit(address: Address) {
    setStatus(null);
    setDraft({
      id: address.id,
      fullName: address.fullName,
      phone: address.phone,
      line1: address.line1,
      line2: address.line2 ?? "",
      city: address.city,
      postalCode: address.postalCode ?? "",
      isDefault: address.isDefault,
    });
  }

  return (
    <AccountSection
      title="Adresat e dërgesës"
      description="Ruani adresat që përdorni shpesh. Njëra shënohet si e parazgjedhur për porositë tuaja."
    >
      {addressesError ? <FormMessage tone="error">{addressesError}</FormMessage> : null}

      {addresses.length === 0 ? (
        <p className="rounded-[1rem] border border-gold/25 bg-cream-deep px-4 py-4 text-sm text-ink-soft">
          Nuk keni ruajtur ende asnjë adresë. Shtoni të parën më poshtë — do ta përdorim automatikisht
          në porosinë tuaj të parë.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {addresses.map((address) => (
            <li
              key={address.id}
              className="flex flex-wrap items-start justify-between gap-3 rounded-[1rem] border border-gold/20 bg-white px-4 py-3"
            >
              <div className="text-sm leading-relaxed text-ink-soft">
                <p className="font-medium text-ink">
                  {address.fullName}
                  {address.isDefault ? (
                    <span className="ml-2 rounded-full bg-blush px-2 py-0.5 text-[0.6rem] uppercase tracking-wider text-ink">
                      E parazgjedhur
                    </span>
                  ) : null}
                </p>
                <p>
                  {address.line1}
                  {address.line2 ? `, ${address.line2}` : ""}
                </p>
                <p>
                  {address.city}
                  {address.postalCode ? `, ${address.postalCode}` : ""} · {address.country}
                </p>
                <p>{address.phone}</p>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <button type="button" className="btn-outline px-4 py-2" onClick={() => edit(address)}>
                  Ndrysho
                </button>
                {!address.isDefault ? (
                  <button
                    type="button"
                    className="btn-outline px-4 py-2"
                    onClick={async () => {
                      setStatus(null);
                      const result = await makeDefault({ data: { id: address.id } });
                      setStatus(
                        result.ok
                          ? { tone: "success", text: "Adresa u shënua si e parazgjedhur." }
                          : { tone: "error", text: result.error }
                      );
                      await router.invalidate();
                    }}
                  >
                    Bëje kryesore
                  </button>
                ) : null}
                <button
                  type="button"
                  className="btn-outline px-4 py-2 text-blush-deep"
                  onClick={async () => {
                    setStatus(null);
                    const result = await remove({ data: { id: address.id } });
                    setStatus(
                      result.ok
                        ? { tone: "success", text: "Adresa u fshi." }
                        : { tone: "error", text: result.error }
                    );
                    if (draft.id === address.id) setDraft(EMPTY_DRAFT);
                    await router.invalidate();
                  }}
                >
                  Fshi
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <form
        noValidate
        className="mt-6 flex flex-col gap-4 border-t border-gold/20 pt-6"
        onSubmit={async (event) => {
          event.preventDefault();
          setStatus(null);
          setBusy(true);
          const result = await save({
            data: {
              id: draft.id,
              fullName: draft.fullName,
              phone: draft.phone,
              line1: draft.line1,
              line2: draft.line2,
              city: draft.city,
              postalCode: draft.postalCode,
              isDefault: draft.isDefault,
            },
          });
          setBusy(false);
          if (!result.ok) {
            setStatus({ tone: "error", text: result.error });
            return;
          }
          setStatus({
            tone: "success",
            text: draft.id ? "Adresa u përditësua." : "Adresa u shtua.",
          });
          setDraft(EMPTY_DRAFT);
          await router.invalidate();
        }}
      >
        <h3 className="font-display text-lg text-ink">
          {draft.id ? "Ndrysho adresën" : "Shto një adresë të re"}
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            label="Emri i marrësit"
            name="addrFullName"
            value={draft.fullName}
            onChange={(v) => set({ fullName: v })}
            autoComplete="name"
            required
          />
          <FormField
            label="Telefoni"
            name="addrPhone"
            type="tel"
            value={draft.phone}
            onChange={(v) => set({ phone: v })}
            autoComplete="tel"
            required
          />
          <FormField
            label="Adresa"
            name="addrLine1"
            value={draft.line1}
            onChange={(v) => set({ line1: v })}
            autoComplete="address-line1"
            required
          />
          <FormField
            label="Detaje shtesë"
            name="addrLine2"
            value={draft.line2}
            onChange={(v) => set({ line2: v })}
            autoComplete="address-line2"
            hint="Pallat, shkallë, apartament…"
          />
          <FormField
            label="Qyteti"
            name="addrCity"
            value={draft.city}
            onChange={(v) => set({ city: v })}
            autoComplete="address-level2"
            required
          />
          <FormField
            label="Kodi postar"
            name="addrPostal"
            value={draft.postalCode}
            onChange={(v) => set({ postalCode: v })}
            autoComplete="postal-code"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-ink-soft">
          <input
            type="checkbox"
            checked={draft.isDefault}
            onChange={(e) => set({ isDefault: e.target.checked })}
            className="h-4 w-4 rounded border-gold/40 accent-[var(--color-gold-deep)]"
          />
          Përdore këtë adresë si të parazgjedhur
        </label>
        {status ? <FormMessage tone={status.tone}>{status.text}</FormMessage> : null}
        <div className="flex flex-wrap gap-3">
          <button type="submit" className="btn-gold" disabled={busy}>
            {busy ? "Po ruhet…" : draft.id ? "Ruaj ndryshimet" : "Shto adresën"}
          </button>
          {draft.id ? (
            <button type="button" className="btn-outline" onClick={() => setDraft(EMPTY_DRAFT)}>
              Anulo
            </button>
          ) : null}
        </div>
      </form>
    </AccountSection>
  );
}
