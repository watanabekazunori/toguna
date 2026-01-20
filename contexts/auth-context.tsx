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
  signIn: (email: string, password: string) => Promise<{ error: Error | null; user?: AuthUser }>
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
  const fetchUserProfile = async (authUser: User): Promise<AuthUser | null> => {
    const supabase = getSupabaseClient()
    if (!supabase) return null

    try {
      const { data: operator } = await supabase
        .from('operators')
        .select('id, name, email, role')
        .eq('email', authUser.email)
        .single()

      if (operator) {
        const authUserData: AuthUser = {
          id: operator.id,
          email: operator.email,
          name: operator.name,
          role: operator.role || 'operator',
        }
        setUser(authUserData)
        return authUserData
      } else {
        const authUserData: AuthUser = {
          id: authUser.id,
          email: authUser.email || '',
          name: authUser.email?.split('@')[0] || 'ユーザー',
          role: 'operator',
        }
        setUser(authUserData)
        return authUserData
      }
    } catch (error) {
      console.error('Failed to fetch user profile:', error)
      const authUserData: AuthUser = {
        id: authUser.id,
        email: authUser.email || '',
        name: authUser.email?.split('@')[0] || 'ユーザー',
        role: 'operator',
      }
      setUser(authUserData)
      return authUserData
    }
  }

  useEffect(() => {
    const supabase = getSupabaseClient()
    if (!supabase) {
      setIsLoading(false)
      return
    }

    let isMounted = true
    let isInitialized = false

    // 認証状態の変更を監視（先に登録）
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!isMounted) return
        console.log('[Auth] Auth state changed:', event, session?.user?.email)

        isInitialized = true
        setSession(session)

        if (session?.user) {
          await fetchUserProfile(session.user)
        } else {
          setUser(null)
        }
        setIsLoading(false)
      }
    )

    // getSession()を使用（ローカルストレージから取得、Abortされにくい）
    const initSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()

        if (!isMounted) return

        if (error) {
          console.error('[Auth] getSession error:', error)
          setIsLoading(false)
          return
        }

        // onAuthStateChangeがまだ発火していない場合のみ処理
        if (!isInitialized) {
          console.log('[Auth] Init session:', session?.user?.email || 'no session')
          setSession(session)
          if (session?.user) {
            await fetchUserProfile(session.user)
          }
          setIsLoading(false)
        }
      } catch (error: unknown) {
        console.error('[Auth] Failed to get session:', error)
        if (isMounted && !isInitialized) {
          setIsLoading(false)
        }
      }
    }

    initSession()

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [])

  const signIn = async (email: string, password: string) => {
    const supabase = getSupabaseClient()
    if (!supabase) {
      return { error: new Error('Supabase client not available') }
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      return { error }
    }

    // ログイン成功時、即座にユーザー情報を取得してセット
    if (data.user) {
      setSession(data.session)
      const authUser = await fetchUserProfile(data.user)
      setIsLoading(false)
      return { error: null, user: authUser || undefined }
    }

    return { error: null }
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
