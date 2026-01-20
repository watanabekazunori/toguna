# TOGUNA プロジェクト引き継ぎドキュメント

## プロジェクト概要

**TOGUNA** - AI搭載のB2Bテレマーケティングプラットフォーム

### 技術スタック
- **フロントエンド**: Next.js 14 (App Router), TypeScript, Tailwind CSS, shadcn/ui
- **バックエンド**: Supabase (PostgreSQL, Auth, RLS)
- **デプロイ**: Vercel
- **リポジトリ**: https://github.com/watanabekazunori/toguna

---

## 要件定義

### ユーザーロール
1. **ディレクター** (`role = 'director'`)
   - `/director` ダッシュボードにアクセス
   - クライアント管理、オペレーター管理、設定管理

2. **オペレーター** (`role = 'operator'`)
   - `/` オペレーターホーム画面にアクセス
   - 架電リスト、コールログ記録

### 主要機能
- ログイン認証（Supabase Auth）
- ロールベースのルーティング
- クライアント（案件）管理
- 企業リスト管理
- 架電ログ記録
- Zoom Phone連携（設定画面あり）

---

## 完了済み機能

### 認証システム
- [x] ログインページ (`/app/login/page.tsx`)
- [x] AuthContext (`/contexts/auth-context.tsx`)
- [x] Supabaseクライアント設定
- [x] ロールベースリダイレクト

### ディレクター機能
- [x] ディレクターダッシュボード (`/app/director/page.tsx`)
- [x] クライアント一覧・詳細・新規作成
- [x] オペレーター一覧・詳細
- [x] 設定画面（Zoom連携UI）

### オペレーター機能
- [x] オペレーターホーム (`/app/page.tsx`)
- [x] 架電リスト画面
- [x] コールログ記録

### データベース
- [x] `operators` テーブル（role, status, email, name等）
- [x] `clients` テーブル
- [x] `companies` テーブル
- [x] `call_logs` テーブル
- [x] RLSは現在**無効化**済み

---

## 本番環境になっていない機能

### Zoom Phone連携
- 設定画面UIのみ実装
- 実際のZoom API連携は未実装
- OAuth認証フロー未実装

### AI機能
- トークスクリプト生成（UI存在、バックエンド未実装）
- 通話分析（未実装）

### その他
- メール通知
- レポート出力
- データエクスポート

---

## 現状の問題

### 1. ログイン後のリダイレクト問題（最重要）

**症状**: `role = 'director'` のユーザーがログイン後、`/director` ではなく `/`（オペレーター画面）にリダイレクトされる

**原因**: コンソールに `AbortError: signal is aborted without reason` が表示され、`operators` テーブルからの `role` 取得が失敗している

**確認済み事項**:
- データベース: `watanabe@fanvest.co.jp` は `role = 'director'`, `status = 'active'` ✓
- RLS: 無効化済み ✓
- コードロジック: 正しい ✓

**修正済みコード**（未デプロイ）:
- `auth-context.tsx`: AbortError対応、マウント状態管理追加
- `login/page.tsx`: デバッグログ追加

### 2. Git Pushがプロキシエラーで失敗

```
fatal: unable to access 'https://github.com/watanabekazunori/toguna.git/': Received HTTP code 403 from proxy after CONNECT
```

**対応**: ローカルターミナルから `git push origin main` を実行する必要あり

---

## 未コミットの変更

現在のブランチに以下の修正がコミット済み（未プッシュ）:

```
commit 0df909a - fix: AbortErrorに対応した認証フローの修正
- auth-context.tsxにAbortError対応とマウント状態の管理を追加
- signIn関数でログイン成功時に即座にユーザー情報を取得・セット
- ログインページにデバッグログを追加してロール判定を可視化
```

---

## 新しいチャット用プロンプト

```
TOGUNAプロジェクトの続きをお願いします。

## 現状
- Next.js 14 + Supabase のテレマーケティングアプリ
- リポジトリ: /sessions/amazing-eloquent-cori/mnt/toguna

## 最優先の問題
ログイン後、`role = 'director'` のユーザーが `/director` ではなく `/` にリダイレクトされる。

原因: `AbortError: signal is aborted without reason` により、`operators` テーブルからの `role` 取得が失敗

## 確認済み
- DB: `watanabe@fanvest.co.jp` は `role = 'director'` ✓
- RLS: 無効化済み ✓
- 修正コード: コミット済み（未プッシュ）

## 次のアクション
1. ローカルで `git push origin main` を実行してデプロイ
2. デプロイ後、ログイン時のコンソールログを確認
3. まだ問題があれば、AbortErrorの根本原因を調査

## 参考ファイル
- /app/login/page.tsx - ログイン処理
- /contexts/auth-context.tsx - 認証コンテキスト
- /HANDOVER.md - このドキュメント
```

---

## ファイル構成（主要）

```
toguna/
├── app/
│   ├── page.tsx                 # オペレーターホーム
│   ├── login/page.tsx           # ログインページ
│   ├── director/
│   │   ├── page.tsx             # ディレクターダッシュボード
│   │   ├── clients/             # クライアント管理
│   │   ├── operators/           # オペレーター管理
│   │   └── settings/            # 設定
│   └── call-list/               # 架電リスト
├── contexts/
│   └── auth-context.tsx         # 認証コンテキスト
├── lib/
│   ├── supabase/
│   │   ├── client.ts            # ブラウザ用クライアント
│   │   └── server.ts            # サーバー用クライアント
│   └── actions/                 # Server Actions
└── components/ui/               # shadcn/ui コンポーネント
```

---

## 環境変数

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...
```

---

## 連絡先

- ユーザー: 渡邊和則
- Email: watanabe@fanvest.co.jp
