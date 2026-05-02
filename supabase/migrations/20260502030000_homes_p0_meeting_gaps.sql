-- ====================================================================
-- TOGUNA HOME'S — 2026-04-24 議事録反映 P0 マイグレーション
-- 6/1 全ユーザー移行ブロッカー対応
-- ====================================================================

-- ----------------------------------------------------------------
-- G-01: 免許番号を重複削除キー化
-- 例: 「福岡県知事免許 (09)第010303号」→
--   license_authority='福岡県知事', license_no_base='010303'
-- 更新回数(09)は除外して本体番号のみ。同一企業の免許更新で番号が増えない。
-- ----------------------------------------------------------------
ALTER TABLE homes_companies
  ADD COLUMN IF NOT EXISTS license_authority TEXT,        -- 「福岡県知事」「国土交通大臣」
  ADD COLUMN IF NOT EXISTS license_no_base TEXT,          -- 「010303」(更新回数除く)
  ADD COLUMN IF NOT EXISTS license_renewal_count INTEGER; -- 「9」(参考)

CREATE UNIQUE INDEX IF NOT EXISTS idx_homes_companies_license_unique
  ON homes_companies (license_authority, license_no_base)
  WHERE license_authority IS NOT NULL AND license_no_base IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_homes_companies_license_authority
  ON homes_companies (license_authority);

-- ----------------------------------------------------------------
-- G-08: 業態フラグ (賃貸仲介/売買仲介/管理) — 必須化前提
-- 既存テーブルに main_business 列があるが単一値なので、boolean 3列を追加
-- 14万件投入後にバリデーションを有効化する想定で、初期は NULL 許可
-- ----------------------------------------------------------------
ALTER TABLE homes_companies
  ADD COLUMN IF NOT EXISTS f_rent_brokerage BOOLEAN,       -- 賃貸仲介
  ADD COLUMN IF NOT EXISTS f_sales_brokerage BOOLEAN,      -- 売買仲介
  ADD COLUMN IF NOT EXISTS f_management BOOLEAN,           -- 管理
  ADD COLUMN IF NOT EXISTS f_sales BOOLEAN;                -- 売買 (新築/中古販売)

CREATE INDEX IF NOT EXISTS idx_homes_companies_business_flags
  ON homes_companies (f_rent_brokerage, f_sales_brokerage, f_management);

-- ----------------------------------------------------------------
-- G-07: リスト 40 種類の種類マーク (多対多)
-- マスター企業 1 行に対して、過去掲載/新規開拓/旧リスト/etc. を複数マーク
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS homes_list_kinds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,            -- 'past_listed' | 'new_open' | 'legacy' ...
  name TEXT NOT NULL,                   -- 表示名
  axis TEXT CHECK (axis IN ('past_listed','new_open','other')),
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS homes_company_list_marks (
  company_id UUID NOT NULL REFERENCES homes_companies(id) ON DELETE CASCADE,
  list_kind_id UUID NOT NULL REFERENCES homes_list_kinds(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (company_id, list_kind_id)
);
CREATE INDEX IF NOT EXISTS idx_homes_company_list_marks_kind
  ON homes_company_list_marks (list_kind_id);

-- 初期 list_kinds (議事録: 40 種類予定だが代表的なもの先行)
INSERT INTO homes_list_kinds (code, name, axis, sort_order) VALUES
  ('past_listed_athome',   '過去掲載 (athome)',  'past_listed', 10),
  ('past_listed_homes',    '過去掲載 (HOME''S)', 'past_listed', 11),
  ('past_listed_suumo',    '過去掲載 (SUUMO)',   'past_listed', 12),
  ('new_open_recent',      '新規開業 (直近1年)', 'new_open',    20),
  ('new_open_3y',          '新規開業 (3年以内)', 'new_open',    21),
  ('legacy_list',          '旧リスト',           'other',       30),
  ('referral',             '紹介',               'other',       31)
ON CONFLICT (code) DO NOTHING;

-- ----------------------------------------------------------------
-- G-02: アポ成立 4 点バリデーション用 — 決済者フラグ
-- 既存 attack_target は事前ターゲット用なので、商談時の実情を別カラムで持つ
-- ----------------------------------------------------------------
ALTER TABLE homes_deals
  ADD COLUMN IF NOT EXISTS decision_maker_status TEXT
    CHECK (decision_maker_status IN ('decision_maker','contact_person','unknown')),
  ADD COLUMN IF NOT EXISTS appointment_email TEXT,
  ADD COLUMN IF NOT EXISTS appointment_contact_name TEXT;

-- 4点が揃った時点で appointment_validated が TRUE になる generated column
ALTER TABLE homes_deals
  ADD COLUMN IF NOT EXISTS appointment_validated BOOLEAN
    GENERATED ALWAYS AS (
      appointed_at IS NOT NULL
      AND appointment_contact_name IS NOT NULL AND appointment_contact_name <> ''
      AND appointment_email IS NOT NULL AND appointment_email <> ''
      AND decision_maker_status IS NOT NULL
    ) STORED;

CREATE INDEX IF NOT EXISTS idx_homes_deals_validated
  ON homes_deals (appointment_validated)
  WHERE appointment_validated = TRUE;

-- ----------------------------------------------------------------
-- G-03: 不在時の必須入力 (先方氏名・折返し時間)
-- ----------------------------------------------------------------
ALTER TABLE homes_activities
  ADD COLUMN IF NOT EXISTS recipient_name TEXT,                              -- 先方氏名
  ADD COLUMN IF NOT EXISTS callback_window TEXT                              -- 'morning'|'afternoon'|'evening'|'unconfirmed'
    CHECK (callback_window IN ('morning','afternoon','evening','unconfirmed')),
  ADD COLUMN IF NOT EXISTS unanswered_consecutive INTEGER DEFAULT 0;         -- G-04 連続無応答カウント用

-- ----------------------------------------------------------------
-- G-04: 無応答 10 回で自動低優先度降格 (trigger)
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION homes_unanswered_demote_trigger()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.outcome = 'unanswered' THEN
    UPDATE homes_companies
       SET score_priority = LEAST(COALESCE(score_priority, 3) + 1, 5)
     WHERE id = NEW.company_id
       AND (
         SELECT COUNT(*) FROM homes_activities
          WHERE company_id = NEW.company_id
            AND outcome = 'unanswered'
            AND created_at > NOW() - INTERVAL '30 days'
       ) >= 10;
  ELSE
    -- 別のアウトカム入ったらカウントリセット (連続性が切れる)
    UPDATE homes_companies SET score_priority = score_priority WHERE id = NEW.company_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_homes_unanswered_demote ON homes_activities;
CREATE TRIGGER trg_homes_unanswered_demote
  AFTER INSERT ON homes_activities
  FOR EACH ROW EXECUTE FUNCTION homes_unanswered_demote_trigger();

-- ----------------------------------------------------------------
-- G-10: 申込書 PDF アップロード
-- ----------------------------------------------------------------
ALTER TABLE homes_orders
  ADD COLUMN IF NOT EXISTS application_form_url TEXT,
  ADD COLUMN IF NOT EXISTS application_form_uploaded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS application_form_notified_at TIMESTAMPTZ;

-- ----------------------------------------------------------------
-- G-11/G-12: 通知 + 行動管理表 (events 統合テーブル)
-- activity-timeline-feed パターン
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS homes_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_type TEXT NOT NULL,                  -- 'company' | 'deal' | 'collection' | 'order'
  parent_id UUID NOT NULL,
  actor_id UUID REFERENCES auth.users(id),
  type TEXT NOT NULL,                         -- 'call' | 'appointment' | 'meeting' | 'order' | 'audit' | 'note'
  outcome TEXT,                               -- 'connected' | 'unanswered' | 'rejected' | 'appointed' | ...
  title TEXT NOT NULL,
  body TEXT,
  metadata JSONB DEFAULT '{}',
  scheduled_for TIMESTAMPTZ,                  -- ネクストアクション予定 (G-11)
  notified_at TIMESTAMPTZ,                    -- 5分前ポップアップ送信済時刻
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_homes_events_parent
  ON homes_events (parent_type, parent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_homes_events_actor_time
  ON homes_events (actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_homes_events_scheduled
  ON homes_events (scheduled_for)
  WHERE scheduled_for IS NOT NULL AND notified_at IS NULL;

-- 行動管理表ビュー (時間軸 × メンバー)
CREATE OR REPLACE VIEW homes_v_activity_timeline AS
SELECT
  e.id,
  e.actor_id,
  u.name AS actor_name,
  e.parent_type,
  e.parent_id,
  e.type,
  e.outcome,
  e.title,
  e.body,
  e.metadata,
  e.scheduled_for,
  e.created_at,
  DATE(e.created_at AT TIME ZONE 'Asia/Tokyo') AS day_jst,
  EXTRACT(HOUR FROM e.created_at AT TIME ZONE 'Asia/Tokyo') AS hour_jst
FROM homes_events e
LEFT JOIN homes_users u ON u.id = e.actor_id;

-- ----------------------------------------------------------------
-- G-13: 申込承認日から 2 ヶ月経過で再審査チェック自動オフ
-- background-jobs-queue / cron で日次実行する用フラグ列
-- ----------------------------------------------------------------
ALTER TABLE homes_collections
  ADD COLUMN IF NOT EXISTS audit_approved_at TIMESTAMPTZ,    -- 申込承認日
  ADD COLUMN IF NOT EXISTS audit_revalidate_required BOOLEAN DEFAULT FALSE;

CREATE OR REPLACE FUNCTION homes_audit_revalidate_check()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  UPDATE homes_collections
     SET audit_revalidate_required = TRUE
   WHERE audit_result = 'ok'
     AND audit_approved_at IS NOT NULL
     AND audit_approved_at < NOW() - INTERVAL '2 months'
     AND status NOT IN ('won','lost');
END;
$$;

-- ----------------------------------------------------------------
-- G-17: AI スコアリング (将来拡張用、列のみ先行)
-- ----------------------------------------------------------------
ALTER TABLE homes_companies
  ADD COLUMN IF NOT EXISTS ai_score NUMERIC,                  -- 0-100
  ADD COLUMN IF NOT EXISTS ai_score_axis TEXT                 -- 'past_listed' | 'new_open'
    CHECK (ai_score_axis IN ('past_listed','new_open')),
  ADD COLUMN IF NOT EXISTS ai_score_reason JSONB,             -- ルールヒット結果
  ADD COLUMN IF NOT EXISTS ai_scored_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_homes_companies_ai_score
  ON homes_companies (ai_score DESC NULLS LAST)
  WHERE ai_score IS NOT NULL;

-- ----------------------------------------------------------------
-- RLS (supabase-rls-architect パターン)
-- 新規テーブルに RLS を有効化 (既存 homes_users が tenant 認証済前提)
-- ----------------------------------------------------------------
ALTER TABLE homes_list_kinds ENABLE ROW LEVEL SECURITY;
ALTER TABLE homes_company_list_marks ENABLE ROW LEVEL SECURITY;
ALTER TABLE homes_events ENABLE ROW LEVEL SECURITY;

-- list_kinds: 全社員参照可、編集はマネージャ以上
DROP POLICY IF EXISTS "list_kinds_select_all" ON homes_list_kinds;
CREATE POLICY "list_kinds_select_all" ON homes_list_kinds FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "list_kinds_modify_manager" ON homes_list_kinds;
CREATE POLICY "list_kinds_modify_manager" ON homes_list_kinds FOR ALL
  USING (EXISTS (SELECT 1 FROM homes_users WHERE id = auth.uid() AND role IN ('admin','manager')))
  WITH CHECK (EXISTS (SELECT 1 FROM homes_users WHERE id = auth.uid() AND role IN ('admin','manager')));

-- company_list_marks: 認証済全員参照、編集も全員 (リスト割当作業)
DROP POLICY IF EXISTS "list_marks_select_all" ON homes_company_list_marks;
CREATE POLICY "list_marks_select_all" ON homes_company_list_marks FOR SELECT
  USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "list_marks_modify_all" ON homes_company_list_marks;
CREATE POLICY "list_marks_modify_all" ON homes_company_list_marks FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- events: 認証済全員参照、INSERT は自分のみ
DROP POLICY IF EXISTS "events_select_all" ON homes_events;
CREATE POLICY "events_select_all" ON homes_events FOR SELECT
  USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "events_insert_self" ON homes_events;
CREATE POLICY "events_insert_self" ON homes_events FOR INSERT
  WITH CHECK (actor_id = auth.uid() OR auth.role() = 'service_role');

COMMENT ON TABLE homes_list_kinds IS 'G-07 リスト 40 種類マスタ';
COMMENT ON TABLE homes_company_list_marks IS 'G-07 マスター企業×リスト種類の多対多';
COMMENT ON TABLE homes_events IS 'G-11/G-12 行動管理表用 events 統合テーブル';
COMMENT ON COLUMN homes_companies.license_no_base IS 'G-01 免許番号(更新回数除く)を重複削除キーに使用';
COMMENT ON COLUMN homes_deals.appointment_validated IS 'G-02 4点バリデーション結果 generated';
COMMENT ON COLUMN homes_activities.recipient_name IS 'G-03 不在時必須入力 先方氏名';
COMMENT ON COLUMN homes_activities.callback_window IS 'G-03 折返し時間帯 (時刻指定はしない)';
COMMENT ON COLUMN homes_orders.application_form_url IS 'G-10 申込書PDF Storage URL';
COMMENT ON COLUMN homes_collections.audit_revalidate_required IS 'G-13 2ヶ月経過で TRUE';
