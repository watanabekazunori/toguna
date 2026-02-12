'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/contexts/auth-context'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  ArrowLeft,
  Loader,
  AlertCircle,
  MessageCircle,
  Play,
  BarChart3,
  Mic,
  Send,
  X,
  CheckCircle,
  TrendingUp,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface RoleplaySession {
  id: string
  operator_id: string
  project_id: string
  scenario_type: 'cold_call' | 'objection_handling' | 'closing' | 'follow_up'
  scenario_data: Record<string, unknown>
  ai_feedback: {
    performance_score: number
    positive_points: string[]
    improvement_areas: string[]
  } | null
  performance_score: number | null
  completed_at: string | null
  created_at: string
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

interface SessionState {
  isActive: boolean
  messages: Message[]
  currentInput: string
}

const SCENARIO_TYPES = [
  { value: 'cold_call', label: 'コールド・コール', color: 'bg-blue-600' },
  { value: 'objection_handling', label: '異議処理', color: 'bg-amber-600' },
  { value: 'closing', label: 'クロージング', color: 'bg-green-600' },
  { value: 'follow_up', label: 'フォローアップ', color: 'bg-purple-600' },
]

export default function RoleplayPage() {
  const router = useRouter()
  const params = useParams()
  const { user, isDirector, isLoading: authLoading } = useAuth()
  const projectId = params.id as string

  const [pastSessions, setPastSessions] = useState<RoleplaySession[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showNewSessionForm, setShowNewSessionForm] = useState(false)
  const [selectedScenario, setSelectedScenario] = useState<string>('')
  const [isCreatingSession, setIsCreatingSession] = useState(false)
  const [sessionState, setSessionState] = useState<SessionState>({
    isActive: false,
    messages: [],
    currentInput: '',
  })
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [activeSession, setActiveSession] = useState<RoleplaySession | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const supabase = createClient()

  // Auth check
  useEffect(() => {
    if (!authLoading && !isDirector) {
      router.push('/director/login')
    }
  }, [authLoading, isDirector, router])

  // Fetch past sessions
  const fetchSessions = useCallback(async () => {
    if (!projectId || !user) return

    try {
      setIsLoading(true)
      setError(null)

      const { data, error: queryError } = await supabase
        .from('roleplay_sessions')
        .select('*')
        .eq('project_id', projectId)
        .eq('operator_id', user.id)
        .order('created_at', { ascending: false })

      if (queryError) {
        setError(`セッション取得エラー: ${queryError.message}`)
        return
      }

      setPastSessions(data || [])
    } catch (err) {
      setError('セッションの取得に失敗しました')
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }, [projectId, user, supabase])

  useEffect(() => {
    if (projectId && user) {
      fetchSessions()
    }
  }, [projectId, user, fetchSessions])

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [sessionState.messages])

  // Get scenario label and color
  const getScenarioLabel = (type: string) => {
    const scenario = SCENARIO_TYPES.find((s) => s.value === type)
    return scenario || { label: type, color: 'bg-gray-600' }
  }

  // Create new session
  const handleCreateSession = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()

      if (!projectId || !user || !selectedScenario) return

      try {
        setIsCreatingSession(true)
        setError(null)

        const scenarioData = {
          type: selectedScenario,
          startedAt: new Date().toISOString(),
          customer_profile: {
            name: 'テスト顧客',
            company: 'サンプル企業',
            pain_points: ['コスト削減', '効率化'],
          },
        }

        const newSession: RoleplaySession = {
          id: `session_${Date.now()}`,
          operator_id: user.id || 'unknown',
          project_id: projectId,
          scenario_type: selectedScenario as RoleplaySession['scenario_type'],
          scenario_data: scenarioData,
          ai_feedback: null,
          performance_score: null,
          completed_at: null,
          created_at: new Date().toISOString(),
        }

        const { error: insertError } = await supabase
          .from('roleplay_sessions')
          .insert([newSession])

        if (insertError) {
          setError(`セッション作成エラー: ${insertError.message}`)
          return
        }

        // Initialize active session
        setActiveSession(newSession)
        setActiveSessionId(newSession.id)
        setSessionState({
          isActive: true,
          messages: [
            {
              id: 'msg_1',
              role: 'assistant',
              content: `こんにちは。本日はお忙しい中、お時間をいただきありがとうございます。私は営業担当の田中と申します。${
                selectedScenario === 'cold_call'
                  ? 'お忙しいところ恐れ入りますが、少しお時間をいただけますか？'
                  : selectedScenario === 'objection_handling'
                  ? 'ご質問やご不明な点があれば、何でもお聞きください。'
                  : selectedScenario === 'closing'
                  ? 'では、本日のご提案についていかがお考えですか？'
                  : 'こちらから新しい情報をお持ちしました。'
              }`,
              timestamp: new Date().toISOString(),
            },
          ],
          currentInput: '',
        })

        setShowNewSessionForm(false)
        setSelectedScenario('')
      } catch (err) {
        setError('セッションの作成に失敗しました')
        console.error(err)
      } finally {
        setIsCreatingSession(false)
      }
    },
    [projectId, user, selectedScenario, supabase]
  )

  // Send message in roleplay session
  const handleSendMessage = useCallback(async () => {
    if (!sessionState.currentInput.trim() || !activeSessionId) return

    const userMessage: Message = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: sessionState.currentInput,
      timestamp: new Date().toISOString(),
    }

    setSessionState((prev) => ({
      ...prev,
      messages: [...prev.messages, userMessage],
      currentInput: '',
    }))

    // Simulate AI response after a delay
    setTimeout(() => {
      const aiResponses = [
        'そうですね、その点についてもう少し詳しくお聞きしてもよろしいですか？',
        'ご指摘ありがとうございます。実は、この問題には複数の解決方法があります。',
        'なるほど。では、弊社のソリューションがどのように役立つか説明させていただきます。',
        'それは非常に重要なポイントです。実際、多くのお客様も同じご懸念をお持ちです。',
        '質問をありがとうございます。良い質問ですね。',
      ]

      const randomResponse =
        aiResponses[Math.floor(Math.random() * aiResponses.length)]

      const assistantMessage: Message = {
        id: `msg_${Date.now()}`,
        role: 'assistant',
        content: randomResponse,
        timestamp: new Date().toISOString(),
      }

      setSessionState((prev) => ({
        ...prev,
        messages: [...prev.messages, assistantMessage],
      }))
    }, 800)
  }, [sessionState.currentInput, activeSessionId])

  // End session
  const handleEndSession = useCallback(async () => {
    if (!activeSessionId || !activeSession) return

    try {
      setIsCreatingSession(true)

      // Simulate AI feedback
      const feedback = {
        performance_score: Math.floor(Math.random() * 40) + 60, // 60-100
        positive_points: [
          'スムーズな会話フロー',
          '顧客ニーズへの傾聴',
          'テンポ良い回答',
        ],
        improvement_areas: [
          'より具体的な事例の提示',
          '相手の異議への対応時間',
          'クロージング部分の強化',
        ],
      }

      const { error: updateError } = await supabase
        .from('roleplay_sessions')
        .update({
          completed_at: new Date().toISOString(),
          performance_score: feedback.performance_score,
          ai_feedback: feedback,
        })
        .eq('id', activeSessionId)

      if (updateError) {
        setError(`セッション終了エラー: ${updateError.message}`)
        return
      }

      // Update local state
      setActiveSession((prev) =>
        prev
          ? {
              ...prev,
              completed_at: new Date().toISOString(),
              performance_score: feedback.performance_score,
              ai_feedback: feedback,
            }
          : null
      )

      // Update past sessions
      await fetchSessions()
    } catch (err) {
      setError('セッションの終了に失敗しました')
      console.error(err)
    } finally {
      setIsCreatingSession(false)
    }
  }, [activeSessionId, activeSession, supabase, fetchSessions])

  // Close session
  const closeSession = () => {
    setActiveSession(null)
    setActiveSessionId(null)
    setSessionState({
      isActive: false,
      messages: [],
      currentInput: '',
    })
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="text-center">
          <Loader className="w-8 h-8 text-white animate-spin mx-auto mb-4" />
          <p className="text-white">読み込み中...</p>
        </div>
      </div>
    )
  }

  if (!isDirector) {
    return null
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
      {/* Sticky Header */}
      <div className="sticky top-0 z-50 bg-black/40 backdrop-blur-md border-b border-white/10">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href={`/director/projects/${projectId}`}
                className="inline-flex items-center gap-2 text-white hover:text-purple-300 transition"
              >
                <ArrowLeft className="w-5 h-5" />
                <span>戻る</span>
              </Link>
              <h1 className="text-2xl font-bold text-white">TOGUNA</h1>
            </div>
            <Badge className="bg-purple-600/80 text-white border-purple-400/50">
              Director
            </Badge>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Page Title */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-white mb-2">ロールプレイ練習</h2>
          <p className="text-gray-300">AIとの対話を通じて営業スキルを磨く</p>
        </div>

        {/* Error Alert */}
        {error && (
          <Card className="mb-6 bg-red-500/10 border-red-500/30 p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-red-400 text-sm">{error}</p>
              <button
                onClick={() => setError(null)}
                className="text-red-300 hover:text-red-200 text-xs mt-1 underline"
              >
                閉じる
              </button>
            </div>
          </Card>
        )}

        {/* Active Session - Chat Interface */}
        {activeSession && sessionState.isActive && (
          <Card className="mb-6 bg-white/5 border-white/10 p-6 flex flex-col h-96">
            <div className="flex items-center justify-between mb-4 pb-4 border-b border-white/10">
              <div>
                <h3 className="text-lg font-semibold text-white">
                  ライブセッション
                </h3>
                <p className="text-sm text-gray-400">
                  {getScenarioLabel(activeSession.scenario_type).label}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={closeSession}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto mb-4 space-y-4 pr-2">
              {sessionState.messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${
                    msg.role === 'user' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  <div
                    className={`max-w-xs px-4 py-2 rounded-lg ${
                      msg.role === 'user'
                        ? 'bg-purple-600/80 text-white'
                        : 'bg-white/10 text-gray-100 border border-white/20'
                    }`}
                  >
                    <p className="text-sm">{msg.content}</p>
                    <p className="text-xs opacity-60 mt-1">
                      {new Date(msg.timestamp).toLocaleTimeString('ja-JP')}
                    </p>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="flex gap-2 pt-4 border-t border-white/10">
              <Input
                type="text"
                placeholder="メッセージを入力..."
                value={sessionState.currentInput}
                onChange={(e) =>
                  setSessionState((prev) => ({
                    ...prev,
                    currentInput: e.target.value,
                  }))
                }
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleSendMessage()
                  }
                }}
                className="bg-white/10 border-white/20 text-white placeholder:text-gray-400 flex-1"
              />
              <Button
                onClick={handleSendMessage}
                disabled={!sessionState.currentInput.trim()}
                className="bg-purple-600 hover:bg-purple-700 text-white"
                size="sm"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>

            {/* End Session Button */}
            <div className="mt-4 pt-4 border-t border-white/10">
              <Button
                onClick={handleEndSession}
                disabled={isCreatingSession}
                className="w-full bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 text-white"
              >
                {isCreatingSession ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin mr-2" />
                    セッション終了中...
                  </>
                ) : (
                  'セッションを終了'
                )}
              </Button>
            </div>
          </Card>
        )}

        {/* New Session Form */}
        {!activeSession && showNewSessionForm && (
          <Card className="mb-6 bg-white/5 border-white/10 p-6">
            <h3 className="text-xl font-semibold text-white mb-4">
              新しいセッションを開始
            </h3>
            <form onSubmit={handleCreateSession} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-3">
                  シナリオタイプを選択
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {SCENARIO_TYPES.map((scenario) => (
                    <button
                      key={scenario.value}
                      type="button"
                      onClick={() => setSelectedScenario(scenario.value)}
                      className={`p-3 rounded-lg text-left font-medium transition ${
                        selectedScenario === scenario.value
                          ? `${scenario.color} text-white border-2 border-white`
                          : 'bg-white/5 border border-white/20 text-gray-300 hover:bg-white/10'
                      }`}
                    >
                      {scenario.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  type="submit"
                  disabled={isCreatingSession || !selectedScenario}
                  className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white"
                >
                  {isCreatingSession ? (
                    <>
                      <Loader className="w-4 h-4 animate-spin mr-2" />
                      開始中...
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 mr-2" />
                      セッションを開始
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    setShowNewSessionForm(false)
                    setSelectedScenario('')
                  }}
                  className="bg-gray-600 hover:bg-gray-700 text-white"
                >
                  キャンセル
                </Button>
              </div>
            </form>
          </Card>
        )}

        {/* Start New Session Button */}
        {!activeSession && !showNewSessionForm && (
          <div className="mb-6">
            <Button
              onClick={() => setShowNewSessionForm(true)}
              className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white"
            >
              <Play className="w-4 h-4 mr-2" />
              新しいセッションを開始
            </Button>
          </div>
        )}

        {/* Past Sessions Section */}
        <div className="mt-12">
          <h3 className="text-2xl font-bold text-white mb-6">過去のセッション</h3>

          {isLoading ? (
            <Card className="bg-white/5 border-white/10 p-8 text-center">
              <Loader className="w-8 h-8 text-purple-400 animate-spin mx-auto mb-3" />
              <p className="text-gray-400">セッションを読み込み中...</p>
            </Card>
          ) : pastSessions.length === 0 ? (
            <Card className="bg-white/5 border-white/10 p-8 text-center">
              <MessageCircle className="w-12 h-12 text-gray-500 mx-auto mb-3 opacity-50" />
              <p className="text-gray-400">完了したセッションはありません</p>
            </Card>
          ) : (
            <div className="grid gap-4">
              {pastSessions.map((session) => {
                const scenarioInfo = getScenarioLabel(session.scenario_type)
                return (
                  <Card
                    key={session.id}
                    className="bg-white/5 border-white/10 p-6 hover:bg-white/10 transition"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge
                            className={`${scenarioInfo.color} text-white border-opacity-50`}
                          >
                            {scenarioInfo.label}
                          </Badge>
                          {session.completed_at && (
                            <Badge className="bg-green-600/20 text-green-300 border-green-400/30">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              完了
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-gray-400 mb-4">
                          実施日:{' '}
                          {new Date(session.created_at).toLocaleDateString(
                            'ja-JP'
                          )}{' '}
                          {new Date(session.created_at).toLocaleTimeString(
                            'ja-JP'
                          )}
                        </p>
                      </div>

                      {session.ai_feedback && session.performance_score !== null && (
                        <div className="text-right">
                          <div className="flex items-end gap-2 mb-4">
                            <div className="text-3xl font-bold text-white">
                              {session.performance_score}
                            </div>
                            <div className="text-gray-400 text-sm mb-1">点</div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* AI Feedback */}
                    {session.ai_feedback && (
                      <div className="space-y-3 pt-4 border-t border-white/10">
                        <div>
                          <p className="text-xs font-semibold text-green-400 mb-2 flex items-center">
                            <TrendingUp className="w-4 h-4 mr-1" />
                            強み
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {session.ai_feedback.positive_points.map(
                              (point, idx) => (
                                <Badge
                                  key={idx}
                                  className="bg-green-600/20 text-green-300 border-green-400/30"
                                >
                                  {point}
                                </Badge>
                              )
                            )}
                          </div>
                        </div>

                        <div>
                          <p className="text-xs font-semibold text-amber-400 mb-2">
                            改善ポイント
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {session.ai_feedback.improvement_areas.map(
                              (area, idx) => (
                                <Badge
                                  key={idx}
                                  className="bg-amber-600/20 text-amber-300 border-amber-400/30"
                                >
                                  {area}
                                </Badge>
                              )
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
