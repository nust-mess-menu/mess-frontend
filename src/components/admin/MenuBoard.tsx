"use client";

import { useMemo, useState } from "react";
import { adminFetch } from "./api";
import type { AdminData } from "./AdminDashboard";
import SlotEditor from "./SlotEditor";
import {
  DAY_LABEL,
  DAYS,
  MEAL_LABEL,
  MEAL_TYPES,
  slotLabel,
  todayInPakistan,
  type Day,
  type Meal,
  type MealType,
  type SlotRef,
  type Week,
} from "./types";
import { ConfirmDialog, Icon, useToast } from "./ui";

export default function MenuBoard({ data, onChanged }: { data: AdminData; onChanged: () => Promise<void> | void }) {
  const toast = useToast();
  const [week, setWeek] = useState<Week>(data.currentWeek);
  const [editing, setEditing] = useState<SlotRef | null>(null);
  const [clearing, setClearing] = useState<SlotRef | null>(null);
  const [busy, setBusy] = useState(false);

  const mealsById = useMemo(() => new Map(data.meals.map((m) => [m.id, m])), [data.meals]);
  const today = todayInPakistan();

  const slotInfo = (w: Week, day: Day, mealType: MealType) => {
    const id = data.ids[w]?.[day]?.[mealType] ?? null;
    const meal = id ? mealsById.get(id) : undefined;
    const items = meal?.items ?? data.dishes[w]?.[day]?.[mealType] ?? [];
    return { id, meal, items };
  };

  const filled = DAYS.reduce(
    (n, day) => n + MEAL_TYPES.filter((t) => slotInfo(week, day, t).items.length > 0).length,
    0
  );

  const clearSlot = async () => {
    if (!clearing) return;
    setBusy(true);
    const res = await adminFetch("menu", {
      method: "DELETE",
      query: { weekNumber: String(clearing.week), day: clearing.day, mealType: clearing.mealType },
    });
    setBusy(false);
    if (!res.ok) {
      toast("error", res.message || "Could not clear the slot.");
      return;
    }
    toast("success", `${slotLabel(clearing)} cleared.`);
    setClearing(null);
    await onChanged();
  };

  return (
    <section className="adm-card">
      <div className="adm-card-head">
        <div className="adm-seg" role="radiogroup" aria-label="Week">
          {([1, 2] as Week[]).map((w) => (
            <button
              key={w}
              type="button"
              role="radio"
              aria-checked={week === w}
              className={`adm-seg-btn ${week === w ? "is-active" : ""}`}
              onClick={() => setWeek(w)}
            >
              Week {w}
              {data.currentWeek === w && <span className="adm-live-dot">Live</span>}
            </button>
          ))}
        </div>
        <p className="adm-muted">
          {filled} of 21 slots set{filled < 21 ? " — empty slots show “No menu” to students" : ""}
        </p>
      </div>

      <div className="adm-board" role="table" aria-label={`Week ${week} menu`}>
        <div className="adm-board-row adm-board-row--head" role="row">
          <div role="columnheader" className="adm-board-day" />
          {MEAL_TYPES.map((t) => (
            <div role="columnheader" key={t} className="adm-board-colhead">
              {MEAL_LABEL[t]}
            </div>
          ))}
        </div>

        {DAYS.map((day) => {
          const isToday = week === data.currentWeek && day === today;
          return (
            <div key={day} role="row" className={`adm-board-row ${isToday ? "is-today" : ""}`}>
              <div role="rowheader" className="adm-board-day">
                <span>{DAY_LABEL[day]}</span>
                {isToday && <span className="adm-badge adm-badge--accent">Today</span>}
              </div>
              {MEAL_TYPES.map((mealType) => {
                const { id, meal, items } = slotInfo(week, day, mealType);
                const ref = { week, day, mealType };
                return (
                  <div role="cell" key={mealType} className="adm-slot-cell">
                    <span className="adm-slot-mobile-label">{MEAL_LABEL[mealType]}</span>
                    {items.length > 0 ? (
                      <div className="adm-slot">
                        {meal?.name && <p className="adm-slot-name">{meal.name}</p>}
                        <ul className="adm-slot-items">
                          {items.map((item, i) => (
                            <li key={i}>{item}</li>
                          ))}
                        </ul>
                        <div className="adm-slot-foot">
                          {id ? (
                            <code className="adm-code" title={id}>
                              {id.length > 22 ? `…${id.slice(-14)}` : id}
                            </code>
                          ) : (
                            <span className="adm-badge">Legacy dishes</span>
                          )}
                          <span className="adm-slot-actions">
                            <button
                              type="button"
                              className="adm-iconbtn"
                              onClick={() => setEditing(ref)}
                              aria-label={`Edit ${slotLabel(ref)}`}
                              title="Edit"
                            >
                              <Icon name="edit" />
                            </button>
                            <button
                              type="button"
                              className="adm-iconbtn adm-iconbtn--danger"
                              onClick={() => setClearing(ref)}
                              aria-label={`Clear ${slotLabel(ref)}`}
                              title="Clear"
                            >
                              <Icon name="trash" />
                            </button>
                          </span>
                        </div>
                      </div>
                    ) : (
                      <button type="button" className="adm-slot-empty" onClick={() => setEditing(ref)}>
                        <Icon name="plus" /> Assign meal
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {editing && (
        <SlotEditor
          slot={editing}
          current={slotInfo(editing.week, editing.day, editing.mealType)}
          meals={data.meals}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await onChanged();
          }}
        />
      )}

      {clearing && (
        <ConfirmDialog
          title="Clear this slot?"
          body={
            <p>
              <strong>{slotLabel(clearing)}</strong> will show “No menu” to students. The meal itself stays in the
              library.
            </p>
          }
          confirmLabel="Clear slot"
          tone="danger"
          busy={busy}
          onConfirm={clearSlot}
          onCancel={() => setClearing(null)}
        />
      )}
    </section>
  );
}

export type SlotCurrent = { id: string | null; meal?: Meal; items: string[] };
