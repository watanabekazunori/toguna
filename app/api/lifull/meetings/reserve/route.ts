/**
 * POST /api/lifull/meetings/reserve
 *
 * クローザー商談枠予約 API
 *
 * 排他制御設計 (api_spec.md §4):
 *   BEGIN;
 *     SELECT * FROM lifull_calendar_locks WHERE closer_id=$1 AND slot_start=$2 FOR UPDATE;
 *     INSERT INTO lifull_meetings ...;
 *     UPDATE lifull_deals ...;
 *     INSERT INTO Google Calendar event;
 *   COMMIT;
 *
 *   UNIQUE (closer_id, slot_start) 物理制約で二重防御
 *
 * エラー設計:
 *   - 409 Conflict: ダブルブッキング (UNIQUE 制約違反)
 *   - 403 calendar_not_shared
 *   - Google Calendar event 作成失敗時: DB ロールバック
 *
 * 対応 threat: S-02 / R-01 (商談枠争奪の否認防止) / I-05 (引き継ぎ誤確定)
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { withTenantContext } from "@/lib/tenant-context";
import { google } from "googleapis";

// ---------------------------------------------------------------------------
// Input validation (Zod)
// ---------------------------------------------------------------------------

const ReserveRequestSchema = z.object({
  deal_id: z.string().uuid(),
  closer_id: z.string().uuid(),
  slot_start: z.string().datetime({ offset: true }),
  slot_end: z.string().datetime({ offset: true }),
  customer_meeting_type: z.enum(["ONLINE", "ONSITE"]),
});

type ReserveRequest = z.infer<typeof ReserveRequestSchema>;

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

/**
 * POST /api/lifull/meetings/reserve
 *
 * @example
 * POST /api/lifull/meetings/reserve
 * { "deal_id": "uuid", "closer_id": "uuid", "slot_start": "...", "slot_end": "...", "customer_meeting_type": "ONLINE" }
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const correlationId = crypto.randomUUID();

  const tenantId = req.headers.get("x-tenant-id");
  if (!tenantId || !/^[a-z][a-z0-9_]*$/.test(tenantId)) {
    return problemDetails(400, "Bad Request", "Missing or invalid x-tenant-id header", correlationId);
  }

  // 認証
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (c) => c.forEach(({ name, value, options }) => cookieStore.set(name, value, options)),
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return problemDetails(401, "Unauthorized", "Authentication required", correlationId);
  }

  // role 認可: 全ロール許可 (予約は APPOINTER もできる)
  const { data: lifullUser } = await supabase
    .from("lifull_users")
    .select("id, role")
    .eq("auth_user_id", user.id)
    .eq("tenant_id", tenantId)
    .single();

  if (!lifullUser) {
    return problemDetails(403, "Forbidden", "User not found in tenant", correlationId, tenantId);
  }

  // リクエスト解析
  let body: ReserveRequest;
  try {
    const raw = await req.json();
    const parsed = ReserveRequestSchema.safeParse(raw);
    if (!parsed.success) {
      return problemDetails(
        400,
        "Bad Request",
        `Invalid body: ${parsed.error.issues[0].message}`,
        correlationId
      );
    }
    body = parsed.data;
  } catch {
    return problemDetails(400, "Bad Request", "Invalid JSON body", correlationId);
  }

  // slot_start < slot_end チェック
  if (new Date(body.slot_start) >= new Date(body.slot_end)) {
    return problemDetails(
      400,
      "Bad Request",
      "`slot_start` must be before `slot_end`",
      correlationId
    );
  }

  return withTenantContext(tenantId, async () => {
    // Service Role Key クライアント (transaction 用)
    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );

    // クローザーの Google Calendar ID を取得
    const { data: closer } = await adminClient
      .from("lifull_users")
      .select("google_calendar_id, name")
      .eq("id", body.closer_id)
      .eq("tenant_id", tenantId)
      .single();

    if (!closer?.google_calendar_id) {
      return problemDetails(
        403,
        "Forbidden",
        "calendar_not_shared",
        correlationId,
        tenantId
      );
    }

    // deal 情報を取得 (audit_log 用)
    const { data: deal } = await adminClient
      .from("lifull_deals")
      .select("id, company_id, status")
      .eq("id", body.deal_id)
      .eq("tenant_id", tenantId)
      .single();

    if (!deal) {
      return problemDetails(404, "Not Found", "Deal not found", correlationId, tenantId);
    }

    // 排他制御 transaction (Supabase rpc 経由)
    const lockId = crypto.randomUUID();
    const meetingId = crypto.randomUUID();

    // Step 1: calendar_lock を取得 + INSERT (SELECT FOR UPDATE は RPC 経由)
    const { error: lockError } = await adminClient.rpc(
      "reserve_calendar_slot",
      {
        p_lock_id: lockId,
        p_tenant_id: tenantId,
        p_closer_id: body.closer_id,
        p_slot_start: body.slot_start,
        p_slot_end: body.slot_end,
        p_deal_id: body.deal_id,
        p_meeting_id: meetingId,
        p_actor_id: lifullUser.id,
      }
    );

    if (lockError) {
      // UNIQUE 制約違反 = ダブルブッキング
      if (
        lockError.code === "23505" ||
        lockError.message.includes("unique") ||
        lockError.message.includes("duplicate")
      ) {
        // 既存の予約情報を取得してレスポンスに含める
        const { data: conflict } = await adminClient
          .from("lifull_calendar_locks")
          .select("meeting_id")
          .eq("closer_id", body.closer_id)
          .eq("slot_start", body.slot_start)
          .eq("tenant_id", tenantId)
          .single();

        return NextResponse.json(
          {
            type: "https://docs.toguna/errors/calendar-conflict",
            title: "Calendar Conflict",
            status: 409,
            detail: "The requested slot is already booked",
            conflict_with: {
              meeting_id: conflict?.meeting_id ?? null,
              closer_id: body.closer_id,
              slot_start: body.slot_start,
            },
            correlation_id: correlationId,
          },
          { status: 409 }
        );
      }

      return problemDetails(
        500,
        "Internal Server Error",
        `Lock acquisition failed: ${lockError.message}`,
        correlationId
      );
    }

    // Step 2: Google Calendar に event を作成
    let calendarEventId: string;
    try {
      calendarEventId = await createGoogleCalendarEvent(
        closer.google_calendar_id,
        body,
        deal,
        closer.name ?? "クローザー"
      );
    } catch (err) {
      // Google Calendar 失敗時: lifull_calendar_locks を削除してロールバック
      await adminClient
        .from("lifull_calendar_locks")
        .delete()
        .eq("id", lockId)
        .eq("tenant_id", tenantId);

      await adminClient
        .from("lifull_meetings")
        .delete()
        .eq("id", meetingId)
        .eq("tenant_id", tenantId);

      console.error(
        JSON.stringify({
          level: "error",
          event: "google_calendar_event_failed",
          deal_id: body.deal_id,
          closer_id: body.closer_id,
          error: String(err),
          action: "rolled_back",
          correlation_id: correlationId,
        })
      );

      return problemDetails(
        502,
        "Calendar Event Failed",
        "Failed to create Google Calendar event — booking rolled back",
        correlationId,
        tenantId
      );
    }

    // Step 3: Google Calendar event_id を lifull_meetings に更新
    await adminClient
      .from("lifull_meetings")
      .update({ calendar_event_id: calendarEventId })
      .eq("id", meetingId)
      .eq("tenant_id", tenantId);

    // audit_log: R-01 対応 (商談枠予約の否認防止)
    await adminClient.from("lifull_audit_logs").insert({
      tenant_id: tenantId,
      table_name: "lifull_meetings",
      record_id: meetingId,
      action: "INSERT",
      actor_id: lifullUser.id,
      new_value: {
        deal_id: body.deal_id,
        closer_id: body.closer_id,
        slot_start: body.slot_start,
        slot_end: body.slot_end,
        calendar_event_id: calendarEventId,
        lock_id: lockId,
      },
    });

    console.info(
      JSON.stringify({
        level: "info",
        event: "meeting_reserved",
        meeting_id: meetingId,
        deal_id: body.deal_id,
        closer_id: body.closer_id,
        lock_id: lockId,
        calendar_event_id: calendarEventId,
        tenant_id: tenantId,
        actor_id: lifullUser.id,
        correlation_id: correlationId,
      })
    );

    return NextResponse.json(
      {
        meeting_id: meetingId,
        calendar_event_id: calendarEventId,
        lock_id: lockId,
        slot_start: body.slot_start,
        slot_end: body.slot_end,
      },
      { status: 201 }
    );
  });
}

// ---------------------------------------------------------------------------
// Google Calendar event 作成
// ---------------------------------------------------------------------------

/**
 * Google Calendar に商談 event を作成する
 *
 * @returns 作成した event の ID
 */
async function createGoogleCalendarEvent(
  calendarId: string,
  body: ReserveRequest,
  deal: { id: string; company_id: string },
  closerName: string
): Promise<string> {
  const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON!;
  const sa = JSON.parse(serviceAccountJson);
  const domain = process.env.GOOGLE_WORKSPACE_DOMAIN ?? "fanvest.co.jp";

  const auth = new google.auth.JWT({
    email: sa.client_email,
    key: sa.private_key,
    scopes: ["https://www.googleapis.com/auth/calendar"],
    subject: `${closerName}@${domain}`,
  });

  const calendar = google.calendar({ version: "v3", auth });

  const meetingLink =
    body.customer_meeting_type === "ONLINE"
      ? "Google Meet / Zoom (担当者より送付)"
      : "訪問商談";

  const event: calendar_v3.Schema$Event = {
    summary: `[大手不動産情報ポータル] 商談`,
    description: [
      `商談種別: ${body.customer_meeting_type === "ONLINE" ? "オンライン" : "訪問"}`,
      `Deal ID: ${deal.id}`,
      `場所: ${meetingLink}`,
    ].join("\n"),
    start: {
      dateTime: body.slot_start,
      timeZone: "Asia/Tokyo",
    },
    end: {
      dateTime: body.slot_end,
      timeZone: "Asia/Tokyo",
    },
    status: "confirmed",
  };

  const response = await calendar.events.insert({
    calendarId,
    requestBody: event,
  });

  if (!response.data.id) {
    throw new Error("Google Calendar event ID not returned");
  }

  return response.data.id;
}

// ---------------------------------------------------------------------------
// RFC 7807 Problem Details
// ---------------------------------------------------------------------------

/** RFC 7807 準拠のエラーレスポンスを生成する */
function problemDetails(
  status: number,
  title: string,
  detail: string,
  correlationId: string,
  tenantId?: string
): NextResponse {
  return NextResponse.json(
    {
      type: `https://docs.toguna/errors/meetings/${title.toLowerCase().replace(/ /g, "-")}`,
      title,
      status,
      detail,
      correlation_id: correlationId,
      ...(tenantId ? { tenant_id: tenantId } : {}),
    },
    { status }
  );
}

// END_OF_FILE
