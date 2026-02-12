'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { getCallQualityScores } from '@/lib/management-api';
import { getProjects } from '@/lib/projects-api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart3, TrendingUp, AlertCircle, Award } from 'lucide-react';

interface CallQualityScore {
  id: string;
  operator_id: string;
  greeting_score: number;
  hearing_score: number;
  proposal_score: number;
  closing_score: number;
  pace_score: number;
  tone_score: number;
  total_score: number;
  recorded_at: string;
  operator_name?: string;
}

interface NGWordData {
  word: string;
  count: number;
}

interface KPI {
  label: string;
  key: 'greeting_score' | 'hearing_score' | 'proposal_score' | 'closing_score' | 'pace_score' | 'tone_score';
  jaLabel: string;
}

const KPIS: KPI[] = [
  { label: 'Greeting', key: 'greeting_score', jaLabel: '挨拶' },
  { label: 'Hearing', key: 'hearing_score', jaLabel: 'ヒアリング' },
  { label: 'Proposal', key: 'proposal_score', jaLabel: '提案' },
  { label: 'Closing', key: 'closing_score', jaLabel: 'クロージング' },
  { label: 'Pace', key: 'pace_score', jaLabel: 'ペース' },
  { label: 'Tone', key: 'tone_score', jaLabel: 'トーン' },
];

export default function QualityCommanderPage() {
  const { user, isLoading: authLoading } = useAuth();

  const [scores, setScores] = useState<CallQualityScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterProject, setFilterProject] = useState('all');
  const [projects, setProjects] = useState<Array<{ id: string; name: string }>>([]);
  const [ngWords, setNgWords] = useState<NGWordData[]>([]);
  const [weekComparison, setWeekComparison] = useState<{
    thisWeek: number;
    lastWeek: number;
  }>({ thisWeek: 0, lastWeek: 0 });

  useEffect(() => {
    if (authLoading || !user) return;
    loadProjects();
    loadScores();
  }, [user, authLoading]);

  const loadProjects = async () => {
    try {
      const data = await getProjects();
      setProjects(data.map(p => ({ id: p.id, name: p.name })) || []);
    } catch (error) {
      console.error('Error loading projects:', error);
    }
  };

  const loadScores = async () => {
    try {
      setLoading(true);
      const data = await getCallQualityScores();

      const formattedScores = data?.map((item: any) => ({
        ...item,
        operator_name: item.operator?.name || 'Unknown',
        recorded_at: item.scored_at || item.recorded_at,
      })) || [];

      setScores(formattedScores);

      // Calculate NG words (mock data - in real scenario, fetch from a separate table)
      calculateNGWords(formattedScores);

      // Calculate week comparison
      calculateWeekComparison(formattedScores);
    } catch (error) {
      console.error('Error loading call quality scores:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateNGWords = (scoreData: CallQualityScore[]) => {
    // Mock NG words - replace with actual data from ng_words table
    const mockNGWords = [
      { word: 'えっと', count: 45 },
      { word: 'あの', count: 38 },
      { word: 'ちょっと', count: 32 },
      { word: 'まあ', count: 28 },
      { word: 'とりあえず', count: 22 },
    ];
    setNgWords(mockNGWords);
  };

  const calculateWeekComparison = (scoreData: CallQualityScore[]) => {
    const now = new Date();
    const thisWeekStart = new Date(now);
    thisWeekStart.setDate(now.getDate() - now.getDay());

    const lastWeekStart = new Date(thisWeekStart);
    lastWeekStart.setDate(thisWeekStart.getDate() - 7);

    const thisWeekScores = scoreData.filter((s) => {
      const date = new Date(s.recorded_at);
      return date >= thisWeekStart;
    });

    const lastWeekScores = scoreData.filter((s) => {
      const date = new Date(s.recorded_at);
      return date >= lastWeekStart && date < thisWeekStart;
    });

    const thisWeekAvg =
      thisWeekScores.reduce((sum, s) => sum + s.total_score, 0) / (thisWeekScores.length || 1);
    const lastWeekAvg =
      lastWeekScores.reduce((sum, s) => sum + s.total_score, 0) / (lastWeekScores.length || 1);

    setWeekComparison({
      thisWeek: Math.round(thisWeekAvg),
      lastWeek: Math.round(lastWeekAvg),
    });
  };

  const getAverageScoreByKPI = (kpiKey: string): number => {
    if (scores.length === 0) return 0;
    const sum = scores.reduce((acc, score) => acc + (score[kpiKey as keyof CallQualityScore] as number || 0), 0);
    return Math.round(sum / scores.length);
  };

  const getRankedOperators = () => {
    return [...scores].sort((a, b) => b.total_score - a.total_score).slice(0, 10);
  };

  const getCoachingQueue = () => {
    return scores.filter((s) => s.total_score < 70).sort((a, b) => a.total_score - b.total_score);
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 70) return 'bg-yellow-500';
    if (score >= 60) return 'bg-orange-500';
    return 'bg-red-500';
  };

  if (authLoading) {
    return <div className="p-8 text-center">読み込み中...</div>;
  }

  const rankedOperators = getRankedOperators();
  const coachingQueue = getCoachingQueue();

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">AI品質コマンダー</h1>
        <p className="text-gray-600">全オペレーターのコール品質監視</p>
      </div>

      {/* Project Filter */}
      <div className="flex gap-4">
        <Select value={filterProject} onValueChange={setFilterProject}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="プロジェクトで絞り込み" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">すべてのプロジェクト</SelectItem>
            {projects.map((proj) => (
              <SelectItem key={proj.id} value={proj.id}>
                {proj.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-500">読み込み中...</div>
      ) : (
        <>
          {/* Week Comparison */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-gray-600">今週の平均スコア</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-blue-600">{weekComparison.thisWeek}</p>
                <p className="text-xs text-gray-500 mt-1">
                  先週: {weekComparison.lastWeek} (
                  {weekComparison.thisWeek - weekComparison.lastWeek >= 0 ? '+' : ''}
                  {weekComparison.thisWeek - weekComparison.lastWeek})
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                  <Award className="w-4 h-4" />
                  評価対象オペレーター
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-green-600">{scores.length}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  コーチング対象
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-red-600">{coachingQueue.length}</p>
              </CardContent>
            </Card>
          </div>

          {/* KPI Overview - Horizontal Bars */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                KPI平均スコア
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {KPIS.map((kpi) => {
                const avgScore = getAverageScoreByKPI(kpi.key);
                return (
                  <div key={kpi.key}>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700">{kpi.jaLabel}</span>
                      <span className="text-sm font-bold text-gray-900">{avgScore}</span>
                    </div>
                    <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${getScoreColor(avgScore)} transition-all`}
                        style={{ width: `${(avgScore / 100) * 100}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Operator Ranking */}
          <Card>
            <CardHeader>
              <CardTitle>オペレーターランキング TOP 10</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {rankedOperators.map((operator, index) => (
                  <div key={operator.id} className="flex items-center gap-4 pb-3 border-b last:border-0">
                    <div className="text-sm font-bold text-gray-500 w-8">#{index + 1}</div>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{operator.operator_name}</p>
                      <div className="flex gap-1 mt-2">
                        {KPIS.map((kpi) => {
                          const score = operator[kpi.key as keyof CallQualityScore] as number;
                          return (
                            <div key={kpi.key} className="flex-1">
                              <div className="h-2 bg-gray-200 rounded overflow-hidden">
                                <div
                                  className={`h-full ${getScoreColor(score)}`}
                                  style={{ width: `${(score / 100) * 100}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-gray-900">{operator.total_score}</p>
                      <p className="text-xs text-gray-600">総合スコア</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* NG Words */}
          <Card>
            <CardHeader>
              <CardTitle>頻出NG言葉</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {ngWords.map((item) => (
                  <div key={item.word} className="flex items-center justify-between">
                    <span className="font-medium text-gray-700">{item.word}</span>
                    <Badge variant="destructive">{item.count}件</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Coaching Queue */}
          {coachingQueue.length > 0 && (
            <Card className="border-orange-200 bg-orange-50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-orange-900">
                  <AlertCircle className="w-5 h-5 text-orange-600" />
                  コーチング対象者 (スコア &lt; 70)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {coachingQueue.map((operator) => (
                    <div
                      key={operator.id}
                      className="flex items-center justify-between p-3 bg-white rounded border border-orange-200"
                    >
                      <div>
                        <p className="font-medium text-gray-900">{operator.operator_name}</p>
                        <p className="text-sm text-gray-600">
                          最終評価: {new Date(operator.recorded_at).toLocaleDateString('ja-JP')}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-red-600">{operator.total_score}</p>
                        <p className="text-xs text-gray-600">総合スコア</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
