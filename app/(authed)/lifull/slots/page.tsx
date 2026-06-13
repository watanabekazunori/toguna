/**
 * クローザー商談枠管理 v1.3 ページ (Server Component)
 * closer 一覧 fetch → クライアント側で週カレンダー + 設定編集。
 */
import { createServerClient } from "@/lib/supabase/server";
import { CloserPicker } from "@/components/slot/CloserPicker";
import { WeekCalendarGrid } from "@/components/slot/WeekCalendarGrid";
import { SlotSettingsForm } from "@/components/slot/SlotSettingsForm";

interface CloserRow {
  id: string;
  display_name: string | null;
  google_calendar_id: string | null;
}

interface SlotSettingsRow {
  closer_id: string;
  weekday_mask: number[];
  start_minute: number;
  end_minute: number;
  max_meetings_per_day: number;
  duration_minute: number;
  blocked_ranges: { start: string; end: string }[];
}

/** 週カレンダー + 設定編集の SC エントリ */
export default async function SlotsPage() {
  const supabase = createServerClient();

  const { data: closers } = await supabase
    .from("lifull_users")
    .select("id, display_name, google_calendar_id")
    .eq("role", "CLOSER")
    .order("display_name", { ascending: true });

  const closerList: CloserRow[] = closers ?? [];
  const firstId = closerList[0]?.id ?? null;

  let settings: SlotSettingsRow | null = null;
  if (firstId) {
    const { data } = await supabase
      .from("lifull_slot_settings")
      .select(
        "closer_id, weekday_mask, start_minute, end_minute, max_meetings_per_day, duration_minute, blocked_ranges"
      )
      .eq("closer_id", firstId)
      .maybeSingle<SlotSettingsRow>();
    settings = data ?? null;
  }

  return (
    <main className="container mx-auto py-6 px-4 space-y-6 max-w-7xl">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          商談枠管理 (v1.3)
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          クローザー4名の商談枠 / Google Calendar FreeBusy / DB ロック枠を
          週カレンダーで表示。
        </p>
      </header>

      <CloserPicker
        closers={closerList.map((c) => ({
          id: c.id,
          name: c.display_name ?? "(名前未設定)",
          hasCalendar: c.google_calendar_id != null,
        }))}
        selectedId={firstId}
      />

      <section className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <WeekCalendarGrid
          closerId={firstId}
          duration={settings?.duration_minute ?? 60}
        />
        <SlotSettingsForm initial={settings} closerId={firstId} />
      </section>
    </main>
  );
}

// END_OF_FILE
