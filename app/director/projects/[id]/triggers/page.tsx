'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/auth-context';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ArrowLeft,
  AlertCircle,
  Zap,
  ExternalLink,
  RefreshCw,
  ChevronDown,
  Plus,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface Company {
  id: string;
  name: string;
}

interface NewsTrigger {
  id: string;
  company_id: string;
  company_name?: string;
  trigger_type: 'funding' | 'hiring' | 'expansion' | 'product_launch' | 'executive_change' | 'merger' | 'award' | 'regulation' | 'other';
  title: string;
  description: string;
  source_url: string;
  detected_at: string;
  priority_score: number;
  is_processed: boolean;
  processed_by?: string;
  processed_at?: string;
  created_at: string;
}

const triggerTypeColors: Record<NewsTrigger['trigger_type'], { bg: string; text: string; label: string }> = {
  funding: { bg: 'bg-green-100', text: 'text-green-800', label: '資金調達' },
  hiring: { bg: 'bg-blue-100', text: 'text-blue-800', label: '採用' },
  expansion: { bg: 'bg-purple-100', text: 'text-purple-800', label: '拡大' },
  product_launch: { bg: 'bg-cyan-100', text: 'text-cyan-800', label: '製品発表' },
  executive_change: { bg: 'bg-amber-100', text: 'text-amber-800', label: '役員変更' },
  merger: { bg: 'bg-red-100', text: 'text-red-800', label: 'M&A' },
  award: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: '受賞' },
  regulation: { bg: 'bg-orange-100', text: 'text-orange-800', label: '規制' },
  other: { bg: 'bg-slate-100', text: 'text-slate-800', label: 'その他' },
};

const triggerTypeOptions = Object.entries(triggerTypeColors).map(([key, val]) => ({
  value: key,
  label: val.label,
}));

export default function TriggersPage() {
  const router = useRouter();
  const params = useParams();
  const { user, isDirector } = useAuth();

  const [triggers, setTriggers] = useState<NewsTrigger[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter states
  const [filterType, setFilterType] = useState<string>('all');
  const [filterProcessed, setFilterProcessed] = useState<string>('all');
  const [priorityRange, setPriorityRange] = useState<{ min: number; max: number }>({ min: 0, max: 100 });

  // Form states
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    company_id: '',
    trigger_type: 'funding' as NewsTrigger['trigger_type'],
    title: '',
    description: '',
    source_url: '',
    priority_score: 50,
  });
  const [submitting, setSubmitting] = useState(false);

  const projectId = params?.id as string;
  const supabase = createClient();

  // Auth guard
  useEffect(() => {
    if (!user || !isDirector) {
      router.push('/');
    }
  }, [user, isDirector, router]);

  // Fetch triggers and companies
  const fetchData = useCallback(async () => {
    if (!projectId) return;

    try {
      setLoading(true);
      setError(null);

      // Fetch companies for this project
      const { data: companiesData, error: companiesError } = await supabase
        .from('companies')
        .select('id, name')
        .eq('project_id', projectId)
        .order('name');

      if (companiesError) throw companiesError;
      setCompanies(companiesData || []);

      // Fetch news triggers for companies in this project
      const { data: triggersData, error: triggersError } = await supabase
        .from('news_triggers')
        .select('*')
        .in('company_id', (companiesData || []).map(c => c.id))
        .order('priority_score', { ascending: false })
        .order('detected_at', { ascending: false });

      if (triggersError) throw triggersError;

      // Enhance triggers with company names
      const enhancedTriggers = (triggersData || []).map(trigger => ({
        ...trigger,
        company_name: companiesData?.find(c => c.id === trigger.company_id)?.name || '不明',
      }));

      setTriggers(enhancedTriggers);
    } catch (err) {
      const message = err instanceof Error ? err.message : '不明なエラーが発生しました';
      setError(message);
      console.error('Error fetching triggers:', err);
    } finally {
      setLoading(false);
    }
  }, [projectId, supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-refresh every 15 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchData();
    }, 15000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Handle process trigger
  const handleProcessTrigger = async (triggerId: string) => {
    try {
      const { error } = await supabase
        .from('news_triggers')
        .update({
          is_processed: true,
          processed_by: user?.id,
          processed_at: new Date().toISOString(),
        })
        .eq('id', triggerId);

      if (error) throw error;

      // Update local state
      setTriggers(prev =>
        prev.map(t =>
          t.id === triggerId
            ? {
                ...t,
                is_processed: true,
                processed_by: user?.id,
                processed_at: new Date().toISOString(),
              }
            : t
        )
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'エラーが発生しました';
      console.error('Error processing trigger:', err);
      alert(`処理エラー: ${message}`);
    }
  };

  // Handle add trigger
  const handleAddTrigger = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.company_id || !formData.title.trim()) {
      alert('企業と題目は必須です');
      return;
    }

    try {
      setSubmitting(true);

      const { error } = await supabase.from('news_triggers').insert([
        {
          company_id: formData.company_id,
          trigger_type: formData.trigger_type,
          title: formData.title,
          description: formData.description,
          source_url: formData.source_url,
          priority_score: formData.priority_score,
          is_processed: false,
          detected_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
        },
      ]);

      if (error) throw error;

      // Reset form and refresh
      setFormData({
        company_id: '',
        trigger_type: 'funding',
        title: '',
        description: '',
        source_url: '',
        priority_score: 50,
      });
      setShowAddForm(false);
      await fetchData();
    } catch (err) {
      const message = err instanceof Error ? err.message : '不明なエラーが発生しました';
      console.error('Error adding trigger:', err);
      alert(`追加エラー: ${message}`);
    } finally {
      setSubmitting(false);
    }
  };

  // Filter triggers
  const filteredTriggers = triggers.filter(trigger => {
    if (filterType !== 'all' && trigger.trigger_type !== filterType) return false;
    if (filterProcessed === 'unprocessed' && trigger.is_processed) return false;
    if (filterProcessed === 'processed' && !trigger.is_processed) return false;
    if (trigger.priority_score < priorityRange.min || trigger.priority_score > priorityRange.max) return false;
    return true;
  });

  // Calculate stats
  const totalTriggers = triggers.length;
  const unprocessedCount = triggers.filter(t => !t.is_processed).length;
  const highPriorityCount = triggers.filter(t => t.priority_score > 70).length;
  const todayTriggersCount = triggers.filter(t => {
    const detectedDate = new Date(t.detected_at).toDateString();
    const today = new Date().toDateString();
    return detectedDate === today;
  }).length;

  const getPriorityColor = (score: number): string => {
    if (score >= 80) return 'bg-red-500';
    if (score >= 60) return 'bg-orange-500';
    if (score >= 40) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getPriorityLabel = (score: number): string => {
    if (score >= 80) return '極高';
    if (score >= 60) return '高';
    if (score >= 40) return '中';
    return '低';
  };

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
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-4xl font-bold text-slate-900">ニューストリガー管理</h1>
            <p className="text-slate-600 mt-2">優先度ベースの企業アウトリーチトリガーを管理</p>
          </div>
          <Button onClick={() => setShowAddForm(!showAddForm)} className="gap-2">
            <Plus className="h-4 w-4" />
            トリガーを追加
          </Button>
        </div>
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

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card className="p-6">
          <p className="text-sm text-slate-600 font-medium">総トリガー数</p>
          <p className="text-2xl font-bold text-slate-900 mt-2">{totalTriggers}</p>
        </Card>
        <Card className="p-6">
          <p className="text-sm text-slate-600 font-medium">未処理</p>
          <p className="text-2xl font-bold text-slate-900 mt-2">{unprocessedCount}</p>
        </Card>
        <Card className="p-6">
          <p className="text-sm text-slate-600 font-medium">高優先度 (&gt;70)</p>
          <p className="text-2xl font-bold text-slate-900 mt-2">{highPriorityCount}</p>
        </Card>
        <Card className="p-6">
          <p className="text-sm text-slate-600 font-medium">本日のトリガー</p>
          <p className="text-2xl font-bold text-slate-900 mt-2">{todayTriggersCount}</p>
        </Card>
      </div>

      {/* Add Trigger Form */}
      {showAddForm && (
        <Card className="p-8 mb-6">
          <h2 className="text-xl font-bold text-slate-900 mb-6">新しいトリガーを追加</h2>
          <form onSubmit={handleAddTrigger} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-900 mb-2">企業</label>
                <Select value={formData.company_id} onValueChange={(value) => setFormData({ ...formData, company_id: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="企業を選択" />
                  </SelectTrigger>
                  <SelectContent>
                    {companies.map(company => (
                      <SelectItem key={company.id} value={company.id}>
                        {company.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-900 mb-2">トリガータイプ</label>
                <Select value={formData.trigger_type} onValueChange={(value) => setFormData({ ...formData, trigger_type: value as NewsTrigger['trigger_type'] })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {triggerTypeOptions.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-900 mb-2">題目</label>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="トリガーの題目"
                  required
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-900 mb-2">説明</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="詳細説明"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-900 mb-2">ソースURL</label>
                <Input
                  value={formData.source_url}
                  onChange={(e) => setFormData({ ...formData, source_url: e.target.value })}
                  placeholder="https://example.com"
                  type="url"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-900 mb-2">優先度スコア</label>
                <div className="flex items-center gap-4">
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={formData.priority_score}
                    onChange={(e) => setFormData({ ...formData, priority_score: Math.max(0, Math.min(100, parseInt(e.target.value) || 0)) })}
                    className="w-20"
                  />
                  <div className="flex-1">
                    <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-full ${getPriorityColor(formData.priority_score)} transition-all`}
                        style={{ width: `${formData.priority_score}%` }}
                      />
                    </div>
                  </div>
                  <Badge>{getPriorityLabel(formData.priority_score)}</Badge>
                </div>
              </div>
            </div>

            <div className="flex gap-4 justify-end">
              <Button variant="outline" onClick={() => setShowAddForm(false)}>
                キャンセル
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? '追加中...' : '追加'}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Filters */}
      <Card className="p-6 mb-6">
        <h3 className="font-semibold text-slate-900 mb-4">フィルタ</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-900 mb-2">トリガータイプ</label>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">すべて</SelectItem>
                {triggerTypeOptions.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-900 mb-2">処理状況</label>
            <Select value={filterProcessed} onValueChange={setFilterProcessed}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">すべて</SelectItem>
                <SelectItem value="unprocessed">未処理</SelectItem>
                <SelectItem value="processed">処理済み</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-900 mb-2">最小優先度</label>
            <Input
              type="number"
              min="0"
              max="100"
              value={priorityRange.min}
              onChange={(e) => setPriorityRange({ ...priorityRange, min: parseInt(e.target.value) || 0 })}
              placeholder="0"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-900 mb-2">最大優先度</label>
            <Input
              type="number"
              min="0"
              max="100"
              value={priorityRange.max}
              onChange={(e) => setPriorityRange({ ...priorityRange, max: parseInt(e.target.value) || 100 })}
              placeholder="100"
            />
          </div>
        </div>
      </Card>

      {/* Triggers Feed */}
      {loading ? (
        <Card className="p-12 text-center">
          <p className="text-slate-600">トリガーを読み込み中...</p>
        </Card>
      ) : filteredTriggers.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="text-slate-600">トリガーがありません</p>
        </Card>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-slate-600 font-medium">
            {filteredTriggers.length} 件のトリガー
          </p>
          {filteredTriggers.map((trigger, index) => (
            <div
              key={trigger.id}
              className={`border rounded-lg overflow-hidden transition-all hover:shadow-md ${
                trigger.is_processed ? 'bg-slate-50 border-slate-200' : 'bg-white border-slate-300'
              }`}
            >
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <Badge className={`${triggerTypeColors[trigger.trigger_type].bg} ${triggerTypeColors[trigger.trigger_type].text}`}>
                        {triggerTypeColors[trigger.trigger_type].label}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={`${getPriorityColor(trigger.priority_score)} text-white border-0`}
                      >
                        {getPriorityLabel(trigger.priority_score)} ({trigger.priority_score})
                      </Badge>
                      {trigger.is_processed && (
                        <Badge variant="secondary">処理済み</Badge>
                      )}
                    </div>
                    <h3 className={`text-lg font-semibold ${trigger.is_processed ? 'text-slate-500 line-through' : 'text-slate-900'}`}>
                      {trigger.title}
                    </h3>
                    <p className="text-sm text-slate-600 mt-1">{trigger.company_name}</p>
                  </div>

                  <div className="text-right ml-4">
                    <div className="text-2xl font-bold text-slate-900">
                      {trigger.priority_score}
                    </div>
                    <div className="w-16 bg-slate-200 rounded-full h-2 overflow-hidden mt-2">
                      <div
                        className={`h-full ${getPriorityColor(trigger.priority_score)}`}
                        style={{ width: `${trigger.priority_score}%` }}
                      />
                    </div>
                  </div>
                </div>

                {trigger.description && (
                  <p className="text-slate-700 mb-4">{trigger.description}</p>
                )}

                <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600 mb-4">
                  <span>検出日時: {new Date(trigger.detected_at).toLocaleDateString('ja-JP')}</span>
                  {trigger.source_url && (
                    <a
                      href={trigger.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 flex items-center gap-1"
                    >
                      ソース <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>

                {trigger.is_processed && trigger.processed_at && (
                  <p className="text-xs text-slate-500 mb-4">
                    処理日時: {new Date(trigger.processed_at).toLocaleDateString('ja-JP')}
                  </p>
                )}

                <div className="flex justify-end">
                  {!trigger.is_processed && (
                    <Button
                      onClick={() => handleProcessTrigger(trigger.id)}
                      size="sm"
                      className="gap-2"
                    >
                      <Zap className="h-4 w-4" />
                      処理済みにする
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Auto-refresh indicator */}
      <div className="mt-8 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
        <RefreshCw className="h-3 w-3 animate-spin" />
        15秒ごとに自動更新
      </div>
    </div>
  );
}
