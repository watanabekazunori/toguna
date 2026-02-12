'use client'

import { AlertCircle, RotateCcw, Home } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-orange-50 to-slate-100 dark:from-slate-950 dark:via-orange-950 dark:to-slate-900 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl p-8 space-y-6">
          {/* Error Icon */}
          <div className="flex justify-center">
            <div className="w-16 h-16 bg-orange-100 dark:bg-orange-950/30 rounded-full flex items-center justify-center">
              <AlertCircle className="h-8 w-8 text-orange-600 dark:text-orange-400" />
            </div>
          </div>

          {/* Error Title */}
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              ページの読み込みに失敗しました
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              申し訳ありません。ページの読み込み中にエラーが発生しました
            </p>
          </div>

          {/* Error Message */}
          {error.message && (
            <div className="bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
              <p className="text-sm font-mono text-orange-700 dark:text-orange-300 break-words">
                {error.message}
              </p>
            </div>
          )}

          {/* Error Digest (if available) */}
          {error.digest && (
            <div className="bg-slate-100 dark:bg-slate-800 rounded-lg p-3">
              <p className="text-xs text-slate-600 dark:text-slate-400 font-mono">
                Error ID: {error.digest}
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-3 pt-4">
            <Button
              onClick={reset}
              className="w-full bg-gradient-to-r from-orange-600 to-orange-500 text-white hover:from-orange-700 hover:to-orange-600 shadow-lg"
              size="lg"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              もう一度試す
            </Button>

            <Link href="/call-list" className="block">
              <Button
                variant="outline"
                className="w-full border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
                size="lg"
              >
                <Home className="h-4 w-4 mr-2" />
                ダッシュボードに戻る
              </Button>
            </Link>
          </div>

          {/* Help Text */}
          <div className="text-center pt-4 border-t border-slate-200 dark:border-slate-800">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              問題が継続する場合は、サポートまでお問い合わせください
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
