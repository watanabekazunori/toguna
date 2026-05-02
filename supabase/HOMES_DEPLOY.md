# TOGUNA HOME'S デプロイ手順

## 構成
```
supabase/
├── config.toml                                  # supabase init で生成 (project_id="toguna")
├── homes_full.sql                               # 3migration を結合した一発適用用SQL
└── migrations/
    ├── 20260502_homes_toguna_schema.sql         # テーブル/トリガ/View/RPC
    ├── 20260502_homes_toguna_rls.sql            # RLSポリシー
    └── 20260502_homes_toguna_seed.sql           # 種データ (23ユーザー/エリア/稟議/サンプル法人)
```

## 適用方法 (3パターン)

### A. CLI から push (推奨)
1. Supabase Dashboard → Settings → API で `Project Ref` と `Service Role Key` を取得
2. ターミナルから:
```bash
cd /Users/watanabekazunori/Desktop/ファイル/開発/toguna
supabase login                           # 初回のみ
supabase link --project-ref <project-ref>
supabase db push                          # 3つの migration を順次適用
```

### B. Dashboard SQL Editor で一発投入
1. Supabase Dashboard → SQL Editor → New query
2. `supabase/homes_full.sql` の内容をコピー&ペースト
3. Run

### C. ローカル開発スタック (Docker 必要)
```bash
brew install --cask docker
supabase start                            # ローカル PostgreSQL を起動
supabase db reset                         # 全 migration を適用
```

## 認証連携 (Supabase Auth ↔ homes_users)

シード投入後、`auth_user_id` は NULL です。本番運用では:

1. ADMIN が Auth ユーザーを Supabase Dashboard or `supabase auth signup` で作成
2. 同じメールで homes_users にレコードを置いておく (シード済)
3. SQL で auth.users.id を homes_users.auth_user_id に紐付け:

```sql
UPDATE homes_users hu
SET auth_user_id = au.id
FROM auth.users au
WHERE au.email = hu.email AND hu.auth_user_id IS NULL;
```

または、新規 Auth サインアップ時にトリガで自動連携 (推奨):

```sql
CREATE OR REPLACE FUNCTION sync_homes_user_on_signup()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE homes_users
     SET auth_user_id = NEW.id
   WHERE email = NEW.email AND auth_user_id IS NULL;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_signup
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION sync_homes_user_on_signup();
```

## .env.local 設定

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ... (anon public key)
```

## 動作確認

### 1. テーブル一覧
```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema='public' AND table_name LIKE 'homes_%'
ORDER BY table_name;
```
→ 13 件 (homes_activities, homes_approvals, homes_areas, homes_collections, homes_companies, homes_deals, homes_lists, homes_meetings, homes_orders, homes_teams, homes_users, homes_yomi_rates) + view 5件

### 2. 種データ
```sql
SELECT role, COUNT(*) FROM homes_users GROUP BY role ORDER BY role;
-- ADMIN:1, APPOINTER:15, CLOSER:4, COLLECTOR:2, PM:1, SV:2  (= 23)

SELECT * FROM homes_v_yomi_forecast;     -- 受注予測 view (deal 0件時は空)
```

### 3. ヨミ率の自動算出 (RPC + Trigger)
```sql
-- yomi_rates テーブルから自動コピーされることを確認
INSERT INTO homes_meetings (deal_id, meeting_seq, status, yomi)
VALUES ('<dealのUUID>', 1, 'done', 'A_circle')
RETURNING yomi_rate;  -- => 0.95
```

### 4. RPC: 次架電先取得
```sql
SELECT * FROM homes_next_dial_target('<userのUUID>'::UUID, 24);
```

## Phase 2 以降の運用

- **CSV インポート**: `/homes/lists` 画面 → ファイルアップロード (POST /api/homes/companies/import)
- **CSV エクスポート**: `/homes/call-list` → 「CSV エクスポート」ボタン (GET /api/homes/companies/export)
- **次架電取得**: `/homes/call` 画面の「次の架電先を取得」ボタン (POST /api/homes/companies/next-target)
- **Zoom Phone 連携**: `homes_users.zoom_phone_user_id` と `homes_activities.zoom_call_id` 経由で webhook 受け
- **稟議番号自動付与**: 商談ヨミ判定時に該当エリアの `homes_approvals` を候補表示 (UI実装済)

## 緊急時のロールバック

```bash
supabase migration list                   # migration 一覧確認
supabase db reset --version 20260211      # HOMES 投入前に戻す (ローカル)
# 本番では Supabase Dashboard → Database → Backups から復元
```
