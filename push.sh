#!/bin/bash
# TOGUNA - 全新機能をGitHubにpush
set -e

echo "=== TOGUNA 全機能push ==="

# index.lockがあれば削除
rm -f .git/index.lock

# リモートの最新を取得
echo "1. リモートから最新を取得中..."
git fetch origin main

# リモートの変更をマージ（tsconfig.jsonの修正等）
echo "2. リモートの変更をマージ中..."
git merge origin/main --no-edit -X ours || true

# .gitignoreにバックエンドとnode_modulesを追加
echo "3. .gitignore更新中..."
if ! grep -q "^backend/" .gitignore 2>/dev/null; then
  echo "" >> .gitignore
  echo "# Old backend/frontend directories" >> .gitignore
  echo "backend/" >> .gitignore
  echo "frontend/" >> .gitignore
fi

# 全ファイルをステージング（.DS_Storeと仕様書は除外）
echo "4. ファイルをステージング中..."
git add -A
git reset HEAD -- "TOGUNA_全機能仕様書.docx" 2>/dev/null || true
git reset HEAD -- .DS_Store 2>/dev/null || true
git reset HEAD -- app/.DS_Store 2>/dev/null || true
git reset HEAD -- supabase/.DS_Store 2>/dev/null || true

# コミット
echo "5. コミット中..."
git commit -m "feat: 戦略分析・Zoom連携・全管理機能を追加

- プロジェクト管理 + AI戦略分析（3C/4P/STP/ロードマップ）
- Zoom Phone連携（OAuth2認証・発信・通話制御）
- インキュベーション（断り分析・クロスセル提案）
- ナーチャリング（マルチチャネル自動フォロー）
- コンプライアンス管理・不正検知
- 品質管理（Quality Commander）
- ゴールデンコール（通話録音・分析）
- セールスフロア（リアルタイム営業ダッシュボード）
- 請求・プラン管理・トライアル管理
- サポートチャット・ナレッジDNA
- APIルート（25+エンドポイント）
- エラーハンドリング・ページネーション・認証強化"

# プッシュ
echo "6. GitHubにpush中..."
git push origin main

echo ""
echo "✅ push完了！Vercelが自動でデプロイを開始します。"
echo "   https://toguna.vercel.app で確認してください。"
