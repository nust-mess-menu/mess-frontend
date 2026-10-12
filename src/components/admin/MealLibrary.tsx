"use client";

import { useMemo, useState } from "react";
import { adminFetch } from "./api";
import { MEAL_LABEL, slotShort, type Meal, type MealType, type SlotRef } from "./types";
import { ChipInput, copyText, downloadJson, Icon, Modal, Spinner, useToast } from "./ui";

export default function MealLibrary({
  meals,
  usage,
  onChanged,
}: {
  meals: Meal[];
  usage: Map<string, SlotRef[]>;
  onChanged: () => Promise<void> | void;
}) {
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<MealType | "all" | "none">("all");
  const [onlyUnused, setOnlyUnused] = useState(false);
  const [editing, setEditing] = useState<Meal | "new" | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return meals.filter((m) => {
      if (category === "none" && m.category) return false;
      if (category !== "all" && category !== "none" && m.category !== category) return false;
      if (onlyUnused && usage.has(m.id)) return false;
      return (
        !q ||
        m.id.toLowerCase().includes(q) ||
        m.name.toLowerCase().includes(q) ||
        m.items.some((i) => i.toLowerCase().includes(q))
      );
    });
  }, [meals, query, category, onlyUnused, usage]);

  const copyId = async (id: string) => {
    const ok = await copyText(id);
    toast(ok ? "success" : "error", ok ? "Meal ID copied." : "Could not copy to clipboard.");
  };

  return (
    <section className="adm-card">
      <div className="adm-card-head">
        <div className="adm-toolbar adm-toolbar--grow">
          <label className="adm-search">
            <Icon name="search" />
            <span className="adm-sr">Search meals</span>
            <input
              className="adm-input"
              placeholder="Search by dish, name or ID"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              maxLength={100}
            />
          </label>
          <select
            className="adm-input adm-select"
            value={category}
            onChange={(e) => setCategory(e.target.value as typeof category)}
            aria-label="Filter by category"
          >
            <option value="all">All categories</option>
            <option value="breakfast">Breakfast</option>
            <option value="lunch">Lunch</option>
            <option value="dinner">Dinner</option>
            <option value="none">Uncategorised</option>
          </select>
          <label className="adm-check">
            <input type="checkbox" checked={onlyUnused} onChange={(e) => setOnlyUnused(e.target.checked)} />
            Not on the menu
          </label>
        </div>
        <div className="adm-toolbar">
          <button
            type="button"
            className="adm-btn adm-btn--ghost"
            onClick={() =>
              downloadJson(
                "meals.json",
                meals.map((m) => ({ id: m.id, name: m.name || "", items: m.items, category: m.category ?? null }))
              )
            }
            disabled={meals.length === 0}
          >
            <Icon name="download" /> Export JSON
          </button>
          <button type="button" className="adm-btn adm-btn--primary" onClick={() => setEditing("new")}>
            <Icon name="plus" /> New meal
          </button>
        </div>
      </div>

      <p className="adm-muted adm-count">
        Showing {filtered.length} of {meals.length} meals
      </p>

      {filtered.length === 0 ? (
        <div className="adm-empty">
          {meals.length === 0 ? "No meals yet. Create one, or assign dishes to a menu slot." : "No meals match these filters."}
        </div>
      ) : (
        <ul className="adm-meals">
          {filtered.map((m) => {
            const used = usage.get(m.id) ?? [];
            return (
              <li key={m.id} className="adm-meal">
                <div className="adm-meal-head">
                  <div>
                    <p className="adm-meal-name">
                      {m.name || <span className="adm-meal-name--derived">{m.items.slice(0, 2).join(" + ")}</span>}
                    </p>
                    <div className="adm-meal-meta">
                      {m.category && <span className="adm-badge">{MEAL_LABEL[m.category]}</span>}
                      <button type="button" className="adm-codebtn" onClick={() => copyId(m.id)} title="Copy meal ID">
                        <code>{m.id}</code>
                        <Icon name="copy" size={14} />
                      </button>
                    </div>
                  </div>
                  <button type="button" className="adm-btn adm-btn--ghost adm-btn--sm" onClick={() => setEditing(m)}>
                    <Icon name="edit" /> Edit
                  </button>
                </div>
                <div className="adm-chips">
                  {m.items.map((item, i) => (
                    <span key={i} className="adm-chip adm-chip--static">
                      {item}
                    </span>
                  ))}
                </div>
                <p className="adm-meal-usage">
                  {used.length ? (
                    <>
                      On the menu: <span>{used.map(slotShort).join(" · ")}</span>
                    </>
                  ) : (
                    <span className="adm-muted">Not on the menu</span>
                  )}
                </p>
              </li>
            );
          })}
        </ul>
      )}

      {editing && (
        <MealEditor
          meal={editing === "new" ? null : editing}
          usedIn={editing === "new" ? [] : (usage.get(editing.id) ?? [])}
          onClose={() => setEditing(null)}
          onSaved={async (message) => {
            toast("success", message);
            setEditing(null);
            await onChanged();
          }}
        />
      )}
    </section>
  );
}

function MealEditor({
  meal,
  usedIn,
  onClose,
  onSaved,
}: {
  meal: Meal | null;
  usedIn: SlotRef[];
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const toast = useToast();
  const [name, setName] = useState(meal?.name ?? "");
  const [category, setCategory] = useState<MealType | "">(meal?.category ?? "");
  const [items, setItems] = useState<string[]>(meal?.items ?? []);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!items.length || saving) return;
    setSaving(true);
    const res = await adminFetch<{ meal: Meal }>("meals", {
      method: "POST",
      body: {
        items,
        name: name.trim(),
        ...(category ? { category } : {}),
        ...(meal ? { mealId: meal.id } : {}),
      },
    });
    setSaving(false);
    if (!res.ok) {
      toast("error", res.message || "Could not save the meal.");
      return;
    }
    onSaved(meal ? "Meal updated." : "Meal created.");
  };

  return (
    <Modal
      title={meal ? "Edit meal" : "New meal"}
      subtitle={meal ? <code className="adm-code">{meal.id}</code> : "Reusable in any menu slot"}
      onClose={onClose}
      busy={saving}
      footer={
        <>
          <button type="button" className="adm-btn adm-btn--ghost" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="button" className="adm-btn adm-btn--primary" onClick={save} disabled={!items.length || saving}>
            {saving ? <Spinner /> : <Icon name="check" />} {meal ? "Save changes" : "Create meal"}
          </button>
        </>
      }
    >
      {meal && usedIn.length > 0 && (
        <div className="adm-banner adm-banner--warn">
          <Icon name="warning" /> Changes apply everywhere this meal is served: {usedIn.map(slotShort).join(", ")}.
        </div>
      )}
      <div className="adm-grid2">
        <div className="adm-field">
          <label className="adm-label" htmlFor="meal-name">
            Display name <span className="adm-muted">(optional)</span>
          </label>
          <input
            id="meal-name"
            className="adm-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={100}
            placeholder="e.g. Sunday Special"
            data-autofocus
          />
        </div>
        <div className="adm-field">
          <label className="adm-label" htmlFor="meal-category">
            Category
          </label>
          <select
            id="meal-category"
            className="adm-input adm-select"
            value={category}
            onChange={(e) => setCategory(e.target.value as MealType | "")}
          >
            <option value="">None</option>
            <option value="breakfast">Breakfast</option>
            <option value="lunch">Lunch</option>
            <option value="dinner">Dinner</option>
          </select>
        </div>
      </div>
      <ChipInput label="Dishes" value={items} onChange={setItems} />
    </Modal>
  );
}
