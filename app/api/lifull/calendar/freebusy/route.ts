/**
 * GET /api/lifull/calendar/freebusy
 *
 * クローザー商談枠 FreeBusy API
 *
 * 設計:
 *   - Zod 入力検証
 *   - withTenantContext + role 認可 (CLOSER / MANAGER / ADMIN)
 *   - Google Calendar FreeBusy 並列取得 + 5分 SWR キャッシュ
 *   - busy_slots に lifull_deals_locked 由来も含める
 *   - 403 calendar_not_shared 対応
 *   - Service Account scope: calendar.freebusy 限定 (I-03 対策)
 *
 * Rate limit: 30/分/user (api_spec.md §8)
 *
 * 対応 threat: I-03 (Calendar 越境) / S-03 (Service Account 偽装)
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { withTenantContext } from "@/lib/tenant-context";
import { GoogleCalendarClient } from "@/lib/google-calendar";

// ---------------------------------------------------------------------------
// Input validation (Zod)
// ---------------------------------------------------------------------------

const FreeBusyQuerySchema = z.object({
  closer_ids: z
    .string()
    .transform((s) => s.split(","))
    .pipe(z.array(z.string().uuid()).min(1).max(20)),
  from: z.string().datetime({ offset: true }),
  to: z.string().datetime({ offset: true }),
});

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

/**
 * GET /api/lifull/calendar/freebusy
 *
 * @example
 * GET /api/lifull/calendar/freebusy?closer_ids=uuid1,uuid2&from=2026-06-12T09:00:00Z&to=2026-06-12T18:00:00Z
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const correlationId = crypto.randomUUID();

  // テナント ID をヘッダから取得 (全 API 共通)
  const tenantId = req.headers.get("x-tenant-id");
  if (!tenantId || !/^[a-z][a-z0-9_]*$/.test(tenantId)) {
    return problemDetails(
      400,
      "Bad Request",
      "Missing or invalid x-tenant-id header",
      correlationId
    );
  }

  // Supabase Auth + RLS クライアント
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

  // 認証チェック
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return problemDetails(401, "Unauthorized", "Authentication required", correlationId);
  }

  // role 認可: CLOSER / MANAGER / ADMIN のみ許可
  const { data: lifullUser } = await supabase
    .from("lifull_users")
    .select("role")
    .eq("auth_user_id", user.id)
    .eq("tenant_id", tenantId)
    .single();

  if (!lifullUser || !["CLOSER", "MANAGER", "ADMIN"].includes(lifullUser.role)) {
    return problemDetails(
      403,
      "Forbidden",
      "Role CLOSER, MANAGER, or ADMIN required",
      correlationId,
      tenantId
    );
  }

  // 入力検証
  const searchParams = req.nextUrl.searchParams;
  const parseResult = FreeBusyQuerySchema.safeParse({
    closer_ids: searchParams.get("closer_ids") ?? "",
    from: searchParams.get("from"),
    to: searchParams.get("to"),
  });

  if (!parseResult.success) {
    return problemDetails(
      400,
      "Bad Request",
      `Invalid query: ${parseResult.error.issues[0].message}`,
      correlationId
    );
  }

  const { closer_ids, from, to } = parseResult.data;

  // from < to チェック
  if (new Date(from) >= new Date(to)) {
    return problemDetails(
      400,
      "Bad Request",
      "`from` must be before `to`",
      correlationId
    );
  }

  // withTenantContext で tenant_id を伝播 (I-02 対策)
  return withTenantContext(tenantId, async () => {
    const googleServiceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON!;
    const googleDomain = process.env.GOOGLE_WORKSPACE_DOMAIN ?? "fanvest.co.jp";

    const calendarClient = new GoogleCalendarClient(
      googleServiceAccountJson,
      googleDomain
    );

    const results = await calendarClient.getFreeBusy(
      {
        closerIds: closer_ids,
        from: new Date(from),
        to: new Date(to),
        tenantId,
      },
      supabase
    );

    // calendar_not_shared のクローザーがいる場合は部分的に 403 相当の情報を含める
    const hasCalendarNotShared = results.some(
      (r) => r.error === "calendar_not_shared"
    );

    return NextResponse.json(
      {
        closers: results.map((r) => ({
          closer_id: r.closer_id,
          free_slots: r.free_slots,
          busy_slots: r.busy_slots,
          error: r.error ?? null,
        })),
        // 一部 calendar_not_shared がある場合に警告フラグ
        partial_calendar_not_shared: hasCalendarNotShared,
      },
      { status: 200 }
    );
  });
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
      type: `https://docs.toguna/errors/calendar/${title.toLowerCase().replace(/ /g, "-")}`,
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
