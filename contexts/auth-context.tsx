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

// operatorsテーブルからユーザー情報をfetchで直接取得
async function queryOperatorByEmail(email: string | undefined): Promise<AuthUser | null> {
  if (!email) return null
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return null

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 6000)

    const res = await fetch(
      `${url}/rest/v1/operators?select=id,name,email,role&email=eq.${encodeURIComponent(email)}&limit=1`,
      {
        headers: {
          'apikey': key,
          'Authorization': `Bearer ${key}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        signal: controller.signal,
      }
    )
    clearTimeout(timeoutId)

    if (!res.ok) return null
    const rows = await res.json()
    if (!Array.isArray(rows) || rows.length === 0) return null

    const op = rows[0]
    return {
      id: op.id,
      email: op.email,
      name: op.name,
      role: op.role || 'operator',
    }
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const supabase = createClient()
  const mountedRef = useRef(true)
  const fetchingRef = useRef(false)

  useEffect(() => {
    mountedRef.current = true

    const getSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!mountedRef.current) return

        setSession(session)
        if (session?.user) {
          await fetchUserProfile(session.user)
        }
      } catch (error: any) {
        if (error?.name === 'AbortError') return
        console.error('Failed to get session:', error)
      } finally {
        if (mountedRef.current) {
          setIsLoading(false)
        }
      }
    }

    getSession()

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

  const fetchUserProfile = async (authUser: User) => {
    // 二重呼び出しを防止
    if (fetchingRef.current) return
    fetchingRef.current = true

    try {
      // 1) キャッシュ (user_metadata) があれば即座に設定してreturn
      const cachedRole = authUser.user_metadata?.role as UserRole | undefined
      const cachedOperatorId = authUser.user_metadata?.operator_id as string | undefined
      const cachedName = authUser.user_metadata?.name as string | undefined

      if (cachedRole && cachedOperatorId) {
        setUser({
          id: cachedOperatorId,
          email: authUser.email || '',
          name: cachedName || authUser.email?.split('@')[0] || 'ユーザー',
          role: cachedRole,
        })
        // バックグラウンドでDBから最新情報を取得してキャッシュを更新
        queryOperatorByEmail(authUser.email).then(op => {
          if (op && mountedRef.current) {
            setUser(op)
            supabase.auth.updateUser({
              data: { role: op.role, operator_id: op.id, name: op.name }
            }).catch(() => {})
          }
        })
        return
      }

      // 2) キャッシュがない場合: fetch APIで直接クエリ（Supabase SDKのPromise問題を回避）
      const operator = await queryOperatorByEmail(authUser.email)

      if (operator) {
        setUser(operator)
        // user_metadataにキャッシュ（次回は高速パスを使える）
        supabase.auth.updateUser({
          data: { role: operator.role, operator_id: operator.id, name: operator.name }
        }).catch(() => {})
        return
      }

      // 3) フォールバック
      setUser({
        id: authUser.id,
        email: authUser.email || '',
        name: authUser.email?.split('@')[0] || 'ユーザー',
        role: 'operator',
      })
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

    if (data.user) {
      // fetch APIで直接クエリ
      const operator = await queryOperatorByEmail(data.user.email)

      if (operator) {
        supabase.auth.updateUser({
          data: { role: operator.role, operator_id: operator.id, name: operator.name }
        }).catch(() => {})
      }

      const authUser: AuthUser = operator || {
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
