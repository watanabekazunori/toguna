'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/contexts/auth-context'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Brain,
  ArrowLeft,
  Bell,
  LogOut,
  Loader2,
  Lightbulb,
  TrendingUp,
  TrendingDown,
  Target,
  Clock,
  Users,
  Phone,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  ChevronRight,
  Zap,
} from 'lucide-react'

type Suggestion = {
  id: string
  type: 'improvement' | 'warning' | 'insight' | 'action'
  priority: 'high' | 'medium' | 'low'
  title: string
  description: string
  impact: string
  actionLabel?: string
}

type AIInsight = {
  category: string
  icon: React.ReactNode
  value: string
  trend: 'up' | 'down' | 'neutral'
  trendValue: string
  description: string
}

export default function AISuggestionsPage() {
  const { user, signOut, isDirector, isLoading: authLoading } = useAuth()
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [isAnalyzing, setIsAnalyzing] = useState(false)

  useEffect(() => {
    if (!authLoading && !isDirector) {
      router.push('/')
    }
  }, [authLoading, isDirector, router])

  useEffect(() => {
    // シミュレーション
    const timer = setTimeout(() => setIsLoading(false), 1000)
    return () => clearTimeout(timer)
  }, [])

  const handleSignOut = async () => {
    await signOut()
    router.push('/login')
  }

  const handleReanalyze = () => {
    setIsAnalyzing(true)
    setTimeout(() => setIsAnalyzing(false), 2000)
  }

  const insights: AIInsight[] = [
    {
      category: 'アポ獲得率',
      icon: <Target className="h-5 w-5" />,
      value: '3.2%',
      trend: 'up',
      trendValue: '+0.5%',
      description: '先週比で改善。S判定企業への集中が効果的。',
    },
    {
      category: '最適架電時間',
      icon: <Clock className="h-5 w-5" />,
      value: '10:00-11:00',
      trend: 'neutral',
      trendValue: '安定',
      description: 'この時間帯の接続率が最も高い傾向。',
    },
    {
      category: 'トップパフォーマー',
      icon: <Users className="h-5 w-5" />,
      value: '田中さん',
      trend: 'up',
      trendValue: '週間MVP',
      description: 'アポ獲得率5.1%で全オペレーター中1位。',
    },
    {
      category: '改善ポテンシャル',
      icon: <TrendingUp className="h-5 w-5" />,
      value: '+25%',
      trend: 'up',
      trendValue: '予測',
      description: '提案を実行すればアポ数25%増加の見込み。',
    },
  ]

  const suggestions: Suggestion[] = [
    {
      id: '1',
      type: 'action',
      priority: 'high',
      title: 'S判定企業への優先架電を推奨',
      description:
        'S判定企業のアポ獲得率は平均の2.5倍です。残り45社のS判定企業を今週中に架電完了させることを推奨します。',
      impact: 'アポ+3件/週 の見込み',
      actionLabel: 'S判定リストを表示',
    },
    {
      id: '2',
      type: 'warning',
      priority: 'high',
      title: '火曜日の接続率低下に注意',
      description:
        '過去4週間のデータ分析の結果、火曜日の接続率が他の曜日より15%低い傾向があります。架電時間帯の調整を検討してください。',
      impact: '接続率+15%の可能性',
      actionLabel: '詳細を分析',
    },
    {
      id: '3',
      type: 'improvement',
      priority: 'medium',
      title: '受付突破スクリプトの改善提案',
      description:
        '現在の受付突破率は42%です。「ご担当者様にお繋ぎいただけますか」の代わりに「〇〇の件でお電話しました」と具体的に伝えることで突破率向上が見込めます。',
      impact: '受付突破率+10%',
      actionLabel: 'スクリプト例を見る',
    },
    {
      id: '4',
      type: 'insight',
      priority: 'medium',
      title: '不動産業界の反応が良好',
      description:
        '直近2週間で不動産業界へのアポ獲得率が4.8%と高い傾向にあります。不動産業界の企業を優先的に架電することを推奨します。',
      impact: 'アポ効率1.5倍',
    },
    {
      id: '5',
      type: 'improvement',
      priority: 'low',
      title: 'フォローアップの最適タイミング',
      description:
        '「時期尚早」となった企業へのフォローアップは2週間後が最適です。自動リマインダー設定をお勧めします。',
      impact: '再架電成功率+20%',
    },
  ]

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
      case 'medium':
        return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
      default:
        return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400'
    }
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'action':
        return <Zap className="h-5 w-5 text-blue-600" />
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-amber-600" />
      case 'improvement':
        return <TrendingUp className="h-5 w-5 text-green-600" />
      default:
        return <Lightbulb className="h-5 w-5 text-purple-600" />
    }
  }

  if (authLoading || !isDirector) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 dark:from-slate-950 dark:via-blue-950 dark:to-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-white/80 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="max-w-[1920px] mx-auto px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/director">
              <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500 bg-clip-text text-transparent">
                TOGUNA
              </h1>
            </Link>
            <Badge className="bg-purple-500 text-white px-4 py-1 text-sm font-medium">
              Director
            </Badge>
          </div>

          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-3 pl-4 border-l border-slate-200 dark:border-slate-800">
              <span className="text-sm font-medium">{user?.name}</span>
              <Avatar className="h-9 w-9">
                <AvatarFallback className="bg-gradient-to-br from-purple-500 to-pink-500 text-white">
                  {user?.name?.charAt(0) || 'D'}
                </AvatarFallback>
              </Avatar>
            </div>
            <Button variant="ghost" size="icon" onClick={handleSignOut}>
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-[1920px] mx-auto px-8 py-8 space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/director">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg">
                <Brain className="h-6 w-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  AI分析・提案
                </h2>
                <p className="text-sm text-slate-500">
                  データに基づく改善提案
                </p>
              </div>
            </div>
          </div>

          <Button
            variant="outline"
            onClick={handleReanalyze}
            disabled={isAnalyzing}
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                分析中...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                再分析
              </>
            )}
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <Loader2 className="h-12 w-12 animate-spin text-purple-600 mx-auto mb-4" />
              <p className="text-slate-600">AIがデータを分析中...</p>
            </div>
          </div>
        ) : (
          <>
            {/* AI Insights */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {insights.map((insight, index) => (
                <Card
                  key={index}
                  className="p-4 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg text-purple-600">
                        {insight.icon}
                      </div>
                      <div
                        className={`flex items-center gap-1 text-sm font-medium ${
                          insight.trend === 'up'
                            ? 'text-green-600'
                            : insight.trend === 'down'
                            ? 'text-red-600'
                            : 'text-slate-500'
                        }`}
                      >
                        {insight.trend === 'up' && <TrendingUp className="h-4 w-4" />}
                        {insight.trend === 'down' && <TrendingDown className="h-4 w-4" />}
                        {insight.trendValue}
                      </div>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">{insight.category}</p>
                      <p className="text-2xl font-bold">{insight.value}</p>
                    </div>
                    <p className="text-xs text-slate-500">{insight.description}</p>
                  </div>
                </Card>
              ))}
            </div>

            {/* Suggestions List */}
            <Card className="p-6 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
              <div className="flex items-center gap-2 mb-6">
                <Sparkles className="h-5 w-5 text-purple-600" />
                <h3 className="font-bold text-lg">AI改善提案</h3>
                <Badge className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                  {suggestions.length}件
                </Badge>
              </div>

              <div className="space-y-4">
                {suggestions.map((suggestion) => (
                  <Card
                    key={suggestion.id}
                    className="p-4 border hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start gap-4">
                      <div className="mt-1">{getTypeIcon(suggestion.type)}</div>
                      <div className="flex-1 space-y-2">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-bold">{suggestion.title}</h4>
                              <Badge className={getPriorityColor(suggestion.priority)}>
                                {suggestion.priority === 'high'
                                  ? '優先度高'
                                  : suggestion.priority === 'medium'
                                  ? '優先度中'
                                  : '優先度低'}
                              </Badge>
                            </div>
                            <p className="text-sm text-slate-600 dark:text-slate-400">
                              {suggestion.description}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-sm">
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                            <span className="text-green-600 font-medium">
                              期待効果: {suggestion.impact}
                            </span>
                          </div>
                          {suggestion.actionLabel && (
                            <Button variant="outline" size="sm">
                              {suggestion.actionLabel}
                              <ChevronRight className="h-4 w-4 ml-1" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </Card>

            {/* AI Summary */}
            <Card className="p-6 bg-gradient-to-r from-purple-500 to-pink-500 text-white">
              <div className="flex items-start gap-4">
                <Brain className="h-8 w-8 flex-shrink-0" />
                <div>
                  <h3 className="font-bold text-lg mb-2">AIサマリー</h3>
                  <p className="text-white/90">
                    現在のデータ分析によると、S判定企業への集中架電とスクリプト改善により、
                    週間アポ獲得数を現在の8件から12件（+50%）に向上させる可能性があります。
                    特に火曜日の時間帯調整と不動産業界へのアプローチ強化が効果的です。
                  </p>
                </div>
              </div>
            </Card>
          </>
        )}
      </main>
    </div>
  )
}
