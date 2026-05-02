'use client'

// グローバル: 5分前 toast + Browser Notification
// レイアウトに 1 度だけマウントされ、auth セッションから homes_users.id を取って配信
import { useEffect, useState } from 'react'
import { getCurrentHomesUser } from '@/lib/homes/api'
import { NextActionToaster } from './NextActionToaster'

export function HomesGlobalShell() {
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    getCurrentHomesUser()
      .then((u) => {
        if (active && u) setUserId(u.id)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])

  if (!userId) return null
  return <NextActionToaster userId={userId} />
}

export default HomesGlobalShell
