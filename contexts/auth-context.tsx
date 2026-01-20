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
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>
  signOut: () => Promise<void>
  isDirector: boolean
  isOperator: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// グローバルシングルトンインスタンス（モジュールレベル）
let globalSupabase: ReturnType<typeof createClient> | null = null

function getGlobalSupabase() {
  if (!globalSupabase && typeof window !== 'undefined') {
    globalSupabase = createClient()
  }
  return globalSupabase
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const isInitializedRef = useRef(false)
  const initPromiseRef = useRef<Promise<void> | null>(null)

  useEffect(() => {
    // 既に初期化済みの場合はスキップ（Strict Modeの二重実行対策）
    if (isInitializedRef.current) {
      return
    }
    isInitializedRef.current = true

    const supabase = getGlobalSupabase()
    if (!supabase) {
      setIsLoading(false)
      return
    }

    let isMounted = true

    // 初期セッション取得
    const initializeAuth = async () => {
      // 既に初期化中の場合は待機
      if (initPromiseRef.current) {
        await initPromiseRef.current
        return
      }

      initPromiseRef.current = (async () => {
        try {
          const { data: { session }, error } = await supabase.auth.getSession()

          if (error) {
            console.error('Session error:', error)
            if (isMounted) {
              setIsLoading(false)
            }
            return
          }

          if (isMounted) {
            setSession(session)
            if (session?.user) {
              await fetchUserProfile(session.user, supabase)
            }
            setIsLoading(false)
          }
        } catch (error) {
          // AbortError は無視（コンポーネントのアンマウント時に発生）
          if (error instanceof Error && error.name === 'AbortError') {
            console.log('Auth request aborted (component unmounted)')
            return
          }
          console.error('Failed to get session:', error)
          if (isMounted) {
            setIsLoading(false)
          }
        } finally {
          initPromiseRef.current = null
        }
      })()

      await initPromiseRef.current
    }

    initializeAuth()

    // 認証状態の変更を監視
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!isMounted) return

        setSession(session)
        if (session?.user) {
          await fetchUserProfile(session.user, supabase)
        } else {
          setUser(null)
        }
        setIsLoading(false)
      }
    )

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [])

  // ユーザープロファイルを取得（operatorsテーブルから）
  const fetchUserProfile = async (authUser: User, supabase: ReturnType<typeof createClient>) => {
    try {
      const { data: operator } = await supabase
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
    } catch (error) {
      // AbortError は無視
      if (error instanceof Error && error.name === 'AbortError') {
        return
      }
      console.error('Failed to fetch user profile:', error)
      // エラー時もデフォルトユーザーを設定
      setUser({
        id: authUser.id,
        email: authUser.email || '',
        name: authUser.email?.split('@')[0] || 'ユーザー',
        role: 'operator',
      })
    }
  }

  const signIn = async (email: string, password: string) => {
    const supabase = getGlobalSupabase()
    if (!supabase) {
      return { error: new Error('Supabase client not available') }
    }
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    return { error }
  }

  const signOut = async () => {
    const supabase = getGlobalSupabase()
    if (!supabase) return
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
