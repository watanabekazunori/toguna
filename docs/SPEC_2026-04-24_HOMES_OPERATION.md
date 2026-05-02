# HOME'S Operation 要件反映指示書

**作成日**: 2026-05-02
**ベース**: 2026-04-24 TOGUNA × LIFULL HOME'S 打合せ議事録
**対象**: TOGUNA HOME'S Operation Hub (`/app/homes/*`)
**マイルストーン**: **6/1 全ユーザー移行** (5/末暫定運用開始)
**ディレクター**: 渡邊
**Repo**: `Desktop/ファイル/開発/toguna`

---

## 0. エグゼクティブサマリー

| 指標 | 値 |
|---|---|
| 抽出GAP数 | 17件 |
| **P0 (6/1必須)** | **7件** |
| P1 (6月中) | 6件 |
| P2 (7月以降) | 4件 |
| 想定総工数 | 16〜22人日 (P0+P1) |
| クリティカルパス | リスト移行 → アポ成立4項目 → 不在時バリデーション |

> **意思決定**: 5/末暫定はP0のみ完了で開始可。アポ運用に直結する **C / E / F / H / M** は何があっても優先する。

---

## 1. GAP一覧 (議事録 → システム差分マトリクス)

### 1.1 P0: 対応必須 (6/1までに完了)

| ID | 議事録要件 | 現状 | あるべき姿 | 工数 |
|---|---|---|---|---|
| **GAP-A** | 全ユーザー (LIFULL HOME'S 全アポインター/クローザー/管理者) を6/1までに登録・ロール付与 | 個別登録のみ | CSV一括取り込み + 既存コムデスクID紐付け | 2人日 |
| **GAP-C** | 重複削除の識別子は **免許番号** | `homes_companies` に license_number 列なし (※要確認) | `license_number` 列追加 + UNIQUE INDEX、インポート時dedupeを免許番号基準に | 1.5人日 |
| **GAP-E** | 不在時は **先方氏名** と **折返し時間** を必須入力 | コール画面の不在登録は任意項目 | `result_secondary='absent'` 時に氏名・callback_at が無いと保存不可 | 1人日 |
| **GAP-F** | 無応答 **10回** で自動的に低優先度リストへ | カウンタなし | `homes_companies.no_answer_count` + Postgres trigger で priority='low' 自動切替 | 1人日 |
| **GAP-H** | アポ成立は **①日時確定 ②担当者名 ③メアド ④決済者かどうか** の4点全て収集が条件 | `AppointmentValidator` 雛形があるが call screen に未統合 | 4項目バリデータをコール画面のアポ確定モーダルに組込み、欠損時は保存不可 | 2人日 |
| **GAP-J** | 過去架電/録音データ移行は **まず100件サンプル** で構造確認 | 移行スクリプト無し | `scripts/migrate-comdesk.ts` (100件サンプルモード) + 録音ファイル Storage 投入 | 2人日 |
| **GAP-M** | 業態ランク (賃貸 / 売買 / 管理) を **入力必須** | `business_type` フィールド未必須 | NOT NULL + CHECK 制約、フォームバリデーション、既存データ移行 | 1人日 |

**P0 小計: 10.5人日**

### 1.2 P1: 望ましい (6月中対応)

| ID | 議事録要件 | 現状 | あるべき姿 | 工数 |
|---|---|---|---|---|
| **GAP-B** | リスト14万件・40種を **マスターリスト＋種類マーク** で絞り込み | リスト一覧はあるが種類マーク絞り込みUIなし | `/homes/lists` にマルチタグフィルタ (業態×ソース×新規/掲載済) 追加 | 1.5人日 |
| **GAP-D** | アポインター稼働ガード (9:30-18:30、コール開始25分から、定例水18:00) | ガードなし | コール画面に時間帯バナー、定例リマインダー、`homes_settings` テーブル新設 | 1人日 |
| **GAP-G** | 再架電は **時間帯指定NG** (集中するため) | callback_at を時刻まで取得 | callback_at を「日付のみ」or NULL推奨に変更、ネクストアクション自動時刻入力ロジック削除 | 0.5人日 |
| **GAP-I** | アポ→クローザー振り分けは **手動** (アポインターがカレンダー確認) | 振り分け機構未実装 | アポ確定モーダルに closer ピッカー + 各クローザーの当日空きスロット表示 | 2人日 |
| **GAP-N** | 行動管理表で **時間ごと** 確認可、ネクストアクション **5分前ポップアップ** | `/homes/activity` あり、時間軸ピボット弱い | hourly ピボットビュー + Service Worker / in-app toast で5分前通知 | 2人日 |
| **GAP-O** | 受注後に **申込書PDFアップロード → クローザー自動通知** | アップロード/通知なし | `homes_orders.application_pdf_url` + Supabase Storage + Edge Function (Slack/メール通知) | 1.5人日 |

**P1 小計: 8.5人日**

### 1.3 P2: 将来検討 (7月以降)

| ID | 議事録要件 | 現状 | あるべき姿 | 工数 |
|---|---|---|---|---|
| **GAP-K** | リスト割り振りロジックAI化、毎朝7:00自動生成 (ルールブック=藤原・五十嵐・藤井) | 未実装 | pg_cron + Edge Function、`homes_dispatch_rules` テーブル | 3人日 |
| **GAP-L** | スコアリング2軸 (過去掲載企業 / 新規開拓企業)、種類別チューニング | 未実装 | `homes_companies.score` + `homes_lists.score_profile` JSON、コールリスト並び替え | 2.5人日 |
| **GAP-P** | 審査管理スプシ連携 + 申込承認日から2ヶ月経過で再審査チェック自動オフ | `/homes/audit` に2ヶ月再審査フラグはあり、スプシ連携なし | Google Sheets API 連携 + daily cron で自動オフ | 2人日 |
| **GAP-Q** | 個人別分析ダッシュボード (過去半年・数字推移) | **✅ 実装済 ([app/homes/personal/page.tsx](../app/homes/personal/page.tsx))** | データ実流入のみ確認 | 0.2人日 |

**P2 小計: 7.7人日**

---

## 2. 各GAPの影響範囲詳細 (画面 / DB / ロジック)

### GAP-A — ユーザー一括移行 (P0)
- **画面**: `/homes/users` に「CSVインポート」ボタン追加
- **DB**: `homes_users` への bulk insert (既存スキーマで対応可)
- **ロジック**: `lib/homes/import-users.ts` 新規。役職→role マッピング、team_id 解決、初期パスワード発行 + メール
- **担当**: バックエンド1名

### GAP-B — 種類マーク絞り込み (P1)
- **画面**: `/homes/lists` (`app/homes/lists/page.tsx` ※確認要) と `/homes/call-list` (`app/homes/call-list/page.tsx`) にタグフィルタ
- **DB**: `homes_lists.tags TEXT[]` 追加 (例: `['rental','existing']`)、`homes_companies.business_type` を絞り込みに使う
- **ロジック**: クライアント側で `array_overlap` 検索、または PostgREST の `cs.{...}` クエリ

### GAP-C — 免許番号ベース重複削除 (P0) ★最優先
- **画面**: リストインポート画面に「重複行プレビュー」セクション追加
- **DB**:
  ```sql
  ALTER TABLE homes_companies
    ADD COLUMN license_number TEXT;
  CREATE UNIQUE INDEX ON homes_companies (license_number)
    WHERE license_number IS NOT NULL;
  ```
- **ロジック**: インポート時 ON CONFLICT DO UPDATE、欠損時はwarn表示
- **注意**: 法人番号・宅建番号での既存統合データは免許番号で再リコンサイル必要

### GAP-D — アポインター稼働ガード (P1)
- **画面**: `app/homes/call/page.tsx` 上部に「コール可能時間: 09:55 - 18:30」バナー、時間外は発信ボタン disable
- **DB**: `homes_settings (key, value)` 新設 (call_window_start='09:55' 等)
- **ロジック**: `useEffect` で現在時刻監視、定例 (毎週水18:00) の reminder toast

### GAP-E — 不在時必須入力 (P0)
- **画面**: `app/homes/call/page.tsx` の不在選択時、「先方氏名」「折返し時間 (時刻)」入力欄を必須化、未入力で保存ボタン disable
- **DB**: `homes_activities.callback_name TEXT`, `callback_at TIMESTAMPTZ` (※`callback_at` は既存利用の可能性あり、要確認)
- **ロジック**: zod or 手書きバリデータ、不在時 result_secondary に応じて条件分岐

### GAP-F — 無応答10回自動低優先度 (P0)
- **画面**: コール画面で「無応答」選択時に現在カウントを表示
- **DB**:
  ```sql
  ALTER TABLE homes_companies ADD COLUMN no_answer_count INT DEFAULT 0;
  -- trigger
  CREATE FUNCTION bump_no_answer() RETURNS trigger AS $$
  BEGIN
    IF NEW.result_primary = 'no_answer' THEN
      UPDATE homes_companies
        SET no_answer_count = no_answer_count + 1,
            priority = CASE WHEN no_answer_count + 1 >= 10 THEN 'low' ELSE priority END
        WHERE id = NEW.company_id;
    END IF;
    RETURN NEW;
  END $$ LANGUAGE plpgsql;
  ```
- **ロジック**: trigger AFTER INSERT ON homes_activities

### GAP-G — 再架電時刻指定オフ (P1)
- **画面**: `app/homes/call/page.tsx` のネクストアクション欄、callback_at は **日付のみ** ピッカーに変更、自動時刻入力削除
- **DB**: 変更不要 (callback_at の time部はNULLまたは00:00:00で運用)
- **ロジック**: 自動デフォルト時刻 (`new Date(...).setHours(13)` 等) を削除

### GAP-H — アポ成立4点バリデーション (P0) ★クリティカル
- **画面**: `app/homes/call/page.tsx` の「アポ獲得」ボタン押下で `<AppointmentModal>` を表示。4項目入力欠損時は保存ボタン disable
  - ① 商談日時 (datetime-local 必須)
  - ② 担当者名 (text 必須)
  - ③ メールアドレス (email 必須)
  - ④ 決済者かどうか (boolean 必須・true/false 二択)
- **DB**:
  ```sql
  ALTER TABLE homes_deals
    ADD COLUMN contact_email TEXT NOT NULL DEFAULT '',
    ADD COLUMN is_decision_maker BOOLEAN; -- nullable で「未確認」も許容
  ```
- **ロジック**: `lib/homes/validators/AppointmentValidator.ts` (既存雛形があれば流用) を `<AppointmentModal>` 内で hook、`onSubmit` でガード

### GAP-I — クローザー手動振り分け (P1)
- **画面**: アポ確定モーダルに closer 選択ドロップダウン追加。各 closer の当日確定アポ件数 + 直近7日カレンダーをミニ表示
- **DB**: 既存 `homes_deals.closer_user_id` 利用
- **ロジック**: `lib/homes/api.ts::getCloserAvailability(date)` 新設、homes_deals から日別件数集計

### GAP-J — 100件サンプル先行マイグレーション (P0)
- **画面**: なし (運用ツール)
- **DB**: 既存スキーマで対応可 + Storage bucket `legacy-recordings`
- **ロジック**: `scripts/migrate-comdesk.ts`
  - --sample 100 モード
  - フィールドマッピング表 (コムデスク → homes_*)
  - 録音ファイルは Storage signed URL 発行
  - Dry-run / Apply の二段階

### GAP-K — AI割り振り 毎朝7:00 (P2)
- **画面**: `/homes/lists` に「本日の割り振り結果」サマリー
- **DB**: `homes_dispatch_rules`, `homes_dispatch_runs` 新設
- **ロジック**: pg_cron `0 22 * * * UTC` (=JST 7:00)、Supabase Edge Function、ルールエンジン (藤原・五十嵐・藤井ヒアリング後)

### GAP-L — スコアリング2軸 (P2)
- **画面**: コールリストのソート初期値 = score 降順、ヘッダにロジック表示
- **DB**: `homes_companies.score NUMERIC`, `homes_companies.is_existing_publisher BOOLEAN`, `homes_lists.score_profile JSONB`
- **ロジック**: 種類マーク × 過去掲載フラグ で重み変更、夜間バッチで再計算

### GAP-M — 業態ランク必須化 (P0)
- **画面**: 全ての company 編集フォームで `business_type` を必須セレクト (賃貸/売買/管理)
- **DB**:
  ```sql
  ALTER TABLE homes_companies
    ALTER COLUMN business_type SET NOT NULL,
    ADD CONSTRAINT business_type_chk
      CHECK (business_type IN ('rental','sale','management'));
  ```
- **ロジック**: 既存 NULL データは事前マッピング (営業さんが手動補正できる UI 提供)

### GAP-N — 行動管理表 hourly + 5分前通知 (P1)
- **画面**: `app/homes/activity/page.tsx` に「時間別ピボット」トグル (00:00-23:00 × ユーザー × 結果)。5分前ポップアップは全画面共通の `<NextActionToaster>` でグローバル化
- **DB**: 既存 `homes_activities.next_action_at` を購読
- **ロジック**: クライアントポーリング (60秒) または Supabase Realtime で自分宛の next_action_at を監視

### GAP-O — 申込PDFアップ + 通知 (P1)
- **画面**: `app/homes/orders/page.tsx` (M-02) の行クリックで詳細モーダル → PDF ドラッグ&ドロップ
- **DB**: `homes_orders.application_pdf_url TEXT`, Supabase Storage bucket `application-forms`
- **ロジック**: アップロード完了で Edge Function 呼び出し → Slack Webhook (担当クローザーDM) + メール

### GAP-P — 審査スプシ連携 + 自動オフ (P2)
- **画面**: `app/homes/audit/page.tsx` (M-03) に「シート同期」ボタン
- **DB**: `homes_audit_sync_log` 新設
- **ロジック**: Google Sheets API、daily cron で `audit_approved_at + 2 month < now()` の row の `recheck_required` を false に

### GAP-Q — 個人別分析ダッシュボード (P2 / 既実装)
- **画面**: `app/homes/personal/page.tsx` ✅
- **DB**: 既存 `homes_activities` + `homes_orders` で対応済
- **残課題**: 実データ流入時のパフォーマンス確認 (6ヶ月分の集計)

---

## 3. 6/1 移行スケジュール

```
5/02 (今日)──────5/15────────5/22──────5/29──5/31────6/01
│                  │           │          │     │      │
│ P0 着手          │ P0 完了    │P1 完了   │暫定 │ 凍結  │ 全ユーザー
│ (GAP-A,C,J)      │           │ (GAP-B,D,│運用 │ 期間  │ 移行
│                  │           │  G,I,N,O)│開始 │       │
└──────────────────┴───────────┴──────────┴─────┴───────┴──────────
   GAP-E,F,H,M     QA期間1     QA期間2    実運用 最終  本番
                                                確認
```

| 週 | マイルストーン | 検収条件 |
|---|---|---|
| W18 (〜5/03) | P0 全件着手、本ドキュメントレビュー | チーム合意 |
| W19 (〜5/10) | GAP-A / C / J 完了 | 100件サンプル投入で重複検知が動く |
| W20 (〜5/17) | GAP-E / F / H / M 完了 | アポ4点入力欠損で保存できない |
| W21 (〜5/24) | P1 全件完了 + QA1 | 5名スタッフ実機テスト合格 |
| W22 (〜5/31) | 暫定運用 + 残課題対応 | 1日180コール × 5名で遅延なし |
| **6/01** | **全ユーザー本番移行** | 全アポインター・クローザーで稼働 |

---

## 4. 開発チームへの指示書

### 4.1 アサイン (推奨)

| 担当 | 範囲 | 工数 |
|---|---|---|
| バックエンド A | GAP-C / F / J / M (DB・移行) | 6人日 |
| バックエンド B | GAP-A / O / P (Edge Function・連携) | 5人日 |
| フロントエンド A | GAP-E / H / I (コール画面・モーダル) | 5人日 |
| フロントエンド B | GAP-B / D / G / N (リスト・行動表) | 5人日 |
| QA | 暫定/本番移行検収 | 通期 |

### 4.2 タスク発行ルール

各 GAP-ID で Linear / GitHub Issue を作成し、以下のテンプレで:

```markdown
**GAP-ID**: GAP-X
**P級**: P0 / P1 / P2
**議事録引用**: 「(該当文)」
**画面**: app/homes/.../page.tsx
**DB**: ALTER TABLE / 新規テーブル ...
**ロジック**: lib/homes/.../*.ts
**受入条件**:
- [ ] 〜が動く
- [ ] 〜が保存できる
- [ ] 〜のエラーが出る
**担当**: @xxx
**期日**: YYYY-MM-DD
```

### 4.3 PR ルール

- 1 GAP = 1 PR (cross-cut のみ複数 GAP まとめ可)
- スキーマ変更は migration ファイル (`supabase/migrations/<timestamp>_<gapid>_<desc>.sql`) を必ず添付
- P0 PR は **2人レビュー必須**、P1/P2 は1人で可
- 既存 RLS ポリシー破壊チェックを CI に組み込む

### 4.4 暫定運用 (5/末) で許容するもの

- GAP-K (AI割り振り) なし → 手動アサインで運用
- GAP-L (スコアリング) なし → 既存ソート順で運用
- GAP-P (スプシ連携) なし → 手動シート更新で運用
- GAP-N の 5分前通知が動かない → カレンダーで代替

### 4.5 暫定運用 (5/末) で **絶対に許容しない** もの

- アポ4点バリデーション (GAP-H) のスキップ
- 業態ランク (GAP-M) の任意化
- 免許番号 (GAP-C) 以外での重複削除
- 不在時必須入力 (GAP-E) のスキップ

---

## 5. 司令塔への引き継ぎサマリー

### 主要エンティティ (新規 / 変更)
- `homes_companies` (license_number / no_answer_count / business_type NOT NULL)
- `homes_deals` (contact_email / is_decision_maker)
- `homes_activities` (callback_name / callback_at)
- `homes_orders` (application_pdf_url)
- `homes_settings` (新規)
- `homes_dispatch_rules` (P2新規)
- `homes_audit_sync_log` (P2新規)

### ユースケースID一覧
- UC-01 アポインター: コール → 結果入力 (GAP-E, F)
- UC-02 アポインター: アポ確定 4点入力 (GAP-H)
- UC-03 アポインター: クローザー手動振り分け (GAP-I)
- UC-04 クローザー: 申込PDFアップ → 自動通知 (GAP-O)
- UC-05 マネジャー: hourly 行動確認 (GAP-N)
- UC-06 管理者: ユーザー一括登録 (GAP-A)
- UC-07 管理者: 100件サンプル移行 (GAP-J)

### 非機能要件サマリー
- 同時接続: アポインター13名 × クローザー10名 + マネジャー = 約30人想定
- レスポンス: コール画面の保存 1秒以内、リスト取得 3秒以内
- データ保管: 過去6ヶ月以上の架電履歴を高速参照可
- 通知: ネクストアクション5分前は誤差±30秒以内
- 録音保管: Storage 暗号化、3年保管

### 外部連携先
- コムデスク (移行元、ETL一回限り)
- Google Calendar (GAP-I のクローザー空き表示、要検討)
- Slack (GAP-O 通知)
- Google Sheets (GAP-P 審査連携、P2)

---

**END OF SPEC** — 不明点は渡邊までエスカレーション
