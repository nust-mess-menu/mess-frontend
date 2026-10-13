"use client";

import { useMemo, useState } from "react";
import { adminFetch } from "./api";
import type { SlotCurrent } from "./MenuBoard";
import { MEAL_LABEL, slotLabel, type Meal, type MealType, type SlotRef } from "./types";
import { badge, btn, ChipInput, cx, Icon, input, Modal, seg, segBtn, select, Spinner, ui, useToast } from "./ui";

type Mode = "pick" | "type";

export default function SlotEditor({
  slot,
  current,
  meals,
  onClose,
  onSaved,
}: {
  slot: SlotRef;
  current: SlotCurrent;
  meals: Meal[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [mode, setMode] = useState<Mode>(meals.length ? "pick" : "type");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<MealType | "all">(slot.mealType);
  const [selectedId, setSelectedId] = useState<string | null>(current.id);
  const [dishes, setDishes] = useState<string[]>(current.id ? [] : current.items);
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return meals
      .filter((m) => category === "all" || !m.category || m.category === category)
      .filter(
        (m) =>
          !q ||
          m.id.toLowerCase().includes(q) ||
          m.name.toLowerCase().includes(q) ||
          m.items.some((i) => i.toLowerCase().includes(q))
      )
      // Current meal first, then meals tagged for this slot's meal type
      .sort(
        (a, b) =>
          Number(b.id === current.id) - Number(a.id === current.id) ||
          Number(b.category === slot.mealType) - Number(a.category === slot.mealType)
      );
  }, [meals, query, category, slot.mealType, current.id]);

  const selectedMeal = meals.find((m) => m.id === selectedId);
  const canSave =
    mode === "pick" ? Boolean(selectedId) && selectedId !== current.id : dishes.length > 0;

  const save = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    const res = await adminFetch("menu", {
      method: "POST",
      body: {
        weekNumber: slot.week,
        day: slot.day,
        mealType: slot.mealType,
        dishes: mode === "pick" ? selectedId : dishes,
      },
    });
    setSaving(false);
    if (!res.ok) {
      toast("error", res.message || "Could not save the slot.");
      return;
    }
    toast("success", `${slotLabel(slot)} updated.`);
    onSaved();
  };

  return (
    <Modal
      title={`Edit ${MEAL_LABEL[slot.mealType].toLowerCase()}`}
      subtitle={slotLabel(slot)}
      onClose={onClose}
      size="lg"
      busy={saving}
      footer={
        <>
          <p className="mr-auto line-clamp-2 text-[12px] text-adm-text-3 max-[600px]:basis-full">
            {mode === "pick"
              ? selectedMeal
                ? `Will serve: ${selectedMeal.items.join(", ")}`
                : "Choose a meal from the library."
              : dishes.length
                ? "An identical existing meal is reused; otherwise a new one is created."
                : "Add at least one dish."}
          </p>
          <button type="button" className={btn("ghost")} onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="button" className={btn("primary")} onClick={save} disabled={!canSave || saving}>
            {saving ? <Spinner /> : <Icon name="check" />} Save slot
          </button>
        </>
      }
    >
      <div className="mb-3.5 flex flex-wrap items-baseline gap-2 rounded-adm-sm border border-adm-border bg-adm-surface-2 px-3 py-2.5">
        <span className={ui.eyebrow}>Currently</span>
        {current.items.length ? (
          <span>
            {current.meal?.name ? <strong>{current.meal.name}: </strong> : null}
            {current.items.join(", ")}
          </span>
        ) : (
          <span className={ui.muted}>Empty — students see “No menu”</span>
        )}
      </div>

      <div className={seg(true)} role="radiogroup" aria-label="How to fill this slot">
        <button
          type="button"
          role="radio"
          aria-checked={mode === "pick"}
          className={segBtn(mode === "pick", true)}
          onClick={() => setMode("pick")}
        >
          Choose from library
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={mode === "type"}
          className={segBtn(mode === "type", true)}
          onClick={() => setMode("type")}
        >
          Enter dishes
        </button>
      </div>

      {mode === "pick" ? (
        <>
          <div className={ui.toolbar}>
            <label className={ui.search}>
              <Icon name="search" className={ui.searchIcon} />
              <span className="sr-only">Search meals</span>
              <input
                className={input({ search: true })}
                placeholder="Search by dish, name or ID"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                maxLength={100}
                data-autofocus
              />
            </label>
            <select
              className={select()}
              value={category}
              onChange={(e) => setCategory(e.target.value as MealType | "all")}
              aria-label="Filter by category"
            >
              <option value="all">All categories</option>
              <option value="breakfast">Breakfast</option>
              <option value="lunch">Lunch</option>
              <option value="dinner">Dinner</option>
            </select>
          </div>

          <ul className="mt-3 grid max-h-[46vh] gap-1.5 overflow-y-auto" role="listbox" aria-label="Meals">
            {filtered.length === 0 && (
              <li role="presentation" className={ui.empty}>
                No meals match. Try another search or enter dishes.
              </li>
            )}
            {filtered.map((m) => {
              const selected = m.id === selectedId;
              return (
                <li key={m.id} role="presentation">
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    className={cx(
                      "flex w-full items-start gap-2.5 rounded-adm-sm border px-3 py-2.5 text-left",
                      selected
                        ? "border-adm-accent bg-adm-accent-soft shadow-[inset_0_0_0_1px_var(--color-adm-accent)]"
                        : "border-adm-border bg-adm-surface hover:border-adm-border-strong"
                    )}
                    onClick={() => setSelectedId(m.id)}
                  >
                    <span
                      className={cx(
                        "mt-0.5 size-4 shrink-0 rounded-full",
                        selected ? "border-[5px] border-adm-accent" : "border-2 border-adm-border-strong"
                      )}
                      aria-hidden="true"
                    />
                    <span className="grid min-w-0 gap-0.5">
                      <span className="flex flex-wrap items-center gap-1.5 font-semibold">
                        {m.name || m.items.slice(0, 2).join(" + ")}
                        {m.id === current.id && <span className={badge(true)}>Current</span>}
                        {m.category && <span className={badge()}>{MEAL_LABEL[m.category]}</span>}
                      </span>
                      <span className="text-[13px] text-adm-text-2">{m.items.join(", ")}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      ) : (
        <ChipInput label="Dishes" value={dishes} onChange={setDishes} autoFocus />
      )}
    </Modal>
  );
}
