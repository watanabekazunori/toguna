-- インテント分析と企業分析データを保存するカラムを追加

-- インテント分析用カラム
ALTER TABLE companies ADD COLUMN IF NOT EXISTS intent_score INTEGER DEFAULT 0;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS intent_level VARCHAR(10) DEFAULT 'cold'; -- hot, warm, cold
ALTER TABLE companies ADD COLUMN IF NOT EXISTS intent_signals JSONB DEFAULT '[]'::jsonb;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS buying_stage VARCHAR(20) DEFAULT 'unknown'; -- awareness, consideration, decision, unknown
ALTER TABLE companies ADD COLUMN IF NOT EXISTS best_contact_timing VARCHAR(100);
ALTER TABLE companies ADD COLUMN IF NOT EXISTS intent_summary TEXT;

-- スクレイピング収集データ
ALTER TABLE companies ADD COLUMN IF NOT EXISTS scraped_data JSONB DEFAULT '{}'::jsonb;

-- SalesRadar元データ（全カラム保存用）
ALTER TABLE companies ADD COLUMN IF NOT EXISTS salesradar_data JSONB DEFAULT '{}'::jsonb;
-- salesradar_dataには以下を格納:
-- アップロード時のExcel/CSVの全カラムデータをそのまま保存
-- 例: { "法人名称": "...", "法人番号": "...", "業種": "...", "売上高(円)": "...", ... }
-- scraped_dataには以下を格納:
-- {
--   "companyInfo": { "description": "", "foundedYear": null, "ceo": "", "headquarters": "", "employeeCount": null },
--   "hiringSignals": { "isHiring": false, "jobCount": 0, "positions": [], "urgency": "none" },
--   "newsSignals": { "recentNews": [], "fundingInfo": null },
--   "socialSignals": { "twitterActive": false, "linkedinActive": false },
--   "sources": [],
--   "errors": []
-- }

-- 企業分析用カラム
ALTER TABLE companies ADD COLUMN IF NOT EXISTS analysis_data JSONB DEFAULT '{}'::jsonb;
-- analysis_dataには以下を格納:
-- {
--   "overview": { "description": "", "headquarters": "", "businessModel": "" },
--   "marketPosition": { "rank": "", "trend": "", "strengths": [], "weaknesses": [] },
--   "competitors": [],
--   "opportunities": [],
--   "risks": [],
--   "recommendedApproach": { "strategy": "", "talkingPoints": [], "objectionHandling": [], "idealTiming": "" }
-- }

-- スコアリング詳細
ALTER TABLE companies ADD COLUMN IF NOT EXISTS score_value INTEGER DEFAULT 0;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS score_reasons JSONB DEFAULT '[]'::jsonb;

-- スクレイピング実行日時
ALTER TABLE companies ADD COLUMN IF NOT EXISTS scraped_at TIMESTAMP WITH TIME ZONE;
-- 分析実行日時
ALTER TABLE companies ADD COLUMN IF NOT EXISTS analyzed_at TIMESTAMP WITH TIME ZONE;

-- インデックス追加（検索性能向上）
CREATE INDEX IF NOT EXISTS idx_companies_intent_level ON companies(intent_level);
CREATE INDEX IF NOT EXISTS idx_companies_intent_score ON companies(intent_score);
CREATE INDEX IF NOT EXISTS idx_companies_buying_stage ON companies(buying_stage);
