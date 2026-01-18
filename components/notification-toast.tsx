'use client'

import { useEffect, useState } from 'react'
import { X, PartyPopper, Phone, Building2, Info } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Notification, NotificationType } from '@/lib/realtime'

type NotificationToastProps = {
  notification: Notification
  onClose: () => void
  onRead?: () => void
  duration?: number
}

const typeConfig: Record<
  NotificationType,
  { icon: React.ReactNode; bgColor: string; borderColor: string }
> = {
  appointment: {
    icon: <PartyPopper className="h-5 w-5 text-green-600" />,
    bgColor: 'bg-green-50 dark:bg-green-950/50',
    borderColor: 'border-green-200 dark:border-green-800',
  },
  call_complete: {
    icon: <Phone className="h-5 w-5 text-blue-600" />,
    bgColor: 'bg-blue-50 dark:bg-blue-950/50',
    borderColor: 'border-blue-200 dark:border-blue-800',
  },
  new_company: {
    icon: <Building2 className="h-5 w-5 text-purple-600" />,
    bgColor: 'bg-purple-50 dark:bg-purple-950/50',
    borderColor: 'border-purple-200 dark:border-purple-800',
  },
  system: {
    icon: <Info className="h-5 w-5 text-slate-600" />,
    bgColor: 'bg-slate-50 dark:bg-slate-900/50',
    borderColor: 'border-slate-200 dark:border-slate-700',
  },
}

export function NotificationToast({
  notification,
  onClose,
  onRead,
  duration = 5000,
}: NotificationToastProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [isLeaving, setIsLeaving] = useState(false)

  const config = typeConfig[notification.type] || typeConfig.system

  useEffect(() => {
    // 表示アニメーション
    const showTimer = setTimeout(() => setIsVisible(true), 10)

    // 自動非表示
    const hideTimer = setTimeout(() => {
      handleClose()
    }, duration)

    return () => {
      clearTimeout(showTimer)
      clearTimeout(hideTimer)
    }
  }, [duration])

  const handleClose = () => {
    setIsLeaving(true)
    setTimeout(() => {
      onRead?.()
      onClose()
    }, 300)
  }

  return (
    <div
      className={cn(
        'fixed z-[100] transition-all duration-300 ease-out',
        'max-w-sm w-full shadow-lg rounded-lg border',
        config.bgColor,
        config.borderColor,
        isVisible && !isLeaving
          ? 'translate-x-0 opacity-100'
          : 'translate-x-full opacity-0'
      )}
      style={{ top: '1rem', right: '1rem' }}
    >
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 mt-0.5">{config.icon}</div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm text-slate-900 dark:text-slate-100">
              {notification.title}
            </p>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              {notification.message}
            </p>
            {notification.data?.duration && (
              <p className="mt-1 text-xs text-slate-500">
                通話時間: {Math.floor(notification.data.duration / 60)}分
                {notification.data.duration % 60}秒
              </p>
            )}
          </div>
          <button
            onClick={handleClose}
            className="flex-shrink-0 p-1 rounded-full hover:bg-black/10 transition-colors"
          >
            <X className="h-4 w-4 text-slate-500" />
          </button>
        </div>
      </div>
    </div>
  )
}

type NotificationStackProps = {
  notifications: Notification[]
  onClose: (id: string) => void
  onRead?: (id: string) => void
}

export function NotificationStack({
  notifications,
  onClose,
  onRead,
}: NotificationStackProps) {
  return (
    <div className="fixed top-4 right-4 z-[100] space-y-2">
      {notifications.slice(0, 3).map((notification, index) => (
        <div
          key={notification.id}
          style={{
            transform: `translateY(${index * 8}px) scale(${1 - index * 0.02})`,
            zIndex: 100 - index,
          }}
        >
          <NotificationToastItem
            notification={notification}
            onClose={() => onClose(notification.id)}
            onRead={() => onRead?.(notification.id)}
          />
        </div>
      ))}
    </div>
  )
}

function NotificationToastItem({
  notification,
  onClose,
  onRead,
}: {
  notification: Notification
  onClose: () => void
  onRead?: () => void
}) {
  const [isLeaving, setIsLeaving] = useState(false)
  const config = typeConfig[notification.type] || typeConfig.system

  useEffect(() => {
    const timer = setTimeout(() => {
      handleClose()
    }, 5000)

    return () => clearTimeout(timer)
  }, [])

  const handleClose = () => {
    setIsLeaving(true)
    setTimeout(() => {
      onRead?.()
      onClose()
    }, 300)
  }

  return (
    <div
      className={cn(
        'max-w-sm w-80 shadow-lg rounded-lg border transition-all duration-300',
        config.bgColor,
        config.borderColor,
        isLeaving ? 'translate-x-full opacity-0' : 'translate-x-0 opacity-100'
      )}
    >
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 mt-0.5">{config.icon}</div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm text-slate-900 dark:text-slate-100">
              {notification.title}
            </p>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400 line-clamp-2">
              {notification.message}
            </p>
          </div>
          <button
            onClick={handleClose}
            className="flex-shrink-0 p-1 rounded-full hover:bg-black/10 transition-colors"
          >
            <X className="h-4 w-4 text-slate-500" />
          </button>
        </div>
      </div>
    </div>
  )
}
