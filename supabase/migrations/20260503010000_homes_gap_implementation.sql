-- ==============================================================
-- HOME'S Operation 2026-04-24 議事録 GAP対応 マイグレーション
-- 全GAP (P0/P1/P2) を一括反映
-- ==============================================================

-- ============================================================
-- GAP-C: 免許番号ベース重複削除
-- ============================================================
-- takken_license_no は既存。UNIQUE制約のみ追加
CREATE UNIQUE INDEX IF NOT EXISTS homes_companies_takken_license_unique
  ON homes_companies (takken_license_no)
  WHERE takken_license_no IS NOT NULL AND takken_license_no <> '';

-- ============================================================
-- GAP-F: 無応答10回で自動低優先度
-- ============================================================
ALTER TABLE homes_companies
  ADD COLUMN IF NOT EXISTS no_answer_count INT NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION homes_bump_no_answer() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.result_primary = 'no_answer' THEN
    UPDATE homes_companies
       SET no_answer_count = no_answer_count + 1,
           score_priority = CASE
             WHEN no_answer_count + 1 >= 10 THEN 1  -- 1=最低優先
             ELSE score_priority
           END,
           call_state = CASE
             WHEN no_answer_count + 1 >= 10 THEN 'low_priority'
             ELSE call_state
           END
     WHERE id = NEW.company_id;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_homes_bump_no_answer ON homes_activities;
CREATE TRIGGER trg_homes_bump_no_answer
  AFTER INSERT ON homes_activities
  FOR EACH ROW EXECUTE FUNCTION homes_bump_no_answer();

-- ============================================================
-- GAP-H: アポ成立4点
-- ============================================================
ALTER TABLE homes_deals
  ADD COLUMN IF NOT EXISTS contact_email TEXT,
  ADD COLUMN IF NOT EXISTS is_decision_maker BOOLEAN;

-- 受信済みアポ確定済みdeals (status >= meeting_scheduled) にはメール必須
-- 既存データには制約をかけない (後方互換)。新規はアプリ側でバリデート

-- ============================================================
-- GAP-M: 業態ランク必須化
-- ============================================================
-- main_business は既存。NULL を unknown で埋め、その後 NOT NULL
UPDATE homes_companies
   SET main_business = 'unknown'
 WHERE main_business IS NULL OR main_business = '';

-- 既に NOT NULL の可能性あり。冪等に
DO $$
BEGIN
  ALTER TABLE homes_companies ALTER COLUMN main_business SET NOT NULL;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ============================================================
-- GAP-O: 申込書PDFアップロード
-- ============================================================
ALTER TABLE homes_orders
  ADD COLUMN IF NOT EXISTS application_pdf_url TEXT,
  ADD COLUMN IF NOT EXISTS application_pdf_uploaded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS application_pdf_uploaded_by UUID REFERENCES homes_users(id);

-- Storage bucket は SQL で作成不可。supabase/seeds または手動

-- ============================================================
-- GAP-D: 営業時間設定
-- ============================================================
CREATE TABLE IF NOT EXISTS homes_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES homes_users(id)
);

INSERT INTO homes_settings (key, value, description) VALUES
  -- 議事録: 9:30-18:30 営業 / コール開始 9:55 (25分から)
  ('call_window', '{"start":"09:30","end":"18:30","first_call_at":"09:55","weekday_only":false}'::jsonb, 'コール可能時間 (議事録G-04 / CallWindowGuard 参照)'),
  ('regular_meeting', '{"day_of_week":3,"hour":18,"minute":0}'::jsonb, '定例ミーティング (毎週水 18:00)'),
  ('no_answer_threshold', '10'::jsonb, '無応答自動低優先化の閾値'),
  ('next_action_alert_minutes', '5'::jsonb, 'ネクストアクション何分前にアラートか')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- GAP-K: AI割り振りルール
-- ============================================================
CREATE TABLE IF NOT EXISTS homes_dispatch_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  priority INT NOT NULL DEFAULT 100,
  is_active BOOLEAN NOT NULL DEFAULT true,
  -- 条件: business_type, prefecture, score_range, is_existing_publisher など
  conditions JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- 配分: ターゲットチームor役職
  target_team_id UUID REFERENCES homes_teams(id),
  target_role TEXT,
  weight NUMERIC NOT NULL DEFAULT 1.0,
  authored_by UUID REFERENCES homes_users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS homes_dispatch_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  total_companies INT NOT NULL DEFAULT 0,
  assigned_count INT NOT NULL DEFAULT 0,
  skipped_count INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending', -- pending/running/done/failed
  error TEXT,
  details JSONB
);

-- ============================================================
-- GAP-L: スコアリング2軸
-- ============================================================
ALTER TABLE homes_companies
  ADD COLUMN IF NOT EXISTS is_existing_publisher BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS total_score NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS score_calculated_at TIMESTAMPTZ;

ALTER TABLE homes_lists
  ADD COLUMN IF NOT EXISTS score_profile JSONB DEFAULT '{}'::jsonb;
  -- {"existing": {"quality":1.0,"size":0.5,"potential":0.3,"priority":1.5},
  --  "new":      {"quality":1.5,"size":1.0,"potential":1.5,"priority":0.5}}

-- ============================================================
-- GAP-P: 審査スプシ連携
-- ============================================================
CREATE TABLE IF NOT EXISTS homes_audit_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  source TEXT NOT NULL, -- 'sheet' / 'recheck_cron'
  sheet_url TEXT,
  rows_processed INT NOT NULL DEFAULT 0,
  rows_updated INT NOT NULL DEFAULT 0,
  rows_skipped INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'done',
  error TEXT,
  details JSONB
);

-- 2ヶ月再審査自動オフ用カラム (collections に audit_progress 既存。フラグだけ追加)
ALTER TABLE homes_collections
  ADD COLUMN IF NOT EXISTS recheck_required BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS recheck_auto_off_at TIMESTAMPTZ;

-- ============================================================
-- GAP-J: 移行ログ
-- ============================================================
CREATE TABLE IF NOT EXISTS homes_migration_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  migrated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  source TEXT NOT NULL, -- 'comdesk'
  mode TEXT NOT NULL, -- 'sample' / 'full'
  total INT NOT NULL DEFAULT 0,
  succeeded INT NOT NULL DEFAULT 0,
  failed INT NOT NULL DEFAULT 0,
  errors JSONB,
  notes TEXT
);

-- ============================================================
-- GAP-N: 5分前通知 (既存 next_content_date を活用、追加カラム不要)
-- ただし通知履歴を残すためのテーブル
-- ============================================================
CREATE TABLE IF NOT EXISTS homes_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES homes_users(id),
  kind TEXT NOT NULL, -- 'next_action_5min' / 'order_pdf_uploaded' / etc.
  title TEXT NOT NULL,
  body TEXT,
  payload JSONB,
  fired_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS homes_notifications_user_unread
  ON homes_notifications (user_id, read_at) WHERE read_at IS NULL;

-- ============================================================
-- RLS for new tables
-- ============================================================
ALTER TABLE homes_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE homes_dispatch_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE homes_dispatch_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE homes_audit_sync_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE homes_migration_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE homes_notifications ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- 全認証ユーザー読み込み可
  CREATE POLICY homes_settings_read ON homes_settings FOR SELECT TO authenticated USING (true);
  CREATE POLICY homes_dispatch_rules_read ON homes_dispatch_rules FOR SELECT TO authenticated USING (true);
  CREATE POLICY homes_dispatch_runs_read ON homes_dispatch_runs FOR SELECT TO authenticated USING (true);
  CREATE POLICY homes_audit_sync_log_read ON homes_audit_sync_log FOR SELECT TO authenticated USING (true);
  CREATE POLICY homes_migration_log_read ON homes_migration_log FOR SELECT TO authenticated USING (true);
  -- 通知は本人のみ
  CREATE POLICY homes_notifications_self ON homes_notifications FOR SELECT TO authenticated
    USING (user_id IN (SELECT id FROM homes_users WHERE auth_user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- updated_at triggers (既存 homes_set_updated_at 関数を流用)
-- ============================================================
DROP TRIGGER IF EXISTS trg_homes_settings_updated ON homes_settings;
CREATE TRIGGER trg_homes_settings_updated
  BEFORE UPDATE ON homes_settings
  FOR EACH ROW EXECUTE FUNCTION homes_set_updated_at();

DROP TRIGGER IF EXISTS trg_homes_dispatch_rules_updated ON homes_dispatch_rules;
CREATE TRIGGER trg_homes_dispatch_rules_updated
  BEFORE UPDATE ON homes_dispatch_rules
  FOR EACH ROW EXECUTE FUNCTION homes_set_updated_at();

-- ============================================================
-- pg_cron schedules (毎朝7:00 JST = 22:00 UTC)
-- 注意: pg_cron 拡張が有効でない場合はスキップ
-- ============================================================
DO $$
BEGIN
  -- AI割り振り 毎朝7:00 JST
  PERFORM cron.schedule(
    'homes_dispatch_morning',
    '0 22 * * *',
    $cron$ SELECT net.http_post(
      url := current_setting('app.dispatch_function_url', true),
      headers := '{"Content-Type":"application/json"}'::jsonb,
      body := '{}'::jsonb
    ) $cron$
  );

  -- 2ヶ月再審査自動オフ 毎日3:00 JST = 18:00 UTC
  PERFORM cron.schedule(
    'homes_audit_recheck_off',
    '0 18 * * *',
    $cron$
      UPDATE homes_collections
         SET recheck_required = false,
             recheck_auto_off_at = now()
       WHERE recheck_required = true
         AND audit_request_date IS NOT NULL
         AND audit_request_date < (now() - interval '2 months');
    $cron$
  );

EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron not available, skipping schedule registration';
END $$;

-- ============================================================
-- View: 個人ダッシュボード強化 (過去6ヶ月)
-- ============================================================
CREATE OR REPLACE VIEW homes_v_personal_6months AS
SELECT
  u.id AS user_id,
  u.name AS user_name,
  u.role,
  date_trunc('month', a.call_started_at AT TIME ZONE 'Asia/Tokyo') AS month,
  COUNT(*) FILTER (WHERE a.call_started_at IS NOT NULL) AS calls,
  COUNT(*) FILTER (WHERE a.result_primary = 'contact') AS contacts,
  COUNT(*) FILTER (WHERE a.result_secondary = 'appointment') AS appointments,
  COUNT(DISTINCT o.id) FILTER (WHERE o.ordered_at IS NOT NULL) AS orders,
  SUM(o.initial_fee) AS initial_fee_total,
  SUM(o.monthly_fee) AS monthly_fee_total
FROM homes_users u
LEFT JOIN homes_activities a ON a.user_id = u.id
  AND a.call_started_at >= (now() - interval '6 months')
LEFT JOIN homes_orders o ON o.closer_user_id = u.id
  AND date_trunc('month', o.ordered_at AT TIME ZONE 'Asia/Tokyo')
    = date_trunc('month', a.call_started_at AT TIME ZONE 'Asia/Tokyo')
GROUP BY u.id, u.name, u.role, date_trunc('month', a.call_started_at AT TIME ZONE 'Asia/Tokyo');

GRANT SELECT ON homes_v_personal_6months TO authenticated;

-- ============================================================
-- View: hourly 行動管理表 (時間別ピボット)
-- ============================================================
CREATE OR REPLACE VIEW homes_v_activity_hourly AS
SELECT
  date_trunc('hour', a.call_started_at AT TIME ZONE 'Asia/Tokyo') AS hour,
  a.user_id,
  u.name AS user_name,
  u.team_id,
  COUNT(*) AS calls,
  COUNT(*) FILTER (WHERE a.result_primary = 'contact') AS contacts,
  COUNT(*) FILTER (WHERE a.result_secondary = 'appointment') AS appointments,
  COUNT(*) FILTER (WHERE a.result_primary = 'no_answer') AS no_answers,
  COUNT(*) FILTER (WHERE a.result_primary = 'absent') AS absents,
  COUNT(*) FILTER (WHERE a.result_secondary = 'ng') AS ngs
FROM homes_activities a
JOIN homes_users u ON u.id = a.user_id
WHERE a.call_started_at >= (now() - interval '7 days')
GROUP BY date_trunc('hour', a.call_started_at AT TIME ZONE 'Asia/Tokyo'),
         a.user_id, u.name, u.team_id;

GRANT SELECT ON homes_v_activity_hourly TO authenticated;

-- ============================================================
-- DONE
-- ============================================================
