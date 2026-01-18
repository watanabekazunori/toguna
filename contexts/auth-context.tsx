'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { User, Session } from '@supabase/supabase-js'

type UserRole = 'director' | 'operator'

type AuthUser = {
  id: string
  email: string
  name: string
  role: UserRole
}

type AuthContextType = {
  user: AuthUser | null
  session: Session | null
  isLoading: boolean
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>
  signOut: () => Promise<void>
  isDirector: boolean
  isOperator: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    // 初期セッション取得
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      setSession(session)
      if (session?.user) {
        await fetchUserProfile(session.user)
      }
      setIsLoading(false)
    }

    getSession()

    // 認証状態の変更を監視
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session)
        if (session?.user) {
          await fetchUserProfile(session.user)
        } else {
          setUser(null)
        }
        setIsLoading(false)
      }
    )

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  // ユーザープロファイルを取得（operatorsテーブルから）
  const fetchUserProfile = async (authUser: User) => {
    // まずoperatorsテーブルから検索
    const { data: operator, error } = await supabase
      .from('operators')
      .select('id, name, email, role')
      .eq('email', authUser.email)
      .single()

    if (operator) {
      setUser({
        id: operator.id,
        email: operator.email,
        name: operator.name,
        role: operator.role || 'operator',
      })
    } else {
      // operatorsテーブルにない場合はデフォルト
      setUser({
        id: authUser.id,
        email: authUser.email || '',
        name: authUser.email?.split('@')[0] || 'ユーザー',
        role: 'operator',
      })
    }
  }

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    return { error }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setSession(null)
  }

  const value = {
    user,
    session,
    isLoading,
    signIn,
    signOut,
    isDirector: user?.role === 'director',
    isOperator: user?.role === 'operator',
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
