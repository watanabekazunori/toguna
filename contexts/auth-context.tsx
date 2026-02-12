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

  // ユーザープロファイルを取得（operatorsテーブルから、リトライ付き）
  const fetchingRef = useRef(false)
  const fetchUserProfile = async (authUser: User) => {
    // 二重呼び出しを防止
    if (fetchingRef.current) return
    fetchingRef.current = true

    try {
      // まずキャッシュから即座にユーザー情報を設定（高速表示のため）
      const cachedRole = authUser.user_metadata?.role as UserRole | undefined
      const cachedOperatorId = authUser.user_metadata?.operator_id as string | undefined
      if (cachedRole && cachedOperatorId) {
        setUser({
          id: cachedOperatorId,
          email: authUser.email || '',
          name: authUser.user_metadata?.name as string || authUser.email?.split('@')[0] || 'ユーザー',
          role: cachedRole,
        })
      }

      const maxRetries = 3
      const timeoutMs = 8000

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          // Supabaseのthenableを明示的にPromiseに変換
          const operatorPromise = supabase
            .from('operators')
            .select('id, name, email, role')
            .eq('email', authUser.email)
            .single()
            .then(result => result)

          const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Operator query timeout')), timeoutMs)
          )

          const result = await Promise.race([operatorPromise, timeoutPromise])

          if (result.error && result.error.code !== 'PGRST116') {
            throw new Error(result.error.message)
          }

          const operator = result.data

          if (operator) {
            const resolvedUser: AuthUser = {
              id: operator.id,
              email: operator.email,
              name: operator.name,
              role: operator.role || 'operator',
            }
            setUser(resolvedUser)
            // user_metadataにロールをキャッシュ（次回フォールバック用）
            if (operator.role) {
              supabase.auth.updateUser({
                data: { role: operator.role, operator_id: operator.id, name: operator.name }
              }).catch(() => {})
            }
            return
          }
          // operatorsテーブルにレコードが無い場合はリトライせずデフォルト
          break
        } catch (err) {
          console.warn(`fetchUserProfile attempt ${attempt}/${maxRetries} failed:`, err)
          if (attempt < maxRetries) {
            await new Promise(r => setTimeout(r, 500 * attempt))
            continue
          }
        }
      }

      // フォールバック: user_metadataからロールを復元（キャッシュ設定済みなら何もしない）
      if (!cachedRole) {
        setUser({
          id: cachedOperatorId || authUser.id,
          email: authUser.email || '',
          name: authUser.email?.split('@')[0] || 'ユーザー',
          role: 'operator',
        })
      }
    } finally {
      fetchingRef.current = false
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

    // ログイン成功時、リトライ付きでユーザー情報を取得
    if (data.user) {
      let operator = null

      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const operatorPromise = supabase
            .from('operators')
            .select('id, name, email, role')
            .eq('email', data.user.email)
            .single()
            .then(result => result)

          const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Operator query timeout')), 8000)
          )

          const result = await Promise.race([operatorPromise, timeoutPromise])
          if (result.data) {
            operator = result.data
            // user_metadataにロールをキャッシュ
            supabase.auth.updateUser({
              data: { role: result.data.role, operator_id: result.data.id }
            }).catch(() => {})
            break
          }
          if (result.error && result.error.code === 'PGRST116') break // レコードなし
        } catch (err) {
          console.warn(`signIn operator query attempt ${attempt}/3 failed:`, err)
          if (attempt < 3) await new Promise(r => setTimeout(r, 500 * attempt))
        }
      }

      const authUser: AuthUser = operator ? {
        id: operator.id,
        email: operator.email,
        name: operator.name,
        role: operator.role || 'operator',
      } : {
        id: data.user.id,
        email: data.user.email || '',
        name: data.user.email?.split('@')[0] || 'ユーザー',
        role: (data.user.user_metadata?.role as UserRole) || 'operator',
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
