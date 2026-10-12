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
} as const;

export function Icon({ name, size = 16 }: { name: keyof typeof paths; size?: number }) {
  return (
    <svg className="adm-icon" width={size} height={size} viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path d={paths[name]} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <span className="adm-spinner" role="status">
      <span className="adm-spinner-ring" aria-hidden="true" />
      {label ? <span>{label}</span> : <span className="adm-sr">Loading</span>}
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
      <div className="adm-toasts" aria-live="polite" aria-atomic="false">
        {toasts.map((t) => (
          <div key={t.id} className={`adm-toast adm-toast--${t.kind}`} role={t.kind === "error" ? "alert" : "status"}>
            <Icon name={t.kind === "error" ? "warning" : "check"} />
            <span>{t.text}</span>
            <button
              type="button"
              className="adm-toast-close"
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
      className="adm-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div
        className={`adm-modal adm-modal--${size}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        ref={panelRef}
        tabIndex={-1}
        onKeyDown={onKeyDown}
      >
        <header className="adm-modal-head">
          <div>
            <h2 id={titleId} className="adm-modal-title">
              {title}
            </h2>
            {subtitle && <p className="adm-modal-sub">{subtitle}</p>}
          </div>
          <button type="button" className="adm-iconbtn" onClick={onClose} disabled={busy} aria-label="Close">
            <Icon name="close" />
          </button>
        </header>
        <div className="adm-modal-body">{children}</div>
        {footer && <footer className="adm-modal-foot">{footer}</footer>}
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
          <button type="button" className="adm-btn adm-btn--ghost" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className={`adm-btn ${tone === "danger" ? "adm-btn--danger" : "adm-btn--primary"}`}
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
      <div className="adm-confirm-body">{body}</div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Chip input for dish lists                                           */
/* ------------------------------------------------------------------ */

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
    <div className="adm-field">
      <label className="adm-label" htmlFor={inputId}>
        {label} <span className="adm-muted">({value.length}/{MAX_ITEMS})</span>
      </label>
      <div className="adm-chipbox" onClick={() => document.getElementById(inputId)?.focus()}>
        {value.map((item, i) => (
          <span className="adm-chip" key={`${item}-${i}`}>
            <span className="adm-chip-text">{item}</span>
            {i > 0 && (
              <button type="button" className="adm-chip-btn" aria-label={`Move ${item} earlier`} onClick={() => move(i, -1)}>
                ‹
              </button>
            )}
            <button
              type="button"
              className="adm-chip-btn"
              aria-label={`Remove ${item}`}
              onClick={() => onChange(value.filter((_, j) => j !== i))}
            >
              ×
            </button>
          </span>
        ))}
        <input
          id={inputId}
          className="adm-chip-input"
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
      <p className="adm-hint">Press Enter or comma to add. Paste a comma-separated list to add many at once.</p>
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
