"use client";

/**
 * 7日 × 30分グリッド週カレンダー。
 * FreeBusy 色分け: 空き=緑 / Google busy=灰 / deal lock=橙。
 */
import { useMemo } from "react";
import { addDays, format, startOfWeek } from "date-fns";
import { ja } from "date-fns/locale";
import { useFreebusy } from "@/hooks/useFreebusy";

interface Props {
  closerId: string | null;
  duration: number;
}

const HOURS_FROM = 9;
const HOURS_TO = 19;
const STEP_MIN = 30;

type CellKind = "free" | "google_busy" | "deal_lock" | "outside";

interface Cell {
  start: Date;
  end: Date;
  kind: CellKind;
}

/** 週カレンダー 7日 × 30分グリッド */
export function WeekCalendarGrid({ closerId, duration }: Props) {
  const monday = useMemo(
    () => startOfWeek(new Date(), { weekStartsOn: 1 }),
    []
  );
  const friday = useMemo(() => addDays(monday, 5), [monday]);

  const { data, error } = useFreebusy({
    closerIds: closerId ? [closerId] : [],
    from: monday,
    to: friday,
  });

  const days = Array.from({ length: 5 }).map((_, i) => addDays(monday, i));
  const slotsPerDay = Math.ceil(((HOURS_TO - HOURS_FROM) * 60) / STEP_MIN);

  if (!closerId) {
    return (
      <div className="rounded border border-dashed bg-muted/30 p-12 text-center text-sm text-muted-foreground">
        クローザーを選択してください
      </div>
    );
  }

  if (error === "calendar_not_shared") {
    return (
      <div className="rounded border border-amber-300 bg-amber-50 p-6 text-sm text-amber-900">
        Google Calendar が共有されていません。クローザーに
        Service Account への共有を依頼してください。
      </div>
    );
  }

  const closerBusy = data?.find((d) => d.closer_id === closerId);
  const busySlots = closerBusy?.busy_slots ?? [];

  const cells: Cell[][] = days.map((day) => {
    return Array.from({ length: slotsPerDay }).map((_, idx) => {
      const start = new Date(day);
      start.setHours(HOURS_FROM, idx * STEP_MIN, 0, 0);
      const end = new Date(start.getTime() + duration * 60 * 1000);
      const matched = busySlots.find((b) => {
        const bs = new Date(b.start);
        const be = new Date(b.end);
        return start < be && end > bs;
      });
      let kind: CellKind = "free";
      if (matched) {
        kind =
          matched.source === "lifull_deals_locked"
            ? "deal_lock"
            : "google_busy";
      }
      return { start, end, kind };
    });
  });

  return (
    <div className="rounded border overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="bg-muted/50">
            <th className="border p-1 w-16 text-left">時刻</th>
            {days.map((d) => (
              <th key={d.toISOString()} className="border p-1 text-center">
                {format(d, "M/d (E)", { locale: ja })}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: slotsPerDay }).map((_, row) => {
            const h = HOURS_FROM + Math.floor((row * STEP_MIN) / 60);
            const m = (row * STEP_MIN) % 60;
            return (
              <tr key={row}>
                <td className="border p-1 font-mono text-muted-foreground">
                  {String(h).padStart(2, "0")}:{String(m).padStart(2, "0")}
                </td>
                {cells.map((dayCells, col) => {
                  const c = dayCells[row];
                  return (
                    <td
                      key={col}
                      className={cellClass(c.kind)}
                      title={cellTitle(c)}
                    />
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="border-t bg-muted/30 px-3 py-2 text-xs flex gap-4">
        <Legend color="bg-green-200" label="空き" />
        <Legend color="bg-gray-300" label="Google Calendar busy" />
        <Legend color="bg-orange-300" label="DB lock (deal)" />
      </div>
    </div>
  );
}

function cellClass(kind: CellKind): string {
  const base = "border h-7 cursor-pointer hover:opacity-80";
  switch (kind) {
    case "free":
      return `${base} bg-green-100`;
    case "google_busy":
      return `${base} bg-gray-300`;
    case "deal_lock":
      return `${base} bg-orange-300`;
    default:
      return `${base} bg-white`;
  }
}

function cellTitle(c: Cell): string {
  const label =
    c.kind === "free"
      ? "空き"
      : c.kind === "google_busy"
        ? "Google Calendar"
        : "DB lock";
  return `${label} ${format(c.start, "HH:mm")}-${format(c.end, "HH:mm")}`;
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1">
      <span className={`inline-block h-3 w-3 rounded ${color}`} />
      <span>{label}</span>
    </div>
  );
}

// END_OF_FILE
