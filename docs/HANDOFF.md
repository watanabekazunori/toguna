# TOGUNA プロジェクト引き継ぎドキュメント

**更新日:** 2026年1月15日
**進捗:** 約98%完了

---

## プロジェクト概要

TOGUNA は B2B不動産営業向けのAI搭載テレマーケティング支援プラットフォームです。

### 技術スタック

**フロントエンド:**
- Next.js 16 (App Router)
- TypeScript
- Tailwind CSS
- shadcn/ui コンポーネント
- Lucide React アイコン

**バックエンド:**
- Node.js + Express
- Supabase (認証 + データベース + Realtime)
- OpenAI GPT-4o-mini (AIスコアリング・スクリプト生成)

**インフラ:**
- Vercel (フロントエンド)
- Railway (バックエンド)
- Supabase (PostgreSQL)

---

## 完了済み機能 ✅

### 1. 認証システム (Supabase Auth)
- **ファイル:**
  - `lib/supabase/client.ts` - ブラウザ用クライアント
  - `lib/supabase/server.ts` - サーバー用クライアント
  - `lib/supabase/middleware.ts` - セッション管理
  - `contexts/auth-context.tsx` - 認証コンテキスト
  - `middleware.ts` - ルート保護
  - `app/login/page.tsx` - ログイン画面

- **機能:**
  - メール/パスワード認証
  - ロールベースアクセス制御 (director / operator)
  - 自動リダイレクト（未認証→ログイン、認証済み→ダッシュボード）

### 2. API クライアント
- **ファイル:** `lib/api.ts`
- **エンドポイント:**
  ```typescript
  // クライアント管理
  getClients() / createClient(data) / deleteClient(id)

  // オペレーター管理
  getOperators() / getOperator(id)

  // 企業リスト
  getCompanies(filters) / getCompany(id)

  // 架電ログ
  getCallLogs(filters) / createCallLog(data)

  // AI機能
  scoreCompany(companyId) / generateScript(companyId, clientId)

  // CSVアップロード
  uploadCompaniesCSV(file, clientId)
  ```

### 3. ダッシュボードグラフ (NEW ✅)
- **ファイル:**
  - `components/charts/index.ts` - エクスポート
  - `components/charts/daily-calls-chart.tsx` - 日別推移エリアチャート
  - `components/charts/result-pie-chart.tsx` - 結果分布円グラフ
  - `components/charts/operator-bar-chart.tsx` - オペレーター別棒グラフ
  - `components/charts/hourly-chart.tsx` - 時間帯別棒グラフ

- **機能:**
  - Recharts による可視化
  - 日別の架電数/接続数/アポ獲得数推移
  - 架電結果の分布（円グラフ）
  - オペレーター別パフォーマンス比較
  - 時間帯別架電実績

- **使用方法:**
  ```tsx
  import { DailyCallsChart, ResultPieChart, OperatorBarChart } from '@/components/charts'

  <DailyCallsChart data={dailyData} height={300} />
  <ResultPieChart data={pieData} height={300} />
  <OperatorBarChart data={operatorData} height={300} />
  ```

### 4. リアルタイム通知システム (NEW ✅)
- **ファイル:**
  - `lib/realtime.ts` - Supabase Realtime ラッパー
  - `contexts/notification-context.tsx` - 通知コンテキスト
  - `components/notification-toast.tsx` - トースト通知UI
  - `components/notification-dropdown.tsx` - 通知一覧ドロップダウン

- **機能:**
  - アポ獲得時のリアルタイム通知（Supabase Realtime）
  - トースト通知（スタック表示、自動消去）
  - 通知一覧ドロップダウン（既読/未読管理）
  - ブラウザ通知対応
  - 通知音再生（`/public/sounds/notification.mp3` を配置すれば有効）

- **使用方法:**
  ```typescript
  // 通知を受け取る（自動で購読される）
  import { useNotifications } from '@/contexts/notification-context'

  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications()

  // 手動で通知を追加する場合
  const { addNotification } = useNotifications()
  addNotification({
    type: 'appointment',
    title: 'アポ獲得！',
    message: '田中さんがWHEREからアポを獲得しました',
  })
  ```

### 5. インテント調査・企業分析 (NEW ✅)
- **ファイル:**
  - `lib/api.ts` - API関数（analyzeIntent, analyzeCompany, runFullAnalysis, runBatchAnalysis）
  - `components/company-analysis-modal.tsx` - 企業分析モーダル
  - `app/director/upload/page.tsx` - CSVアップロード画面（分析機能統合）

- **機能:**
  - **インテント調査:**
    - インテントスコア (0-100)
    - リードレベル (HOT / WARM / COLD)
    - 購買段階 (認知 / 検討 / 決定)
    - シグナル検出（採用、事業拡大、資金調達、ニュース、技術導入）
    - 最適コンタクトタイミング

  - **企業分析:**
    - 企業概要（設立年、代表、事業モデル）
    - 市場ポジション（業界順位、シェア、成長トレンド）
    - 強み・弱み分析
    - 競合情報
    - 機会とリスク

  - **アプローチ戦略:**
    - 推奨戦略
    - トークポイント
    - 想定反論と対策
    - 理想的タイミング

- **使用方法:**
  ```typescript
  import { runFullAnalysis, analyzeIntent, analyzeCompany } from '@/lib/api'

  // フル分析（スコアリング + インテント + 企業分析）
  const result = await runFullAnalysis(company)
  // result.score, result.intent, result.analysis

  // バッチ分析（複数企業）
  const batchResult = await runBatchAnalysis(companies)
  // batchResult.results, batchResult.summary.hotLeads
  ```

- **UI:**
  - CSVアップロード後の企業一覧にインテント列追加
  - 各企業の「分析」ボタンでモーダル表示
  - 3タブ構成: インテント / 企業分析 / アプローチ

### 6. 商材マッチング機能 (NEW ✅)
- **ファイル:**
  - `lib/api.ts` - Product型、マッチングAPI関数
  - `app/director/products/page.tsx` - 商材一覧・マッチ企業検索
  - `app/director/products/new/page.tsx` - 商材登録画面
  - `app/call-list/page.tsx` - 架電リストに商材マッチ度表示

- **機能:**
  - **商材管理:**
    - 商材の登録・編集・削除
    - ターゲット業界・従業員規模・地域の設定
    - キーワード・導入メリットの設定
    - AIによる理想顧客プロファイル(ICP)自動生成

  - **企業マッチング:**
    - 商材にマッチする企業を自動検出
    - マッチスコア（0-100）と理由表示
    - マッチレベル（最適/良好/適合/低）
    - 業界・規模・地域でのマッチング計算

  - **架電リスト連携:**
    - 商材選択で企業にマッチ度バッジ表示
    - マッチ度順のソート機能
    - マッチ理由の詳細表示

- **使用方法:**
  ```typescript
  import { getProducts, getMatchingCompanies, createProduct } from '@/lib/api'

  // 商材にマッチする企業を取得
  const { matches, summary } = await getMatchingCompanies(productId, { limit: 10 })
  // matches[0].matchScore, matches[0].matchLevel, matches[0].matchReasons
  ```

### 7. Zoom Phone連携 (NEW ✅)
- **ファイル:**
  - `lib/zoom.ts` - Zoom Phone APIクライアント
  - `app/actions/zoom.ts` - Server Actions (発信・終了・ステータス取得)
  - `app/call/page.tsx` - 架電画面にZoom発信ボタン
  - `app/director/settings/page.tsx` - Zoom接続状態・ユーザー一覧表示

- **機能:**
  - **OAuth2認証:**
    - Server-to-Server OAuth (Client Credentials)
    - アクセストークンの自動キャッシュ・更新
    - 環境変数: `ZOOM_ACCOUNT_ID`, `ZOOM_CLIENT_ID`, `ZOOM_CLIENT_SECRET`

  - **架電機能:**
    - ワンクリック発信 (Zoom Phone経由)
    - 通話ステータスリアルタイム監視
    - 通話終了処理
    - 通話履歴取得

  - **管理機能:**
    - Phone対応ユーザー一覧取得
    - 接続テスト機能
    - 設定画面でのステータス表示

- **使用方法:**
  ```typescript
  // Server Actions経由で安全に呼び出し
  import { initiateZoomCall, endZoomCall, getZoomCallStatus } from '@/app/actions/zoom'

  // 発信
  const result = await initiateZoomCall({
    userId: 'zoom-user-id',
    phoneNumber: '03-1234-5678',
  })

  // ステータス確認
  const status = await getZoomCallStatus({
    userId: 'zoom-user-id',
    callId: result.callSession.call_id,
  })

  // 終了
  await endZoomCall({
    userId: 'zoom-user-id',
    callId: result.callSession.call_id,
  })
  ```

- **電話番号フォーマット:**
  - 日本の電話番号をE.164形式に自動変換
  - 例: `03-1234-5678` → `+81312345678`

### 8. エクスポート機能 (NEW ✅)
- **ファイル:**
  - `lib/export.ts` - エクスポートライブラリ
  - `app/director/reports/page.tsx` - レポート画面（エクスポートボタン）

- **機能:**
  - **CSV出力:**
    - 日別レポート (日付、架電数、接続数、アポ獲得数、率)
    - オペレーター別レポート (名前、架電数、アポ獲得数、率)
    - 企業リスト出力
    - BOM付きUTF-8でExcel文字化け対策

  - **PDF出力:**
    - サマリーレポート（印刷ダイアログ経由）
    - 統計サマリー表示
    - オペレーター別テーブル
    - プロフェッショナルなレイアウト

- **使用方法:**
  ```typescript
  import {
    exportDailyReport,
    exportOperatorReport,
    exportToPDF,
    formatDateTimeForExport,
  } from '@/lib/export'

  // CSVエクスポート
  exportDailyReport(data, 'レポート_2026-01-15')

  // PDFエクスポート
  exportToPDF({
    title: 'レポートタイトル',
    generatedAt: formatDateTimeForExport(new Date()),
    summary: [{ label: '総架電数', value: 180 }],
    tableData: { headers: [...], rows: [...] },
  })
  ```

### 9. ディレクター画面

| 画面 | パス | 機能 |
|------|------|------|
| ダッシュボード | `/director` | 概要統計、クイックアクション、通知ドロップダウン |
| クライアント一覧 | `/director/clients` | 一覧表示、削除 |
| クライアント登録 | `/director/clients/new` | 新規登録フォーム |
| 商材一覧 | `/director/products` | 商材一覧、マッチ企業検索 |
| 商材登録 | `/director/products/new` | 新規商材登録フォーム |
| CSVアップロード | `/director/upload` | CSV取込、AIスコアリング、インテント調査、企業分析 |
| オペレーター一覧 | `/director/operators` | 一覧、稼働状況 |
| オペレーター詳細 | `/director/operators/[id]` | 個人統計、架電履歴 |
| レポート | `/director/reports` | 期間別集計、AI分析、CSV/PDFエクスポート |
| スケジュール | `/director/schedule` | ガントチャート形式 |
| AI提案 | `/director/ai-suggestions` | 改善提案リスト |
| 設定 | `/director/settings` | システム設定 |

### 10. オペレーター画面

| 画面 | パス | 機能 |
|------|------|------|
| 架電リスト | `/call-list` | 企業一覧、フィルター、商材マッチング |
| 架電画面 | `/call` | タイマー、AIスクリプト、結果登録、Zoom発信 |

---

## 残タスク（優先度順）

### 低優先度 🟢

#### 1. メール通知
**目的:** 日次/週次レポート自動送信

**実装方針:**
- Resend または SendGrid API
- Supabase Edge Functions でスケジュール実行

#### 2. 多言語対応
**目的:** 英語UI対応

**実装方針:**
- next-intl または react-i18next
- `locales/ja.json`, `locales/en.json`

---

## データベーススキーマ

```sql
-- 主要テーブル
operators (id, name, email, phone, role, status, created_at)
clients (id, name, industry, contact_person, email, phone, created_at)
companies (id, client_id, name, phone, address, industry, employee_count, revenue, ai_score, ai_rank, status, created_at)
call_logs (id, company_id, operator_id, result, duration, notes, called_at)

-- role: 'director' | 'operator'
-- status: 'active' | 'inactive'
-- ai_rank: 'S' | 'A' | 'B' | 'C' | 'D'
-- result: '接続' | 'アポ獲得' | '不在' | '担当者不在' | '断り' | 'NG'
```

---

## 環境変数

```env
# .env.local
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx
NEXT_PUBLIC_API_URL=http://localhost:3001/api

# バックエンド側（Railway）
OPENAI_API_KEY=sk-xxx
SUPABASE_SERVICE_ROLE_KEY=eyJxxx
ZOOM_ACCOUNT_ID=xxx
ZOOM_CLIENT_ID=xxx
ZOOM_CLIENT_SECRET=xxx
```

---

## ディレクトリ構造

```
toguna/
├── app/
│   ├── layout.tsx          # ルートレイアウト (AuthProvider + NotificationProvider)
│   ├── page.tsx            # オペレーターダッシュボード
│   ├── login/page.tsx      # ログイン
│   ├── call-list/page.tsx  # 架電リスト
│   ├── call/page.tsx       # 架電画面
│   └── director/
│       ├── page.tsx        # ディレクターダッシュボード（通知ドロップダウン付き）
│       ├── clients/        # クライアント管理
│       ├── upload/         # CSVアップロード
│       ├── operators/      # オペレーター管理
│       ├── reports/        # レポート
│       ├── schedule/       # スケジュール
│       ├── ai-suggestions/ # AI提案
│       └── settings/       # 設定
├── components/
│   ├── ui/                 # shadcn/ui コンポーネント
│   ├── charts/             # Rechartsチャートコンポーネント
│   ├── company-analysis-modal.tsx  # 企業分析モーダル
│   ├── notification-toast.tsx      # トースト通知
│   └── notification-dropdown.tsx   # 通知ドロップダウン
├── contexts/
│   ├── auth-context.tsx         # 認証コンテキスト
│   └── notification-context.tsx # 通知コンテキスト
├── lib/
│   ├── api.ts              # APIクライアント
│   ├── realtime.ts         # Supabase Realtime ラッパー
│   ├── zoom.ts             # Zoom Phone APIクライアント
│   ├── export.ts           # CSV/PDFエクスポート
│   ├── utils.ts            # ユーティリティ
│   └── supabase/           # Supabaseクライアント
├── app/
│   └── actions/
│       └── zoom.ts         # Zoom Server Actions
├── docs/
│   ├── AUTH_SETUP.md       # 認証セットアップ手順
│   └── HANDOFF.md          # この引き継ぎ書
└── supabase/
    └── migrations/         # DBマイグレーション
```

---

## 開発コマンド

```bash
# 開発サーバー起動
npm run dev

# ビルド
npm run build

# 型チェック
npx tsc --noEmit

# Lint
npm run lint
```

---

## 注意事項

1. **npm install が E403 エラー**
   - 直接 `package.json` を編集してパッケージを追加する

2. **認証テスト用アカウント**
   - Supabase Dashboard で作成する必要あり
   - operators テーブルに role='director' のレコードを追加

3. **APIはモック状態**
   - 現在 `lib/api.ts` はバックエンドAPIを呼び出す設計
   - バックエンドが未起動の場合はエラーになる
   - 必要に応じてモックデータに切り替え可能

4. **AIスコアリング**
   - バックエンド側で OpenAI API を呼び出す
   - `OPENAI_API_KEY` が必要

5. **リアルタイム通知**
   - Supabase の Realtime 機能を使用
   - Supabase Dashboard で Realtime を有効にする必要あり
   - `call_logs` テーブルへの INSERT をトリガーに通知

---

## 連絡先

質問があれば、このドキュメントと合わせてコードを確認してください。
主要なロジックは以下に集約されています：
- `lib/api.ts` - API通信
- `lib/realtime.ts` - リアルタイム通知
- `lib/zoom.ts` - Zoom Phone連携
- `lib/export.ts` - CSV/PDFエクスポート
- `app/actions/zoom.ts` - Zoom Server Actions
- `contexts/auth-context.tsx` - 認証
- `contexts/notification-context.tsx` - 通知管理
