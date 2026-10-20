import { useId, type ReactNode } from "react";

/**
 * Small accessible form primitives shared by every account page.
 * Real <label htmlFor> pairs, errors wired through aria-describedby + aria-invalid,
 * and status messages announced through aria-live so screen readers hear them.
 */

export function FormField({
  label,
  name,
  type = "text",
  value,
  onChange,
  error,
  hint,
  autoComplete,
  required = false,
  placeholder,
  inputMode,
  disabled = false,
  multiline = false,
  rows = 3,
}: {
  label: string;
  name: string;
  type?: "text" | "email" | "password" | "tel" | "radio";
  value: string;
  onChange: (value: string) => void;
  error?: string | null;
  hint?: string;
  autoComplete?: string;
  required?: boolean;
  placeholder?: string;
  inputMode?: "text" | "email" | "tel" | "numeric";
  disabled?: boolean;
  multiline?: boolean;
  rows?: number;
}) {
  const id = `f-${name}-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(" ");
  const inputClass = `input-soft ${multiline ? "rounded-[1rem] py-3" : ""} ${
    error ? "border-blush-deep" : ""
  }`;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs uppercase tracking-[0.15em] text-ink-soft">
        {label}
        {required ? (
          <span aria-hidden className="ml-1 text-gold-deep">
            *
          </span>
        ) : (
          <span className="ml-1 normal-case tracking-normal text-ink-soft/70">(opsionale)</span>
        )}
      </label>
      {multiline ? (
        <textarea
          id={id}
          name={name}
          rows={rows}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          placeholder={placeholder}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
          className={inputClass}
        />
      ) : (
        <input
          id={id}
          name={name}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          placeholder={placeholder}
          inputMode={inputMode}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
          className={inputClass}
        />
      )}
      {hint ? (
        <p id={hintId} className="text-xs text-ink-soft/80">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-xs font-medium text-blush-deep">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function FormMessage({
  tone,
  children,
}: {
  tone: "error" | "success" | "info";
  children: ReactNode;
}) {
  if (!children) return null;
  const styles =
    tone === "error"
      ? "border-blush-deep/60 bg-blush/50 text-ink"
      : tone === "success"
        ? "border-gold/50 bg-beige/70 text-ink"
        : "border-gold/25 bg-cream-deep text-ink-soft";
  return (
    <p
      role={tone === "error" ? "alert" : undefined}
      aria-live={tone === "error" ? "assertive" : "polite"}
      className={`rounded-[1rem] border px-4 py-3 text-sm leading-relaxed ${styles}`}
    >
      {children}
    </p>
  );
}

export function AuthShell({
  eyebrow,
  title,
  intro,
  children,
  aside,
}: {
  eyebrow: string;
  title: string;
  intro?: ReactNode;
  children: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <main className="container-shop py-12 sm:py-16">
      <div className="mx-auto grid w-full max-w-5xl gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section className="card-soft p-6 sm:p-9">
          <p className="eyebrow">{eyebrow}</p>
          <h1 className="mt-2 font-display text-3xl text-ink sm:text-4xl">{title}</h1>
          {intro ? <div className="mt-3 text-sm leading-relaxed text-ink-soft">{intro}</div> : null}
          <div className="mt-7">{children}</div>
        </section>
        {aside ? <aside className="flex flex-col gap-4">{aside}</aside> : null}
      </div>
    </main>
  );
}

export function SideNote({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-[var(--radius-card)] border border-gold/25 bg-cream-deep p-5">
      <h2 className="font-display text-lg text-ink">{title}</h2>
      <div className="mt-2 text-sm leading-relaxed text-ink-soft">{children}</div>
    </div>
  );
}
