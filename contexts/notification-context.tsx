'use client'

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react'
import {
  realtimeService,
  playNotificationSound,
  showBrowserNotification,
  type Notification,
} from '@/lib/realtime'
import { NotificationStack } from '@/components/notification-toast'
import { useAuth } from '@/contexts/auth-context'

type NotificationContextType = {
  notifications: Notification[]
  unreadCount: number
  addNotification: (notification: Omit<Notification, 'id' | 'created_at' | 'read'>) => void
  markAsRead: (id: string) => void
  markAllAsRead: () => void
  removeNotification: (id: string) => void
  clearAll: () => void
}

const NotificationContext = createContext<NotificationContextType | null>(null)

export function useNotifications() {
  const context = useContext(NotificationContext)
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider')
  }
  return context
}

type NotificationProviderProps = {
  children: ReactNode
}

export function NotificationProvider({ children }: NotificationProviderProps) {
  const { isDirector, user } = useAuth()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [toastQueue, setToastQueue] = useState<Notification[]>([])

  // 通知を追加
  const addNotification = useCallback(
    (notif: Omit<Notification, 'id' | 'created_at' | 'read'>) => {
      const newNotification: Notification = {
        ...notif,
        id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        read: false,
        created_at: new Date().toISOString(),
      }

      setNotifications((prev) => [newNotification, ...prev].slice(0, 50))
      setToastQueue((prev) => [...prev, newNotification])

      // 通知音とブラウザ通知
      playNotificationSound()
      showBrowserNotification(newNotification.title, {
        body: newNotification.message,
        icon: '/icon.png',
      })
    },
    []
  )

  // 既読にする
  const markAsRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    )
  }, [])

  // 全て既読にする
  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
  }, [])

  // 通知を削除
  const removeNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id))
  }, [])

  // 全て削除
  const clearAll = useCallback(() => {
    setNotifications([])
  }, [])

  // トーストを閉じる
  const handleToastClose = useCallback((id: string) => {
    setToastQueue((prev) => prev.filter((n) => n.id !== id))
  }, [])

  // ディレクターの場合、リアルタイム通知を購読
  useEffect(() => {
    if (!isDirector || !user) return

    const unsubscribe = realtimeService.subscribeToAppointments((notification) => {
      // 自分以外のオペレーターからの通知のみ表示
      if (notification.data?.operator_id !== user.id) {
        setNotifications((prev) => [notification, ...prev].slice(0, 50))
        setToastQueue((prev) => [...prev, notification])
        playNotificationSound()
        showBrowserNotification(notification.title, {
          body: notification.message,
          icon: '/icon.png',
        })
      }
    })

    return () => {
      unsubscribe()
    }
  }, [isDirector, user])

  // 未読カウント
  const unreadCount = notifications.filter((n) => !n.read).length

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        addNotification,
        markAsRead,
        markAllAsRead,
        removeNotification,
        clearAll,
      }}
    >
      {children}
      <NotificationStack
        notifications={toastQueue}
        onClose={handleToastClose}
        onRead={markAsRead}
      />
    </NotificationContext.Provider>
  )
}
