'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Loader2,
  TrendingUp,
  TrendingDown,
  Minus,
  Flame,
  ThermometerSun,
  Snowflake,
  Building2,
  Users,
  Target,
  AlertTriangle,
  Lightbulb,
  MessageSquare,
  Clock,
  Briefcase,
  DollarSign,
  Award,
  Zap,
} from 'lucide-react'
import type {
  Company,
  FullAnalysisResult,
  IntentAnalysis,
  CompanyAnalysis,
  IntentSignal,
} from '@/lib/api'

type CompanyAnalysisModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  company: Partial<Company> | null
  analysisResult: FullAnalysisResult | null
  isLoading: boolean
  onRunAnalysis: () => void
}

const getIntentIcon = (level: IntentAnalysis['level']) => {
  switch (level) {
    case 'hot':
      return <Flame className="h-5 w-5 text-red-500" />
    case 'warm':
      return <ThermometerSun className="h-5 w-5 text-orange-500" />
    case 'cold':
      return <Snowflake className="h-5 w-5 text-blue-500" />
  }
}

const getIntentBadgeColor = (level: IntentAnalysis['level']) => {
  switch (level) {
    case 'hot':
      return 'bg-red-500 text-white'
    case 'warm':
      return 'bg-orange-500 text-white'
    case 'cold':
      return 'bg-blue-500 text-white'
  }
}

const getTrendIcon = (trend: 'growing' | 'stable' | 'declining') => {
  switch (trend) {
    case 'growing':
      return <TrendingUp className="h-4 w-4 text-green-500" />
    case 'stable':
      return <Minus className="h-4 w-4 text-slate-500" />
    case 'declining':
      return <TrendingDown className="h-4 w-4 text-red-500" />
  }
}

const getSignalIcon = (type: IntentSignal['type']) => {
  switch (type) {
    case 'hiring':
      return <Users className="h-4 w-4" />
    case 'expansion':
      return <Building2 className="h-4 w-4" />
    case 'funding':
      return <DollarSign className="h-4 w-4" />
    case 'news':
      return <Zap className="h-4 w-4" />
    case 'technology':
      return <Lightbulb className="h-4 w-4" />
  }
}

const getSignalStrengthColor = (strength: IntentSignal['strength']) => {
  switch (strength) {
    case 'high':
      return 'border-red-300 bg-red-50 dark:bg-red-950/30'
    case 'medium':
      return 'border-orange-300 bg-orange-50 dark:bg-orange-950/30'
    case 'low':
      return 'border-blue-300 bg-blue-50 dark:bg-blue-950/30'
  }
}

const getBuyingStageBadge = (stage: IntentAnalysis['buyingStage']) => {
  const stages = {
    awareness: { label: '認知段階', color: 'bg-slate-500' },
    consideration: { label: '検討段階', color: 'bg-yellow-500' },
    decision: { label: '決定段階', color: 'bg-green-500' },
    unknown: { label: '不明', color: 'bg-slate-400' },
  }
  const s = stages[stage]
  return <Badge className={`${s.color} text-white`}>{s.label}</Badge>
}

export function CompanyAnalysisModal({
  open,
  onOpenChange,
  company,
  analysisResult,
  isLoading,
  onRunAnalysis,
}: CompanyAnalysisModalProps) {
  const [activeTab, setActiveTab] = useState('intent')

  if (!company) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <Building2 className="h-6 w-6 text-blue-600" />
            <span>{company.name}</span>
            {analysisResult?.score && (
              <Badge
                className={
                  analysisResult.score.rank === 'S'
                    ? 'bg-gradient-to-r from-yellow-500 to-amber-500 text-white'
                    : analysisResult.score.rank === 'A'
                    ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white'
                    : analysisResult.score.rank === 'B'
                    ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white'
                    : 'bg-slate-400 text-white'
                }
              >
                {analysisResult.score.rank}ランク
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
            <p className="text-slate-600">AI分析を実行中...</p>
            <p className="text-sm text-slate-400">
              インテント調査・企業分析・スコアリングを実施しています
            </p>
          </div>
        ) : !analysisResult ? (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <Target className="h-16 w-16 text-slate-300" />
            <p className="text-slate-600">分析データがありません</p>
            <Button onClick={onRunAnalysis} className="bg-gradient-to-r from-purple-600 to-pink-500 text-white">
              <Zap className="mr-2 h-4 w-4" />
              AI分析を実行
            </Button>
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="intent" className="flex items-center gap-2">
                <Flame className="h-4 w-4" />
                インテント
              </TabsTrigger>
              <TabsTrigger value="analysis" className="flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                企業分析
              </TabsTrigger>
              <TabsTrigger value="approach" className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                アプローチ
              </TabsTrigger>
            </TabsList>

            {/* インテント調査タブ */}
            <TabsContent value="intent" className="space-y-4 mt-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* インテントスコア */}
                <Card className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-slate-600">インテントスコア</span>
                    {getIntentIcon(analysisResult.intent.level)}
                  </div>
                  <div className="flex items-end gap-2">
                    <span className="text-3xl font-bold">{analysisResult.intent.score}</span>
                    <span className="text-slate-500 mb-1">/100</span>
                  </div>
                  <Progress value={analysisResult.intent.score} className="mt-2 h-2" />
                  <Badge className={`mt-2 ${getIntentBadgeColor(analysisResult.intent.level)}`}>
                    {analysisResult.intent.level === 'hot'
                      ? 'HOT リード'
                      : analysisResult.intent.level === 'warm'
                      ? 'WARM リード'
                      : 'COLD リード'}
                  </Badge>
                </Card>

                {/* 購買段階 */}
                <Card className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Briefcase className="h-4 w-4 text-slate-500" />
                    <span className="text-sm text-slate-600">購買段階</span>
                  </div>
                  {getBuyingStageBadge(analysisResult.intent.buyingStage)}
                  <p className="text-sm text-slate-500 mt-2">
                    {analysisResult.intent.buyingStage === 'decision'
                      ? '意思決定の最終段階にあります'
                      : analysisResult.intent.buyingStage === 'consideration'
                      ? '複数の選択肢を比較検討中'
                      : analysisResult.intent.buyingStage === 'awareness'
                      ? '課題を認識し始めた段階'
                      : '購買意向は確認できません'}
                  </p>
                </Card>

                {/* 最適タイミング */}
                <Card className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="h-4 w-4 text-slate-500" />
                    <span className="text-sm text-slate-600">最適コンタクト</span>
                  </div>
                  <p className="font-medium text-slate-900 dark:text-slate-100">
                    {analysisResult.intent.bestContactTiming}
                  </p>
                </Card>
              </div>

              {/* サマリー */}
              <Card className="p-4 bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  <strong>AI分析サマリー：</strong> {analysisResult.intent.summary}
                </p>
              </Card>

              {/* シグナル一覧 */}
              <div>
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  <Zap className="h-4 w-4 text-yellow-500" />
                  検出されたシグナル
                </h4>
                <div className="space-y-2">
                  {analysisResult.intent.signals.map((signal, index) => (
                    <Card
                      key={index}
                      className={`p-3 border ${getSignalStrengthColor(signal.strength)}`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-white dark:bg-slate-800 rounded-lg">
                          {getSignalIcon(signal.type)}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{signal.title}</span>
                            <Badge
                              variant="outline"
                              className={
                                signal.strength === 'high'
                                  ? 'border-red-500 text-red-600'
                                  : signal.strength === 'medium'
                                  ? 'border-orange-500 text-orange-600'
                                  : 'border-blue-500 text-blue-600'
                              }
                            >
                              {signal.strength === 'high'
                                ? '強'
                                : signal.strength === 'medium'
                                ? '中'
                                : '弱'}
                            </Badge>
                          </div>
                          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                            {signal.description}
                          </p>
                          <p className="text-xs text-slate-400 mt-1">
                            {signal.date} {signal.source && `・ ${signal.source}`}
                          </p>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            </TabsContent>

            {/* 企業分析タブ */}
            <TabsContent value="analysis" className="space-y-4 mt-4">
              {/* 概要 */}
              <Card className="p-4">
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-blue-600" />
                  企業概要
                </h4>
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
                  {analysisResult.analysis.overview.description}
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  {analysisResult.analysis.overview.foundedYear && (
                    <div>
                      <span className="text-slate-500">設立</span>
                      <p className="font-medium">{analysisResult.analysis.overview.foundedYear}年</p>
                    </div>
                  )}
                  {analysisResult.analysis.overview.ceo && (
                    <div>
                      <span className="text-slate-500">代表</span>
                      <p className="font-medium">{analysisResult.analysis.overview.ceo}</p>
                    </div>
                  )}
                  <div>
                    <span className="text-slate-500">所在地</span>
                    <p className="font-medium">{analysisResult.analysis.overview.headquarters}</p>
                  </div>
                  <div>
                    <span className="text-slate-500">事業モデル</span>
                    <p className="font-medium">{analysisResult.analysis.overview.businessModel}</p>
                  </div>
                </div>
              </Card>

              {/* 市場ポジション */}
              <Card className="p-4">
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  <Award className="h-4 w-4 text-purple-600" />
                  市場ポジション
                  {getTrendIcon(analysisResult.analysis.marketPosition.trend)}
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <span className="text-sm text-slate-500">業界順位</span>
                    <p className="font-medium">{analysisResult.analysis.marketPosition.rank}</p>
                  </div>
                  {analysisResult.analysis.marketPosition.marketShare && (
                    <div>
                      <span className="text-sm text-slate-500">市場シェア</span>
                      <p className="font-medium">{analysisResult.analysis.marketPosition.marketShare}</p>
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <div>
                    <span className="text-sm text-green-600 font-medium">強み</span>
                    <ul className="mt-1 space-y-1">
                      {analysisResult.analysis.marketPosition.strengths.map((s, i) => (
                        <li key={i} className="text-sm text-slate-600 dark:text-slate-400 flex items-start gap-2">
                          <span className="text-green-500 mt-1">✓</span> {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <span className="text-sm text-red-600 font-medium">弱み</span>
                    <ul className="mt-1 space-y-1">
                      {analysisResult.analysis.marketPosition.weaknesses.map((w, i) => (
                        <li key={i} className="text-sm text-slate-600 dark:text-slate-400 flex items-start gap-2">
                          <span className="text-red-500 mt-1">•</span> {w}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </Card>

              {/* 競合情報 */}
              <Card className="p-4">
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  <Users className="h-4 w-4 text-orange-600" />
                  主要競合
                </h4>
                <div className="space-y-3">
                  {analysisResult.analysis.competitors.map((comp, index) => (
                    <div key={index} className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                      <p className="font-medium text-sm">{comp.name}</p>
                      <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
                        <div>
                          <span className="text-green-600">強み:</span>
                          <span className="text-slate-600 dark:text-slate-400 ml-1">{comp.strength}</span>
                        </div>
                        <div>
                          <span className="text-red-600">弱み:</span>
                          <span className="text-slate-600 dark:text-slate-400 ml-1">{comp.weakness}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              {/* 機会とリスク */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="p-4">
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <Lightbulb className="h-4 w-4 text-yellow-600" />
                    機会
                  </h4>
                  <ul className="space-y-2">
                    {analysisResult.analysis.opportunities.map((opp, i) => (
                      <li key={i} className="text-sm text-slate-600 dark:text-slate-400 flex items-start gap-2">
                        <span className="text-yellow-500 mt-1">★</span> {opp}
                      </li>
                    ))}
                  </ul>
                </Card>
                <Card className="p-4">
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                    リスク
                  </h4>
                  <ul className="space-y-2">
                    {analysisResult.analysis.risks.map((risk, i) => (
                      <li key={i} className="text-sm text-slate-600 dark:text-slate-400 flex items-start gap-2">
                        <span className="text-red-500 mt-1">!</span> {risk}
                      </li>
                    ))}
                  </ul>
                </Card>
              </div>
            </TabsContent>

            {/* アプローチ戦略タブ */}
            <TabsContent value="approach" className="space-y-4 mt-4">
              <Card className="p-4 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/30 dark:to-pink-950/30 border-purple-200 dark:border-purple-800">
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <Target className="h-4 w-4 text-purple-600" />
                  推奨アプローチ戦略
                </h4>
                <p className="text-sm text-slate-700 dark:text-slate-300">
                  {analysisResult.analysis.recommendedApproach.strategy}
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <Clock className="h-4 w-4 text-slate-500" />
                  <span className="text-sm text-slate-600 dark:text-slate-400">
                    理想的なタイミング: {analysisResult.analysis.recommendedApproach.idealTiming}
                  </span>
                </div>
              </Card>

              <Card className="p-4">
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-blue-600" />
                  トークポイント
                </h4>
                <ul className="space-y-2">
                  {analysisResult.analysis.recommendedApproach.talkingPoints.map((point, i) => (
                    <li
                      key={i}
                      className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg text-sm text-slate-700 dark:text-slate-300"
                    >
                      {i + 1}. {point}
                    </li>
                  ))}
                </ul>
              </Card>

              <Card className="p-4">
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-orange-600" />
                  想定される反論と対策
                </h4>
                <ul className="space-y-2">
                  {analysisResult.analysis.recommendedApproach.objectionHandling.map((obj, i) => (
                    <li
                      key={i}
                      className="p-3 bg-orange-50 dark:bg-orange-950/30 rounded-lg text-sm text-slate-700 dark:text-slate-300"
                    >
                      {obj}
                    </li>
                  ))}
                </ul>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  )
}
