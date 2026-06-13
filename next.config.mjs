/** @type {import('next').NextConfig} */
const nextConfig = {
  // Phase 6 本番ビルド時の型チェックは tsc --noEmit で別途完走済(0 エラー)。
  // Next.js の build フェーズで TypeScript を回す層がデッドロックする (
  // googleapis / @google-cloud/vertexai の大型型定義) ため、build 段階の型検査は
  // skip して webpack コンパイルだけ通す。CI 側で `pnpm tsc --noEmit` を別途必須。
  typescript: {
    ignoreBuildErrors: true,
  },
  // 画像最適化を無効化（外部画像がないため）
  images: {
    unoptimized: true,
  },
  // 実験的機能: パッケージインポートの最適化
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-select',
      '@radix-ui/react-tabs',
      '@radix-ui/react-progress',
      'recharts',
    ],
  },
  // ログレベル（エラーのみ表示で高速化）
  logging: {
    fetches: {
      fullUrl: false,
    },
  },
}

export default nextConfig
