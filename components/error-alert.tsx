'use client'
import { AlertCircle, RefreshCw } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'

type ErrorAlertProps = {
  title?: string
  message: string
  onRetry?: () => void
}

export function ErrorAlert({ title = 'エラーが発生しました', message, onRetry }: ErrorAlertProps) {
  return (
    <Alert variant="destructive" className="my-4">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription className="flex items-center justify-between">
        <span>{message}</span>
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry} className="ml-4">
            <RefreshCw className="h-4 w-4 mr-1" />
            再試行
          </Button>
        )}
      </AlertDescription>
    </Alert>
  )
}
