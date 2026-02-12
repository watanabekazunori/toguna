import { Home } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 dark:from-slate-950 dark:via-blue-950 dark:to-slate-900 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl p-8 space-y-6">
          {/* 404 Number */}
          <div className="flex justify-center">
            <div className="text-6xl font-bold bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent">
              404
            </div>
          </div>

          {/* Error Title */}
          <div className="text-center space-y-3">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              ページが見つかりません
            </h1>
            <p className="text-slate-600 dark:text-slate-400">
              お探しのページは存在しないか、移動した可能性があります
            </p>
          </div>

          {/* Illustration */}
          <div className="flex justify-center py-6">
            <div className="w-24 h-24 bg-blue-100 dark:bg-blue-950/30 rounded-full flex items-center justify-center">
              <div className="text-4xl">🔍</div>
            </div>
          </div>

          {/* Description */}
          <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <p className="text-sm text-slate-700 dark:text-slate-300 text-center">
              URLが正しいか確認してください。または、以下のボタンからダッシュボードに戻ることができます。
            </p>
          </div>

          {/* Action Button */}
          <Link href="/call-list" className="block">
            <Button
              className="w-full bg-gradient-to-r from-blue-600 to-cyan-500 text-white hover:from-blue-700 hover:to-cyan-600 shadow-lg"
              size="lg"
            >
              <Home className="h-4 w-4 mr-2" />
              ダッシュボードに戻る
            </Button>
          </Link>

          {/* Home Link */}
          <div className="text-center">
            <Link href="/" className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
              ホームページへ
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
