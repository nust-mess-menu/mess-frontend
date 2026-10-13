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
import { badge, ConfirmDialog, cx, Icon, iconBtn, seg, segBtn, ui, useToast } from "./ui";


const ROW =
  "grid grid-cols-[120px_repeat(3,minmax(0,1fr))] items-stretch gap-2 " +
  "max-[900px]:grid-cols-1 max-[900px]:rounded-adm-sm max-[900px]:border max-[900px]:border-adm-border max-[900px]:p-2.5";
const DAY_CELL =
  "flex flex-col items-start gap-1 px-1 py-2.5 font-bold max-[900px]:flex-row max-[900px]:items-center max-[900px]:px-0 max-[900px]:py-0.5";

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
    <section className={ui.card}>
      <div className={ui.cardHead}>
        <div className={seg()} role="radiogroup" aria-label="Week">
          {([1, 2] as Week[]).map((w) => (
            <button
              key={w}
              type="button"
              role="radio"
              aria-checked={week === w}
              className={segBtn(week === w)}
              onClick={() => setWeek(w)}
            >
              Week {w}
              {data.currentWeek === w && (
                <span className="inline-flex items-center gap-1 text-[11px] text-adm-accent-strong before:size-[7px] before:rounded-full before:bg-adm-accent before:content-['']">
                  Live
                </span>
              )}
            </button>
          ))}
        </div>
        <p className={ui.muted}>
          {filled} of 21 slots set{filled < 21 ? " — empty slots show “No menu” to students" : ""}
        </p>
      </div>

      <div className="grid gap-2" role="table" aria-label={`Week ${week} menu`}>
        <div className={cx(ROW, "sticky top-[58px] z-[5] bg-adm-surface py-1 max-[900px]:hidden")} role="row">
          <div role="columnheader" className={DAY_CELL} />
          {MEAL_TYPES.map((t) => (
            <div role="columnheader" key={t} className="px-1 text-[12px] font-bold uppercase tracking-[0.05em] text-adm-text-3">
              {MEAL_LABEL[t]}
            </div>
          ))}
        </div>

        {DAYS.map((day) => {
          const isToday = week === data.currentWeek && day === today;
          return (
            <div
              key={day}
              role="row"
              className={cx(
                ROW,
                isToday &&
                  "rounded-adm-sm bg-[linear-gradient(90deg,var(--color-adm-accent-soft),transparent_140px)] max-[900px]:bg-adm-accent-soft max-[900px]:bg-none"
              )}
            >
              <div role="rowheader" className={DAY_CELL}>
                <span>{DAY_LABEL[day]}</span>
                {isToday && <span className={badge(true)}>Today</span>}
              </div>
              {MEAL_TYPES.map((mealType) => {
                const { id, meal, items } = slotInfo(week, day, mealType);
                const ref = { week, day, mealType };
                return (
                  <div role="cell" key={mealType} className="flex flex-col">
                    <span className="hidden text-[11px] font-bold uppercase tracking-[0.05em] text-adm-text-3 max-[900px]:mb-1 max-[900px]:block">{MEAL_LABEL[mealType]}</span>
                    {items.length > 0 ? (
                      <div
                        className={cx(
                          "flex flex-1 flex-col gap-1.5 rounded-adm-sm border bg-adm-surface pt-2.5 pr-2.5 pb-2 pl-3 transition-[border-color,box-shadow] duration-150 hover:shadow-adm",
                          isToday ? "border-[#c9d7a2]" : "border-adm-border hover:border-adm-border-strong"
                        )}
                      >
                        {meal?.name && <p className="text-[13px] font-bold">{meal.name}</p>}
                        <ul className="text-[13px] text-adm-text-2">
                          {items.map((item, i) => (
                            <li key={i} className="before:text-adm-accent before:content-['•_']">
                              {item}
                            </li>
                          ))}
                        </ul>
                        <div className="mt-auto flex items-center justify-between gap-1.5">
                          {id ? (
                            <code className={ui.code} title={id}>
                              {id.length > 22 ? `…${id.slice(-14)}` : id}
                            </code>
                          ) : (
                            <span className={badge()}>Legacy dishes</span>
                          )}
                          <span className="flex">
                            <button
                              type="button"
                              className={iconBtn()}
                              onClick={() => setEditing(ref)}
                              aria-label={`Edit ${slotLabel(ref)}`}
                              title="Edit"
                            >
                              <Icon name="edit" />
                            </button>
                            <button
                              type="button"
                              className={iconBtn(true)}
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
                      <button
                        type="button"
                        className={cx(
                          "flex min-h-[92px] flex-1 items-center justify-center gap-1.5 rounded-adm-sm border-[1.5px] border-dashed bg-adm-surface-2 font-semibold text-adm-text-3 hover:bg-adm-accent-soft hover:text-adm-accent-strong max-[900px]:min-h-12",
                          isToday ? "border-[#c9d7a2]" : "border-adm-border-strong hover:border-adm-accent"
                        )}
                        onClick={() => setEditing(ref)}
                      >
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
