'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Plus, Search, TrendingUp } from 'lucide-react';

interface KnowledgeItem {
  id: string;
  project_id: string;
  category: 'script' | 'objection_handling' | 'closing' | 'product_info' | 'market_info';
  title: string;
  content: string;
  success_rate: number;
  usage_count: number;
  created_by: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

type Category = 'script' | 'objection_handling' | 'closing' | 'product_info' | 'market_info';

const CATEGORIES: Array<{ id: Category; label: string; ja: string }> = [
  { id: 'script', label: 'Script', ja: 'スクリプト' },
  { id: 'objection_handling', label: 'Objection', ja: '切り返しトーク' },
  { id: 'closing', label: 'Closing', ja: 'クロージング' },
  { id: 'product_info', label: 'Product', ja: '商品知識' },
  { id: 'market_info', label: 'Market', ja: '市場情報' },
];

export default function KnowledgeDNAPage() {
  const { user, isLoading: authLoading } = useAuth();
  const supabase = createClient();

  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterProject, setFilterProject] = useState('all');
  const [sortBy, setSortBy] = useState<'success_rate' | 'usage_count'>('success_rate');
  const [projects, setProjects] = useState<Array<{ id: string; name: string }>>([]);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Form state
  const [formCategory, setFormCategory] = useState<Category>('script');
  const [formTitle, setFormTitle] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formProjectId, setFormProjectId] = useState('');

  useEffect(() => {
    if (authLoading || !user) return;
    loadProjects();
    loadItems();
  }, [user, authLoading]);

  const loadProjects = async () => {
    try {
      const { data } = await supabase.from('projects').select('id, name');
      setProjects(data || []);
      if (data?.[0]) {
        setFormProjectId(data[0].id);
      }
    } catch (error) {
      console.error('Error loading projects:', error);
    }
  };

  const loadItems = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.from('knowledge_dna').select('*');
      if (error) throw error;
      setItems(data || []);
    } catch (error) {
      console.error('Error loading knowledge items:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateItem = async () => {
    if (!formTitle.trim() || !formContent.trim()) return;

    try {
      const { error } = await supabase.from('knowledge_dna').insert({
        project_id: formProjectId,
        category: formCategory,
        title: formTitle,
        content: formContent,
        success_rate: 0,
        usage_count: 0,
        created_by: user?.id,
        is_active: true,
      });

      if (error) throw error;

      setFormTitle('');
      setFormContent('');
      setFormCategory('script');
      setDialogOpen(false);
      loadItems();
    } catch (error) {
      console.error('Error creating knowledge item:', error);
    }
  };

  const toggleActive = async (itemId: string, currentActive: boolean) => {
    try {
      const { error } = await supabase
        .from('knowledge_dna')
        .update({ is_active: !currentActive })
        .eq('id', itemId);

      if (error) throw error;
      loadItems();
    } catch (error) {
      console.error('Error toggling active status:', error);
    }
  };

  const filteredItems = items.filter((item) => {
    if (filterProject !== 'all' && item.project_id !== filterProject) return false;
    if (searchQuery && !item.title.includes(searchQuery) && !item.content.includes(searchQuery)) {
      return false;
    }
    return true;
  });

  const getItemsByCategory = (category: Category) => {
    return filteredItems.filter((item) => item.category === category).sort((a, b) => {
      if (sortBy === 'success_rate') return b.success_rate - a.success_rate;
      return b.usage_count - a.usage_count;
    });
  };

  if (authLoading) {
    return <div className="p-8 text-center">読み込み中...</div>;
  }

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">ナレッジDNA管理</h1>
          <p className="text-gray-600">営業スクリプト・知識ベースの管理</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              新規追加
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>新規ナレッジを追加</DialogTitle>
              <DialogDescription>新しいスクリプトや知識項目を作成します</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">カテゴリ</label>
                <Select value={formCategory} onValueChange={(v) => setFormCategory(v as Category)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.ja}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">プロジェクト</label>
                <Select value={formProjectId} onValueChange={setFormProjectId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((proj) => (
                      <SelectItem key={proj.id} value={proj.id}>
                        {proj.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">タイトル</label>
                <Input
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="タイトルを入力"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">内容</label>
                <textarea
                  value={formContent}
                  onChange={(e) => setFormContent(e.target.value)}
                  placeholder="内容を入力"
                  rows={6}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </div>

              <Button onClick={handleCreateItem} className="w-full">
                作成
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters & Search */}
      <div className="flex gap-4 flex-wrap">
        <div className="flex-1 min-w-64">
          <Input
            placeholder="タイトル・内容で検索"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

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

        <Select value={sortBy} onValueChange={(v) => setSortBy(v as 'success_rate' | 'usage_count')}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="並び順" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="success_rate">成功率で並ぶ</SelectItem>
            <SelectItem value="usage_count">使用回数で並ぶ</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tabs by Category */}
      {loading ? (
        <div className="text-center py-8 text-gray-500">読み込み中...</div>
      ) : (
        <Tabs defaultValue="script" className="space-y-6">
          <TabsList className="grid grid-cols-5 w-full">
            {CATEGORIES.map((cat) => (
              <TabsTrigger key={cat.id} value={cat.id}>
                {cat.ja}
              </TabsTrigger>
            ))}
          </TabsList>

          {CATEGORIES.map((cat) => {
            const categoryItems = getItemsByCategory(cat.id);
            return (
              <TabsContent key={cat.id} value={cat.id} className="space-y-4">
                {categoryItems.length === 0 ? (
                  <Card>
                    <CardContent className="py-8 text-center text-gray-500">
                      この カテゴリにはアイテムがありません
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {categoryItems.map((item) => (
                      <Card key={item.id} className={!item.is_active ? 'opacity-60' : ''}>
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between">
                            <CardTitle className="text-base">{item.title}</CardTitle>
                            <Button
                              size="sm"
                              variant={item.is_active ? 'default' : 'outline'}
                              onClick={() => toggleActive(item.id, item.is_active)}
                            >
                              {item.is_active ? 'アクティブ' : '非アクティブ'}
                            </Button>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <p className="text-sm text-gray-600 line-clamp-3">{item.content}</p>

                          <div className="space-y-2">
                            <div>
                              <div className="flex justify-between mb-1">
                                <span className="text-xs font-medium text-gray-600">
                                  成功率
                                </span>
                                <span className="text-xs font-bold text-gray-900">
                                  {item.success_rate}%
                                </span>
                              </div>
                              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-green-500"
                                  style={{ width: `${item.success_rate}%` }}
                                />
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center justify-between text-xs text-gray-600">
                            <Badge variant="secondary" className="gap-1">
                              <TrendingUp className="w-3 h-3" />
                              使用: {item.usage_count}回
                            </Badge>
                            <span>
                              更新: {new Date(item.updated_at).toLocaleDateString('ja-JP')}
                            </span>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>
            );
          })}
        </Tabs>
      )}
    </div>
  );
}
