-- ============================================================
-- TOGUNA 包括的スキーマアップグレード
-- 8章仕様書に対応する全テーブル追加
-- 実行日: 2026-02-11
-- ============================================================

-- ============================================================
-- 第1章: AI戦略構築・オンボーディング (AI Strategy Core)
-- ============================================================

-- プロジェクト（マルチプロジェクト管理の中核）
CREATE TABLE IF NOT EXISTS projects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('draft', 'active', 'paused', 'completed', 'archived')),
  priority INTEGER DEFAULT 0,
  -- 目標設定
  daily_call_target INTEGER DEFAULT 60,
  weekly_appointment_target INTEGER DEFAULT 3,
  monthly_appointment_target INTEGER DEFAULT 12,
  -- 撤退ライン（第5章 Pivot Alert）
  min_appointment_rate NUMERIC(5,2) DEFAULT 0.5,
  withdrawal_threshold_days INTEGER DEFAULT 14,
  -- メタデータ
  start_date DATE,
  end_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- プロジェクト権限（管理者、マネージャー、アポインター）
CREATE TABLE IF NOT EXISTS project_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  operator_id UUID REFERENCES operators(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'appointer' CHECK (role IN ('admin', 'manager', 'appointer')),
  is_active BOOLEAN DEFAULT true,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, operator_id)
);

-- AI戦略分析結果（3C/4P/STP分析）
CREATE TABLE IF NOT EXISTS strategy_analyses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  analysis_type TEXT NOT NULL CHECK (analysis_type IN ('3c', '4p', 'stp', 'roadmap', 'hypothesis')),
  -- 3C分析
  customer_analysis JSONB DEFAULT '{}'::jsonb,
  competitor_analysis JSONB DEFAULT '{}'::jsonb,
  company_analysis JSONB DEFAULT '{}'::jsonb,
  -- 4P分析
  product_analysis JSONB DEFAULT '{}'::jsonb,
  price_analysis JSONB DEFAULT '{}'::jsonb,
  place_analysis JSONB DEFAULT '{}'::jsonb,
  promotion_analysis JSONB DEFAULT '{}'::jsonb,
  -- STP分析
  segmentation JSONB DEFAULT '{}'::jsonb,
  targeting JSONB DEFAULT '{}'::jsonb,
  positioning JSONB DEFAULT '{}'::jsonb,
  -- 戦略ロードマップ
  target_attributes JSONB DEFAULT '{}'::jsonb,  -- 誰に
  appeal_points JSONB DEFAULT '[]'::jsonb,       -- 何を
  channels JSONB DEFAULT '[]'::jsonb,            -- どうやって
  winning_hypothesis TEXT,                        -- 勝ち筋仮説
  -- メタデータ
  source_documents JSONB DEFAULT '[]'::jsonb,
  ai_model_used TEXT,
  confidence_score NUMERIC(5,2),
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 資料アップロード管理
CREATE TABLE IF NOT EXISTS uploaded_documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_type TEXT, -- pdf, pptx, docx
  file_size INTEGER,
  file_url TEXT,
  storage_path TEXT,
  -- NLP解析結果
  extracted_text TEXT,
  nlp_analysis JSONB DEFAULT '{}'::jsonb,
  key_phrases JSONB DEFAULT '[]'::jsonb,
  summary TEXT,
  parsed_at TIMESTAMPTZ,
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- バーチャル・ロールプレイングセッション
CREATE TABLE IF NOT EXISTS roleplay_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  operator_id UUID REFERENCES operators(id) ON DELETE SET NULL,
  -- 仮想ターゲットプロファイル
  virtual_persona JSONB DEFAULT '{}'::jsonb,
  scenario_type TEXT DEFAULT 'cold_call' CHECK (scenario_type IN ('cold_call', 'follow_up', 'objection_handling', 'closing')),
  -- セッション記録
  conversation_log JSONB DEFAULT '[]'::jsonb,
  duration_seconds INTEGER DEFAULT 0,
  -- AI評価
  ai_feedback JSONB DEFAULT '{}'::jsonb,
  score INTEGER,
  improvement_points JSONB DEFAULT '[]'::jsonb,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 競合シミュレーターデータ
CREATE TABLE IF NOT EXISTS competitor_simulations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  competitor_name TEXT NOT NULL,
  competitor_data JSONB DEFAULT '{}'::jsonb,
  comparison_table JSONB DEFAULT '{}'::jsonb,
  counter_talk_scripts JSONB DEFAULT '[]'::jsonb,
  web_sources JSONB DEFAULT '[]'::jsonb,
  generated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 第2章: インテリジェント・リストビルディング (Data Mining Engine)
-- ============================================================

-- ウェブクローリングジョブ
CREATE TABLE IF NOT EXISTS crawl_jobs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
  target_conditions JSONB DEFAULT '{}'::jsonb,
  -- 結果サマリ
  companies_found INTEGER DEFAULT 0,
  companies_imported INTEGER DEFAULT 0,
  errors JSONB DEFAULT '[]'::jsonb,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- レピュテーション・ガード（リスク検知）
CREATE TABLE IF NOT EXISTS company_risk_flags (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  risk_type TEXT NOT NULL CHECK (risk_type IN ('bankruptcy', 'scandal', 'compliance', 'lawsuit', 'other')),
  severity TEXT DEFAULT 'medium' CHECK (severity IN ('high', 'medium', 'low')),
  description TEXT,
  source_url TEXT,
  detected_at TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true,
  reviewed_by UUID REFERENCES operators(id),
  reviewed_at TIMESTAMPTZ
);

-- 市場飽和度トラッキング
CREATE TABLE IF NOT EXISTS market_saturation (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  approach_count INTEGER DEFAULT 0,
  last_approached_at TIMESTAMPTZ,
  saturation_level TEXT DEFAULT 'fresh' CHECK (saturation_level IN ('fresh', 'warm', 'saturated', 'exhausted')),
  cooldown_until TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 第3章: アダプティブ・実行コックピット (Execution Cockpit)
-- ============================================================

-- オペレーター・プロジェクトアサイン（最大6案件）
CREATE TABLE IF NOT EXISTS operator_project_assignments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  operator_id UUID REFERENCES operators(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  slot_number INTEGER CHECK (slot_number BETWEEN 1 AND 6),
  is_active BOOLEAN DEFAULT true,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(operator_id, slot_number)
);

-- リアルタイム・トリガー・インジェクション（ニュース検知）
CREATE TABLE IF NOT EXISTS news_triggers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('funding', 'executive_change', 'expansion', 'award', 'partnership', 'ipo', 'product_launch', 'other')),
  title TEXT NOT NULL,
  description TEXT,
  source_url TEXT,
  -- ドアノックトーク自動生成
  suggested_talk TEXT,
  talk_tone TEXT DEFAULT 'congratulation' CHECK (talk_tone IN ('congratulation', 'empathy', 'urgency', 'interest')),
  -- 優先度
  priority INTEGER DEFAULT 5,
  is_processed BOOLEAN DEFAULT false,
  detected_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

-- AIデイリー・スケジューリング
CREATE TABLE IF NOT EXISTS daily_schedules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  operator_id UUID REFERENCES operators(id) ON DELETE CASCADE,
  schedule_date DATE NOT NULL,
  -- AIが生成した最適架電順序
  call_queue JSONB DEFAULT '[]'::jsonb, -- [{company_id, project_id, priority, reason}]
  total_planned INTEGER DEFAULT 0,
  total_completed INTEGER DEFAULT 0,
  ai_reasoning TEXT,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(operator_id, schedule_date)
);

-- 通話録音メタデータ
CREATE TABLE IF NOT EXISTS call_recordings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  call_log_id UUID REFERENCES call_logs(id) ON DELETE CASCADE,
  recording_url TEXT,
  storage_path TEXT,
  duration_seconds INTEGER,
  file_size INTEGER,
  -- 文字起こし
  transcription TEXT,
  transcription_status TEXT DEFAULT 'pending' CHECK (transcription_status IN ('pending', 'processing', 'completed', 'failed')),
  -- 感情分析
  sentiment_analysis JSONB DEFAULT '{}'::jsonb,
  keywords JSONB DEFAULT '[]'::jsonb,
  -- ステータス自動判定
  auto_detected_status TEXT,
  auto_summary TEXT,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 相性マッチング・アサインデータ
CREATE TABLE IF NOT EXISTS affinity_scores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  operator_id UUID REFERENCES operators(id) ON DELETE CASCADE,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  score NUMERIC(5,2),
  factors JSONB DEFAULT '{}'::jsonb, -- {voice_match, personality_match, industry_experience}
  calculated_at TIMESTAMPTZ DEFAULT NOW()
);

-- バーチャル・セールスフロア状態
CREATE TABLE IF NOT EXISTS sales_floor_status (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  operator_id UUID REFERENCES operators(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'idle' CHECK (status IN ('idle', 'calling', 'on_call', 'wrapping_up', 'break', 'offline')),
  current_company_id UUID REFERENCES companies(id),
  current_project_id UUID REFERENCES projects(id),
  call_start_time TIMESTAMPTZ,
  appointments_today INTEGER DEFAULT 0,
  calls_today INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 第4章: オートメーション＆ナーチャリング (Nurturing Automation)
-- ============================================================

-- 資料送付テンプレート
CREATE TABLE IF NOT EXISTS document_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  subject TEXT,
  body_template TEXT,
  attachment_urls JSONB DEFAULT '[]'::jsonb,
  template_type TEXT DEFAULT 'email' CHECK (template_type IN ('email', 'dm', 'letter')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 資料送付ログ
CREATE TABLE IF NOT EXISTS document_sends (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  call_log_id UUID REFERENCES call_logs(id),
  template_id UUID REFERENCES document_templates(id),
  operator_id UUID REFERENCES operators(id),
  -- 送付内容
  channel TEXT DEFAULT 'email' CHECK (channel IN ('email', 'dm', 'letter', 'fax')),
  recipient_email TEXT,
  subject TEXT,
  body TEXT,
  -- ステータス
  status TEXT DEFAULT 'sent' CHECK (status IN ('draft', 'sent', 'delivered', 'bounced', 'failed')),
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  delivered_at TIMESTAMPTZ
);

-- インサイト・スコアリング（資料閲覧トラッキング）
CREATE TABLE IF NOT EXISTS document_tracking (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  document_send_id UUID REFERENCES document_sends(id) ON DELETE CASCADE,
  -- トラッキングデータ
  event_type TEXT NOT NULL CHECK (event_type IN ('open', 'page_view', 'link_click', 'download', 'forward')),
  page_number INTEGER,
  duration_seconds INTEGER,
  ip_address TEXT,
  user_agent TEXT,
  tracked_at TIMESTAMPTZ DEFAULT NOW()
);

-- 顧客エンゲージメントスコア
CREATE TABLE IF NOT EXISTS engagement_scores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  -- スコア構成
  total_score INTEGER DEFAULT 0,
  call_score INTEGER DEFAULT 0,
  document_score INTEGER DEFAULT 0,
  web_activity_score INTEGER DEFAULT 0,
  social_score INTEGER DEFAULT 0,
  -- アラート
  score_trend TEXT DEFAULT 'stable' CHECK (score_trend IN ('rising', 'stable', 'declining')),
  alert_level TEXT DEFAULT 'none' CHECK (alert_level IN ('none', 'low', 'medium', 'high', 'critical')),
  last_activity_at TIMESTAMPTZ,
  calculated_at TIMESTAMPTZ DEFAULT NOW()
);

-- アポイント・スケジュール管理
CREATE TABLE IF NOT EXISTS appointments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  operator_id UUID REFERENCES operators(id),
  call_log_id UUID REFERENCES call_logs(id),
  -- スケジュール
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER DEFAULT 30,
  meeting_type TEXT DEFAULT 'online' CHECK (meeting_type IN ('online', 'onsite', 'phone')),
  meeting_url TEXT,
  -- ステータス
  status TEXT DEFAULT 'confirmed' CHECK (status IN ('tentative', 'confirmed', 'completed', 'cancelled', 'no_show')),
  -- 商談担当者
  assigned_sales_rep TEXT,
  sales_rep_email TEXT,
  -- Google Calendar連携
  google_calendar_event_id TEXT,
  -- メモ
  notes TEXT,
  outcome TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 第5章: マネジメント＆ガバナンス (Management & Governance)
-- ============================================================

-- AI品質スコアリング（通話品質採点）
CREATE TABLE IF NOT EXISTS call_quality_scores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  call_log_id UUID REFERENCES call_logs(id) ON DELETE CASCADE,
  recording_id UUID REFERENCES call_recordings(id),
  operator_id UUID REFERENCES operators(id),
  -- 100点満点採点
  total_score INTEGER DEFAULT 0,
  -- KPI個別スコア
  greeting_score INTEGER DEFAULT 0,      -- 挨拶
  hearing_score INTEGER DEFAULT 0,       -- ヒアリング
  proposal_score INTEGER DEFAULT 0,      -- 提案
  closing_score INTEGER DEFAULT 0,       -- クロージング
  speech_pace_score INTEGER DEFAULT 0,   -- 話速
  tone_score INTEGER DEFAULT 0,          -- トーン
  -- NG検出
  ng_words_detected JSONB DEFAULT '[]'::jsonb,
  hearing_items_covered JSONB DEFAULT '[]'::jsonb,
  -- AIフィードバック
  improvement_points JSONB DEFAULT '[]'::jsonb,
  positive_points JSONB DEFAULT '[]'::jsonb,
  coaching_tips TEXT,
  scored_at TIMESTAMPTZ DEFAULT NOW()
);

-- ピボット・アラートシステム
CREATE TABLE IF NOT EXISTS pivot_alerts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL CHECK (alert_type IN ('low_rate', 'high_rejection', 'target_mismatch', 'price_issue', 'timing_issue', 'other')),
  severity TEXT DEFAULT 'warning' CHECK (severity IN ('info', 'warning', 'critical')),
  -- 分析データ
  current_metrics JSONB DEFAULT '{}'::jsonb,
  threshold_metrics JSONB DEFAULT '{}'::jsonb,
  rejection_analysis JSONB DEFAULT '{}'::jsonb,
  -- 提案
  pivot_suggestions JSONB DEFAULT '[]'::jsonb,
  recommended_action TEXT,
  -- ステータス
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'acknowledged', 'resolved', 'dismissed')),
  acknowledged_by UUID REFERENCES operators(id),
  acknowledged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- クライアント・ミラーリング・ポータル
CREATE TABLE IF NOT EXISTS client_portal_access (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  access_token TEXT UNIQUE NOT NULL,
  -- アクセス範囲
  can_view_calls BOOLEAN DEFAULT true,
  can_view_appointments BOOLEAN DEFAULT true,
  can_view_reports BOOLEAN DEFAULT true,
  can_play_golden_calls BOOLEAN DEFAULT true,
  -- 有効期限
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  last_accessed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ゴールデンコール（成功通話）
CREATE TABLE IF NOT EXISTS golden_calls (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  call_log_id UUID REFERENCES call_logs(id) ON DELETE CASCADE,
  recording_id UUID REFERENCES call_recordings(id),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  -- 選定理由
  selection_reason TEXT,
  quality_score INTEGER,
  -- クライアント公開設定
  is_client_visible BOOLEAN DEFAULT true,
  selected_by UUID REFERENCES operators(id),
  selected_at TIMESTAMPTZ DEFAULT NOW()
);

-- オペレーター稼働・不正監視ログ
CREATE TABLE IF NOT EXISTS operator_activity_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  operator_id UUID REFERENCES operators(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL CHECK (activity_type IN ('login', 'logout', 'call_start', 'call_end', 'break_start', 'break_end', 'idle_detected', 'anomaly_detected')),
  -- 詳細
  details JSONB DEFAULT '{}'::jsonb,
  -- 不正検知
  is_anomaly BOOLEAN DEFAULT false,
  anomaly_type TEXT, -- silent_call, short_call, script_deviation, idle_too_long
  anomaly_severity TEXT CHECK (anomaly_severity IN ('low', 'medium', 'high')),
  -- GPS/IP
  ip_address TEXT,
  logged_at TIMESTAMPTZ DEFAULT NOW()
);

-- ナレッジDNA（成功パターン抽出）
CREATE TABLE IF NOT EXISTS knowledge_dna (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  operator_id UUID REFERENCES operators(id),
  -- パターンデータ
  pattern_type TEXT NOT NULL CHECK (pattern_type IN ('phrase', 'timing', 'tone', 'structure', 'objection_handling')),
  pattern_data JSONB DEFAULT '{}'::jsonb,
  -- 統計
  success_rate NUMERIC(5,2),
  sample_count INTEGER DEFAULT 0,
  -- 共有
  is_shared BOOLEAN DEFAULT false,
  shared_at TIMESTAMPTZ,
  extracted_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 第6章: 補助金コンプライアンス (Subsidy & Compliance)
-- ============================================================

-- 補助金実績報告
CREATE TABLE IF NOT EXISTS subsidy_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  report_type TEXT NOT NULL CHECK (report_type IN ('performance', 'effect', 'productivity', 'wage_increase')),
  -- 報告データ
  report_period_start DATE,
  report_period_end DATE,
  metrics JSONB DEFAULT '{}'::jsonb,
  productivity_data JSONB DEFAULT '{}'::jsonb,
  wage_data JSONB DEFAULT '{}'::jsonb,
  -- 出力
  generated_pdf_url TEXT,
  generated_csv_url TEXT,
  -- 提出管理
  submission_deadline DATE,
  submitted_at TIMESTAMPTZ,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'generated', 'reviewed', 'submitted', 'accepted', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 証憑一元管理（WORM: Write Once Read Many）
CREATE TABLE IF NOT EXISTS compliance_documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id),
  document_type TEXT NOT NULL CHECK (document_type IN ('contract', 'order', 'delivery', 'invoice', 'daily_report', 'other')),
  -- ドキュメント情報
  title TEXT NOT NULL,
  description TEXT,
  file_url TEXT,
  storage_path TEXT,
  file_hash TEXT, -- 改竄検知用
  -- 紐付け
  related_entity_type TEXT,
  related_entity_id UUID,
  -- 保管期限（5年）
  retention_start DATE DEFAULT CURRENT_DATE,
  retention_end DATE DEFAULT (CURRENT_DATE + INTERVAL '5 years'),
  -- メタ
  uploaded_by UUID REFERENCES operators(id),
  is_immutable BOOLEAN DEFAULT true, -- WORM
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 監査対応ビュー用クエリログ
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  actor_id UUID REFERENCES operators(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  old_data JSONB,
  new_data JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- インボイス管理
CREATE TABLE IF NOT EXISTS invoices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id),
  -- インボイス番号
  invoice_number TEXT NOT NULL UNIQUE,
  qualified_invoice_issuer_number TEXT, -- 適格請求書発行事業者番号
  -- 金額
  subtotal NUMERIC(12,2),
  tax_rate NUMERIC(5,2) DEFAULT 10.00,
  tax_amount NUMERIC(12,2),
  total NUMERIC(12,2),
  -- 取引先
  vendor_name TEXT,
  vendor_invoice_number TEXT,
  is_qualified_vendor BOOLEAN, -- 適格請求書発行事業者かどうか
  -- ステータス
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'issued', 'sent', 'paid', 'overdue', 'cancelled')),
  issued_date DATE,
  due_date DATE,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 第7章: プロダクト・インキュベーション (Product Incubation)
-- ============================================================

-- 「不」のデータベース（断り文句・不満の構造化蓄積）
CREATE TABLE IF NOT EXISTS rejection_insights (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  call_log_id UUID REFERENCES call_logs(id),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  company_id UUID REFERENCES companies(id),
  -- 断りデータ
  rejection_category TEXT NOT NULL CHECK (rejection_category IN ('price', 'timing', 'no_need', 'competitor', 'authority', 'budget', 'satisfaction', 'other')),
  rejection_detail TEXT,
  customer_pain_point TEXT,
  unmet_need TEXT,
  -- AIクラスタリング
  cluster_id TEXT,
  sentiment_score NUMERIC(5,2),
  -- メタ
  recorded_by UUID REFERENCES operators(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 新商品開発シミュレーション
CREATE TABLE IF NOT EXISTS product_ideas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  -- 元データ
  source_rejection_ids JSONB DEFAULT '[]'::jsonb,
  source_project_ids JSONB DEFAULT '[]'::jsonb,
  -- アイデア
  idea_name TEXT NOT NULL,
  description TEXT,
  target_market TEXT,
  market_size_estimate TEXT,
  feasibility_score INTEGER, -- 0-100
  market_potential_score INTEGER, -- 0-100
  -- AI出力
  product_design JSONB DEFAULT '{}'::jsonb,
  lp_structure JSONB DEFAULT '{}'::jsonb,
  competitor_gap_analysis JSONB DEFAULT '{}'::jsonb,
  -- ステータス
  status TEXT DEFAULT 'idea' CHECK (status IN ('idea', 'researching', 'validated', 'prototyping', 'launched', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- プロジェクト間クロスセル・レコメンド
CREATE TABLE IF NOT EXISTS cross_sell_recommendations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  source_project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  target_project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  -- マッチングデータ
  match_score INTEGER, -- 0-100
  match_reasons JSONB DEFAULT '[]'::jsonb,
  -- 元の失注理由
  original_rejection_category TEXT,
  original_rejection_detail TEXT,
  -- ステータス
  status TEXT DEFAULT 'suggested' CHECK (status IN ('suggested', 'accepted', 'contacted', 'converted', 'dismissed')),
  suggested_at TIMESTAMPTZ DEFAULT NOW(),
  actioned_at TIMESTAMPTZ
);

-- ============================================================
-- 第8章: サービス運用・顧客インターフェース (Service Operations)
-- ============================================================

-- プラン管理
CREATE TABLE IF NOT EXISTS plan_tiers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL, -- starter, standard, premium
  display_name TEXT NOT NULL,
  -- 機能制限
  max_projects INTEGER DEFAULT 3,
  max_operators INTEGER DEFAULT 5,
  max_companies_per_project INTEGER DEFAULT 500,
  ai_features_enabled BOOLEAN DEFAULT false,
  advanced_reports_enabled BOOLEAN DEFAULT false,
  api_access_enabled BOOLEAN DEFAULT false,
  -- 料金
  monthly_price NUMERIC(10,2),
  annual_price NUMERIC(10,2),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- クライアントのプラン契約
CREATE TABLE IF NOT EXISTS client_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  plan_tier_id UUID REFERENCES plan_tiers(id),
  -- 契約期間
  start_date DATE NOT NULL,
  end_date DATE,
  is_trial BOOLEAN DEFAULT false,
  trial_end_date DATE,
  -- ステータス
  status TEXT DEFAULT 'active' CHECK (status IN ('trial', 'active', 'suspended', 'cancelled', 'expired')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- システム設定（永続化）
CREATE TABLE IF NOT EXISTS system_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  setting_key TEXT NOT NULL UNIQUE,
  setting_value JSONB NOT NULL,
  category TEXT DEFAULT 'general',
  updated_by UUID REFERENCES operators(id),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 既存テーブル拡張
-- ============================================================

-- operatorsテーブル拡張
ALTER TABLE operators ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE operators ADD COLUMN IF NOT EXISTS voice_type TEXT; -- 相性マッチング用
ALTER TABLE operators ADD COLUMN IF NOT EXISTS personality_tags JSONB DEFAULT '[]'::jsonb;
ALTER TABLE operators ADD COLUMN IF NOT EXISTS zoom_user_id TEXT;
ALTER TABLE operators ADD COLUMN IF NOT EXISTS zoom_phone_number TEXT;
ALTER TABLE operators ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- clientsテーブル拡張
ALTER TABLE clients ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS plan_tier TEXT DEFAULT 'standard';
ALTER TABLE clients ADD COLUMN IF NOT EXISTS google_calendar_id TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}'::jsonb;

-- companiesテーブル拡張（プロジェクト対応）
ALTER TABLE companies ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE SET NULL;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS contact_person TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS contact_email TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS revenue TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS capital TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS founded_date TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS ceo TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS listing_status TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS corporate_number TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS google_maps_data JSONB DEFAULT '{}'::jsonb;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS risk_flag BOOLEAN DEFAULT false;

-- call_logsテーブル拡張
ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE SET NULL;
ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS recording_id UUID;
ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS quality_score INTEGER;
ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS ai_summary TEXT;
ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS ai_detected_status TEXT;
ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS sentiment_score NUMERIC(5,2);
ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS talk_speed NUMERIC(5,2);
ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS script_adherence NUMERIC(5,2);
ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS next_action TEXT;
ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS next_action_date DATE;

-- ============================================================
-- インデックス追加
-- ============================================================

-- プロジェクト関連
CREATE INDEX IF NOT EXISTS idx_projects_client_id ON projects(client_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_project_members_operator ON project_members(operator_id);
CREATE INDEX IF NOT EXISTS idx_project_members_project ON project_members(project_id);

-- アサイン関連
CREATE INDEX IF NOT EXISTS idx_op_project_assign_operator ON operator_project_assignments(operator_id);
CREATE INDEX IF NOT EXISTS idx_op_project_assign_project ON operator_project_assignments(project_id);

-- トリガー・ニュース
CREATE INDEX IF NOT EXISTS idx_news_triggers_company ON news_triggers(company_id);
CREATE INDEX IF NOT EXISTS idx_news_triggers_detected ON news_triggers(detected_at DESC);

-- スケジューリング
CREATE INDEX IF NOT EXISTS idx_daily_schedules_operator_date ON daily_schedules(operator_id, schedule_date);

-- 通話品質
CREATE INDEX IF NOT EXISTS idx_call_quality_operator ON call_quality_scores(operator_id);
CREATE INDEX IF NOT EXISTS idx_call_quality_call ON call_quality_scores(call_log_id);

-- ナーチャリング
CREATE INDEX IF NOT EXISTS idx_document_sends_company ON document_sends(company_id);
CREATE INDEX IF NOT EXISTS idx_document_tracking_send ON document_tracking(document_send_id);
CREATE INDEX IF NOT EXISTS idx_engagement_scores_company ON engagement_scores(company_id);

-- アポイント
CREATE INDEX IF NOT EXISTS idx_appointments_company ON appointments(company_id);
CREATE INDEX IF NOT EXISTS idx_appointments_scheduled ON appointments(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_appointments_operator ON appointments(operator_id);

-- 監査
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);

-- 断りデータ
CREATE INDEX IF NOT EXISTS idx_rejection_insights_project ON rejection_insights(project_id);
CREATE INDEX IF NOT EXISTS idx_rejection_insights_category ON rejection_insights(rejection_category);

-- クロスセル
CREATE INDEX IF NOT EXISTS idx_cross_sell_source ON cross_sell_recommendations(source_project_id);
CREATE INDEX IF NOT EXISTS idx_cross_sell_target ON cross_sell_recommendations(target_project_id);
CREATE INDEX IF NOT EXISTS idx_cross_sell_company ON cross_sell_recommendations(company_id);

-- コンプライアンス
CREATE INDEX IF NOT EXISTS idx_compliance_docs_client ON compliance_documents(client_id);
CREATE INDEX IF NOT EXISTS idx_compliance_docs_type ON compliance_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_invoices_client ON invoices(client_id);

-- プロジェクト紐付き
CREATE INDEX IF NOT EXISTS idx_companies_project ON companies(project_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_project ON call_logs(project_id);

-- ============================================================
-- RLSポリシー（新テーブル用）
-- ============================================================

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE strategy_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE uploaded_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE roleplay_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE competitor_simulations ENABLE ROW LEVEL SECURITY;
ALTER TABLE crawl_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_risk_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_saturation ENABLE ROW LEVEL SECURITY;
ALTER TABLE operator_project_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE news_triggers ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_recordings ENABLE ROW LEVEL SECURITY;
ALTER TABLE affinity_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_floor_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_sends ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE engagement_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_quality_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE pivot_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_portal_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE golden_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE operator_activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_dna ENABLE ROW LEVEL SECURITY;
ALTER TABLE subsidy_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE rejection_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_ideas ENABLE ROW LEVEL SECURITY;
ALTER TABLE cross_sell_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- 認証済みユーザーに全アクセスを許可するポリシー（開発用、本番ではより厳密に設定）
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'projects', 'project_members', 'strategy_analyses', 'uploaded_documents',
    'roleplay_sessions', 'competitor_simulations', 'crawl_jobs', 'company_risk_flags',
    'market_saturation', 'operator_project_assignments', 'news_triggers', 'daily_schedules',
    'call_recordings', 'affinity_scores', 'sales_floor_status', 'document_templates',
    'document_sends', 'document_tracking', 'engagement_scores', 'appointments',
    'call_quality_scores', 'pivot_alerts', 'client_portal_access', 'golden_calls',
    'operator_activity_logs', 'knowledge_dna', 'subsidy_reports', 'compliance_documents',
    'audit_logs', 'invoices', 'rejection_insights', 'product_ideas',
    'cross_sell_recommendations', 'plan_tiers', 'client_subscriptions', 'system_settings'
  ])
  LOOP
    EXECUTE format('CREATE POLICY "Allow all for authenticated users" ON %I FOR ALL USING (auth.role() = ''authenticated'')', tbl);
  END LOOP;
END $$;

-- ============================================================
-- デフォルトプランデータ
-- ============================================================

INSERT INTO plan_tiers (name, display_name, max_projects, max_operators, max_companies_per_project, ai_features_enabled, advanced_reports_enabled, monthly_price)
VALUES
  ('starter', 'スターター', 3, 5, 500, false, false, 29800),
  ('standard', 'スタンダード', 10, 20, 2000, true, false, 98000),
  ('premium', 'プレミアム', 100, 100, 10000, true, true, 298000)
ON CONFLICT DO NOTHING;
