"use client";

/**
 * クローザー商談枠設定編集フォーム。
 * 曜日 / 時間帯 / 最大商談数 / 所要時間 / ブロック枠を編集。
 */
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

interface SlotSettingsRow {
  closer_id: string;
  weekday_mask: number[];
  start_minute: number;
  end_minute: number;
  max_meetings_per_day: number;
  duration_minute: number;
  blocked_ranges: { start: string; end: string }[];
}

interface Props {
  initial: SlotSettingsRow | null;
  closerId: string | null;
}

const WEEKDAYS = ["月", "火", "水", "木", "金", "土", "日"];

/** 商談枠設定編集パネル */
export function SlotSettingsForm({ initial, closerId }: Props) {
  const [weekdayMask, setWeekdayMask] = useState<number[]>(
    initial?.weekday_mask ?? [0, 1, 2, 3, 4]
  );
  const [startH, setStartH] = useState<number>(
    Math.floor((initial?.start_minute ?? 540) / 60)
  );
  const [endH, setEndH] = useState<number>(
    Math.floor((initial?.end_minute ?? 1080) / 60)
  );
  const [maxMeetings, setMaxMeetings] = useState<number>(
    initial?.max_meetings_per_day ?? 6
  );
  const [duration, setDuration] = useState<number>(
    initial?.duration_minute ?? 60
  );
  const [blockedRange, setBlockedRange] = useState<string>(
    JSON.stringify(initial?.blocked_ranges ?? [], null, 2)
  );
  const [pending, startTransition] = useTransition();
  const [savedAt, setSavedAt] = useState<string | null>(null);

  function toggleWeekday(d: number) {
    setWeekdayMask((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort()
    );
  }

  function handleSave() {
    if (!closerId) return;
    startTransition(async () => {
      let blocked: { start: string; end: string }[] = [];
      try {
        blocked = JSON.parse(blockedRange);
      } catch {
        // ignore
      }
      await fetch(`/api/lifull/slot-settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          closer_id: closerId,
          weekday_mask: weekdayMask,
          start_minute: startH * 60,
          end_minute: endH * 60,
          max_meetings_per_day: maxMeetings,
          duration_minute: duration,
          blocked_ranges: blocked,
        }),
      });
      setSavedAt(new Date().toLocaleTimeString("ja-JP"));
    });
  }

  return (
    <aside className="rounded border p-4 space-y-4 text-sm h-fit">
      <h2 className="font-semibold">商談枠設定</h2>

      <div className="space-y-2">
        <Label className="text-xs">対応曜日</Label>
        <div className="flex flex-wrap gap-2">
          {WEEKDAYS.map((w, i) => (
            <label
              key={w}
              className="flex items-center gap-1 text-xs cursor-pointer"
            >
              <Checkbox
                checked={weekdayMask.includes(i)}
                onCheckedChange={() => toggleWeekday(i)}
              />
              {w}
            </label>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs">開始 (時)</Label>
          <Input
            type="number"
            min={0}
            max={23}
            value={startH}
            onChange={(e) => setStartH(Number(e.target.value))}
          />
        </div>
        <div>
          <Label className="text-xs">終了 (時)</Label>
          <Input
            type="number"
            min={0}
            max={23}
            value={endH}
            onChange={(e) => setEndH(Number(e.target.value))}
          />
        </div>
      </div>

      <div>
        <Label className="text-xs">1日最大商談数</Label>
        <Input
          type="number"
          min={1}
          max={20}
          value={maxMeetings}
          onChange={(e) => setMaxMeetings(Number(e.target.value))}
        />
      </div>

      <div>
        <Label className="text-xs">所要時間 (分)</Label>
        <Input
          type="number"
          min={15}
          step={15}
          value={duration}
          onChange={(e) => setDuration(Number(e.target.value))}
        />
      </div>

      <div>
        <Label className="text-xs">
          ブロック枠 (JSON: {`[{start,end}]`})
        </Label>
        <textarea
          className="w-full rounded border p-2 text-xs font-mono"
          rows={4}
          value={blockedRange}
          onChange={(e) => setBlockedRange(e.target.value)}
        />
      </div>

      <Button
        onClick={handleSave}
        disabled={pending || !closerId}
        className="w-full"
      >
        {pending ? "保存中..." : "保存"}
      </Button>
      {savedAt && (
        <p className="text-xs text-green-700">保存しました ({savedAt})</p>
      )}
    </aside>
  );
}

// END_OF_FILE
