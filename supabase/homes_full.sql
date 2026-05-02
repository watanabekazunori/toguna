-- =====================================================================
-- TOGUNA HOME'S 仕様スキーマ (REQUIREMENTS / v1.0)
-- 発行日: 2026-05-02
-- 11 エンティティ + 補助テーブル
-- prefix: homes_  (既存 toguna スキーマと衝突回避)
-- =====================================================================

-- ====== 拡張 ======
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================================
-- 1. homes_teams (チーム)  -- 石川/藤井/栗原
-- =====================================================================
CREATE TABLE IF NOT EXISTS homes_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  leader_user_id UUID,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================================
-- 2. homes_users (稼働メンバー)
--    role: APPOINTER / CLOSER / COLLECTOR / SV / PM / ADMIN
-- =====================================================================
CREATE TABLE IF NOT EXISTS homes_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID UNIQUE,        -- Supabase auth.users 連携
  email TEXT UNIQUE,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('APPOINTER','CLOSER','COLLECTOR','SV','PM','ADMIN')),
  team_id UUID REFERENCES homes_teams(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT TRUE,
  zoom_phone_user_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE homes_teams
  DROP CONSTRAINT IF EXISTS homes_teams_leader_fk,
  ADD CONSTRAINT homes_teams_leader_fk
    FOREIGN KEY (leader_user_id) REFERENCES homes_users(id) ON DELETE SET NULL;

-- =====================================================================
-- 3. homes_areas (エリアマスタ)
-- =====================================================================
CREATE TABLE IF NOT EXISTS homes_areas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prefecture TEXT NOT NULL,
  city TEXT,
  is_priority_area BOOLEAN DEFAULT FALSE,           -- 特定優先エリア(値引き反響半額)
  is_new_approval_area BOOLEAN DEFAULT FALSE,       -- 新稟議対象エリア
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (prefecture, city)
);

-- =====================================================================
-- 4. homes_lists (リスト分類)  -- スーモ④/旧令和/Renovi派生 等
-- =====================================================================
CREATE TABLE IF NOT EXISTS homes_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  source TEXT,                                       -- 由来 (suumo/reiwa/renovi/manual等)
  description TEXT,
  total_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  imported_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================================
-- 5. homes_approvals (稟議番号マスタ)
-- =====================================================================
CREATE TABLE IF NOT EXISTS homes_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  approval_no TEXT NOT NULL UNIQUE,                  -- 例: KNP2025000101
  title TEXT,
  discount_rate NUMERIC,                             -- 値引率 (0-1)
  discount_amount INTEGER,                           -- 値引額 (円)
  applicable_area_ids UUID[] DEFAULT '{}',           -- 対象エリア
  valid_from DATE,
  valid_until DATE,
  is_active BOOLEAN DEFAULT TRUE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================================
-- 6. homes_companies (法人マスタ)  -- M1 リスト管理
--    14万件規模対応
-- =====================================================================
CREATE TABLE IF NOT EXISTS homes_companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 基本
  phone TEXT NOT NULL,
  company_name TEXT NOT NULL,
  fc_name TEXT,                                      -- FC名
  list_id UUID REFERENCES homes_lists(id) ON DELETE SET NULL,
  area TEXT,
  prefecture TEXT,
  city TEXT,
  address TEXT,

  -- 企業属性
  listing_status TEXT,                               -- 上場区分
  company_grade TEXT,                                -- 法人グレード
  established_at DATE,                               -- 設立年月日
  capital BIGINT,                                    -- 資本金(円)
  revenue BIGINT,                                    -- 売上高(円)
  employees INTEGER,                                 -- 従業員数

  first_license_date DATE,                           -- 最初免許年月日
  takken_license_no TEXT,                            -- 宅建免許番号
  homepage TEXT,
  closed_days TEXT,                                  -- 定休日

  -- コール状態
  last_call_at TIMESTAMPTZ,                          -- 最終発信日時
  call_restriction TEXT CHECK (call_restriction IN ('none','closed_business','current_announcer','duplicate_list','existing','lh_following')) DEFAULT 'none',
  call_count INTEGER DEFAULT 0,                      -- 発信数

  -- 代表者
  representative_name TEXT,
  representative_phone TEXT,
  representative_email TEXT,

  -- 担当者
  contact_person_name TEXT,
  contact_person_phone TEXT,
  contact_person_email TEXT,

  -- アタック
  attack_target TEXT CHECK (attack_target IN ('representative','decision_maker','contact_person')),
  prev_list_contact TEXT,                            -- 前リストコンタクト先

  -- 媒体利用状況
  homes_usage TEXT,
  athome_rent_count INTEGER DEFAULT 0,
  athome_sale_count INTEGER DEFAULT 0,
  suumo_rent_count INTEGER DEFAULT 0,
  suumo_sale_count INTEGER DEFAULT 0,
  other_media TEXT,
  bulk_quote_media TEXT,
  other_services TEXT,

  -- 担当スタッフ
  staff_name TEXT,
  staff_email TEXT,

  -- 業態
  main_business TEXT,                                -- 賃貸管理/賃貸仲介/売買仲介/売買買取/実需/収益/事業

  -- スコア (4項目の自動算出枠)
  score_quality NUMERIC,
  score_size NUMERIC,
  score_potential NUMERIC,
  score_priority INTEGER,                            -- 優先度 (1=最高 ~ 5=最低)

  -- 担当割当
  assigned_user_id UUID REFERENCES homes_users(id) ON DELETE SET NULL,

  -- ステータス
  call_state TEXT DEFAULT 'untouched'                -- 未着手→発信済→通電→コンタクト→アポ獲得/NG/再架電予約
    CHECK (call_state IN ('untouched','dialed','connected','contacted','appointed','ng','recall_scheduled')),

  status_note TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_homes_companies_phone ON homes_companies(phone);
CREATE INDEX IF NOT EXISTS idx_homes_companies_takken ON homes_companies(takken_license_no);
CREATE INDEX IF NOT EXISTS idx_homes_companies_list ON homes_companies(list_id);
CREATE INDEX IF NOT EXISTS idx_homes_companies_pref_city ON homes_companies(prefecture, city);
CREATE INDEX IF NOT EXISTS idx_homes_companies_call_restriction ON homes_companies(call_restriction);
CREATE INDEX IF NOT EXISTS idx_homes_companies_call_state ON homes_companies(call_state);
CREATE INDEX IF NOT EXISTS idx_homes_companies_priority ON homes_companies(score_priority);
CREATE INDEX IF NOT EXISTS idx_homes_companies_last_call ON homes_companies(last_call_at);
CREATE INDEX IF NOT EXISTS idx_homes_companies_name_trgm ON homes_companies USING gin (company_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_homes_companies_assigned ON homes_companies(assigned_user_id);

-- =====================================================================
-- 7. homes_activities (コール1件のジャーナル)  -- M2
-- =====================================================================
CREATE TABLE IF NOT EXISTS homes_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES homes_companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES homes_users(id) ON DELETE RESTRICT,

  call_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  call_ended_at TIMESTAMPTZ,
  call_duration_sec INTEGER,
  recording_url TEXT,
  zoom_call_id TEXT,

  -- 結果1段階目: 無応答/未通電 / 不在 / 受付NG / コンタクト
  result_primary TEXT NOT NULL CHECK (result_primary IN ('no_answer','absent','reception_ng','contact')),

  -- コンタクト時必須: 応対者
  responder_role TEXT CHECK (responder_role IN ('representative','decision_maker','contact_person')),
  responder_name TEXT,                                -- 架電先人物名

  -- 結果2段階目: アポ / アポネタ / 再架電 / 資料送付 / NG
  result_secondary TEXT CHECK (result_secondary IN ('appointment','lead','recall','document_send','ng')),

  -- アポ詳細 (result_secondary = appointment 時)
  appointment_date DATE,
  appointment_time TIME,
  appointment_type TEXT CHECK (appointment_type IN ('phone','web')),
  closer_user_id UUID REFERENCES homes_users(id) ON DELETE SET NULL,
  appointment_kind TEXT,                              -- 売買掲載アポ/賃貸掲載アポ/売却査定アポ/その他
  handover_memo TEXT,                                 -- 引継メモ
  appointment_status TEXT DEFAULT 'pending'           -- アポ調 / 確定アポ
    CHECK (appointment_status IN ('pending','confirmed')),

  -- 再架電 (result_secondary = recall 時)
  recall_date DATE,
  recall_time TIME,
  keep_assignee BOOLEAN DEFAULT TRUE,                 -- 担当者継続フラグ

  -- NG理由 (result_secondary = ng 時)
  ng_reason TEXT,                                     -- 掲載/仕入NG, 現状NG, 他媒体NG, 営業NG, 時期NG, 工数NG, 金額NG, HOMES_NG

  -- 資料送付 (result_secondary = document_send 時)
  document_send_target TEXT,                          -- 送付先メール

  -- ログ
  operator_log TEXT,                                  -- 自由記述: 発言録/印象/決裁感
  metadata JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_homes_activities_company ON homes_activities(company_id);
CREATE INDEX IF NOT EXISTS idx_homes_activities_user ON homes_activities(user_id);
CREATE INDEX IF NOT EXISTS idx_homes_activities_started_at ON homes_activities(call_started_at DESC);
CREATE INDEX IF NOT EXISTS idx_homes_activities_result ON homes_activities(result_primary, result_secondary);

-- =====================================================================
-- 8. homes_deals (案件)  -- M3
-- =====================================================================
CREATE TABLE IF NOT EXISTS homes_deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES homes_companies(id) ON DELETE CASCADE,
  list_id UUID REFERENCES homes_lists(id) ON DELETE SET NULL,

  -- アポ情報
  appointer_user_id UUID REFERENCES homes_users(id) ON DELETE SET NULL,
  closer_user_id UUID REFERENCES homes_users(id) ON DELETE SET NULL,
  appointed_at TIMESTAMPTZ NOT NULL,
  appointment_kind TEXT,                              -- アポ種類
  appointment_type TEXT CHECK (appointment_type IN ('phone','web')),
  appointment_status TEXT CHECK (appointment_status IN ('pending','confirmed')),
  attack_target TEXT,
  contact_person_name TEXT,                           -- 先方氏名

  -- ステータス: 商談化 / リスケ / 消滅 / 失注 / 受注 / Cヨミ追客中
  status TEXT NOT NULL DEFAULT 'meeting_scheduled'
    CHECK (status IN ('meeting_scheduled','rescheduled','disappeared','lost','won','c_yomi_following')),

  reschedule_count INTEGER DEFAULT 0,
  reschedule_reason TEXT,
  disappear_reason TEXT,

  -- 最新派生フィールド
  latest_meeting_id UUID,                             -- (FK後付け)
  latest_meeting_at TIMESTAMPTZ,
  latest_yomi TEXT,                                   -- 受注/A〇/A/B〇/B/C/D/失注
  contact_count INTEGER DEFAULT 0,                    -- 対応回数 (商談履歴回数)

  -- 補助
  priority INTEGER,
  category TEXT,
  count INTEGER,
  notes TEXT,                                         -- 掲載ヒアリング: 過去利用/ニーズ/商談方法/アポフック

  -- 稟議
  approval_id UUID REFERENCES homes_approvals(id) ON DELETE SET NULL,
  is_priority_area BOOLEAN DEFAULT FALSE,             -- 特定優先

  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_homes_deals_company ON homes_deals(company_id);
CREATE INDEX IF NOT EXISTS idx_homes_deals_status ON homes_deals(status);
CREATE INDEX IF NOT EXISTS idx_homes_deals_closer ON homes_deals(closer_user_id);
CREATE INDEX IF NOT EXISTS idx_homes_deals_appointer ON homes_deals(appointer_user_id);
CREATE INDEX IF NOT EXISTS idx_homes_deals_appointed_at ON homes_deals(appointed_at DESC);
CREATE INDEX IF NOT EXISTS idx_homes_deals_latest_yomi ON homes_deals(latest_yomi);

-- =====================================================================
-- 9. homes_meetings (商談1件)  -- M4
-- =====================================================================
CREATE TABLE IF NOT EXISTS homes_meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES homes_deals(id) ON DELETE CASCADE,
  closer_user_id UUID REFERENCES homes_users(id) ON DELETE SET NULL,
  meeting_seq INTEGER NOT NULL DEFAULT 1,             -- 1〜10

  scheduled_at TIMESTAMPTZ,
  meeting_type TEXT CHECK (meeting_type IN ('phone','web')),

  -- 商談化: 商談 / リスケ / 消滅
  status TEXT NOT NULL CHECK (status IN ('done','rescheduled','disappeared')),

  contact_person_name TEXT,
  contact_person_role TEXT,                           -- 役職
  meeting_content TEXT,                               -- 商談内容(自由記述)
  next_content TEXT,                                  -- NEXT内容
  next_date DATE,                                     -- NEXT日

  -- 商談結果
  meeting_result TEXT,                                -- NG/OK
  ng_reason TEXT,                                     -- 掲載金額NG等

  -- 提案プラン
  proposal_plan TEXT,                                 -- 問い合わせ課金プラン/掲載課金プラン/業務支援プラン/新築戸建てプラン
  sale_slot_count INTEGER,                            -- 売買枠数
  rent_slot_count INTEGER,                            -- 賃貸枠数
  options TEXT[],                                     -- OP (パノラマ掲載×2 等)

  -- 売却査定
  appraisal_max_count INTEGER,
  appraisal_types TEXT[],                             -- マンション/戸建て/土地/区分マンション/一棟MS・アパート

  -- 金額
  initial_fee BIGINT,                                 -- イニシャル金額
  running_fee BIGINT,                                 -- ランニング金額
  running_discount_period_months INTEGER,             -- ランニング値引き期間

  -- ヨミ
  yomi TEXT CHECK (yomi IN ('won','A_circle','A','B_circle','B','C','D','lost')),
  yomi_rate NUMERIC,                                  -- ヨミ受注率 (派生キャッシュ)

  -- 課題合意・審査連携
  issue_agreement TEXT,
  meeting_period TEXT,                                -- 商談時期
  audit_date DATE,                                    -- 審査
  b_yomi_date DATE,                                   -- Bヨミ日
  a_yomi_date DATE,                                   -- Aヨミ日
  won_date DATE,                                      -- 受注日
  lost_date DATE,                                     -- 失注日
  lost_reason TEXT,

  -- 稟議
  approval_id UUID REFERENCES homes_approvals(id) ON DELETE SET NULL,

  created_by UUID REFERENCES homes_users(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_homes_meetings_deal ON homes_meetings(deal_id);
CREATE INDEX IF NOT EXISTS idx_homes_meetings_closer ON homes_meetings(closer_user_id);
CREATE INDEX IF NOT EXISTS idx_homes_meetings_scheduled ON homes_meetings(scheduled_at);

-- 後付けFK
ALTER TABLE homes_deals
  DROP CONSTRAINT IF EXISTS homes_deals_latest_meeting_fk,
  ADD CONSTRAINT homes_deals_latest_meeting_fk
    FOREIGN KEY (latest_meeting_id) REFERENCES homes_meetings(id) ON DELETE SET NULL;

-- =====================================================================
-- 10. homes_collections (回収案件)  -- M5
-- =====================================================================
CREATE TABLE IF NOT EXISTS homes_collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL UNIQUE REFERENCES homes_deals(id) ON DELETE CASCADE,
  meeting_id UUID REFERENCES homes_meetings(id) ON DELETE SET NULL,

  collector_user_id UUID REFERENCES homes_users(id) ON DELETE SET NULL,
  ba_remind_user_id UUID REFERENCES homes_users(id) ON DELETE SET NULL,

  -- リマインド
  ba_remind_date DATE,
  ba_remind_time TIME,
  confirm_mail_sent_at TIMESTAMPTZ,
  application_mail_sent_at TIMESTAMPTZ,
  expected_return_date DATE,
  irregular_handling BOOLEAN DEFAULT FALSE,
  collection_can_advance BOOLEAN DEFAULT TRUE,

  -- 審査
  audit_request_date DATE,
  audit_document_no TEXT,                             -- KNP/202600046289 等
  audit_result TEXT CHECK (audit_result IN ('pending','ok','exempt','ng')),
  billing_month DATE,
  ftp_status TEXT,
  audit_issue TEXT,
  dw_stored_at DATE,

  -- LIFULL 提出ブロック (受注確定時)
  lifull_payload JSONB DEFAULT '{}',

  -- ステータス: 発生→リマ予定→確認メール→申込書送付→返送予定→申請(審査)→審査結果→受注確定/失注
  status TEXT NOT NULL DEFAULT 'opened'
    CHECK (status IN ('opened','remind_set','confirm_sent','application_sent','return_pending','audit_requested','audit_done','won','lost')),

  is_anti_social_checked BOOLEAN DEFAULT FALSE,
  audit_progress TEXT,
  docu_status TEXT,
  cl_status TEXT,

  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_homes_collections_deal ON homes_collections(deal_id);
CREATE INDEX IF NOT EXISTS idx_homes_collections_collector ON homes_collections(collector_user_id);
CREATE INDEX IF NOT EXISTS idx_homes_collections_status ON homes_collections(status);
CREATE INDEX IF NOT EXISTS idx_homes_collections_remind_date ON homes_collections(ba_remind_date);

-- =====================================================================
-- 11. homes_orders (受注確定レコード)
-- =====================================================================
CREATE TABLE IF NOT EXISTS homes_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID UNIQUE REFERENCES homes_collections(id) ON DELETE CASCADE,
  deal_id UUID NOT NULL REFERENCES homes_deals(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES homes_companies(id) ON DELETE CASCADE,

  ordered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closer_user_id UUID REFERENCES homes_users(id) ON DELETE SET NULL,
  collector_user_id UUID REFERENCES homes_users(id) ON DELETE SET NULL,

  -- LIFULL 納品ブロック
  contact_block JSONB DEFAULT '{}',                   -- 担当者情報
  company_block JSONB DEFAULT '{}',                   -- 会社情報
  billing_block JSONB DEFAULT '{}',                   -- 請求案内
  appraisal_block JSONB DEFAULT '{}',                 -- 売却査定受注時
  other_block JSONB DEFAULT '{}',                     -- その他
  acceptance_block JSONB DEFAULT '{}',                -- 検収書記載

  monthly_discount_count INTEGER,                     -- 月額値引き数
  initial_fee BIGINT,
  monthly_fee BIGINT,
  location TEXT,
  list_price_billing_start_month DATE,                -- 定価反響料金発生月
  phone TEXT,
  mlit_no TEXT,                                       -- 国交省

  product_kind TEXT,                                  -- 賃貸反響課金/賃貸掲載/賃貸×売却/流通売却実名/流通匿名/業務支援/流通掲載×売却
  proposal_plan TEXT,
  approval_id UUID REFERENCES homes_approvals(id) ON DELETE SET NULL,

  lifull_opportunity_url TEXT,                        -- Salesforce URL
  lifull_docu_url TEXT,                               -- 申込書PDF URL

  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_homes_orders_company ON homes_orders(company_id);
CREATE INDEX IF NOT EXISTS idx_homes_orders_ordered_at ON homes_orders(ordered_at DESC);
CREATE INDEX IF NOT EXISTS idx_homes_orders_product ON homes_orders(product_kind);

-- =====================================================================
-- 12. homes_recall_queue (再架電キュー / 補助テーブル)
-- =====================================================================
CREATE TABLE IF NOT EXISTS homes_recall_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES homes_companies(id) ON DELETE CASCADE,
  scheduled_at TIMESTAMPTZ NOT NULL,
  assigned_user_id UUID REFERENCES homes_users(id) ON DELETE SET NULL,
  source_activity_id UUID REFERENCES homes_activities(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','done','cancelled')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_homes_recall_queue_scheduled ON homes_recall_queue(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_homes_recall_queue_assignee ON homes_recall_queue(assigned_user_id);

-- =====================================================================
-- 13. homes_audit_logs (監査ログ)
-- =====================================================================
CREATE TABLE IF NOT EXISTS homes_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES homes_users(id) ON DELETE SET NULL,
  entity TEXT NOT NULL,                               -- companies/activities/deals/meetings/collections/orders
  entity_id UUID NOT NULL,
  action TEXT NOT NULL,                               -- create/update/delete/status_change
  diff JSONB DEFAULT '{}',
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_homes_audit_entity ON homes_audit_logs(entity, entity_id);
CREATE INDEX IF NOT EXISTS idx_homes_audit_user ON homes_audit_logs(user_id);

-- =====================================================================
-- 14. ヨミ受注率マスタ (定義表)
-- =====================================================================
CREATE TABLE IF NOT EXISTS homes_yomi_rates (
  yomi TEXT PRIMARY KEY,
  rate NUMERIC NOT NULL,
  display_order INTEGER NOT NULL,
  description TEXT
);

INSERT INTO homes_yomi_rates (yomi, rate, display_order, description) VALUES
  ('won',      1.00, 1, '受注: 申込書回収完了'),
  ('A_circle', 0.95, 2, 'A〇: 申込書返送待ち'),
  ('A',        0.90, 3, 'A: 回収アポ取得済'),
  ('B_circle', 0.85, 4, 'B〇: 審査OK'),
  ('B',        0.80, 5, 'B: 口頭承諾'),
  ('C',        0.20, 6, 'C: 決裁権有・ネガなし月内回答'),
  ('D',        0.10, 7, 'D: 社内定義'),
  ('lost',     0.00, 8, '失注: 見送り確定')
ON CONFLICT (yomi) DO UPDATE
  SET rate = EXCLUDED.rate, display_order = EXCLUDED.display_order, description = EXCLUDED.description;

-- =====================================================================
-- 15. updated_at トリガー
-- =====================================================================
CREATE OR REPLACE FUNCTION homes_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'homes_teams','homes_users','homes_lists','homes_approvals',
    'homes_companies','homes_deals','homes_meetings','homes_collections','homes_orders'
  ])
  LOOP
    EXECUTE format('
      DROP TRIGGER IF EXISTS trg_%I_updated_at ON %I;
      CREATE TRIGGER trg_%I_updated_at
      BEFORE UPDATE ON %I
      FOR EACH ROW EXECUTE FUNCTION homes_set_updated_at();
    ', t, t, t, t);
  END LOOP;
END$$;

-- =====================================================================
-- 16. Activity → Company 状態同期トリガー
-- =====================================================================
CREATE OR REPLACE FUNCTION homes_sync_company_after_activity()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE homes_companies
  SET
    last_call_at = NEW.call_started_at,
    call_count = call_count + 1,
    call_state = CASE
      WHEN NEW.result_secondary = 'appointment' THEN 'appointed'
      WHEN NEW.result_secondary = 'ng' THEN 'ng'
      WHEN NEW.result_secondary = 'recall' THEN 'recall_scheduled'
      WHEN NEW.result_primary = 'contact' THEN 'contacted'
      WHEN NEW.result_primary IN ('absent','no_answer','reception_ng') THEN 'dialed'
      ELSE call_state
    END
  WHERE id = NEW.company_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_homes_activities_sync_company ON homes_activities;
CREATE TRIGGER trg_homes_activities_sync_company
AFTER INSERT ON homes_activities
FOR EACH ROW EXECUTE FUNCTION homes_sync_company_after_activity();

-- =====================================================================
-- 17. Activity 「アポ獲得」→ Deal 自動生成
-- =====================================================================
CREATE OR REPLACE FUNCTION homes_create_deal_on_appointment()
RETURNS TRIGGER AS $$
DECLARE
  v_list_id UUID;
BEGIN
  IF NEW.result_secondary = 'appointment' THEN
    SELECT list_id INTO v_list_id FROM homes_companies WHERE id = NEW.company_id;
    INSERT INTO homes_deals (
      company_id, list_id, appointer_user_id, closer_user_id,
      appointed_at, appointment_kind, appointment_type, appointment_status,
      contact_person_name, attack_target,
      status, contact_count
    ) VALUES (
      NEW.company_id, v_list_id, NEW.user_id, NEW.closer_user_id,
      COALESCE((NEW.appointment_date + COALESCE(NEW.appointment_time, '10:00'::TIME))::TIMESTAMPTZ, NOW()),
      NEW.appointment_kind, NEW.appointment_type, NEW.appointment_status,
      NEW.responder_name, NEW.responder_role,
      'meeting_scheduled', 0
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_homes_activities_create_deal ON homes_activities;
CREATE TRIGGER trg_homes_activities_create_deal
AFTER INSERT ON homes_activities
FOR EACH ROW EXECUTE FUNCTION homes_create_deal_on_appointment();

-- =====================================================================
-- 18. Meeting → Deal 派生フィールド更新
-- =====================================================================
CREATE OR REPLACE FUNCTION homes_sync_deal_after_meeting()
RETURNS TRIGGER AS $$
DECLARE
  v_rate NUMERIC;
BEGIN
  SELECT rate INTO v_rate FROM homes_yomi_rates WHERE yomi = NEW.yomi;
  IF v_rate IS NOT NULL THEN
    UPDATE homes_meetings SET yomi_rate = v_rate WHERE id = NEW.id;
  END IF;

  UPDATE homes_deals
  SET
    latest_meeting_id = NEW.id,
    latest_meeting_at = NEW.scheduled_at,
    latest_yomi = COALESCE(NEW.yomi, latest_yomi),
    contact_count = (SELECT COUNT(*) FROM homes_meetings WHERE deal_id = NEW.deal_id),
    status = CASE
      WHEN NEW.yomi = 'won' THEN 'won'
      WHEN NEW.yomi = 'lost' THEN 'lost'
      WHEN NEW.status = 'rescheduled' THEN 'rescheduled'
      WHEN NEW.status = 'disappeared' THEN 'disappeared'
      WHEN NEW.yomi = 'C' THEN 'c_yomi_following'
      ELSE 'meeting_scheduled'
    END
  WHERE id = NEW.deal_id;

  -- ヨミ B 以上で Collection を起動 (口頭受注以降)
  IF NEW.yomi IN ('B','B_circle','A','A_circle','won') THEN
    INSERT INTO homes_collections (deal_id, meeting_id, status)
    VALUES (NEW.deal_id, NEW.id, 'opened')
    ON CONFLICT (deal_id) DO UPDATE
      SET meeting_id = EXCLUDED.meeting_id,
          updated_at = NOW();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_homes_meetings_sync_deal ON homes_meetings;
CREATE TRIGGER trg_homes_meetings_sync_deal
AFTER INSERT OR UPDATE ON homes_meetings
FOR EACH ROW EXECUTE FUNCTION homes_sync_deal_after_meeting();

-- =====================================================================
-- 19. ダッシュボード派生ビュー
-- =====================================================================

-- 19-1: クール毎集計 (9コマ × ユーザー)
CREATE OR REPLACE VIEW homes_v_kuru_stats AS
SELECT
  date_trunc('day', call_started_at AT TIME ZONE 'Asia/Tokyo') AS work_date,
  user_id,
  -- クール: 1=09:00-09:59, 2=10:00, ... 9=17:30-18:30
  CASE
    WHEN extract(hour from call_started_at AT TIME ZONE 'Asia/Tokyo') < 10 THEN 1
    WHEN extract(hour from call_started_at AT TIME ZONE 'Asia/Tokyo') < 11 THEN 2
    WHEN extract(hour from call_started_at AT TIME ZONE 'Asia/Tokyo') < 12 THEN 3
    WHEN extract(hour from call_started_at AT TIME ZONE 'Asia/Tokyo') < 14 THEN 4   -- 13時開始
    WHEN extract(hour from call_started_at AT TIME ZONE 'Asia/Tokyo') < 15 THEN 5
    WHEN extract(hour from call_started_at AT TIME ZONE 'Asia/Tokyo') < 16 THEN 6
    WHEN extract(hour from call_started_at AT TIME ZONE 'Asia/Tokyo') < 17 THEN 7
    WHEN extract(hour from call_started_at AT TIME ZONE 'Asia/Tokyo') < 18 THEN 8
    ELSE 9
  END AS kuru,
  COUNT(*) AS calls,
  COUNT(*) FILTER (WHERE result_primary = 'contact') AS contacts,
  COUNT(*) FILTER (WHERE result_secondary = 'appointment') AS appointments
FROM homes_activities
GROUP BY 1, 2, 3;

-- 19-2: 個人別本日サマリー
CREATE OR REPLACE VIEW homes_v_today_personal AS
SELECT
  user_id,
  COUNT(*) AS calls_today,
  COUNT(*) FILTER (WHERE result_primary = 'contact') AS contacts_today,
  COUNT(*) FILTER (WHERE result_secondary = 'appointment') AS appointments_today,
  ROUND(
    COUNT(*) FILTER (WHERE result_primary = 'contact')::NUMERIC
    / NULLIF(COUNT(*),0) * 100, 1
  ) AS contact_rate_pct,
  ROUND(
    COUNT(*) FILTER (WHERE result_secondary = 'appointment')::NUMERIC
    / NULLIF(COUNT(*),0) * 100, 1
  ) AS appointment_rate_pct
FROM homes_activities
WHERE date_trunc('day', call_started_at AT TIME ZONE 'Asia/Tokyo')
    = date_trunc('day', NOW() AT TIME ZONE 'Asia/Tokyo')
GROUP BY user_id;

-- 19-3: ヨミ別件数 + 受注予測
CREATE OR REPLACE VIEW homes_v_yomi_forecast AS
SELECT
  d.latest_yomi AS yomi,
  COUNT(*) AS deal_count,
  yr.rate AS yomi_rate,
  ROUND(COUNT(*) * yr.rate, 1) AS expected_won_count
FROM homes_deals d
JOIN homes_yomi_rates yr ON yr.yomi = d.latest_yomi
WHERE d.status NOT IN ('lost','disappeared')
GROUP BY d.latest_yomi, yr.rate;

-- 19-4: チーム別実績
CREATE OR REPLACE VIEW homes_v_team_stats AS
SELECT
  t.id AS team_id,
  t.name AS team_name,
  COUNT(DISTINCT a.id) AS calls_total,
  COUNT(DISTINCT a.id) FILTER (WHERE a.result_primary = 'contact') AS contacts_total,
  COUNT(DISTINCT a.id) FILTER (WHERE a.result_secondary = 'appointment') AS appointments_total
FROM homes_teams t
LEFT JOIN homes_users u ON u.team_id = t.id
LEFT JOIN homes_activities a ON a.user_id = u.id
GROUP BY t.id, t.name;

-- 19-5: 月次サマリー
CREATE OR REPLACE VIEW homes_v_monthly_summary AS
SELECT
  date_trunc('month', a.call_started_at AT TIME ZONE 'Asia/Tokyo')::DATE AS month,
  COUNT(*) AS calls,
  COUNT(*) FILTER (WHERE a.result_primary = 'contact') AS contacts,
  COUNT(*) FILTER (WHERE a.result_secondary = 'appointment') AS appointments
FROM homes_activities a
GROUP BY 1;

-- =====================================================================
-- 20. 次架電先取得 RPC
-- =====================================================================
CREATE OR REPLACE FUNCTION homes_next_dial_target(
  p_user_id UUID,
  p_min_interval_hours INTEGER DEFAULT 24
)
RETURNS SETOF homes_companies AS $$
  SELECT *
  FROM homes_companies
  WHERE call_restriction = 'none'
    AND call_state NOT IN ('appointed','ng')
    AND (assigned_user_id = p_user_id OR assigned_user_id IS NULL)
    AND (last_call_at IS NULL OR last_call_at < NOW() - (p_min_interval_hours || ' hours')::INTERVAL)
  ORDER BY
    score_priority NULLS LAST,
    last_call_at NULLS FIRST
  LIMIT 1;
$$ LANGUAGE sql;

-- =====================================================================
-- 21. RLS (Phase 0: 緩く有効化、Phase 1+でロール厳格化)
-- =====================================================================
-- 当面はRLSオフ（既存togunaに合わせる）。アプリ層でロール検査。
-- 後続migrationで homes_users.auth_user_id ベースのRLSポリシーを追加する。

-- =====================================================================
-- 22. 種データ (チーム3つ + ヨミ表は既に投入済み)
-- =====================================================================
INSERT INTO homes_teams (name, display_order) VALUES
  ('石川チーム', 1),
  ('藤井チーム', 2),
  ('栗原チーム', 3)
ON CONFLICT DO NOTHING;
-- =====================================================================
-- TOGUNA HOME'S RLS ポリシー (Phase 1)
-- 発行日: 2026-05-02
-- 認証連携: homes_users.auth_user_id ↔ auth.users.id
-- =====================================================================

-- =====================================================================
-- helper: 現在のユーザー情報をJWTから取得 (ロール判定/team判定 高速化)
-- =====================================================================
CREATE OR REPLACE FUNCTION homes_current_user_id() RETURNS UUID
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id FROM homes_users WHERE auth_user_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION homes_current_user_role() RETURNS TEXT
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT role FROM homes_users WHERE auth_user_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION homes_is_admin() RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM homes_users
    WHERE auth_user_id = auth.uid() AND role IN ('ADMIN','PM','SV')
  );
$$;

-- =====================================================================
-- RLS 有効化
-- =====================================================================
ALTER TABLE homes_teams           ENABLE ROW LEVEL SECURITY;
ALTER TABLE homes_users           ENABLE ROW LEVEL SECURITY;
ALTER TABLE homes_areas           ENABLE ROW LEVEL SECURITY;
ALTER TABLE homes_lists           ENABLE ROW LEVEL SECURITY;
ALTER TABLE homes_approvals       ENABLE ROW LEVEL SECURITY;
ALTER TABLE homes_companies       ENABLE ROW LEVEL SECURITY;
ALTER TABLE homes_activities      ENABLE ROW LEVEL SECURITY;
ALTER TABLE homes_deals           ENABLE ROW LEVEL SECURITY;
ALTER TABLE homes_meetings        ENABLE ROW LEVEL SECURITY;
ALTER TABLE homes_collections     ENABLE ROW LEVEL SECURITY;
ALTER TABLE homes_orders          ENABLE ROW LEVEL SECURITY;
ALTER TABLE homes_yomi_rates      ENABLE ROW LEVEL SECURITY;

-- =====================================================================
-- マスタ系: 認証済みなら全員 SELECT 可。書込みは ADMIN/PM のみ
-- =====================================================================
CREATE POLICY "homes_teams_read" ON homes_teams FOR SELECT TO authenticated USING (true);
CREATE POLICY "homes_teams_write" ON homes_teams FOR ALL TO authenticated
  USING (homes_is_admin()) WITH CHECK (homes_is_admin());

CREATE POLICY "homes_users_read" ON homes_users FOR SELECT TO authenticated USING (true);
CREATE POLICY "homes_users_self_update" ON homes_users FOR UPDATE TO authenticated
  USING (auth_user_id = auth.uid() OR homes_is_admin())
  WITH CHECK (auth_user_id = auth.uid() OR homes_is_admin());
CREATE POLICY "homes_users_admin_write" ON homes_users FOR INSERT TO authenticated
  WITH CHECK (homes_is_admin());
CREATE POLICY "homes_users_admin_delete" ON homes_users FOR DELETE TO authenticated
  USING (homes_is_admin());

CREATE POLICY "homes_areas_read" ON homes_areas FOR SELECT TO authenticated USING (true);
CREATE POLICY "homes_areas_write" ON homes_areas FOR ALL TO authenticated
  USING (homes_is_admin()) WITH CHECK (homes_is_admin());

CREATE POLICY "homes_lists_read" ON homes_lists FOR SELECT TO authenticated USING (true);
CREATE POLICY "homes_lists_write" ON homes_lists FOR ALL TO authenticated
  USING (homes_is_admin()) WITH CHECK (homes_is_admin());

CREATE POLICY "homes_approvals_read" ON homes_approvals FOR SELECT TO authenticated USING (true);
CREATE POLICY "homes_approvals_write" ON homes_approvals FOR ALL TO authenticated
  USING (homes_is_admin()) WITH CHECK (homes_is_admin());

CREATE POLICY "homes_yomi_rates_read" ON homes_yomi_rates FOR SELECT TO authenticated USING (true);
CREATE POLICY "homes_yomi_rates_write" ON homes_yomi_rates FOR ALL TO authenticated
  USING (homes_is_admin()) WITH CHECK (homes_is_admin());

-- =====================================================================
-- companies: 認証済み全員に SELECT/UPDATE。INSERT/DELETE は ADMIN/PM
-- =====================================================================
CREATE POLICY "homes_companies_read" ON homes_companies FOR SELECT TO authenticated USING (true);
CREATE POLICY "homes_companies_update" ON homes_companies FOR UPDATE TO authenticated
  USING (true) WITH CHECK (true);
CREATE POLICY "homes_companies_admin_insert" ON homes_companies FOR INSERT TO authenticated
  WITH CHECK (homes_is_admin());
CREATE POLICY "homes_companies_admin_delete" ON homes_companies FOR DELETE TO authenticated
  USING (homes_is_admin());

-- =====================================================================
-- activities: 自分のものを書き込める。読みは全員。削除は ADMIN
-- =====================================================================
CREATE POLICY "homes_activities_read" ON homes_activities FOR SELECT TO authenticated USING (true);
CREATE POLICY "homes_activities_insert" ON homes_activities FOR INSERT TO authenticated
  WITH CHECK (user_id = homes_current_user_id() OR homes_is_admin());
CREATE POLICY "homes_activities_update" ON homes_activities FOR UPDATE TO authenticated
  USING (user_id = homes_current_user_id() OR homes_is_admin())
  WITH CHECK (user_id = homes_current_user_id() OR homes_is_admin());
CREATE POLICY "homes_activities_delete" ON homes_activities FOR DELETE TO authenticated
  USING (homes_is_admin());

-- =====================================================================
-- deals / meetings: 認証済み全員 read。書き込みはアサイン者 + ADMIN
-- =====================================================================
CREATE POLICY "homes_deals_read" ON homes_deals FOR SELECT TO authenticated USING (true);
CREATE POLICY "homes_deals_write" ON homes_deals FOR ALL TO authenticated
  USING (
    closer_user_id = homes_current_user_id()
    OR appointer_user_id = homes_current_user_id()
    OR homes_is_admin()
  )
  WITH CHECK (true);

CREATE POLICY "homes_meetings_read" ON homes_meetings FOR SELECT TO authenticated USING (true);
CREATE POLICY "homes_meetings_write" ON homes_meetings FOR ALL TO authenticated
  USING (
    closer_user_id = homes_current_user_id()
    OR created_by = homes_current_user_id()
    OR homes_is_admin()
  )
  WITH CHECK (true);

-- =====================================================================
-- collections: 回収アサイン者 + ADMIN/SV
-- =====================================================================
CREATE POLICY "homes_collections_read" ON homes_collections FOR SELECT TO authenticated USING (true);
CREATE POLICY "homes_collections_write" ON homes_collections FOR ALL TO authenticated
  USING (
    collector_user_id = homes_current_user_id()
    OR ba_remind_user_id = homes_current_user_id()
    OR homes_is_admin()
  )
  WITH CHECK (true);

-- =====================================================================
-- orders: 受注作成は CLOSER/COLLECTOR/ADMIN
-- =====================================================================
CREATE POLICY "homes_orders_read" ON homes_orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "homes_orders_insert" ON homes_orders FOR INSERT TO authenticated
  WITH CHECK (
    closer_user_id = homes_current_user_id()
    OR collector_user_id = homes_current_user_id()
    OR homes_is_admin()
  );
CREATE POLICY "homes_orders_update" ON homes_orders FOR UPDATE TO authenticated
  USING (
    closer_user_id = homes_current_user_id()
    OR collector_user_id = homes_current_user_id()
    OR homes_is_admin()
  )
  WITH CHECK (true);
CREATE POLICY "homes_orders_admin_delete" ON homes_orders FOR DELETE TO authenticated
  USING (homes_is_admin());

-- =====================================================================
-- View 単位の権限はベーステーブルRLSで担保される (security invoker)
-- =====================================================================
-- =====================================================================
-- TOGUNA HOME'S 種データ
-- 発行日: 2026-05-02
-- アポインター15 / クローザー4 / 回収2 / SV1-2 / PM1 / Admin1 = 23名構成
-- ※ auth_user_id は別途運用で紐付ける (Supabase Auth Sign Up 後 UPDATE)
-- =====================================================================

-- =====================================================================
-- 0. 補正: 法人テーブルの電話重複制御 (CSV インポートのキー)
--    schema migration 後に UNIQUE 制約を追加
-- =====================================================================
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'homes_companies_phone_key' AND conrelid = 'homes_companies'::regclass
  ) THEN
    ALTER TABLE homes_companies ADD CONSTRAINT homes_companies_phone_key UNIQUE (phone);
  END IF;
END $$;

-- =====================================================================
-- 1. エリア (関東 + 関西の主要都市 + 特定優先エリアフラグ)
-- =====================================================================
INSERT INTO homes_areas (prefecture, city, is_priority_area, is_new_approval_area, display_order) VALUES
  ('東京都', '千代田区', TRUE, TRUE, 1),
  ('東京都', '港区', TRUE, TRUE, 2),
  ('東京都', '渋谷区', TRUE, FALSE, 3),
  ('東京都', '新宿区', TRUE, FALSE, 4),
  ('東京都', '中央区', TRUE, FALSE, 5),
  ('東京都', '世田谷区', FALSE, FALSE, 6),
  ('神奈川県', '横浜市', TRUE, FALSE, 7),
  ('神奈川県', '川崎市', FALSE, FALSE, 8),
  ('埼玉県', 'さいたま市', FALSE, FALSE, 9),
  ('千葉県', '千葉市', FALSE, FALSE, 10),
  ('大阪府', '大阪市', TRUE, TRUE, 20),
  ('大阪府', '堺市', FALSE, FALSE, 21),
  ('京都府', '京都市', TRUE, FALSE, 22),
  ('兵庫県', '神戸市', TRUE, FALSE, 23),
  ('愛知県', '名古屋市', TRUE, FALSE, 30),
  ('福岡県', '福岡市', TRUE, FALSE, 40)
ON CONFLICT DO NOTHING;

-- =====================================================================
-- 2. ユーザー (23名 - auth_user_id は NULL で先に名簿登録)
--    Auth サインアップ後、ADMIN が auth_user_id をリンクする運用
-- =====================================================================
DO $$
DECLARE
  team_ishikawa UUID;
  team_fujii    UUID;
  team_kurihara UUID;
BEGIN
  SELECT id INTO team_ishikawa FROM homes_teams WHERE name = '石川チーム';
  SELECT id INTO team_fujii    FROM homes_teams WHERE name = '藤井チーム';
  SELECT id INTO team_kurihara FROM homes_teams WHERE name = '栗原チーム';

  -- ADMIN/PM (1+1)
  INSERT INTO homes_users (email, name, role, team_id, is_active) VALUES
    ('admin@toguna.test', '渡辺 (Admin)', 'ADMIN', NULL, TRUE),
    ('pm@toguna.test',    '田中PM',       'PM',    NULL, TRUE)
  ON CONFLICT (email) DO NOTHING;

  -- SV (2)
  INSERT INTO homes_users (email, name, role, team_id, is_active) VALUES
    ('sv1@toguna.test', '石川SV', 'SV', team_ishikawa, TRUE),
    ('sv2@toguna.test', '藤井SV', 'SV', team_fujii,    TRUE)
  ON CONFLICT (email) DO NOTHING;

  -- CLOSER (4)
  INSERT INTO homes_users (email, name, role, team_id, is_active) VALUES
    ('closer1@toguna.test', '川崎クローザー', 'CLOSER', team_ishikawa, TRUE),
    ('closer2@toguna.test', '中島クローザー', 'CLOSER', team_fujii,    TRUE),
    ('closer3@toguna.test', '佐藤クローザー', 'CLOSER', team_kurihara, TRUE),
    ('closer4@toguna.test', '高橋クローザー', 'CLOSER', team_kurihara, TRUE)
  ON CONFLICT (email) DO NOTHING;

  -- COLLECTOR (2)
  INSERT INTO homes_users (email, name, role, team_id, is_active) VALUES
    ('collector1@toguna.test', '吉田回収', 'COLLECTOR', NULL, TRUE),
    ('collector2@toguna.test', '伊藤回収', 'COLLECTOR', NULL, TRUE)
  ON CONFLICT (email) DO NOTHING;

  -- APPOINTER (15) - 各チーム5名ずつ
  INSERT INTO homes_users (email, name, role, team_id, is_active) VALUES
    ('app01@toguna.test', '山田アポ',   'APPOINTER', team_ishikawa, TRUE),
    ('app02@toguna.test', '鈴木アポ',   'APPOINTER', team_ishikawa, TRUE),
    ('app03@toguna.test', '小林アポ',   'APPOINTER', team_ishikawa, TRUE),
    ('app04@toguna.test', '加藤アポ',   'APPOINTER', team_ishikawa, TRUE),
    ('app05@toguna.test', '渡部アポ',   'APPOINTER', team_ishikawa, TRUE),
    ('app06@toguna.test', '森アポ',     'APPOINTER', team_fujii,    TRUE),
    ('app07@toguna.test', '池田アポ',   'APPOINTER', team_fujii,    TRUE),
    ('app08@toguna.test', '橋本アポ',   'APPOINTER', team_fujii,    TRUE),
    ('app09@toguna.test', '石井アポ',   'APPOINTER', team_fujii,    TRUE),
    ('app10@toguna.test', '清水アポ',   'APPOINTER', team_fujii,    TRUE),
    ('app11@toguna.test', '山本アポ',   'APPOINTER', team_kurihara, TRUE),
    ('app12@toguna.test', '中村アポ',   'APPOINTER', team_kurihara, TRUE),
    ('app13@toguna.test', '小川アポ',   'APPOINTER', team_kurihara, TRUE),
    ('app14@toguna.test', '木村アポ',   'APPOINTER', team_kurihara, TRUE),
    ('app15@toguna.test', '坂本アポ',   'APPOINTER', team_kurihara, TRUE)
  ON CONFLICT (email) DO NOTHING;

  -- チームリーダー紐付け (各チーム最初のアポインターをリーダーに仮置)
  UPDATE homes_teams SET leader_user_id = (SELECT id FROM homes_users WHERE email = 'sv1@toguna.test')
    WHERE name = '石川チーム' AND leader_user_id IS NULL;
  UPDATE homes_teams SET leader_user_id = (SELECT id FROM homes_users WHERE email = 'sv2@toguna.test')
    WHERE name = '藤井チーム' AND leader_user_id IS NULL;
END $$;

-- =====================================================================
-- 3. リスト (3件のサンプル)
-- =====================================================================
INSERT INTO homes_lists (name, source, description, is_active) VALUES
  ('2026-05 関東エリア仕入れリスト', 'HOME''S FRANCHISE', '関東1都3県の不動産仲介・管理会社', TRUE),
  ('2026-05 関西エリア仕入れリスト', '自社調査',          '大阪/京都/兵庫の不動産仲介・管理会社', TRUE),
  ('2026-04 売却査定キャンペーン',   'マーケ提供',        '売却査定アポ専用ナーチャリング済リスト', TRUE)
ON CONFLICT DO NOTHING;

-- =====================================================================
-- 4. 稟議番号 (KNP2025xxxxxx 形式)
-- =====================================================================
INSERT INTO homes_approvals (approval_no, title, discount_rate, discount_amount, valid_from, valid_until, is_active, notes) VALUES
  ('KNP2025000101', '東京都心5区 スタンダード',    0.15, 30000,  '2026-04-01', '2026-09-30', TRUE, '千代田/港/渋谷/新宿/中央 限定'),
  ('KNP2025000102', '関西重点エリア',              0.20, 50000,  '2026-04-01', '2026-09-30', TRUE, '大阪/京都/神戸 売却査定アポ向け'),
  ('KNP2025000103', '新規開拓エリア (政令指定都市)', 0.25, 80000,  '2026-05-01', '2026-12-31', TRUE, '新規アプローチ専用'),
  ('KNP2025000104', '名古屋・福岡 限定',          0.10, 20000,  '2026-05-01', '2026-08-31', TRUE, '中部/九州'),
  ('KNP2025000105', '汎用 (全エリア対応)',         0.05, 10000,  '2026-04-01', '2027-03-31', TRUE, '稟議特典なしの基本プラン')
ON CONFLICT (approval_no) DO NOTHING;

-- =====================================================================
-- 5. 法人サンプル (デモ用 10件)
-- =====================================================================
DO $$
DECLARE
  list_kanto UUID;
  list_kansai UUID;
BEGIN
  SELECT id INTO list_kanto  FROM homes_lists WHERE name LIKE '%関東%' LIMIT 1;
  SELECT id INTO list_kansai FROM homes_lists WHERE name LIKE '%関西%' LIMIT 1;

  INSERT INTO homes_companies (phone, company_name, list_id, prefecture, city, address, employees, capital, call_state, score_priority) VALUES
    ('03-1111-1111', '株式会社サンプル不動産',     list_kanto,  '東京都',   '千代田区', '丸の内1-1-1', 25,  10000000, 'untouched', 1),
    ('03-2222-2222', '東京エステート株式会社',     list_kanto,  '東京都',   '港区',     '六本木6-6-6',  60,  50000000, 'untouched', 2),
    ('03-3333-3333', '渋谷ハウジング株式会社',     list_kanto,  '東京都',   '渋谷区',   '神宮前1-1-1', 15,   5000000, 'untouched', 3),
    ('045-1111-1111','横浜不動産センター株式会社', list_kanto,  '神奈川県', '横浜市',   'みなとみらい1-1', 40, 30000000, 'untouched', 2),
    ('048-1111-1111','埼玉ホームズ株式会社',       list_kanto,  '埼玉県',   'さいたま市', '大宮区桜木町1-1', 12, 5000000, 'untouched', 4),
    ('06-1111-1111', '大阪リアルエステート株式会社', list_kansai, '大阪府',   '大阪市',   '北区梅田1-1-1', 80,  80000000, 'untouched', 1),
    ('06-2222-2222', '関西不動産パートナーズ',     list_kansai, '大阪府',   '大阪市',   '中央区難波1-1', 30, 15000000, 'untouched', 2),
    ('075-1111-1111','京都ハウジング',             list_kansai, '京都府',   '京都市',   '中京区烏丸通1', 18,  8000000, 'untouched', 3),
    ('078-1111-1111','神戸ベイエステート',         list_kansai, '兵庫県',   '神戸市',   '中央区三宮町1', 22, 10000000, 'untouched', 3),
    ('092-1111-1111','福岡都市不動産',             NULL,        '福岡県',   '福岡市',   '中央区天神1-1', 35, 20000000, 'untouched', 2)
  ON CONFLICT (phone) DO NOTHING;
END $$;

-- =====================================================================
-- 6. リスト件数の同期 (total_count を実カウントに合わせる)
-- =====================================================================
UPDATE homes_lists SET
  total_count = (SELECT COUNT(*) FROM homes_companies WHERE list_id = homes_lists.id),
  imported_at = NOW()
WHERE imported_at IS NULL;
