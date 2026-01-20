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

// シングルトンSupabaseクライアント
let supabaseClient: ReturnType<typeof createClient> | null = null

function getSupabaseClient() {
  if (typeof window === 'undefined') return null
  if (!supabaseClient) {
    supabaseClient = createClient()
  }
  return supabaseClient
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // ユーザープロファイルを取得
  const fetchUserProfile = async (authUser: User) => {
    const supabase = getSupabaseClient()
    if (!supabase) return

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
        setUser({
          id: authUser.id,
          email: authUser.email || '',
          name: authUser.email?.split('@')[0] || 'ユーザー',
          role: 'operator',
        })
      }
    } catch (error) {
      console.error('Failed to fetch user profile:', error)
      setUser({
        id: authUser.id,
        email: authUser.email || '',
        name: authUser.email?.split('@')[0] || 'ユーザー',
        role: 'operator',
      })
    }
  }

  useEffect(() => {
    const supabase = getSupabaseClient()
    if (!supabase) {
      setIsLoading(false)
      return
    }

    let isMounted = true

    // タイムアウト：1秒後に強制的にisLoadingをfalseに
    const timeout = setTimeout(() => {
      if (isMounted) {
        console.warn('[Auth] Session check timeout, setting isLoading to false')
        setIsLoading(false)
      }
    }, 1000)

    // 初期ユーザー取得（getUser()を使用 - より信頼性が高い）
    const initSession = async () => {
      try {
        // getUser()はサーバーからユーザー情報を取得するのでより信頼性が高い
        const { data: { user: authUser }, error } = await supabase.auth.getUser()

        if (!isMounted) return
        clearTimeout(timeout)

        if (error) {
          // AuthSessionMissingError は正常（未ログイン状態）
          if (error.name !== 'AuthSessionMissingError') {
            console.error('Auth error:', error)
          }
          setIsLoading(false)
          return
        }

        if (authUser) {
          await fetchUserProfile(authUser)
        }
        setIsLoading(false)
      } catch (error: unknown) {
        // AbortErrorは無視（React Strict Modeでの重複実行による）
        if (error instanceof Error && error.name === 'AbortError') {
          console.log('[Auth] Request aborted, ignoring')
          return
        }
        console.error('Failed to get user:', error)
        if (isMounted) {
          clearTimeout(timeout)
          setIsLoading(false)
        }
      }
    }

    initSession()

    // 認証状態の変更を監視
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (!isMounted) return
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
      isMounted = false
      clearTimeout(timeout)
      subscription.unsubscribe()
    }
  }, [])

  const signIn = async (email: string, password: string) => {
    const supabase = getSupabaseClient()
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
    const supabase = getSupabaseClient()
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
