'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import './login.css'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const supabase = createClient()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (authError) {
        setError(
          authError.message === 'Invalid login credentials'
            ? 'メールアドレスまたはパスワードが正しくありません'
            : authError.message
        )
        setIsLoading(false)
        return
      }

      // LIFULL HOME'S ユーザーチェック (Phase 6 新)
      try {
        const { data: lifullUser } = await supabase
          .from('lifull_users')
          .select('id, role')
          .eq('auth_user_id', authData.user?.id)
          .eq('tenant_id', 'lifull_homes')
          .maybeSingle()
        if (lifullUser?.id) {
          window.location.href = '/lifull/dashboard'
          return
        }
      } catch {
        // フォールスルー
      }

      // HOME'S ユーザーチェック (旧 v0 互換)
      try {
        const { data: homesUser } = await supabase
          .from('homes_users')
          .select('id')
          .eq('auth_user_id', authData.user?.id)
          .maybeSingle()
        if (homesUser?.id) {
          window.location.href = '/homes'
          return
        }
      } catch {
        // フォールスルー
      }

      // レガシー: operators
      let role: string | null = null
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const operatorPromise = supabase
            .from('operators')
            .select('role')
            .eq('email', email)
            .single()
          const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Operator query timeout')), 4000)
          )
          interface OperatorQueryResult {
            data?: { role: string } | null
            error?: { code: string } | null
          }
          const result = await Promise.race<OperatorQueryResult>([operatorPromise, timeoutPromise])
          if (result.data?.role) {
            role = result.data.role
            supabase.auth.updateUser({ data: { role } }).catch(() => {})
            break
          }
          if (result.error?.code === 'PGRST116') break
        } catch {
          if (attempt < 3) await new Promise(r => setTimeout(r, 500 * attempt))
        }
      }
      if (!role) role = authData.user?.user_metadata?.role || 'operator'

      if (role === 'director') {
        window.location.href = '/director'
      } else {
        window.location.href = '/'
      }
    } catch (err) {
      console.error('Login error:', err)
      setError('ログイン中にエラーが発生しました')
      setIsLoading(false)
    }
  }

  return (
    <div className="lito-login">
      <div className="lito-login-bg" aria-hidden />
      <div className="lito-login-card">
        {/* Logo */}
        <div className="lito-login-brand">
          <div className="lito-login-logo">
            <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 4h3l2 5-2 1.5a11 11 0 0 0 5.5 5.5L15 14l5 2v3a2 2 0 0 1-2 2A14 14 0 0 1 4 7a2 2 0 0 1 1-3z" />
            </svg>
          </div>
          <h1 className="lito-login-title">
            TOGUNA
            <span className="lito-login-tagline">HOME&apos;S Operation Hub</span>
          </h1>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} className="lito-login-form">
          {error && (
            <div className="lito-login-error" role="alert">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          <div className="lito-field">
            <label htmlFor="email" className="lito-field-label">メールアドレス</label>
            <input
              id="email"
              type="email"
              placeholder="email@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isLoading}
              autoComplete="email"
              className="lito-field-input"
            />
          </div>

          <div className="lito-field">
            <label htmlFor="password" className="lito-field-label">パスワード</label>
            <input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isLoading}
              autoComplete="current-password"
              className="lito-field-input"
            />
          </div>

          <button type="submit" disabled={isLoading} className="lito-login-submit">
            {isLoading ? (
              <>
                <svg className="lito-spin" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M21 12a9 9 0 1 1-6.2-8.55" />
                </svg>
                <span>ログイン中...</span>
              </>
            ) : (
              <>
                <span>ログイン</span>
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="13 6 19 12 13 18" />
                </svg>
              </>
            )}
          </button>
        </form>

        {/* Links */}
        <div className="lito-login-footer">
          <a href="/forgot-password" className="lito-login-link">パスワードをお忘れの方</a>
          <div className="lito-login-divider" />
          <div className="lito-login-signup">
            <span>アカウントをお作りの方は</span>
            <a href="/signup" className="lito-login-link strong">こちらからサインアップ</a>
          </div>
        </div>

        <p className="lito-login-copyright">© 2026 TOGUNA · FANVEST · LITO</p>
      </div>
    </div>
  )
}
