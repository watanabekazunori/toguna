"use client";

/**
 * クローザー4名選択 + 現在の空き状況サマリ。
 * 既存 toguna app/homes/_components/CloserPicker.tsx を `lifull_` 移植 [obs_id:tg-012]。
 */
import { useState, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useFreebusy } from "@/hooks/useFreebusy";

interface CloserOption {
  id: string;
  name: string;
  hasCalendar: boolean;
}

interface Props {
  closers: CloserOption[];
  selectedId: string | null;
}

function weekRange(): { from: string; to: string } {
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((day + 6) % 7));
  monday.setHours(9, 0, 0, 0);
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);
  friday.setHours(18, 0, 0, 0);
  return { from: monday.toISOString(), to: friday.toISOString() };
}

/** クローザー4名選択 + 週次空き枠サマリ */
export function CloserPicker({ closers, selectedId }: Props) {
  const router = useRouter();
  const sp = useSearchParams();
  const [selected, setSelected] = useState<string | null>(selectedId);
  const range = useMemo(weekRange, []);
  const ids = closers.map((c) => c.id);

  const { data, isLoading, error } = useFreebusy({
    closerIds: ids,
    from: range.from,
    to: range.to,
  });

  function handleSelect(id: string) {
    setSelected(id);
    const params = new URLSearchParams(sp?.toString() ?? "");
    params.set("closer_id", id);
    router.push(`?${params.toString()}`);
  }

  return (
    <section className="rounded border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-medium">クローザー選択</h2>
        {error?.code === "calendar_not_shared" && (
          <Badge variant="destructive">カレンダー共有設定が必要です</Badge>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {closers.map((c) => {
          const summary = data?.closers?.find((d) => d.closer_id === c.id);
          const freeCount = summary?.free_slots?.length ?? null;
          const isActive = selected === c.id;
          return (
            <Button
              key={c.id}
              variant={isActive ? "default" : "outline"}
              size="sm"
              onClick={() => handleSelect(c.id)}
              className="flex flex-col items-start h-auto py-2"
            >
              <span className="text-sm font-medium">{c.name}</span>
              <span className="text-xs text-muted-foreground">
                {!c.hasCalendar
                  ? "Calendar 未連携"
                  : isLoading
                    ? "読み込み中..."
                    : freeCount != null
                      ? `今週 空き ${freeCount} 枠`
                      : "—"}
              </span>
            </Button>
          );
        })}
      </div>
    </section>
  );
}

// END_OF_FILE
