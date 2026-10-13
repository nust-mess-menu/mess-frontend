"use client";

import { useMemo, useState } from "react";
import { adminFetch } from "./api";
import { MEAL_LABEL, slotShort, type Meal, type MealType, type SlotRef } from "./types";
import { badge, banner, btn, ChipInput, copyText, cx, downloadJson, Icon, input, Modal, select, Spinner, ui, useToast } from "./ui";

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
    <section className={ui.card}>
      <div className={ui.cardHead}>
        <div className={cx(ui.toolbar, "min-w-[260px] flex-1")}>
          <label className={ui.search}>
            <Icon name="search" className={ui.searchIcon} />
            <span className="sr-only">Search meals</span>
            <input
              className={input({ search: true })}
              placeholder="Search by dish, name or ID"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              maxLength={100}
            />
          </label>
          <select
            className={select()}
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
          <label className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap text-[13px] text-adm-text-2">
            <input type="checkbox" className="accent-adm-accent" checked={onlyUnused} onChange={(e) => setOnlyUnused(e.target.checked)} />
            Not on the menu
          </label>
        </div>
        <div className={ui.toolbar}>
          <button
            type="button"
            className={btn("ghost")}
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
          <button type="button" className={btn("primary")} onClick={() => setEditing("new")}>
            <Icon name="plus" /> New meal
          </button>
        </div>
      </div>

      <p className={cx(ui.muted, "mb-2.5 text-[12px]")}>
        Showing {filtered.length} of {meals.length} meals
      </p>

      {filtered.length === 0 ? (
        <div className={ui.empty}>
          {meals.length === 0 ? "No meals yet. Create one, or assign dishes to a menu slot." : "No meals match these filters."}
        </div>
      ) : (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-2.5 max-[600px]:grid-cols-1">
          {filtered.map((m) => {
            const used = usage.get(m.id) ?? [];
            return (
              <li key={m.id} className="flex flex-col gap-2.5 rounded-adm-sm border border-adm-border p-3.5" data-testid="meal-card">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="mb-1 font-bold">
                      {m.name || <span className="font-semibold text-adm-text-2">{m.items.slice(0, 2).join(" + ")}</span>}
                    </p>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {m.category && <span className={badge()}>{MEAL_LABEL[m.category]}</span>}
                      <button
                        type="button"
                        className="inline-flex max-w-full items-center gap-[5px] rounded-[5px] border border-adm-border bg-adm-surface-2 px-1.5 py-px text-adm-text-2 hover:border-adm-accent hover:text-adm-accent-strong"
                        onClick={() => copyId(m.id)}
                        title="Copy meal ID"
                      >
                        <code className="truncate font-mono text-[12px]">{m.id}</code>
                        <Icon name="copy" size={14} />
                      </button>
                    </div>
                  </div>
                  <button type="button" className={btn("ghost", { sm: true })} onClick={() => setEditing(m)}>
                    <Icon name="edit" /> Edit
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {m.items.map((item, i) => (
                    <span key={i} className={ui.chipStatic}>
                      {item}
                    </span>
                  ))}
                </div>
                <p className="mt-auto text-[12px] text-adm-text-2">
                  {used.length ? (
                    <>
                      On the menu: <span>{used.map(slotShort).join(" · ")}</span>
                    </>
                  ) : (
                    <span className={ui.muted}>Not on the menu</span>
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
      subtitle={meal ? <code className={ui.code}>{meal.id}</code> : "Reusable in any menu slot"}
      onClose={onClose}
      busy={saving}
      footer={
        <>
          <button type="button" className={btn("ghost")} onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="button" className={btn("primary")} onClick={save} disabled={!items.length || saving}>
            {saving ? <Spinner /> : <Icon name="check" />} {meal ? "Save changes" : "Create meal"}
          </button>
        </>
      }
    >
      {meal && usedIn.length > 0 && (
        <div className={banner("warn")}>
          <Icon name="warning" /> Changes apply everywhere this meal is served: {usedIn.map(slotShort).join(", ")}.
        </div>
      )}
      <div className="grid grid-cols-[2fr_1fr] gap-3 max-[600px]:grid-cols-1">
        <div className={ui.field}>
          <label className={ui.label} htmlFor="meal-name">
            Display name <span className={ui.muted}>(optional)</span>
          </label>
          <input
            id="meal-name"
            className={input()}
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={100}
            placeholder="e.g. Sunday Special"
            data-autofocus
          />
        </div>
        <div className={ui.field}>
          <label className={ui.label} htmlFor="meal-category">
            Category
          </label>
          <select
            id="meal-category"
            className={select(true)}
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
