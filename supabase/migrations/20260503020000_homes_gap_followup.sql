-- ==============================================================
-- HOME'S GAP follow-up: Storage bucket + admin write policies
-- 20260503_homes_gap_implementation.sql の補完
-- ==============================================================

-- 受注日カラム (homes_user_conversion_view が参照)
-- status='won' に遷移した時刻を記録。アプリ側で UPDATE 時に NOW() を投入する想定。
ALTER TABLE homes_deals ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_homes_deals_closed_at ON homes_deals(closed_at);

-- ============================================================
-- GAP-O: 申込書PDF用 Storage bucket
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('application-forms', 'application-forms', false, 10485760, ARRAY['application/pdf'])
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 認証済みユーザーは自社案件の申込書を読める
DO $$
BEGIN
  CREATE POLICY application_forms_read_authenticated
    ON storage.objects FOR SELECT TO authenticated
    USING (bucket_id = 'application-forms');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- アップロード: クローザー / クローザーロール以上のみ
DO $$
BEGIN
  CREATE POLICY application_forms_upload_role
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (
      bucket_id = 'application-forms'
      AND auth.uid() IN (
        SELECT auth_user_id FROM homes_users
         WHERE role IN ('CLOSER', 'COLLECTOR', 'SV', 'PM', 'ADMIN')
           AND is_active = true
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 新規テーブルの WRITE policy (ADMIN/PM のみ)
-- ============================================================
DO $$
BEGIN
  -- homes_settings: ADMIN のみ書込
  CREATE POLICY homes_settings_admin_write
    ON homes_settings FOR ALL TO authenticated
    USING (auth.uid() IN (
      SELECT auth_user_id FROM homes_users WHERE role = 'ADMIN' AND is_active = true
    ))
    WITH CHECK (auth.uid() IN (
      SELECT auth_user_id FROM homes_users WHERE role = 'ADMIN' AND is_active = true
    ));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  -- homes_dispatch_rules: ADMIN/PM 書込
  CREATE POLICY homes_dispatch_rules_admin_write
    ON homes_dispatch_rules FOR ALL TO authenticated
    USING (auth.uid() IN (
      SELECT auth_user_id FROM homes_users WHERE role IN ('ADMIN','PM') AND is_active = true
    ))
    WITH CHECK (auth.uid() IN (
      SELECT auth_user_id FROM homes_users WHERE role IN ('ADMIN','PM') AND is_active = true
    ));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  -- homes_notifications: 通知作成は ADMIN/PM/SV/CLOSER (システム経由), 既読更新は本人
  CREATE POLICY homes_notifications_insert
    ON homes_notifications FOR INSERT TO authenticated
    WITH CHECK (auth.uid() IN (
      SELECT auth_user_id FROM homes_users
       WHERE role IN ('ADMIN','PM','SV','CLOSER') AND is_active = true
    ));

  CREATE POLICY homes_notifications_self_update
    ON homes_notifications FOR UPDATE TO authenticated
    USING (user_id IN (SELECT id FROM homes_users WHERE auth_user_id = auth.uid()))
    WITH CHECK (user_id IN (SELECT id FROM homes_users WHERE auth_user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- list_id × main_business 複合 index (GAP-B 絞り込み高速化)
-- 14万件 × 40種類のフィルタ用
-- ============================================================
CREATE INDEX IF NOT EXISTS homes_companies_list_business
  ON homes_companies (list_id, main_business)
  WHERE list_id IS NOT NULL;

-- ============================================================
-- last_call_at sort 用 index (GAP-F 無応答10回 + 低優先度のソート)
-- ============================================================
CREATE INDEX IF NOT EXISTS homes_companies_no_answer_priority
  ON homes_companies (no_answer_count DESC, score_priority ASC)
  WHERE call_state = 'low_priority';

-- ============================================================
-- recheck_required filter index (GAP-P)
-- ============================================================
CREATE INDEX IF NOT EXISTS homes_collections_recheck
  ON homes_collections (recheck_required, audit_request_date)
  WHERE recheck_required = true;

-- ============================================================
-- B-02: list-progress N+1 防止用 集計ビュー
-- 40 lists × 14万件 を1クエリで返す
-- ============================================================
DROP VIEW IF EXISTS homes_list_progress_view CASCADE;
CREATE VIEW homes_list_progress_view AS
SELECT
  l.id              AS list_id,
  l.name            AS name,
  l.source          AS source,
  l.total_count     AS list_total_count,
  COUNT(c.id)                                                 AS total,
  COUNT(c.id) FILTER (WHERE c.call_state = 'untouched')        AS untouched,
  COUNT(c.id) FILTER (WHERE c.call_state IN ('dialed','connected','contacted','appointed','ng','recall_scheduled')) AS dialed,
  COUNT(c.id) FILTER (WHERE c.call_state IN ('contacted','appointed'))                  AS contacted,
  COUNT(c.id) FILTER (WHERE c.call_state = 'appointed')        AS appointed,
  COUNT(c.id) FILTER (WHERE c.call_state = 'ng')               AS ng,
  COUNT(c.id) FILTER (WHERE c.call_state = 'low_priority')     AS low_priority
FROM homes_lists l
LEFT JOIN homes_companies c ON c.list_id = l.id
WHERE l.is_active = true
GROUP BY l.id, l.name, l.source, l.total_count
ORDER BY l.name;

GRANT SELECT ON homes_list_progress_view TO authenticated;

-- ============================================================
-- B-03: conversion N+1 防止用 集計ビュー (per user × today)
-- 30 users × 5 queries を 1 view で返す
-- ============================================================
DROP VIEW IF EXISTS homes_user_conversion_view CASCADE;
CREATE VIEW homes_user_conversion_view AS
SELECT
  u.id                AS user_id,
  u.name              AS user_name,
  u.role              AS role,
  u.team_id           AS team_id,
  -- 直近30日 (= 当日 + 過去29日)
  (SELECT COUNT(*) FROM homes_activities a
    WHERE a.user_id = u.id
      AND a.call_started_at >= (CURRENT_DATE - INTERVAL '29 days')
  )                                                            AS calls_30d,
  (SELECT COUNT(*) FROM homes_activities a
    WHERE a.user_id = u.id
      AND a.call_started_at >= (CURRENT_DATE - INTERVAL '29 days')
      AND a.result_secondary = 'connected'
  )                                                            AS connected_30d,
  (SELECT COUNT(*) FROM homes_activities a
    WHERE a.user_id = u.id
      AND a.call_started_at >= (CURRENT_DATE - INTERVAL '29 days')
      AND a.result_secondary = 'contacted'
  )                                                            AS contacted_30d,
  (SELECT COUNT(*) FROM homes_activities a
    WHERE a.user_id = u.id
      AND a.call_started_at >= (CURRENT_DATE - INTERVAL '29 days')
      AND a.result_secondary = 'appointment'
  )                                                            AS appointed_30d,
  (SELECT COUNT(*) FROM homes_deals d
    WHERE d.appointer_user_id = u.id
      AND d.status = 'won'
      AND d.closed_at >= (CURRENT_DATE - INTERVAL '29 days')
  )                                                            AS won_30d
FROM homes_users u
WHERE u.is_active = true
ORDER BY u.name;

GRANT SELECT ON homes_user_conversion_view TO authenticated;

-- ============================================================
-- 既存 DB 向け call_window 設定の補完 (first_call_at 追加)
-- ============================================================
UPDATE homes_settings
SET value = jsonb_set(
  jsonb_set(
    COALESCE(value, '{}'::jsonb),
    '{first_call_at}',
    to_jsonb('09:55'::text),
    true
  ),
  '{start}',
  to_jsonb('09:30'::text),
  true
)
WHERE key = 'call_window'
  AND (value->>'first_call_at') IS NULL;

-- ============================================================
-- DONE
-- ============================================================
