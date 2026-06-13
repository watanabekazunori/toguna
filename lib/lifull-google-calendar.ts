/**
 * Google Calendar API v3 クライアント
 *
 * 設計方針:
 *   - Service Account + Domain-wide Delegation
 *   - scope: calendar.freebusy 限定 (I-03 対策: events.read 不要)
 *   - 並列 FreeBusy 取得 (Promise.all)
 *   - 5分 SWR キャッシュ (Node.js インメモリ)
 *   - エラー時の calendar_not_shared 判定
 *   - lifull_calendar_locks 由来の busy_slots マージ
 *
 * 対応 threat:
 *   I-03 Calendar 越境参照防止 (scope 最小化)
 *   S-03 Service Account 偽装防止 (DWD + scope 限定)
 */

import { google, calendar_v3 } from "googleapis";
import type { SupabaseClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FreeBusySlot {
  start: string;
  end: string;
  duration_min: number;
}

export interface BusySlot {
  start: string;
  end: string;
  source: "google_calendar" | "lifull_deals_locked";
}

export interface CloserFreeBusy {
  closer_id: string;
  /** 空き枠 (60分単位で計算) */
  free_slots: FreeBusySlot[];
  /** ふさがり枠 */
  busy_slots: BusySlot[];
  /** エラー種別 (未設定 or calendar_not_shared) */
  error?: "calendar_not_shared" | "calendar_fetch_failed";
}

export interface FreeBusyQuery {
  closerIds: string[];
  from: Date;
  to: Date;
  tenantId: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** FreeBusy scope — events.read は不要 (I-03 対策) */
const CALENDAR_FREEBUSY_SCOPE =
  "https://www.googleapis.com/auth/calendar.freebusy";

/** SWR キャッシュ有効期間: 5分 */
const CACHE_TTL_MS = 5 * 60 * 1000;

/** 空き枠の最小単位: 60分 */
const FREE_SLOT_MIN_DURATION_MIN = 60;

// ---------------------------------------------------------------------------
// SWR キャッシュ (インメモリ / Next.js サーバーサイド)
// ---------------------------------------------------------------------------

interface CacheEntry {
  data: CloserFreeBusy[];
  expiresAt: number;
}

const freeBusyCache = new Map<string, CacheEntry>();

// ---------------------------------------------------------------------------
// GoogleCalendarClient
// ---------------------------------------------------------------------------

/**
 * Google Calendar FreeBusy API クライアント
 *
 * 使用例:
 *   const client = new GoogleCalendarClient(serviceAccountJson, "example.com");
 *   const results = await client.getFreeBusy({ closerIds, from, to, tenantId });
 */
export class GoogleCalendarClient {
  private readonly auth: ReturnType<typeof google.auth.JWT>;

  constructor(
    /** Service Account JSON 文字列 */
    serviceAccountJson: string,
    /** Google Workspace ドメイン (DWD 用) */
    domain: string
  ) {
    const sa = JSON.parse(serviceAccountJson);

    this.auth = new google.auth.JWT({
      email: sa.client_email,
      key: sa.private_key,
      scopes: [CALENDAR_FREEBUSY_SCOPE],
      // Domain-wide Delegation (I-03 対策: DWD で対象クローザー OU 限定)
      subject: `service@${domain}`,
    });
  }

  // ---------------------------------------------------------------------------
  // Public: getFreeBusy
  // ---------------------------------------------------------------------------

  /**
   * 複数クローザーの FreeBusy を並列取得する
   *
   * @param query FreeBusy クエリ
   * @param supabase Supabase クライアント (lifull_calendar_locks 取得用)
   */
  async getFreeBusy(
    query: FreeBusyQuery,
    supabase: SupabaseClient
  ): Promise<CloserFreeBusy[]> {
    const cacheKey = buildCacheKey(query);
    const cached = freeBusyCache.get(cacheKey);

    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }

    // クローザーの Google Calendar ID を取得
    const { data: users } = await supabase
      .from("lifull_users")
      .select("id, google_calendar_id")
      .in("id", query.closerIds)
      .eq("tenant_id", query.tenantId)
      .eq("role", "CLOSER");

    if (!users || users.length === 0) {
      return query.closerIds.map((id) => ({
        closer_id: id,
        free_slots: [],
        busy_slots: [],
        error: "calendar_not_shared" as const,
      }));
    }

    // DB から lock 情報を取得 (lifull_deals_locked)
    const lockedSlots = await this.fetchLockedSlots(
      query.closerIds,
      query.from,
      query.to,
      query.tenantId,
      supabase
    );

    // 並列 FreeBusy 取得
    const results = await Promise.all(
      users.map(async (user) => {
        const calendarId = user.google_calendar_id;

        if (!calendarId) {
          return {
            closer_id: user.id,
            free_slots: [] as FreeBusySlot[],
            busy_slots: lockedSlots.filter((s) => s.closer_id === user.id).map(
              (s) => ({
                start: s.start,
                end: s.end,
                source: "lifull_deals_locked" as const,
              })
            ),
            error: "calendar_not_shared" as const,
          } satisfies CloserFreeBusy;
        }

        try {
          return await this.fetchSingleCloserFreeBusy(
            user.id,
            calendarId,
            query.from,
            query.to,
            lockedSlots.filter((s) => s.closer_id === user.id)
          );
        } catch (err) {
          const isNotShared =
            err instanceof Error &&
            (err.message.includes("403") ||
              err.message.includes("notFound") ||
              err.message.includes("forbidden"));

          return {
            closer_id: user.id,
            free_slots: [] as FreeBusySlot[],
            busy_slots: [],
            error: isNotShared
              ? ("calendar_not_shared" as const)
              : ("calendar_fetch_failed" as const),
          } satisfies CloserFreeBusy;
        }
      })
    );

    // SWR キャッシュに保存 (5分)
    freeBusyCache.set(cacheKey, {
      data: results,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });

    return results;
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  /**
   * 1クローザーの FreeBusy を Google Calendar API で取得し、
   * lifull_calendar_locks の busy_slots とマージする
   */
  private async fetchSingleCloserFreeBusy(
    closerId: string,
    calendarId: string,
    from: Date,
    to: Date,
    lockedSlots: LockedSlotRecord[]
  ): Promise<CloserFreeBusy> {
    const calendar = google.calendar({ version: "v3", auth: this.auth });

    const response = await calendar.freebusy.query({
      requestBody: {
        timeMin: from.toISOString(),
        timeMax: to.toISOString(),
        items: [{ id: calendarId }],
      },
    });

    const calendarBusy =
      response.data.calendars?.[calendarId]?.busy ?? [];

    // Google Calendar の busy_slots
    const googleBusySlots: BusySlot[] = calendarBusy.map((b) => ({
      start: b.start!,
      end: b.end!,
      source: "google_calendar" as const,
    }));

    // lifull_deals_locked の busy_slots
    const lockBusySlots: BusySlot[] = lockedSlots.map((s) => ({
      start: s.start,
      end: s.end,
      source: "lifull_deals_locked" as const,
    }));

    // 全 busy_slots をマージ
    const allBusySlots = [...googleBusySlots, ...lockBusySlots].sort(
      (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
    );

    // 空き枠を計算 (60分単位)
    const freeSlots = computeFreeSlots(from, to, allBusySlots);

    return {
      closer_id: closerId,
      free_slots: freeSlots,
      busy_slots: allBusySlots,
    };
  }

  /** lifull_calendar_locks から予約済み枠を取得する */
  private async fetchLockedSlots(
    closerIds: string[],
    from: Date,
    to: Date,
    tenantId: string,
    supabase: SupabaseClient
  ): Promise<LockedSlotRecord[]> {
    const { data } = await supabase
      .from("lifull_calendar_locks")
      .select("closer_id, slot_start, slot_end")
      .in("closer_id", closerIds)
      .eq("tenant_id", tenantId)
      .gte("slot_start", from.toISOString())
      .lte("slot_end", to.toISOString());

    return (data ?? []).map((row) => ({
      closer_id: row.closer_id,
      start: row.slot_start,
      end: row.slot_end,
    }));
  }
}

// ---------------------------------------------------------------------------
// Types: private
// ---------------------------------------------------------------------------

interface LockedSlotRecord {
  closer_id: string;
  start: string;
  end: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * busy_slots から空き枠を計算する (60分単位)
 *
 * @param from 検索開始時刻
 * @param to 検索終了時刻
 * @param busySlots ふさがり枠の配列
 */
function computeFreeSlots(
  from: Date,
  to: Date,
  busySlots: BusySlot[]
): FreeBusySlot[] {
  const freeSlots: FreeBusySlot[] = [];
  const slotDurationMs = FREE_SLOT_MIN_DURATION_MIN * 60 * 1000;

  // 30分単位でスキャン
  const current = new Date(from);

  while (current.getTime() + slotDurationMs <= to.getTime()) {
    const slotEnd = new Date(current.getTime() + slotDurationMs);

    const isBlocked = busySlots.some((busy) => {
      const busyStart = new Date(busy.start);
      const busyEnd = new Date(busy.end);
      return current < busyEnd && slotEnd > busyStart;
    });

    if (!isBlocked) {
      freeSlots.push({
        start: current.toISOString(),
        end: slotEnd.toISOString(),
        duration_min: FREE_SLOT_MIN_DURATION_MIN,
      });
    }

    // 30分ステップ
    current.setTime(current.getTime() + 30 * 60 * 1000);
  }

  return freeSlots;
}

/** SWR キャッシュキーを生成する */
function buildCacheKey(query: FreeBusyQuery): string {
  const sortedIds = [...query.closerIds].sort().join(",");
  return `freebusy:${query.tenantId}:${sortedIds}:${query.from.toISOString()}:${query.to.toISOString()}`;
}

// END_OF_FILE
