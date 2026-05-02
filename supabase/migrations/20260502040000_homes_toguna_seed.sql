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
