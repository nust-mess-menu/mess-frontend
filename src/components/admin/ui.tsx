"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";


/* ------------------------------------------------------------------ */
/* Shared Tailwind class strings                                       */
/* ------------------------------------------------------------------ */

export const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(" ");

type BtnVariant = "primary" | "secondary" | "ghost" | "danger";

const BTN_VARIANT: Record<BtnVariant, string> = {
  primary: "border-transparent bg-adm-accent text-white hover:not-disabled:bg-adm-accent-strong",
  secondary: "border-[#dbe5c2] bg-adm-accent-soft text-adm-accent-strong hover:not-disabled:bg-[#e4ecce]",
  ghost:
    "border-adm-border bg-adm-surface text-adm-text-2 hover:not-disabled:border-adm-border-strong hover:not-disabled:text-adm-text",
  danger: "border-transparent bg-adm-danger text-white hover:not-disabled:bg-[#9a2f27]",
};

/** Button classes. Sizes and variants are exclusive so no utilities collide. */
export function btn(variant: BtnVariant, opts: { sm?: boolean; block?: boolean; className?: string } = {}): string {
  return cx(
    "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-adm-sm border font-semibold no-underline",
    "transition-[background-color,border-color,color,box-shadow] duration-150 disabled:cursor-not-allowed disabled:opacity-55",
    opts.sm ? "min-h-8 px-2.5 text-[13px]" : "min-h-9 px-3.5",
    opts.block && "w-full",
    BTN_VARIANT[variant],
    opts.className
  );
}

export function iconBtn(danger = false): string {
  return cx(
    "inline-grid size-8 place-items-center rounded-adm-sm border border-transparent bg-transparent text-adm-text-2",
    danger
      ? "hover:not-disabled:border-[#f0c9c4] hover:not-disabled:bg-adm-danger-soft hover:not-disabled:text-adm-danger"
      : "hover:not-disabled:border-adm-border hover:not-disabled:bg-adm-surface-2 hover:not-disabled:text-adm-text"
  );
}

type Tone = "error" | "warn" | "ok" | "info";
const BANNER_TONE: Record<Tone, string> = {
  error: "bg-adm-danger-soft text-adm-danger",
  warn: "bg-adm-warn-soft text-adm-warn",
  ok: "bg-adm-ok-soft text-adm-ok",
  info: "bg-adm-info-soft text-[#2c4f73]",
};
export const banner = (tone: Tone) =>
  cx("mb-3.5 flex items-start gap-2 rounded-adm-sm px-3 py-2.5 text-[13px]", BANNER_TONE[tone]);

export const badge = (accent = false) =>
  cx(
    "inline-flex items-center whitespace-nowrap rounded-full border px-2 py-px text-[11px] font-semibold",
    accent ? "border-[#dbe5c2] bg-adm-accent-soft text-adm-accent-strong" : "border-adm-border bg-adm-surface-2 text-adm-text-2"
  );

const FIELD_BASE =
  "min-h-[38px] rounded-adm-sm border bg-adm-surface py-2 transition-[border-color,box-shadow] duration-150 " +
  "focus:border-adm-accent focus:shadow-[0_0_0_3px_var(--color-adm-accent-ring)] focus:outline-none";

/** Text input. `search` leaves room for the leading search icon. */
export const input = (opts: { search?: boolean } = {}) =>
  cx(FIELD_BASE, "w-full border-adm-border-strong", opts.search ? "pr-[11px] pl-[34px]" : "px-[11px]");

/** Select. `full` stretches it (in grids); otherwise it's auto-width, full on phones. */
export const select = (full = false) =>
  cx(
    FIELD_BASE,
    "min-w-[150px] cursor-pointer border-adm-border-strong px-[11px]",
    full ? "w-full" : "w-auto max-[600px]:w-full"
  );

export const textarea = (invalid = false) =>
  cx(
    FIELD_BASE,
    "w-full resize-y px-[11px] leading-[1.55]",
    invalid ? "border-adm-danger" : "border-adm-border-strong"
  );

export const ui = {
  muted: "text-adm-text-3",
  eyebrow: "m-0 text-[11px] font-semibold uppercase tracking-[0.06em] text-adm-text-3",
  code: "rounded-[5px] border border-adm-border bg-adm-surface-2 px-1.5 py-px font-mono text-[12px] text-adm-text-2",
  label: "text-[13px] font-semibold text-adm-text",
  hint: "m-0 text-[12px] text-adm-text-3",
  /** Form field; `fieldInForm` drops the bottom margin inside a gapped form grid */
  field: "mb-3.5 grid gap-1.5",
  fieldInForm: "grid gap-1.5",
  card: "rounded-adm border border-adm-border bg-adm-surface p-4 shadow-adm",
  cardHead: "mb-3.5 flex flex-wrap items-center justify-between gap-3",
  h2: "mb-1 text-[17px] font-bold",
  toolbar: "flex items-center gap-2 max-[600px]:flex-wrap",
  search: "relative flex flex-1 items-center",
  searchIcon: "pointer-events-none absolute left-[11px] text-adm-text-3",
  empty: "px-4 py-10 text-center text-adm-text-3",
  chipStatic:
    "inline-flex max-w-full items-center rounded-full border border-adm-border bg-adm-surface-2 px-2.5 py-[3px] text-[13px] font-medium text-adm-text-2",
};

/** Segmented control. `full` makes it a full-width block with equal buttons. */
export const seg = (full = false) =>
  cx("gap-0.5 rounded-[9px] bg-[#eef0e8] p-[3px]", full ? "mb-3.5 flex" : "inline-flex");

export const segBtn = (active: boolean, full = false) =>
  cx(
    "inline-flex items-center justify-center gap-2 rounded-[7px] px-3.5 py-1.5 font-semibold",
    full && "flex-1",
    active ? "bg-adm-surface text-adm-text shadow-[0_1px_2px_rgba(31,36,25,0.12)]" : "bg-transparent text-adm-text-2"
  );

/* ------------------------------------------------------------------ */
/* Icons                                                               */
/* ------------------------------------------------------------------ */

const paths = {
  edit: "M11.5 2.5l2 2L6 12H4v-2l7.5-7.5z",
  trash: "M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 8.5h5.8l.6-8.5",
  plus: "M8 3v10M3 8h10",
  copy: "M5.5 5.5h7v7h-7zM3.5 10.5v-7h7",
  search: "M7 12A5 5 0 107 2a5 5 0 000 10zM14 14l-3.5-3.5",
  close: "M4 4l8 8M12 4l-8 8",
  swap: "M3 5.5h9.5L10 3M13 10.5H3.5L6 13",
  download: "M8 2.5v8M4.5 7L8 10.5 11.5 7M3 13.5h10",
  upload: "M8 10.5v-8M4.5 6L8 2.5 11.5 6M3 13.5h10",
  refresh: "M13 8a5 5 0 11-1.5-3.5M13 2.5v3h-3",
  check: "M3 8.5l3 3 7-7",
  external: "M9.5 2.5h4v4M13.5 2.5L7.5 8.5M12 9.5v4h-9.5V4h4",
  logout: "M10 5V3H3v10h7v-2M7 8h7M11.5 5.5L14 8l-2.5 2.5",
  warning: "M8 2l6.5 11.5h-13zM8 6.5v3M8 11.5v.5",
  eye: "M1.5 8S4 3.5 8 3.5 14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8zM8 10a2 2 0 100-4 2 2 0 000 4z",
  eyeOff: "M2.5 2.5l11 11M6.5 4c.5-.3 1-.5 1.5-.5 4 0 6.5 4.5 6.5 4.5s-.6 1.1-1.7 2.2M4.2 5.2C2.6 6.4 1.5 8 1.5 8S4 12.5 8 12.5c1 0 1.9-.3 2.7-.7",
  calendar: "M3 4h10v9.5H3zM3 7h10M5.5 2.5v3M10.5 2.5v3",
  library: "M3 3h3v10H3zM7 3h3v10H7zM11 3.5l2.5.7-2 9-2.5-.6",
  code: "M5.5 4.5L2 8l3.5 3.5M10.5 4.5L14 8l-3.5 3.5",
  chart: "M2.5 13.5h11M4.5 11V8M8 11V4.5M11.5 11V6.5",
  megaphone: "M2.5 6.5v3h2l6 3.5v-10l-6 3.5zM4.5 9.5l1 4h1.5l-.5-3.5M13 6.5v3",
} as const;

export function Icon({ name, size = 16, className }: { name: keyof typeof paths; size?: number; className?: string }) {
  return (
    <svg className={cx("inline shrink-0 align-[-3px]", className)} width={size} height={size} viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path d={paths[name]} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-2" role="status">
      <span
        className="size-3.5 animate-adm-spin rounded-full border-2 border-current border-r-transparent motion-reduce:[animation-duration:2s]"
        aria-hidden="true"
      />
      {label ? <span>{label}</span> : <span className="sr-only">Loading</span>}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Toasts                                                              */
/* ------------------------------------------------------------------ */

type ToastKind = "success" | "error" | "info";
interface Toast {
  id: number;
  kind: ToastKind;
  text: string;
}

const ToastContext = createContext<(kind: ToastKind, text: string) => void>(() => undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const push = useCallback((kind: ToastKind, text: string) => {
    const id = nextId.current++;
    setToasts((list) => [...list.slice(-3), { id, kind, text }]);
    setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), kind === "error" ? 7000 : 3500);
  }, []);

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div
        className="fixed right-4 bottom-4 z-60 grid w-[min(380px,calc(100vw-32px))] gap-2"
        aria-live="polite"
        aria-atomic="false"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cx(
              "flex animate-adm-rise items-start gap-2 rounded-adm-sm py-2.5 pr-2 pl-3 text-[13px] text-[#f3f5ee] shadow-adm-lg",
              t.kind === "error" ? "bg-[#5c1d18]" : "bg-adm-ink"
            )}
            role={t.kind === "error" ? "alert" : "status"}
          >
            <Icon name={t.kind === "error" ? "warning" : "check"} className={t.kind === "success" ? "text-[#a9c96a]" : undefined} />
            <span className="flex-1">{t.text}</span>
            <button
              type="button"
              className="bg-transparent px-0.5 text-inherit opacity-70"
              aria-label="Dismiss"
              onClick={() => setToasts((list) => list.filter((x) => x.id !== t.id))}
            >
              <Icon name="close" size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);

/* ------------------------------------------------------------------ */
/* Modal with focus trap                                               */
/* ------------------------------------------------------------------ */

const MODAL_WIDTH = { sm: "max-w-[440px]", md: "max-w-[600px]", lg: "max-w-[760px]" } as const;

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Modal({
  title,
  subtitle,
  onClose,
  children,
  footer,
  size = "md",
  busy = false,
}: {
  title: string;
  subtitle?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
  busy?: boolean;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const returnFocus = useRef<Element | null>(null);

  useEffect(() => {
    returnFocus.current = document.activeElement;
    const first = panelRef.current?.querySelector<HTMLElement>("[data-autofocus]") ?? panelRef.current;
    first?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
      (returnFocus.current as HTMLElement | null)?.focus?.();
    };
  }, []);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape" && !busy) {
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key !== "Tab" || !panelRef.current) return;
    const nodes = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (nodes.length === 0) return;
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 grid animate-adm-fade place-items-center bg-[rgba(24,28,18,0.45)] p-4 motion-reduce:animate-none"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div
        className={cx(
          "flex max-h-[calc(100vh-32px)] w-full animate-adm-rise flex-col rounded-[14px] bg-adm-surface shadow-adm-lg outline-none motion-reduce:animate-none",
          MODAL_WIDTH[size]
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        ref={panelRef}
        tabIndex={-1}
        onKeyDown={onKeyDown}
      >
        <header className="flex items-start justify-between gap-3 border-b border-adm-border px-5 pt-[18px] pb-3">
          <div>
            <h2 id={titleId} className="m-0 text-[17px] font-bold">
              {title}
            </h2>
            {subtitle && <p className="mt-0.5 text-[13px] text-adm-text-2">{subtitle}</p>}
          </div>
          <button type="button" className={iconBtn()} onClick={onClose} disabled={busy} aria-label="Close">
            <Icon name="close" />
          </button>
        </header>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <footer className="flex items-center justify-end gap-2 border-t border-adm-border px-5 pt-3 pb-4 max-[600px]:flex-wrap">
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
}

export function ConfirmDialog({
  title,
  body,
  confirmLabel,
  tone = "primary",
  busy = false,
  onConfirm,
  onCancel,
}: {
  title: string;
  body: ReactNode;
  confirmLabel: string;
  tone?: "primary" | "danger";
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal
      title={title}
      onClose={onCancel}
      size="sm"
      busy={busy}
      footer={
        <>
          <button type="button" className={btn("ghost")} onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className={btn(tone === "danger" ? "danger" : "primary")}
            onClick={onConfirm}
            disabled={busy}
            data-autofocus
          >
            {busy ? <Spinner /> : null}
            {confirmLabel}
          </button>
        </>
      }
    >
      <div className="[&_p]:m-0 [&_p]:text-adm-text-2">{body}</div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Chip input for dish lists                                           */
/* ------------------------------------------------------------------ */

const CHIP_BTN = "size-5 rounded-full bg-transparent leading-none text-inherit hover:bg-[rgba(106,130,48,0.15)]";

export const MAX_ITEMS = 20;
export const MAX_ITEM_LENGTH = 200;

export function ChipInput({
  value,
  onChange,
  placeholder = "Type a dish and press Enter",
  autoFocus = false,
  label,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  autoFocus?: boolean;
  label: string;
}) {
  const [draft, setDraft] = useState("");
  const inputId = useId();

  const add = (raw: string) => {
    const parts = raw
      .split(/[,\n]/)
      .map((p) => p.replace(/\s+/g, " ").trim().slice(0, MAX_ITEM_LENGTH))
      .filter(Boolean);
    if (!parts.length) return;
    const next = [...value];
    for (const p of parts) {
      if (next.length >= MAX_ITEMS) break;
      if (!next.some((x) => x.toLowerCase() === p.toLowerCase())) next.push(p);
    }
    onChange(next);
    setDraft("");
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      add(draft);
    } else if (e.key === "Backspace" && !draft && value.length) {
      onChange(value.slice(0, -1));
    }
  };

  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= value.length) return;
    const next = [...value];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  return (
    <div className={ui.field}>
      <label className={ui.label} htmlFor={inputId}>
        {label} <span className={ui.muted}>({value.length}/{MAX_ITEMS})</span>
      </label>
      <div
        className="flex min-h-[46px] cursor-text flex-wrap gap-1.5 rounded-adm-sm border border-adm-border-strong bg-adm-surface p-1.5 focus-within:border-adm-accent focus-within:shadow-[0_0_0_3px_var(--color-adm-accent-ring)]"
        onClick={() => document.getElementById(inputId)?.focus()}>
        {value.map((item, i) => (
          <span
            className="inline-flex max-w-full items-center gap-0.5 rounded-full bg-adm-accent-soft py-[3px] pr-1 pl-2.5 text-[13px] font-medium text-adm-accent-strong"
            key={`${item}-${i}`}
            data-testid="chip"
          >
            <span className="truncate">{item}</span>
            {i > 0 && (
              <button type="button" className={CHIP_BTN} aria-label={`Move ${item} earlier`} onClick={() => move(i, -1)}>
                ‹
              </button>
            )}
            <button
              type="button"
              className={CHIP_BTN}
              aria-label={`Remove ${item}`}
              onClick={() => onChange(value.filter((_, j) => j !== i))}
            >
              ×
            </button>
          </span>
        ))}
        <input
          id={inputId}
          className="min-w-[160px] flex-1 bg-transparent px-1.5 py-1 outline-none"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => add(draft)}
          onPaste={(e) => {
            const text = e.clipboardData.getData("text");
            if (/[,\n]/.test(text)) {
              e.preventDefault();
              add(text);
            }
          }}
          placeholder={value.length >= MAX_ITEMS ? "Maximum reached" : placeholder}
          disabled={value.length >= MAX_ITEMS}
          maxLength={MAX_ITEM_LENGTH * 4}
          autoFocus={autoFocus}
          data-autofocus={autoFocus || undefined}
          autoComplete="off"
        />
      </div>
      <p className={ui.hint}>Press Enter or comma to add. Paste a comma-separated list to add many at once.</p>
    </div>
  );
}

export function copyText(text: string): Promise<boolean> {
  return navigator.clipboard
    .writeText(text)
    .then(() => true)
    .catch(() => false);
}

/** Save JSON to a file (created in-memory; nothing leaves the browser). */
export function downloadJson(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
