# TOGUNA 認証機能セットアップガイド

## 概要

TOGUNAプロジェクトにSupabase Authを使用した認証機能を追加しました。
このガイドでは、認証機能を有効にするための手順を説明します。

## 追加されたファイル

```
toguna/
├── lib/supabase/
│   ├── client.ts        # ブラウザ用Supabaseクライアント
│   ├── server.ts        # サーバー用Supabaseクライアント
│   └── middleware.ts    # 認証ミドルウェア
├── contexts/
│   └── auth-context.tsx # 認証コンテキスト（useAuth hook）
├── app/
│   ├── login/page.tsx   # ログイン画面
│   └── director/page.tsx # ディレクターダッシュボード
├── middleware.ts        # Next.jsミドルウェア（認証チェック）
├── .env.local          # 環境変数（本番用に更新してください）
└── supabase/migrations/
    └── 001_add_role_to_operators.sql # DBマイグレーション
```

## セットアップ手順

### 1. 依存パッケージのインストール

```bash
cd ~/toguna/frontend
npm install
# または
pnpm install
```

package.jsonに以下が追加されています：
- `@supabase/supabase-js`
- `@supabase/ssr`

### 2. Supabaseでの設定

#### 2.1 認証を有効化

1. [Supabase Dashboard](https://supabase.com/dashboard) にログイン
2. TOGUNAプロジェクトを選択
3. Authentication > Providers で「Email」が有効になっていることを確認

#### 2.2 データベースマイグレーション

SQL Editorで以下を実行：

```sql
-- operatorsテーブルにroleカラムを追加
ALTER TABLE operators
ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'operator';

-- roleの値を制限
ALTER TABLE operators
ADD CONSTRAINT operators_role_check
CHECK (role IN ('director', 'operator'));
```

#### 2.3 テストユーザーの作成

Supabase Dashboard > Authentication > Users で新規ユーザーを作成：

**ディレクター用：**
- Email: director@toguna.com
- Password: （任意のパスワード）

**オペレーター用：**
- Email: operator@toguna.com
- Password: （任意のパスワード）

その後、SQL Editorでロールを設定：

```sql
-- ディレクターのロール設定
UPDATE operators
SET role = 'director'
WHERE email = 'director@toguna.com';

-- または、手動でoperatorsテーブルにユーザーを追加
INSERT INTO operators (id, name, email, phone, status, role)
VALUES (
  gen_random_uuid(),
  '管理者',
  'director@toguna.com',
  '090-0000-0000',
  'active',
  'director'
);
```

### 3. 環境変数の確認

`.env.local` ファイルの内容を確認：

```env
NEXT_PUBLIC_SUPABASE_URL=https://dsotzncboiwzlzihptiz.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_API_URL=https://toguna-production.up.railway.app/api
```

### 4. 動作確認

```bash
npm run dev
```

1. http://localhost:3000 にアクセス → `/login` にリダイレクトされる
2. ディレクターでログイン → `/director` に遷移
3. オペレーターでログイン → `/`（オペレーターホーム）に遷移

## 認証フロー

```
┌─────────────────────────────────────────────────────┐
│                   ユーザーアクセス                    │
└─────────────────────────┬───────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────┐
│              middleware.ts（認証チェック）            │
│  - /login以外のページは認証必須                        │
│  - 未認証 → /login へリダイレクト                      │
└─────────────────────────┬───────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────┐
│                  ログイン画面                         │
│  - メールアドレス + パスワード認証                     │
│  - Supabase Auth で認証                              │
└─────────────────────────┬───────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────┐
│             operatorsテーブルからロール取得            │
│  - role = 'director' → /director                    │
│  - role = 'operator' → /（オペレーターホーム）        │
└─────────────────────────────────────────────────────┘
```

## useAuth Hook

認証状態にアクセスするには `useAuth` hookを使用：

```tsx
import { useAuth } from '@/contexts/auth-context'

function MyComponent() {
  const { user, isLoading, isDirector, isOperator, signOut } = useAuth()

  if (isLoading) return <div>Loading...</div>

  return (
    <div>
      <p>ようこそ、{user?.name}さん</p>
      {isDirector && <p>ディレクター権限があります</p>}
      <button onClick={signOut}>ログアウト</button>
    </div>
  )
}
```

## Vercelデプロイ時の設定

Vercel Dashboard > Settings > Environment Variables に追加：

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## トラブルシューティング

### ログインできない

1. Supabase Dashboardで認証が有効になっているか確認
2. ユーザーが作成されているか確認
3. 環境変数が正しく設定されているか確認

### ロールが反映されない

1. operatorsテーブルにroleカラムがあるか確認
2. ログインユーザーのメールアドレスがoperatorsテーブルに存在するか確認
3. roleの値が'director'または'operator'になっているか確認

### ミドルウェアが動作しない

1. `middleware.ts` がプロジェクトルートにあることを確認
2. `matcher`の設定が正しいか確認
