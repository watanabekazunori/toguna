-- Complete TOGUNA Database Schema Migration
-- 2026-02-11: Add all missing tables referenced in API files

-- ====== 1. Projects (プロジェクト) ======
CREATE TABLE IF NOT EXISTS projects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('draft', 'active', 'paused', 'completed', 'archived')),
  priority INTEGER DEFAULT 0,
  daily_call_target INTEGER DEFAULT 0,
  weekly_appointment_target INTEGER DEFAULT 0,
  monthly_appointment_target INTEGER DEFAULT 0,
  min_appointment_rate NUMERIC DEFAULT 0.5,
  withdrawal_threshold_days INTEGER DEFAULT 30,
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ====== 2. Project Members (プロジェクトメンバー) ======
CREATE TABLE IF NOT EXISTS project_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  operator_id UUID NOT NULL REFERENCES operators(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'manager', 'appointer')),
  is_active BOOLEAN DEFAULT true,
  assigned_at TIMESTAMPTZ DEFAULT NOW()
);

-- ====== 3. Operator Project Assignments (オペレーター・プロジェクト割当) ======
CREATE TABLE IF NOT EXISTS operator_project_assignments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  operator_id UUID NOT NULL REFERENCES operators(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  slot_number INTEGER NOT NULL,
  is_active BOOLEAN DEFAULT true,
  assigned_at TIMESTAMPTZ DEFAULT NOW()
);

-- ====== 4. Sales Floor Status (バーチャル・セールスフロア) ======
CREATE TABLE IF NOT EXISTS sales_floor_status (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  operator_id UUID NOT NULL UNIQUE REFERENCES operators(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'idle' CHECK (status IN ('idle', 'calling', 'on_call', 'wrapping_up', 'break', 'offline')),
  current_company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  current_project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  call_start_time TIMESTAMPTZ,
  appointments_today INTEGER DEFAULT 0,
  calls_today INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ====== 5. Strategy Analyses (AI戦略構築分析) ======
CREATE TABLE IF NOT EXISTS strategy_analyses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  analysis_type TEXT NOT NULL CHECK (analysis_type IN ('3c', '4p', 'stp', 'roadmap', 'hypothesis')),
  customer_analysis JSONB DEFAULT '{}',
  competitor_analysis JSONB DEFAULT '{}',
  company_analysis JSONB DEFAULT '{}',
  product_analysis JSONB DEFAULT '{}',
  price_analysis JSONB DEFAULT '{}',
  place_analysis JSONB DEFAULT '{}',
  promotion_analysis JSONB DEFAULT '{}',
  segmentation JSONB DEFAULT '{}',
  targeting JSONB DEFAULT '{}',
  positioning JSONB DEFAULT '{}',
  target_attributes JSONB DEFAULT '{}',
  appeal_points TEXT[] DEFAULT '{}',
  channels TEXT[] DEFAULT '{}',
  winning_hypothesis TEXT,
  source_documents TEXT[] DEFAULT '{}',
  ai_model_used TEXT,
  confidence_score NUMERIC,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ====== 6. Competitor Simulations (競合シミュレーター) ======
CREATE TABLE IF NOT EXISTS competitor_simulations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  competitor_name TEXT NOT NULL,
  competitor_data JSONB DEFAULT '{}',
  comparison_table JSONB DEFAULT '{}',
  counter_talk_scripts JSONB DEFAULT '[]',
  web_sources TEXT[] DEFAULT '{}',
  generated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ====== 7. Call Quality Scores (AI Quality Commander) ======
CREATE TABLE IF NOT EXISTS call_quality_scores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  call_log_id UUID NOT NULL REFERENCES call_logs(id) ON DELETE CASCADE,
  recording_id UUID,
  operator_id UUID REFERENCES operators(id) ON DELETE SET NULL,
  total_score INTEGER NOT NULL,
  greeting_score INTEGER NOT NULL,
  hearing_score INTEGER NOT NULL,
  proposal_score INTEGER NOT NULL,
  closing_score INTEGER NOT NULL,
  speech_pace_score INTEGER NOT NULL,
  tone_score INTEGER NOT NULL,
  ng_words_detected TEXT[] DEFAULT '{}',
  hearing_items_covered TEXT[] DEFAULT '{}',
  improvement_points TEXT[] DEFAULT '{}',
  positive_points TEXT[] DEFAULT '{}',
  coaching_tips TEXT,
  scored_at TIMESTAMPTZ DEFAULT NOW()
);

-- ====== 8. Pivot Alerts (Pivot Alert System) ======
CREATE TABLE IF NOT EXISTS pivot_alerts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL CHECK (alert_type IN ('low_rate', 'high_rejection', 'target_mismatch', 'price_issue', 'timing_issue', 'other')),
  severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
  current_metrics JSONB DEFAULT '{}',
  threshold_metrics JSONB DEFAULT '{}',
  rejection_analysis JSONB DEFAULT '{}',
  pivot_suggestions JSONB DEFAULT '[]',
  recommended_action TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'acknowledged', 'resolved', 'dismissed')),
  acknowledged_by UUID REFERENCES operators(id) ON DELETE SET NULL,
  acknowledged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ====== 9. Golden Calls (成功通話) ======
CREATE TABLE IF NOT EXISTS golden_calls (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  call_log_id UUID NOT NULL REFERENCES call_logs(id) ON DELETE CASCADE,
  recording_id UUID,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  selection_reason TEXT,
  quality_score INTEGER,
  is_client_visible BOOLEAN DEFAULT true,
  selected_at TIMESTAMPTZ DEFAULT NOW()
);

-- ====== 10. Subsidy Reports (補助金コンプライアンス) ======
CREATE TABLE IF NOT EXISTS subsidy_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  report_type TEXT NOT NULL CHECK (report_type IN ('performance', 'effect', 'productivity', 'wage_increase')),
  report_period_start TIMESTAMPTZ,
  report_period_end TIMESTAMPTZ,
  metrics JSONB DEFAULT '{}',
  productivity_data JSONB DEFAULT '{}',
  wage_data JSONB DEFAULT '{}',
  generated_pdf_url TEXT,
  generated_csv_url TEXT,
  submission_deadline TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'generated', 'reviewed', 'submitted', 'accepted', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ====== 11. Compliance Documents (証憑管理) ======
CREATE TABLE IF NOT EXISTS compliance_documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  document_type TEXT NOT NULL CHECK (document_type IN ('contract', 'order', 'delivery', 'invoice', 'daily_report', 'other')),
  title TEXT NOT NULL,
  description TEXT,
  file_url TEXT,
  storage_path TEXT,
  file_hash TEXT,
  retention_start TIMESTAMPTZ NOT NULL,
  retention_end TIMESTAMPTZ NOT NULL,
  is_immutable BOOLEAN DEFAULT true,
  uploaded_by UUID REFERENCES operators(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ====== 12. Audit Logs (監査ログ) ======
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  actor_id UUID REFERENCES operators(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  old_data JSONB,
  new_data JSONB,
  performed_at TIMESTAMPTZ DEFAULT NOW()
);

-- ====== 13. Rejection Insights (失注洞察) ======
CREATE TABLE IF NOT EXISTS rejection_insights (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  call_log_id UUID REFERENCES call_logs(id) ON DELETE SET NULL,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  rejection_category TEXT NOT NULL CHECK (rejection_category IN ('price', 'timing', 'no_need', 'competitor', 'authority', 'budget', 'satisfaction', 'other')),
  rejection_detail TEXT,
  customer_pain_point TEXT,
  unmet_need TEXT,
  cluster_id UUID,
  sentiment_score NUMERIC,
  recorded_by UUID REFERENCES operators(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ====== 14. Cross-Sell Recommendations (クロスセル・レコメンド) ======
CREATE TABLE IF NOT EXISTS cross_sell_recommendations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  source_project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  target_project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  match_score INTEGER NOT NULL,
  match_reasons TEXT[] DEFAULT '{}',
  original_rejection_category TEXT,
  original_rejection_detail TEXT,
  status TEXT DEFAULT 'suggested' CHECK (status IN ('suggested', 'accepted', 'contacted', 'converted', 'dismissed')),
  suggested_at TIMESTAMPTZ DEFAULT NOW()
);

-- ====== 15. Document Templates (ナーチャリング・テンプレート) ======
CREATE TABLE IF NOT EXISTS document_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  subject TEXT,
  body_template TEXT NOT NULL,
  attachment_urls TEXT[] DEFAULT '{}',
  template_type TEXT NOT NULL CHECK (template_type IN ('email', 'dm', 'letter')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ====== 16. Document Sends (資料送付) ======
CREATE TABLE IF NOT EXISTS document_sends (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  call_log_id UUID REFERENCES call_logs(id) ON DELETE SET NULL,
  template_id UUID REFERENCES document_templates(id) ON DELETE SET NULL,
  operator_id UUID REFERENCES operators(id) ON DELETE SET NULL,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'dm', 'letter', 'fax')),
  recipient_email TEXT,
  subject TEXT,
  body TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'delivered', 'bounced', 'failed')),
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  delivered_at TIMESTAMPTZ
);

-- ====== 17. Document Tracking (トラッキング) ======
CREATE TABLE IF NOT EXISTS document_tracking (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  document_send_id UUID NOT NULL REFERENCES document_sends(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('open', 'page_view', 'link_click', 'download', 'forward')),
  page_number INTEGER,
  duration_seconds INTEGER,
  tracked_at TIMESTAMPTZ DEFAULT NOW()
);

-- ====== 18. Engagement Scores (エンゲージメントスコア) ======
CREATE TABLE IF NOT EXISTS engagement_scores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  total_score INTEGER DEFAULT 0,
  call_score INTEGER DEFAULT 0,
  document_score INTEGER DEFAULT 0,
  web_activity_score INTEGER DEFAULT 0,
  social_score INTEGER DEFAULT 0,
  score_trend TEXT DEFAULT 'stable' CHECK (score_trend IN ('rising', 'stable', 'declining')),
  alert_level TEXT DEFAULT 'none' CHECK (alert_level IN ('none', 'low', 'medium', 'high', 'critical')),
  last_activity_at TIMESTAMPTZ,
  calculated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ====== 19. Appointments (アポイント管理) ======
CREATE TABLE IF NOT EXISTS appointments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  operator_id UUID REFERENCES operators(id) ON DELETE SET NULL,
  call_log_id UUID REFERENCES call_logs(id) ON DELETE SET NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER DEFAULT 30,
  meeting_type TEXT DEFAULT 'online' CHECK (meeting_type IN ('online', 'onsite', 'phone')),
  meeting_url TEXT,
  status TEXT DEFAULT 'tentative' CHECK (status IN ('tentative', 'confirmed', 'completed', 'cancelled', 'no_show')),
  assigned_sales_rep TEXT,
  sales_rep_email TEXT,
  google_calendar_event_id TEXT,
  notes TEXT,
  outcome TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ====== 20. Whisper Messages (ウィスパーメッセージ) ======
CREATE TABLE IF NOT EXISTS whisper_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  operator_id UUID NOT NULL REFERENCES operators(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  message TEXT NOT NULL,
  message_type TEXT DEFAULT 'instruction' CHECK (message_type IN ('encouragement', 'instruction', 'warning')),
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ====== 21. Portal Tokens (ポータルトークン) ======
CREATE TABLE IF NOT EXISTS portal_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  is_active BOOLEAN DEFAULT TRUE,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ====== Enable RLS (Row Level Security) ======
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE operator_project_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_floor_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE strategy_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE competitor_simulations ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_quality_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE pivot_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE golden_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE subsidy_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE rejection_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE cross_sell_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_sends ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE engagement_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE whisper_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE portal_tokens ENABLE ROW LEVEL SECURITY;

-- ====== Create RLS Policies ======

-- Projects: Allow all authenticated users
CREATE POLICY "Allow all for authenticated users" ON projects
  FOR ALL USING (auth.role() = 'authenticated');

-- Project Members: Allow all authenticated users
CREATE POLICY "Allow all for authenticated users" ON project_members
  FOR ALL USING (auth.role() = 'authenticated');

-- Operator Project Assignments: Allow all authenticated users
CREATE POLICY "Allow all for authenticated users" ON operator_project_assignments
  FOR ALL USING (auth.role() = 'authenticated');

-- Sales Floor Status: Allow all authenticated users
CREATE POLICY "Allow all for authenticated users" ON sales_floor_status
  FOR ALL USING (auth.role() = 'authenticated');

-- Strategy Analyses: Allow all authenticated users
CREATE POLICY "Allow all for authenticated users" ON strategy_analyses
  FOR ALL USING (auth.role() = 'authenticated');

-- Competitor Simulations: Allow all authenticated users
CREATE POLICY "Allow all for authenticated users" ON competitor_simulations
  FOR ALL USING (auth.role() = 'authenticated');

-- Call Quality Scores: Allow all authenticated users
CREATE POLICY "Allow all for authenticated users" ON call_quality_scores
  FOR ALL USING (auth.role() = 'authenticated');

-- Pivot Alerts: Allow all authenticated users
CREATE POLICY "Allow all for authenticated users" ON pivot_alerts
  FOR ALL USING (auth.role() = 'authenticated');

-- Golden Calls: Allow all authenticated users
CREATE POLICY "Allow all for authenticated users" ON golden_calls
  FOR ALL USING (auth.role() = 'authenticated');

-- Subsidy Reports: Allow all authenticated users
CREATE POLICY "Allow all for authenticated users" ON subsidy_reports
  FOR ALL USING (auth.role() = 'authenticated');

-- Compliance Documents: Allow all authenticated users
CREATE POLICY "Allow all for authenticated users" ON compliance_documents
  FOR ALL USING (auth.role() = 'authenticated');

-- Audit Logs: Allow all authenticated users
CREATE POLICY "Allow all for authenticated users" ON audit_logs
  FOR ALL USING (auth.role() = 'authenticated');

-- Rejection Insights: Allow all authenticated users
CREATE POLICY "Allow all for authenticated users" ON rejection_insights
  FOR ALL USING (auth.role() = 'authenticated');

-- Cross Sell Recommendations: Allow all authenticated users
CREATE POLICY "Allow all for authenticated users" ON cross_sell_recommendations
  FOR ALL USING (auth.role() = 'authenticated');

-- Document Templates: Allow all authenticated users
CREATE POLICY "Allow all for authenticated users" ON document_templates
  FOR ALL USING (auth.role() = 'authenticated');

-- Document Sends: Allow all authenticated users
CREATE POLICY "Allow all for authenticated users" ON document_sends
  FOR ALL USING (auth.role() = 'authenticated');

-- Document Tracking: Allow all authenticated users
CREATE POLICY "Allow all for authenticated users" ON document_tracking
  FOR ALL USING (auth.role() = 'authenticated');

-- Engagement Scores: Allow all authenticated users
CREATE POLICY "Allow all for authenticated users" ON engagement_scores
  FOR ALL USING (auth.role() = 'authenticated');

-- Appointments: Allow all authenticated users
CREATE POLICY "Allow all for authenticated users" ON appointments
  FOR ALL USING (auth.role() = 'authenticated');

-- Whisper Messages: Allow all authenticated users
CREATE POLICY "Allow all for authenticated users" ON whisper_messages
  FOR ALL USING (auth.role() = 'authenticated');

-- Portal Tokens: Allow all authenticated users
CREATE POLICY "Allow all for authenticated users" ON portal_tokens
  FOR ALL USING (auth.role() = 'authenticated');

-- ====== Create Indexes for Performance ======

-- Projects
CREATE INDEX IF NOT EXISTS idx_projects_client_id ON projects(client_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_created_at ON projects(created_at);

-- Project Members
CREATE INDEX IF NOT EXISTS idx_project_members_project_id ON project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_project_members_operator_id ON project_members(operator_id);
CREATE INDEX IF NOT EXISTS idx_project_members_is_active ON project_members(is_active);

-- Operator Project Assignments
CREATE INDEX IF NOT EXISTS idx_operator_project_assignments_operator_id ON operator_project_assignments(operator_id);
CREATE INDEX IF NOT EXISTS idx_operator_project_assignments_project_id ON operator_project_assignments(project_id);
CREATE INDEX IF NOT EXISTS idx_operator_project_assignments_is_active ON operator_project_assignments(is_active);

-- Sales Floor Status
CREATE INDEX IF NOT EXISTS idx_sales_floor_status_operator_id ON sales_floor_status(operator_id);
CREATE INDEX IF NOT EXISTS idx_sales_floor_status_status ON sales_floor_status(status);

-- Strategy Analyses
CREATE INDEX IF NOT EXISTS idx_strategy_analyses_project_id ON strategy_analyses(project_id);
CREATE INDEX IF NOT EXISTS idx_strategy_analyses_analysis_type ON strategy_analyses(analysis_type);

-- Competitor Simulations
CREATE INDEX IF NOT EXISTS idx_competitor_simulations_project_id ON competitor_simulations(project_id);

-- Call Quality Scores
CREATE INDEX IF NOT EXISTS idx_call_quality_scores_call_log_id ON call_quality_scores(call_log_id);
CREATE INDEX IF NOT EXISTS idx_call_quality_scores_operator_id ON call_quality_scores(operator_id);
CREATE INDEX IF NOT EXISTS idx_call_quality_scores_total_score ON call_quality_scores(total_score);

-- Pivot Alerts
CREATE INDEX IF NOT EXISTS idx_pivot_alerts_project_id ON pivot_alerts(project_id);
CREATE INDEX IF NOT EXISTS idx_pivot_alerts_status ON pivot_alerts(status);
CREATE INDEX IF NOT EXISTS idx_pivot_alerts_severity ON pivot_alerts(severity);

-- Golden Calls
CREATE INDEX IF NOT EXISTS idx_golden_calls_project_id ON golden_calls(project_id);
CREATE INDEX IF NOT EXISTS idx_golden_calls_call_log_id ON golden_calls(call_log_id);

-- Subsidy Reports
CREATE INDEX IF NOT EXISTS idx_subsidy_reports_client_id ON subsidy_reports(client_id);
CREATE INDEX IF NOT EXISTS idx_subsidy_reports_status ON subsidy_reports(status);

-- Compliance Documents
CREATE INDEX IF NOT EXISTS idx_compliance_documents_client_id ON compliance_documents(client_id);
CREATE INDEX IF NOT EXISTS idx_compliance_documents_project_id ON compliance_documents(project_id);
CREATE INDEX IF NOT EXISTS idx_compliance_documents_document_type ON compliance_documents(document_type);

-- Audit Logs
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_type ON audit_logs(entity_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_id ON audit_logs(entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_performed_at ON audit_logs(performed_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_id ON audit_logs(actor_id);

-- Rejection Insights
CREATE INDEX IF NOT EXISTS idx_rejection_insights_project_id ON rejection_insights(project_id);
CREATE INDEX IF NOT EXISTS idx_rejection_insights_category ON rejection_insights(rejection_category);
CREATE INDEX IF NOT EXISTS idx_rejection_insights_company_id ON rejection_insights(company_id);

-- Cross Sell Recommendations
CREATE INDEX IF NOT EXISTS idx_cross_sell_recommendations_source_project_id ON cross_sell_recommendations(source_project_id);
CREATE INDEX IF NOT EXISTS idx_cross_sell_recommendations_target_project_id ON cross_sell_recommendations(target_project_id);
CREATE INDEX IF NOT EXISTS idx_cross_sell_recommendations_company_id ON cross_sell_recommendations(company_id);
CREATE INDEX IF NOT EXISTS idx_cross_sell_recommendations_status ON cross_sell_recommendations(status);

-- Document Templates
CREATE INDEX IF NOT EXISTS idx_document_templates_project_id ON document_templates(project_id);
CREATE INDEX IF NOT EXISTS idx_document_templates_is_active ON document_templates(is_active);

-- Document Sends
CREATE INDEX IF NOT EXISTS idx_document_sends_company_id ON document_sends(company_id);
CREATE INDEX IF NOT EXISTS idx_document_sends_operator_id ON document_sends(operator_id);
CREATE INDEX IF NOT EXISTS idx_document_sends_status ON document_sends(status);

-- Document Tracking
CREATE INDEX IF NOT EXISTS idx_document_tracking_document_send_id ON document_tracking(document_send_id);
CREATE INDEX IF NOT EXISTS idx_document_tracking_event_type ON document_tracking(event_type);

-- Engagement Scores
CREATE INDEX IF NOT EXISTS idx_engagement_scores_company_id ON engagement_scores(company_id);
CREATE INDEX IF NOT EXISTS idx_engagement_scores_project_id ON engagement_scores(project_id);
CREATE INDEX IF NOT EXISTS idx_engagement_scores_total_score ON engagement_scores(total_score);

-- Appointments
CREATE INDEX IF NOT EXISTS idx_appointments_company_id ON appointments(company_id);
CREATE INDEX IF NOT EXISTS idx_appointments_project_id ON appointments(project_id);
CREATE INDEX IF NOT EXISTS idx_appointments_operator_id ON appointments(operator_id);
CREATE INDEX IF NOT EXISTS idx_appointments_scheduled_at ON appointments(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);
