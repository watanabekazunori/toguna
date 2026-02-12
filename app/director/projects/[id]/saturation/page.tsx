'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/auth-context';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, TrendingUp, AlertCircle, CheckCircle2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface MarketSaturation {
  id: string;
  project_id: string;
  industry: string;
  region: string;
  total_addressable_market: number;
  contacted_count: number;
  penetration_rate: number;
  saturation_score: number;
  competitor_density: number;
  recommended_action: string;
  calculated_at: string;
}

export default function SaturationPage() {
  const router = useRouter();
  const params = useParams();
  const { user, isDirector } = useAuth();
  const [saturationData, setSaturationData] = useState<MarketSaturation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const projectId = params?.id as string;

  // Auth guard
  useEffect(() => {
    if (!user || !isDirector) {
      router.push('/');
    }
  }, [user, isDirector, router]);

  // Fetch saturation data
  const fetchSaturationData = useCallback(async () => {
    if (!projectId) return;

    try {
      setLoading(true);
      setError(null);
      const supabase = createClient();

      const { data, error: fetchError } = await supabase
        .from('market_saturation')
        .select('*')
        .eq('project_id', projectId)
        .order('saturation_score', { ascending: false });

      if (fetchError) throw fetchError;
      setSaturationData(data || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : '不明なエラーが発生しました';
      setError(message);
      console.error('Error fetching saturation data:', err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchSaturationData();
  }, [fetchSaturationData]);

  // Calculate summary statistics
  const calculateStats = () => {
    if (saturationData.length === 0) {
      return {
        totalTam: 0,
        totalContacted: 0,
        avgPenetration: 0,
        highestSaturation: 0,
        lowestSaturation: 0,
        highestRegion: '',
        lowestRegion: '',
      };
    }

    const totalTam = saturationData.reduce((sum, item) => sum + (item.total_addressable_market || 0), 0);
    const totalContacted = saturationData.reduce((sum, item) => sum + (item.contacted_count || 0), 0);
    const avgPenetration = saturationData.reduce((sum, item) => sum + (item.penetration_rate || 0), 0) / saturationData.length;

    const sorted = [...saturationData].sort((a, b) => (b.saturation_score || 0) - (a.saturation_score || 0));
    const highestSaturation = sorted[0]?.saturation_score || 0;
    const highestRegion = sorted[0]?.region || '';
    const lowestSaturation = sorted[sorted.length - 1]?.saturation_score || 0;
    const lowestRegion = sorted[sorted.length - 1]?.region || '';

    return {
      totalTam,
      totalContacted,
      avgPenetration,
      highestSaturation,
      lowestSaturation,
      highestRegion,
      lowestRegion,
    };
  };

  const getSaturationColor = (rate: number): string => {
    if (rate < 30) return 'bg-green-500';
    if (rate < 60) return 'bg-amber-500';
    return 'bg-red-500';
  };

  const getSaturationLabel = (rate: number): string => {
    if (rate < 30) return '機会有り';
    if (rate < 60) return '中程度';
    return '飽和状態';
  };

  const getSaturationBadgeVariant = (rate: number): 'default' | 'secondary' | 'outline' | 'destructive' => {
    if (rate < 30) return 'default'
    if (rate < 60) return 'secondary'
    return 'destructive'
  }

  const industryBreakdown = () => {
    const grouped = saturationData.reduce((acc, item) => {
      if (!acc[item.industry]) {
        acc[item.industry] = {
          industry: item.industry,
          totalSaturation: 0,
          count: 0,
        };
      }
      acc[item.industry].totalSaturation += item.saturation_score || 0;
      acc[item.industry].count += 1;
      return acc;
    }, {} as Record<string, any>);

    return Object.values(grouped).map((item: any) => ({
      ...item,
      avgSaturation: item.totalSaturation / item.count,
    }));
  };

  const stats = calculateStats();
  const industry = industryBreakdown();

  if (!user || !isDirector) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
      {/* Header */}
      <div className="mb-8">
        <Link href={`/director/projects/${projectId}`}>
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            プロジェクトに戻る
          </Button>
        </Link>
        <h1 className="text-4xl font-bold text-slate-900">市場飽和度分析</h1>
        <p className="text-slate-600 mt-2">プロジェクトの市場飽和状況をリアルタイムで把握</p>
      </div>

      {error && (
        <Card className="bg-red-50 border-red-200 p-4 mb-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
            <div>
              <h3 className="font-semibold text-red-900">エラー</h3>
              <p className="text-red-800">{error}</p>
            </div>
          </div>
        </Card>
      )}

      {loading ? (
        <Card className="p-12 text-center">
          <p className="text-slate-600">データを読み込み中...</p>
        </Card>
      ) : saturationData.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="text-slate-600">市場飽和度データがありません</p>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Summary Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="p-6">
              <p className="text-sm text-slate-600 font-medium">総対象市場規模</p>
              <p className="text-2xl font-bold text-slate-900 mt-2">
                ¥{(stats.totalTam / 1000000).toFixed(1)}M
              </p>
            </Card>
            <Card className="p-6">
              <p className="text-sm text-slate-600 font-medium">接触済み企業</p>
              <p className="text-2xl font-bold text-slate-900 mt-2">{stats.totalContacted.toLocaleString()}</p>
            </Card>
            <Card className="p-6">
              <p className="text-sm text-slate-600 font-medium">平均浸透率</p>
              <p className="text-2xl font-bold text-slate-900 mt-2">{stats.avgPenetration.toFixed(1)}%</p>
            </Card>
            <Card className="p-6">
              <p className="text-sm text-slate-600 font-medium">データポイント数</p>
              <p className="text-2xl font-bold text-slate-900 mt-2">{saturationData.length}</p>
            </Card>
          </div>

          {/* Overall Penetration Rate Gauge */}
          <Card className="p-8">
            <h2 className="text-xl font-bold text-slate-900 mb-6">全体浸透率</h2>
            <div className="flex flex-col items-center justify-center space-y-6">
              <div className="relative w-48 h-48">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 200 200">
                  <circle
                    cx="100"
                    cy="100"
                    r="90"
                    fill="none"
                    stroke="#e2e8f0"
                    strokeWidth="12"
                  />
                  <circle
                    cx="100"
                    cy="100"
                    r="90"
                    fill="none"
                    stroke={getSaturationColor(stats.avgPenetration)}
                    strokeWidth="12"
                    strokeDasharray={`${(stats.avgPenetration / 100) * 565.48} 565.48`}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <p className="text-4xl font-bold text-slate-900">{stats.avgPenetration.toFixed(1)}%</p>
                  <p className="text-sm text-slate-600 mt-1">{getSaturationLabel(stats.avgPenetration)}</p>
                </div>
              </div>
              <p className="text-sm text-slate-600 text-center max-w-md">
                市場の {stats.avgPenetration.toFixed(1)}% に到達しています
              </p>
            </div>
          </Card>

          {/* Industry Breakdown */}
          <Card className="p-8">
            <h2 className="text-xl font-bold text-slate-900 mb-6">業界別分析</h2>
            <div className="space-y-6">
              {industry.map((item: any) => (
                <div key={item.industry}>
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-medium text-slate-900">{item.industry}</span>
                    <span className="text-sm font-semibold text-slate-600">
                      {item.avgSaturation.toFixed(1)}% ({item.count}件)
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
                    <div
                      className={`h-full ${getSaturationColor(item.avgSaturation)} transition-all duration-300`}
                      style={{ width: `${Math.min(item.avgSaturation, 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Region Breakdown Grid */}
          <Card className="p-8">
            <h2 className="text-xl font-bold text-slate-900 mb-6">地域別分析</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {saturationData.map((item) => (
                <div
                  key={item.id}
                  className="border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex justify-between items-start mb-3">
                    <h3 className="font-semibold text-slate-900">{item.region}</h3>
                    <Badge variant={getSaturationBadgeVariant(item.saturation_score)}>
                      {item.saturation_score.toFixed(1)}%
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-600 mb-3">{item.industry}</p>
                  <div className="space-y-2">
                    <div>
                      <p className="text-xs text-slate-600 mb-1">浸透率</p>
                      <Progress value={item.penetration_rate} className="h-2" />
                      <p className="text-xs text-slate-600 mt-1">{item.penetration_rate.toFixed(1)}%</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-600 mb-1">競合密度</p>
                      <Progress value={Math.min(item.competitor_density, 100)} className="h-2" />
                      <p className="text-xs text-slate-600 mt-1">{item.competitor_density.toFixed(1)}</p>
                    </div>
                    <div className="pt-2 border-t border-slate-100">
                      <p className="text-xs text-slate-600">
                        <span className="font-semibold">対象市場:</span> ¥{(item.total_addressable_market / 1000000).toFixed(1)}M
                      </p>
                      <p className="text-xs text-slate-600 mt-1">
                        <span className="font-semibold">接触済み:</span> {item.contacted_count.toLocaleString()}社
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Competitor Density Overview */}
          <Card className="p-8">
            <h2 className="text-xl font-bold text-slate-900 mb-6">競合密度インジケータ</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {saturationData.map((item) => (
                <div key={`competitor-${item.id}`} className="flex items-center justify-between p-4 border border-slate-200 rounded-lg">
                  <div>
                    <p className="font-medium text-slate-900">{item.region} / {item.industry}</p>
                    <p className="text-sm text-slate-600 mt-1">競合密度</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-slate-900">{item.competitor_density.toFixed(1)}</p>
                    <Badge variant={item.competitor_density > 70 ? 'destructive' : item.competitor_density > 40 ? 'secondary' : 'default'}>
                      {item.competitor_density > 70 ? '高い' : item.competitor_density > 40 ? '中程度' : '低い'}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Recommended Actions */}
          <Card className="p-8">
            <h2 className="text-xl font-bold text-slate-900 mb-6">推奨アクション</h2>
            <div className="space-y-4">
              {saturationData.map((item) => (
                <div
                  key={`action-${item.id}`}
                  className="flex items-start gap-4 p-4 border-l-4 bg-slate-50 rounded-lg"
                  style={{
                    borderLeftColor: item.saturation_score < 30 ? '#22c55e' : item.saturation_score < 60 ? '#f59e0b' : '#ef4444',
                  }}
                >
                  <div className="mt-1">
                    {item.saturation_score < 30 ? (
                      <TrendingUp className="h-5 w-5 text-green-600" />
                    ) : item.saturation_score < 60 ? (
                      <AlertCircle className="h-5 w-5 text-amber-600" />
                    ) : (
                      <CheckCircle2 className="h-5 w-5 text-red-600" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-slate-900">
                      {item.region} / {item.industry}
                    </p>
                    <p className="text-sm text-slate-600 mt-1">{item.recommended_action}</p>
                    <p className="text-xs text-slate-500 mt-2">
                      更新日時: {new Date(item.calculated_at).toLocaleDateString('ja-JP')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
