-- TOGUNA テーブル定義
-- Supabaseダッシュボードの SQL Editor で実行してください

-- クライアント（営業代行の依頼元企業）
CREATE TABLE IF NOT EXISTS clients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  contact_person TEXT,
  contact_email TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  industry TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- オペレーター（架電担当者）
CREATE TABLE IF NOT EXISTS operators (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  role TEXT DEFAULT 'operator' CHECK (role IN ('director', 'operator')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 企業（架電先）
CREATE TABLE IF NOT EXISTS companies (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  industry TEXT,
  employees INTEGER,
  location TEXT,
  phone TEXT,
  website TEXT,
  status TEXT DEFAULT '未架電',
  rank TEXT DEFAULT 'C' CHECK (rank IN ('S', 'A', 'B', 'C')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 架電ログ
CREATE TABLE IF NOT EXISTS call_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  operator_id UUID REFERENCES operators(id) ON DELETE SET NULL,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  result TEXT NOT NULL,
  duration INTEGER DEFAULT 0,
  notes TEXT,
  called_at TIMESTAMPTZ DEFAULT NOW()
);

-- 商材
CREATE TABLE IF NOT EXISTS products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  target_industries JSONB DEFAULT '[]',
  target_employee_range JSONB DEFAULT '{"min": 0, "max": 10000}',
  target_revenue JSONB,
  target_locations JSONB DEFAULT '[]',
  keywords JSONB DEFAULT '[]',
  benefits JSONB DEFAULT '[]',
  ideal_customer_profile TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS (Row Level Security) を有効化
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE operators ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- 認証済みユーザーに全アクセスを許可するポリシー
CREATE POLICY "Allow all for authenticated users" ON clients
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow all for authenticated users" ON operators
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow all for authenticated users" ON companies
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow all for authenticated users" ON call_logs
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow all for authenticated users" ON products
  FOR ALL USING (auth.role() = 'authenticated');

-- インデックス
CREATE INDEX IF NOT EXISTS idx_companies_client_id ON companies(client_id);
CREATE INDEX IF NOT EXISTS idx_companies_rank ON companies(rank);
CREATE INDEX IF NOT EXISTS idx_call_logs_company_id ON call_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_client_id ON call_logs(client_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_called_at ON call_logs(called_at);
CREATE INDEX IF NOT EXISTS idx_products_client_id ON products(client_id);

-- サンプルデータ投入
INSERT INTO clients (id, name, industry, contact_email) VALUES
  ('11111111-1111-1111-1111-111111111111', 'デモクライアント（不動産会社A）', '不動産', 'demo@example.com')
ON CONFLICT (id) DO NOTHING;

INSERT INTO operators (id, name, email, phone, status, role) VALUES
  ('22222222-2222-2222-2222-222222222222', '山田太郎', 'yamada@example.com', '090-1234-5678', 'active', 'operator')
ON CONFLICT (id) DO NOTHING;

INSERT INTO companies (id, client_id, name, industry, employees, location, phone, rank, status) VALUES
  ('33333333-3333-3333-3333-333333333331', '11111111-1111-1111-1111-111111111111', 'サンプル株式会社', 'IT', 150, '東京都渋谷区', '03-1234-5678', 'S', '未架電'),
  ('33333333-3333-3333-3333-333333333332', '11111111-1111-1111-1111-111111111111', 'テスト工業株式会社', '製造業', 500, '大阪府大阪市', '06-9876-5432', 'A', '未架電'),
  ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'デモ商事株式会社', '卸売業', 80, '神奈川県横浜市', '045-1111-2222', 'B', '未架電')
ON CONFLICT (id) DO NOTHING;
