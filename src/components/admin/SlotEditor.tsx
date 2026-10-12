"use client";

import { useMemo, useState } from "react";
import { adminFetch } from "./api";
import type { SlotCurrent } from "./MenuBoard";
import { MEAL_LABEL, slotLabel, type Meal, type MealType, type SlotRef } from "./types";
import { ChipInput, Icon, Modal, Spinner, useToast } from "./ui";

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
          <p className="adm-foot-note">
            {mode === "pick"
              ? selectedMeal
                ? `Will serve: ${selectedMeal.items.join(", ")}`
                : "Choose a meal from the library."
              : dishes.length
                ? "An identical existing meal is reused; otherwise a new one is created."
                : "Add at least one dish."}
          </p>
          <button type="button" className="adm-btn adm-btn--ghost" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="button" className="adm-btn adm-btn--primary" onClick={save} disabled={!canSave || saving}>
            {saving ? <Spinner /> : <Icon name="check" />} Save slot
          </button>
        </>
      }
    >
      <div className="adm-current">
        <span className="adm-eyebrow">Currently</span>
        {current.items.length ? (
          <span>
            {current.meal?.name ? <strong>{current.meal.name}: </strong> : null}
            {current.items.join(", ")}
          </span>
        ) : (
          <span className="adm-muted">Empty — students see “No menu”</span>
        )}
      </div>

      <div className="adm-seg adm-seg--full" role="radiogroup" aria-label="How to fill this slot">
        <button
          type="button"
          role="radio"
          aria-checked={mode === "pick"}
          className={`adm-seg-btn ${mode === "pick" ? "is-active" : ""}`}
          onClick={() => setMode("pick")}
        >
          Choose from library
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={mode === "type"}
          className={`adm-seg-btn ${mode === "type" ? "is-active" : ""}`}
          onClick={() => setMode("type")}
        >
          Enter dishes
        </button>
      </div>

      {mode === "pick" ? (
        <>
          <div className="adm-toolbar">
            <label className="adm-search">
              <Icon name="search" />
              <span className="adm-sr">Search meals</span>
              <input
                className="adm-input"
                placeholder="Search by dish, name or ID"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                maxLength={100}
                data-autofocus
              />
            </label>
            <select
              className="adm-input adm-select"
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

          <ul className="adm-picklist" role="listbox" aria-label="Meals">
            {filtered.length === 0 && (
              <li role="presentation" className="adm-empty">
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
                    className={`adm-pick ${selected ? "is-selected" : ""}`}
                    onClick={() => setSelectedId(m.id)}
                  >
                    <span className="adm-pick-radio" aria-hidden="true" />
                    <span className="adm-pick-main">
                      <span className="adm-pick-title">
                        {m.name || m.items.slice(0, 2).join(" + ")}
                        {m.id === current.id && <span className="adm-badge adm-badge--accent">Current</span>}
                        {m.category && <span className="adm-badge">{MEAL_LABEL[m.category]}</span>}
                      </span>
                      <span className="adm-pick-items">{m.items.join(", ")}</span>
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
