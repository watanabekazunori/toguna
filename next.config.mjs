/** @type {import('next').NextConfig} */
const nextConfig = {
  // TypeScriptエラーは修正済みなので無視しない
  typescript: {
    ignoreBuildErrors: false,
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
