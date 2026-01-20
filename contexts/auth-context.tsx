'use client'

import { createContext, useContext, useEffect, useState, useRef, type ReactNode } from 'react'
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
  signIn: (email: string, password: string) => Promise<{ error: Error | null; user?: AuthUser }>
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
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true

    // 初期セッション取得（タイムアウト付き）
    const getSession = async () => {
      try {
        // AbortControllerでタイムアウトを設定
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 5000)

        const { data: { session } } = await supabase.auth.getSession()
        clearTimeout(timeoutId)

        if (!mountedRef.current) return

        setSession(session)
        if (session?.user) {
          await fetchUserProfile(session.user)
        }
      } catch (error: any) {
        // AbortErrorは無視（コンポーネントのアンマウント時）
        if (error?.name === 'AbortError') {
          console.log('Session fetch aborted (component unmounted or timeout)')
          return
        }
        console.error('Failed to get session:', error)
      } finally {
        if (mountedRef.current) {
          setIsLoading(false)
        }
      }
    }

    getSession()

    // 認証状態の変更を監視
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mountedRef.current) return

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
      mountedRef.current = false
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
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      return { error }
    }

    // ログイン成功時、即座にユーザー情報を取得してセット
    if (data.user) {
      const { data: operator } = await supabase
        .from('operators')
        .select('id, name, email, role')
        .eq('email', data.user.email)
        .single()

      const authUser: AuthUser = operator ? {
        id: operator.id,
        email: operator.email,
        name: operator.name,
        role: operator.role || 'operator',
      } : {
        id: data.user.id,
        email: data.user.email || '',
        name: data.user.email?.split('@')[0] || 'ユーザー',
        role: 'operator',
      }

      setUser(authUser)
      setSession(data.session)
      return { error: null, user: authUser }
    }

    return { error: null }
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
