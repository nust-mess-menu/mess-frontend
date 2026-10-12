"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { adminFetch } from "./api";
import { DAYS, type Week, type WeekIds } from "./types";
import { ConfirmDialog, downloadJson, Icon, Spinner, useToast } from "./ui";

const MAX_BYTES = 100 * 1024;

const TEMPLATE = JSON.stringify(
  {
    week1: Object.fromEntries(DAYS.map((d) => [d, { breakfast: null, lunch: null, dinner: null }])),
    week2: Object.fromEntries(DAYS.map((d) => [d, { breakfast: null, lunch: null, dinner: null }])),
  },
  null,
  2
);

interface Analysis {
  ok: boolean;
  error?: string;
  slots: number;
  payload?: unknown;
}

/** Parse the editor text and describe what a submit would do. */
function analyse(text: string): Analysis {
  if (new Blob([text]).size > MAX_BYTES) return { ok: false, error: "JSON is larger than 100 KB.", slots: 0 };
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    const msg = (e as Error).message;
    const pos = /position (\d+)/.exec(msg);
    if (pos) {
      const before = text.slice(0, Number(pos[1]));
      const line = before.split("\n").length;
      const col = before.length - before.lastIndexOf("\n");
      return { ok: false, error: `Invalid JSON at line ${line}, column ${col}.`, slots: 0 };
    }
    return { ok: false, error: "Invalid JSON.", slots: 0 };
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ok: false, error: "Top level must be an object with week1 and/or week2.", slots: 0 };
  }
  const { week1, week2 } = parsed as Record<string, unknown>;
  if (!week1 && !week2) return { ok: false, error: "Include at least one of week1 or week2.", slots: 0 };

  let slots = 0;
  for (const week of [week1, week2]) {
    if (!week || typeof week !== "object") continue;
    for (const day of Object.values(week as Record<string, unknown>)) {
      if (!day || typeof day !== "object") continue;
      for (const value of Object.values(day as Record<string, unknown>)) {
        if (value !== null && value !== undefined) slots += 1;
      }
    }
  }
  return { ok: true, slots, payload: parsed };
}

export default function BulkEditor({
  currentIds,
  onChanged,
}: {
  currentIds: Record<Week, WeekIds>;
  onChanged: () => Promise<void> | void;
}) {
  const toast = useToast();
  const [text, setText] = useState(TEMPLATE);
  const [dirty, setDirty] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ message: string; errors: string[]; failed: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const analysis = useMemo(() => analyse(text), [text]);

  // Warn before leaving with unsaved edits
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const setEditor = (value: string, isDirty: boolean) => {
    setText(value);
    setDirty(isDirty);
    setResult(null);
  };

  const loadCurrent = () => {
    setEditor(JSON.stringify({ week1: currentIds[1], week2: currentIds[2] }, null, 2), false);
    toast("info", "Loaded the current menu as meal IDs.");
  };

  const importFile = (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_BYTES) {
      toast("error", "File is larger than 100 KB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setEditor(String(reader.result ?? ""), true);
      toast("info", `Imported ${file.name}. Review it, then save.`);
    };
    reader.onerror = () => toast("error", "Could not read that file.");
    reader.readAsText(file);
    if (fileRef.current) fileRef.current.value = "";
  };

  const submit = async () => {
    if (!analysis.ok) return;
    setSaving(true);
    const res = await adminFetch<{ message: string; results: { success: number; failed: number; errors: string[] } }>(
      "menu/bulk",
      { method: "POST", body: analysis.payload }
    );
    setSaving(false);
    setConfirming(false);
    if (!res.ok) {
      toast("error", res.message || "Bulk update failed.");
      return;
    }
    const r = res.data!.results;
    setResult({ message: res.data!.message, errors: r.errors ?? [], failed: r.failed });
    setDirty(false);
    toast(r.failed ? "error" : "success", res.data!.message);
    await onChanged();
  };

  return (
    <section className="adm-card">
      <div className="adm-card-head">
        <div>
          <h2 className="adm-h2">Bulk editor</h2>
          <p className="adm-muted">
            Update many slots at once. Use a meal ID (<code className="adm-code">&quot;meal_…&quot;</code>), a list of
            dishes (<code className="adm-code">[&quot;Paratha&quot;, &quot;Tea&quot;]</code>), or{" "}
            <code className="adm-code">null</code> to leave a slot unchanged.
          </p>
        </div>
      </div>

      <div className="adm-toolbar adm-toolbar--wrap">
        <button type="button" className="adm-btn adm-btn--ghost" onClick={loadCurrent}>
          <Icon name="refresh" /> Load current menu
        </button>
        <button type="button" className="adm-btn adm-btn--ghost" onClick={() => setEditor(TEMPLATE, false)}>
          Reset to template
        </button>
        <button type="button" className="adm-btn adm-btn--ghost" onClick={() => fileRef.current?.click()}>
          <Icon name="upload" /> Import file
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => importFile(e.target.files?.[0])}
        />
        <button
          type="button"
          className="adm-btn adm-btn--ghost"
          onClick={() => analysis.ok && downloadJson("menu-bulk.json", analysis.payload)}
          disabled={!analysis.ok}
        >
          <Icon name="download" /> Download
        </button>
      </div>

      <label className="adm-label" htmlFor="bulk-json">
        Menu JSON
      </label>
      <textarea
        id="bulk-json"
        className={`adm-textarea adm-mono ${analysis.ok ? "" : "is-invalid"}`}
        value={text}
        onChange={(e) => setEditor(e.target.value, true)}
        rows={24}
        spellCheck={false}
        autoCapitalize="off"
        autoComplete="off"
        aria-invalid={!analysis.ok}
        aria-describedby="bulk-status"
      />

      <div id="bulk-status" className={`adm-status ${analysis.ok ? "adm-status--ok" : "adm-status--bad"}`}>
        {analysis.ok ? (
          <>
            <Icon name="check" /> Valid JSON — {analysis.slots} slot{analysis.slots === 1 ? "" : "s"} will be updated
          </>
        ) : (
          <>
            <Icon name="warning" /> {analysis.error}
          </>
        )}
      </div>

      {result && (
        <div className={`adm-banner ${result.failed ? "adm-banner--warn" : "adm-banner--ok"}`}>
          <div>
            <p className="adm-strong">{result.message}</p>
            {result.errors.length > 0 && (
              <ul className="adm-errlist">
                {result.errors.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      <div className="adm-actions">
        <button
          type="button"
          className="adm-btn adm-btn--primary"
          onClick={() => setConfirming(true)}
          disabled={!analysis.ok || analysis.slots === 0 || saving}
        >
          {saving ? <Spinner /> : <Icon name="check" />} Save {analysis.ok ? analysis.slots : ""} slot
          {analysis.ok && analysis.slots === 1 ? "" : "s"}
        </button>
      </div>

      {confirming && (
        <ConfirmDialog
          title="Apply bulk update?"
          body={
            <p>
              <strong>{analysis.slots}</strong> menu slot{analysis.slots === 1 ? "" : "s"} will change. Students see
              the new menu immediately. Slots set to <code className="adm-code">null</code> are left as they are.
            </p>
          }
          confirmLabel="Apply update"
          busy={saving}
          onConfirm={submit}
          onCancel={() => setConfirming(false)}
        />
      )}
    </section>
  );
}
