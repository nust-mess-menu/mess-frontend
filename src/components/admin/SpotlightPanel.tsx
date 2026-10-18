"use client";

import { useCallback, useEffect, useId, useState } from "react";
import SpotlightCard from "@/components/spotlight/SpotlightCard";
import {
  isUploadedLogo,
  MAX_LOGO_LENGTH,
  SLOT_LABELS,
  SPOTLIGHT_LOGOS,
  SPOTLIGHT_SLOTS,
  trackedUrl,
  type Spotlight,
  type SpotlightSlot,
} from "@/components/spotlight/model";
import { adminFetch } from "./api";
import { banner, btn, ConfirmDialog, cx, Icon, input, Modal, select, seg, segBtn, Spinner, textarea, ui, useToast } from "./ui";

type Status = "draft" | "active" | "paused";

interface Campaign extends Spotlight {
  status: Status;
  clicks: number;
  createdAt: string;
  updatedAt: string;
  clicksByDay: { date: string; clicks: number }[];
}

/** The editor's working copy: date-times as PKT `datetime-local` strings. */
interface Draft {
  id?: string;
  status: Status;
  advertiser: string;
  headline: string;
  body: string;
  ctaLabel: string;
  ctaUrl: string;
  accent: string;
  logo: string | null;
  slots: SpotlightSlot[];
  startsAt: string;
  endsAt: string;
  weight: number;
  snoozeDays: number;
}

const LIMITS = { advertiser: 60, headline: 80, body: 160, ctaLabel: 30 } as const;

/* Pakistan has no daylight saving: PKT is always UTC+5 */
const PKT_OFFSET_MS = 5 * 60 * 60 * 1000;
const toPktInput = (iso: string) => new Date(Date.parse(iso) + PKT_OFFSET_MS).toISOString().slice(0, 16);
const fromPktInput = (value: string) => new Date(Date.parse(`${value}:00+05:00`)).toISOString();
const nowPktInput = () => toPktInput(new Date().toISOString());

const fmtWhen = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { timeZone: "Asia/Karachi", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

const nf = new Intl.NumberFormat("en");

const BLANK: Omit<Draft, "startsAt"> = {
  status: "draft",
  advertiser: "",
  headline: "",
  body: "",
  ctaLabel: "Learn more",
  ctaUrl: "https://",
  accent: "#9bb158",
  logo: null,
  slots: ["today", "week"],
  endsAt: "",
  weight: 1,
  snoozeDays: 7,
};

/** Ready-made starting points; everything stays editable. */
const TEMPLATES: { label: string; draft: Omit<Draft, "startsAt"> }[] = [
  {
    label: "Guerilla FYP",
    draft: {
      ...BLANK,
      advertiser: "Guerilla FYP",
      headline: "Stuck on your FYP?",
      body: "Web, mobile, AI/ML — we turn your idea into working software. Student-friendly pricing.",
      ctaLabel: "See how it works",
      ctaUrl: "https://www.guerillafyp.space/",
      accent: "#ffc224",
      logo: "/images/spotlight/guerillafyp.svg",
    },
  },
];

type Phase = "live" | "scheduled" | "ended" | "paused" | "draft";

function phaseOf(c: Campaign, now: number): Phase {
  if (c.status === "draft") return "draft";
  if (c.status === "paused") return "paused";
  if (Date.parse(c.startsAt) > now) return "scheduled";
  if (c.endsAt && Date.parse(c.endsAt) <= now) return "ended";
  return "live";
}

const PHASE: Record<Phase, { label: string; className: string }> = {
  live: { label: "Live", className: "border-[#cfe5d3] bg-adm-ok-soft text-adm-ok" },
  scheduled: { label: "Scheduled", className: "border-[#d3e1ef] bg-adm-info-soft text-[#2c4f73]" },
  paused: { label: "Paused", className: "border-[#f0dfb5] bg-adm-warn-soft text-adm-warn" },
  ended: { label: "Ended", className: "border-adm-border bg-adm-surface-2 text-adm-text-3" },
  draft: { label: "Draft", className: "border-adm-border bg-adm-surface-2 text-adm-text-2" },
};

function toDraft(c: Campaign): Draft {
  return {
    id: c.id,
    status: c.status,
    advertiser: c.advertiser,
    headline: c.headline,
    body: c.body,
    ctaLabel: c.ctaLabel,
    ctaUrl: c.ctaUrl,
    accent: c.accent,
    logo: c.logo,
    slots: c.slots,
    startsAt: toPktInput(c.startsAt),
    endsAt: c.endsAt ? toPktInput(c.endsAt) : "",
    weight: c.weight,
    snoozeDays: c.snoozeDays,
  };
}

function toBody(d: Draft) {
  return {
    ...(d.id ? { id: d.id } : {}),
    status: d.status,
    advertiser: d.advertiser,
    headline: d.headline,
    body: d.body,
    ctaLabel: d.ctaLabel,
    ctaUrl: d.ctaUrl.trim(),
    accent: d.accent,
    logo: d.logo,
    slots: d.slots,
    startsAt: fromPktInput(d.startsAt),
    endsAt: d.endsAt ? fromPktInput(d.endsAt) : null,
    weight: d.weight,
    snoozeDays: d.snoozeDays,
  };
}

/** First problem a student would notice, checked before the round trip. */
function problemWith(d: Draft): string | null {
  if (!d.advertiser.trim()) return "Add the advertiser's name.";
  if (!d.headline.trim()) return "Add a headline.";
  if (!d.ctaLabel.trim()) return "Add a button label.";
  try {
    const url = new URL(d.ctaUrl.trim());
    if (url.protocol !== "https:" || !url.hostname.includes(".")) return "The link must be a full https:// address.";
  } catch {
    return "The link must be a full https:// address.";
  }
  if (!/^#[0-9a-f]{6}$/i.test(d.accent)) return "Accent must be a hex colour like #ffc224.";
  if (d.slots.length === 0) return "Pick at least one place to show it.";
  if (!d.startsAt) return "Pick a start time.";
  if (d.endsAt && d.endsAt <= d.startsAt) return "The end must be after the start.";
  return null;
}

const LOGO_SIZE = 128;
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

/**
 * Fit an image file into a 128×128 transparent square and return it as a small
 * raster data URI (WebP where the browser can encode it, PNG otherwise).
 * Read through FileReader, not a blob: URL, because the admin CSP allows only
 * 'self' and data: images. SVGs are rasterised here, so no SVG is ever stored.
 */
async function resizeLogo(file: File): Promise<string> {
  if (!/^image\/(png|jpeg|webp|svg\+xml)$/.test(file.type)) throw new Error("Use a PNG, JPG, WebP or SVG image.");
  if (file.size > MAX_UPLOAD_BYTES) throw new Error("That image is over 5 MB. Use a smaller file.");

  const source = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read that file."));
    reader.readAsDataURL(file);
  });
  const img = new Image();
  img.src = source;
  await img.decode().catch(() => {
    throw new Error("Could not open that image.");
  });

  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = LOGO_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not process that image.");
  const w = img.naturalWidth || LOGO_SIZE;
  const h = img.naturalHeight || LOGO_SIZE;
  const scale = Math.min(LOGO_SIZE / w, LOGO_SIZE / h);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, (LOGO_SIZE - w * scale) / 2, (LOGO_SIZE - h * scale) / 2, w * scale, h * scale);

  for (const type of ["image/webp", "image/png"]) {
    const url = canvas.toDataURL(type, 0.9);
    if (url.startsWith(`data:${type};`) && url.length <= MAX_LOGO_LENGTH) return url;
  }
  throw new Error("That image is too detailed to use as a logo. Try a simpler one.");
}

export default function SpotlightPanel() {
  const toast = useToast();
  const [campaigns, setCampaigns] = useState<Campaign[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Draft | null>(null);
  const [deleting, setDeleting] = useState<Campaign | null>(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const fetchCampaigns = useCallback(async () => {
    const res = await adminFetch<{ campaigns: Campaign[] }>("spotlight");
    if (!res.ok || !res.data) return { error: res.message || "Could not load campaigns." };
    return { data: Array.isArray(res.data.campaigns) ? res.data.campaigns : [] };
  }, []);

  const reload = useCallback(async () => {
    const r = await fetchCampaigns();
    setNow(Date.now());
    if ("data" in r && r.data) {
      setCampaigns(r.data);
      setError(null);
    } else setError(r.error ?? "Could not load campaigns.");
  }, [fetchCampaigns]);

  useEffect(() => {
    let cancelled = false;
    fetchCampaigns().then((r) => {
      if (cancelled) return;
      if ("data" in r && r.data) setCampaigns(r.data);
      else setError(r.error ?? "Could not load campaigns.");
    });
    return () => {
      cancelled = true;
    };
  }, [fetchCampaigns]);

  const save = async (draft: Draft): Promise<boolean> => {
    setBusy(true);
    const res = await adminFetch<{ campaign: Campaign }>("spotlight", { method: "POST", body: toBody(draft) });
    setBusy(false);
    if (!res.ok) {
      toast("error", res.message || "Could not save the campaign.");
      return false;
    }
    toast("success", res.message || "Campaign saved.");
    await reload();
    return true;
  };

  const setStatus = (c: Campaign, status: Status) => save({ ...toDraft(c), status });

  const remove = async () => {
    if (!deleting) return;
    setBusy(true);
    const res = await adminFetch("spotlight", { method: "DELETE", query: { id: deleting.id } });
    setBusy(false);
    setDeleting(null);
    if (!res.ok) {
      toast("error", res.message || "Could not delete the campaign.");
      return;
    }
    toast("success", "Campaign deleted.");
    await reload();
  };

  const startNew = (base: Omit<Draft, "startsAt"> = BLANK) => setEditing({ ...base, startsAt: nowPktInput() });

  if (error && !campaigns) {
    return (
      <div className={banner("error")} role="alert">
        <Icon name="warning" /> {error}
      </div>
    );
  }
  if (!campaigns) {
    return (
      <div className={ui.empty}>
        <Spinner label="Loading campaigns…" />
      </div>
    );
  }

  const liveCount = campaigns.filter((c) => phaseOf(c, now) === "live").length;

  return (
    <section className={ui.card}>
      <div className={ui.cardHead}>
        <div>
          <h2 className={ui.h2}>Spotlight</h2>
          <p className={ui.muted}>
            Sponsored cards shown below the menu, labelled “Sponsored”. Up to two at a time; with more than two live they
            rotate as a slideshow. Students can hide a card for its snooze period. Changes reach students within about 2
            minutes. A click counts whenever a student opens the link (tap, new tab, long-press); bots, prefetches and
            double clicks are not counted, and your own previews here never count.
          </p>
        </div>
        <div className={ui.toolbar}>
          <span className={cx(ui.muted, "text-[13px]")}>{liveCount} live</span>
          <button type="button" className={btn("primary", { sm: true })} onClick={() => startNew()}>
            <Icon name="plus" /> New campaign
          </button>
        </div>
      </div>

      {campaigns.length === 0 ? (
        <div className={ui.empty}>
          <p className="mb-3">No campaigns yet.</p>
          <div className="flex flex-wrap justify-center gap-2">
            {TEMPLATES.map((t) => (
              <button key={t.label} type="button" className={btn("secondary")} onClick={() => startNew(t.draft)}>
                Start from {t.label}
              </button>
            ))}
            <button type="button" className={btn("ghost")} onClick={() => startNew()}>
              Blank campaign
            </button>
          </div>
        </div>
      ) : (
        <ul className="m-0 grid list-none gap-3 p-0">
          {campaigns.map((c) => (
            <CampaignRow
              key={c.id}
              campaign={c}
              phase={phaseOf(c, now)}
              busy={busy}
              onEdit={() => setEditing(toDraft(c))}
              onToggle={() => setStatus(c, c.status === "active" ? "paused" : "active")}
              onDelete={() => setDeleting(c)}
            />
          ))}
        </ul>
      )}

      {editing && (
        <Editor
          initial={editing}
          busy={busy}
          onCancel={() => setEditing(null)}
          onSave={async (draft) => {
            if (await save(draft)) setEditing(null);
          }}
        />
      )}

      {deleting && (
        <ConfirmDialog
          title="Delete this campaign?"
          body={
            <p>
              <strong>{deleting.headline}</strong> disappears for students within about 2 minutes, and its click history
              is no longer shown. To stop it temporarily, pause it instead.
            </p>
          }
          confirmLabel="Delete"
          tone="danger"
          busy={busy}
          onConfirm={remove}
          onCancel={() => setDeleting(null)}
        />
      )}
    </section>
  );
}

function CampaignRow({
  campaign: c,
  phase,
  busy,
  onEdit,
  onToggle,
  onDelete,
}: {
  campaign: Campaign;
  phase: Phase;
  busy: boolean;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const week = c.clicksByDay.slice(-7).reduce((n, d) => n + d.clicks, 0);
  const peak = Math.max(1, ...c.clicksByDay.map((d) => d.clicks));

  return (
    <li className="rounded-adm border border-adm-border bg-adm-surface-2 p-3.5">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className={cx("inline-flex items-center rounded-full border px-2 py-px text-[11px] font-semibold", PHASE[phase].className)}>
          {PHASE[phase].label}
        </span>
        <span className="text-[13px] font-semibold">{c.advertiser}</span>
        <span className={cx(ui.muted, "text-[12px]")}>
          {fmtWhen(c.startsAt)} → {c.endsAt ? fmtWhen(c.endsAt) : "no end date"}
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          <button type="button" className={btn("ghost", { sm: true })} onClick={onEdit} disabled={busy}>
            <Icon name="edit" /> Edit
          </button>
          {c.status !== "draft" && (
            <button type="button" className={btn("ghost", { sm: true })} onClick={onToggle} disabled={busy}>
              {c.status === "active" ? "Pause" : "Resume"}
            </button>
          )}
          {c.status === "draft" && (
            <button type="button" className={btn("secondary", { sm: true })} onClick={onToggle} disabled={busy}>
              Publish
            </button>
          )}
          <button type="button" className={btn("ghost", { sm: true })} onClick={onDelete} disabled={busy} aria-label={`Delete ${c.headline}`}>
            <Icon name="trash" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-[1fr_auto] items-center gap-4 max-[800px]:grid-cols-1">
        <SpotlightCard campaign={c} href={trackedUrl(c)} />
        <div className="min-w-[190px]">
          <p className={ui.eyebrow}>Clicks</p>
          <p className="text-[20px] font-bold tabular-nums">
            {nf.format(c.clicks)} <span className="text-[12px] font-medium text-adm-text-3">total · {nf.format(week)} last 7 days</span>
          </p>
          <div className="mt-1.5 flex h-8 items-end gap-0.5" role="img" aria-label={`Clicks over the last ${c.clicksByDay.length} days`}>
            {c.clicksByDay.map((d) => (
              <span
                key={d.date}
                className={cx("w-2.5 rounded-t-[2px]", d.clicks ? "bg-adm-accent" : "bg-adm-border")}
                style={{ height: `${Math.max(8, (d.clicks / peak) * 100)}%` }}
                title={`${d.date}: ${d.clicks}`}
              />
            ))}
          </div>
          <p className={cx(ui.hint, "mt-1.5")}>
            {c.slots.map((s) => (s === "today" ? "Today" : "This Week")).join(" + ")} · weight {c.weight} · hides {c.snoozeDays}d
          </p>
        </div>
      </div>
    </li>
  );
}

function Editor({
  initial,
  busy,
  onCancel,
  onSave,
}: {
  initial: Draft;
  busy: boolean;
  onCancel: () => void;
  onSave: (draft: Draft) => void;
}) {
  const [d, setD] = useState<Draft>(initial);
  const [touched, setTouched] = useState(false);
  const [uploading, setUploading] = useState(false);
  const toast = useToast();
  const ids = useId();

  const upload = async (file: File) => {
    setUploading(true);
    try {
      set("logo", await resizeLogo(file));
    } catch (error) {
      toast("error", (error as Error).message || "Could not use that image.");
    } finally {
      setUploading(false);
    }
  };
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setD((prev) => ({ ...prev, [key]: value }));
  const problem = problemWith(d);

  const text = (key: keyof typeof LIMITS, label: string, opts: { multiline?: boolean; placeholder?: string } = {}) => (
    <div className={ui.fieldInForm}>
      <label className={ui.label} htmlFor={`${ids}-${key}`}>
        {label}{" "}
        <span className={ui.muted}>
          ({d[key].length}/{LIMITS[key]})
        </span>
      </label>
      {opts.multiline ? (
        <textarea
          id={`${ids}-${key}`}
          className={textarea()}
          rows={2}
          maxLength={LIMITS[key]}
          value={d[key]}
          placeholder={opts.placeholder}
          onChange={(e) => set(key, e.target.value)}
        />
      ) : (
        <input
          id={`${ids}-${key}`}
          className={input()}
          maxLength={LIMITS[key]}
          value={d[key]}
          placeholder={opts.placeholder}
          onChange={(e) => set(key, e.target.value)}
        />
      )}
    </div>
  );

  const submit = () => {
    setTouched(true);
    if (!problem) onSave(d);
  };

  return (
    <Modal
      title={d.id ? "Edit campaign" : "New campaign"}
      subtitle="Times are Pakistan time. Drafts are never shown to students."
      size="lg"
      busy={busy}
      onClose={onCancel}
      footer={
        <>
          <button type="button" className={btn("ghost")} onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button type="button" className={btn("primary")} onClick={submit} disabled={busy}>
            {busy ? <Spinner /> : null}
            {d.status === "active" ? "Save & publish" : "Save"}
          </button>
        </>
      }
    >
      <div className="mb-4 rounded-adm-sm border border-dashed border-adm-border-strong bg-white p-3">
        <p className={cx(ui.eyebrow, "mb-2")}>Preview</p>
        <SpotlightCard
          campaign={{ ...d, headline: d.headline || "Your headline", ctaLabel: d.ctaLabel || "Learn more" }}
          href={trackedUrl({ id: d.id ?? "preview", ctaUrl: d.ctaUrl })}
        />
      </div>

      {touched && problem && (
        <div className={banner("error")} role="alert">
          <Icon name="warning" /> {problem}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3.5 max-[640px]:grid-cols-1">
        {text("advertiser", "Advertiser", { placeholder: "Guerilla FYP" })}
        {text("ctaLabel", "Button label", { placeholder: "See how it works" })}
        <div className="col-span-2 max-[640px]:col-span-1">{text("headline", "Headline", { placeholder: "Stuck on your FYP?" })}</div>
        <div className="col-span-2 max-[640px]:col-span-1">{text("body", "Supporting line (optional)", { multiline: true })}</div>

        <div className={cx(ui.fieldInForm, "col-span-2 max-[640px]:col-span-1")}>
          <label className={ui.label} htmlFor={`${ids}-url`}>
            Link
          </label>
          <input
            id={`${ids}-url`}
            className={input()}
            type="url"
            inputMode="url"
            maxLength={500}
            value={d.ctaUrl}
            onChange={(e) => set("ctaUrl", e.target.value)}
          />
          <p className={ui.hint}>
            Opens in a new tab. <code className={ui.code}>utm_source=messmenu</code> tags are added automatically so the
            advertiser can see visits came from here.
          </p>
        </div>

        <div className={ui.fieldInForm}>
          <label className={ui.label} htmlFor={`${ids}-accent`}>
            Accent colour
          </label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              className="h-[38px] w-12 cursor-pointer rounded-adm-sm border border-adm-border-strong bg-adm-surface p-1"
              value={/^#[0-9a-f]{6}$/i.test(d.accent) ? d.accent : "#9bb158"}
              onChange={(e) => set("accent", e.target.value)}
              aria-label="Pick accent colour"
            />
            <input id={`${ids}-accent`} className={input()} maxLength={7} value={d.accent} onChange={(e) => set("accent", e.target.value.trim())} />
          </div>
          <p className={ui.hint}>Button text turns black or white automatically for contrast.</p>
        </div>

        <div className={ui.fieldInForm}>
          <label className={ui.label} htmlFor={`${ids}-logo`}>
            Logo
          </label>
          <div className="flex items-center gap-2">
            <select
              id={`${ids}-logo`}
              className={select(true)}
              value={d.logo ?? ""}
              onChange={(e) => set("logo", e.target.value || null)}
            >
              <option value="">None (first letter on the accent)</option>
              {SPOTLIGHT_LOGOS.map((l) => (
                <option key={l.path} value={l.path}>
                  {l.label}
                </option>
              ))}
              {isUploadedLogo(d.logo) && <option value={d.logo}>Uploaded image</option>}
            </select>
            <label className={btn("ghost", { className: "shrink-0 cursor-pointer" })}>
              {uploading ? <Spinner /> : <Icon name="upload" />} Upload
              <input
                type="file"
                className="sr-only"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                disabled={uploading}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) void upload(file);
                }}
              />
            </label>
          </div>
          <p className={ui.hint}>PNG, JPG, WebP or SVG. Square works best; it is resized to 128×128.</p>
        </div>

        <fieldset className={cx(ui.fieldInForm, "col-span-2 m-0 border-0 p-0 max-[640px]:col-span-1")}>
          <legend className={cx(ui.label, "mb-1.5")}>Show on</legend>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {SPOTLIGHT_SLOTS.map((slot) => (
              <label key={slot} className="inline-flex cursor-pointer items-center gap-2 text-[14px]">
                <input
                  type="checkbox"
                  className="size-4 accent-adm-accent"
                  checked={d.slots.includes(slot)}
                  onChange={(e) => set("slots", e.target.checked ? [...d.slots, slot] : d.slots.filter((s) => s !== slot))}
                />
                {SLOT_LABELS[slot]}
              </label>
            ))}
          </div>
        </fieldset>

        <div className={ui.fieldInForm}>
          <label className={ui.label} htmlFor={`${ids}-start`}>
            Starts
          </label>
          <input id={`${ids}-start`} className={input()} type="datetime-local" value={d.startsAt} onChange={(e) => set("startsAt", e.target.value)} />
          <p className={ui.hint}>Set a future time to schedule it.</p>
        </div>
        <div className={ui.fieldInForm}>
          <label className={ui.label} htmlFor={`${ids}-end`}>
            Ends <span className={ui.muted}>(optional)</span>
          </label>
          <input id={`${ids}-end`} className={input()} type="datetime-local" value={d.endsAt} min={d.startsAt} onChange={(e) => set("endsAt", e.target.value)} />
          <p className={ui.hint}>It stops showing on its own at this time.</p>
        </div>

        <div className={ui.fieldInForm}>
          <label className={ui.label} htmlFor={`${ids}-weight`}>
            Rotation weight
          </label>
          <input
            id={`${ids}-weight`}
            className={input()}
            type="number"
            min={1}
            max={10}
            value={d.weight}
            onChange={(e) => set("weight", Math.min(10, Math.max(1, Math.round(Number(e.target.value) || 1))))}
          />
          <p className={ui.hint}>With several live campaigns, higher weight is more likely to be shown first. 2 is twice as likely as 1.</p>
        </div>
        <div className={ui.fieldInForm}>
          <label className={ui.label} htmlFor={`${ids}-snooze`}>
            Hidden after ✕ for (days)
          </label>
          <input
            id={`${ids}-snooze`}
            className={input()}
            type="number"
            min={1}
            max={90}
            value={d.snoozeDays}
            onChange={(e) => set("snoozeDays", Math.min(90, Math.max(1, Math.round(Number(e.target.value) || 1))))}
          />
        </div>

        <div className={cx(ui.fieldInForm, "col-span-2 max-[640px]:col-span-1")}>
          <span className={ui.label}>Status</span>
          <div className={seg()} role="radiogroup" aria-label="Status">
            {(["draft", "active", "paused"] as Status[]).map((s) => (
              <button key={s} type="button" role="radio" aria-checked={d.status === s} className={segBtn(d.status === s)} onClick={() => set("status", s)}>
                {s === "draft" ? "Draft" : s === "active" ? "Active" : "Paused"}
              </button>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}
