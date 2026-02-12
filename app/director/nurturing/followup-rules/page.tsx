'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Trash2, Edit2, Plus } from 'lucide-react';

interface FollowupRule {
  id: string;
  project_id: string;
  name: string;
  trigger_type:
    | 'no_response_after_send'
    | 'document_opened'
    | 'appointment_no_show'
    | 'call_rejection'
    | 'engagement_score_threshold';
  trigger_conditions: Record<string, any>;
  action_type: 'send_email' | 'send_line' | 'create_task' | 'alert_manager' | 'schedule_call';
  action_config: Record<string, any>;
  delay_minutes: number;
  max_executions: number;
  is_active: boolean;
  created_at: string;
}

interface FollowupExecution {
  id: string;
  rule_id: string;
  company_id: string;
  executed_at: string;
  result: Record<string, any>;
}

interface Project {
  id: string;
  name: string;
}

const TRIGGER_TYPES = [
  { value: 'no_response_after_send', label: '送信後無応答' },
  { value: 'document_opened', label: 'ドキュメント開封' },
  { value: 'appointment_no_show', label: 'アポ未出席' },
  { value: 'call_rejection', label: '通話拒否' },
  { value: 'engagement_score_threshold', label: 'エンゲージメントスコア閾値' },
];

const ACTION_TYPES = [
  { value: 'send_email', label: 'メール送信' },
  { value: 'send_line', label: 'LINE送信' },
  { value: 'create_task', label: 'タスク作成' },
  { value: 'alert_manager', label: 'マネージャーへ通知' },
  { value: 'schedule_call', label: 'コール予約' },
];

export default function FollowupRulesPage() {
  const supabase = createClient();
  const [rules, setRules] = useState<FollowupRule[]>([]);
  const [executions, setExecutions] = useState<FollowupExecution[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingRule, setEditingRule] = useState<FollowupRule | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState<{
    name: string
    trigger_type: string
    trigger_conditions: Record<string, any>
    action_type: string
    action_config: Record<string, any>
    delay_minutes: number
    max_executions: number
  }>({
    name: '',
    trigger_type: 'no_response_after_send',
    trigger_conditions: { days_after: 3 },
    action_type: 'send_email',
    action_config: { template_id: '' },
    delay_minutes: 0,
    max_executions: 1,
  });

  useEffect(() => {
    loadProjects();
  }, []);

  useEffect(() => {
    if (selectedProject) {
      loadRulesData();
    }
  }, [selectedProject]);

  const loadProjects = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('projects')
        .select('id, name')
        .order('name');

      if (error) throw error;

      setProjects(data || []);
      if (data && data.length > 0) {
        setSelectedProject(data[0].id);
      }
    } catch (error) {
      console.error('Error loading projects:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadRulesData = async () => {
    try {
      setLoading(true);

      // Load rules
      const { data: rulesData, error: rulesError } = await supabase
        .from('followup_rules')
        .select('*')
        .eq('project_id', selectedProject)
        .order('created_at', { ascending: false });

      if (rulesError) throw rulesError;
      setRules(rulesData || []);

      // Load executions for all rules in project
      const ruleIds = (rulesData || []).map((r) => r.id);
      if (ruleIds.length > 0) {
        const { data: executionsData, error: executionsError } = await supabase
          .from('followup_executions')
          .select('*')
          .in('rule_id', ruleIds)
          .order('executed_at', { ascending: false })
          .limit(50);

        if (executionsError) throw executionsError;
        setExecutions(executionsData || []);
      }
    } catch (error) {
      console.error('Error loading rules data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveRule = async () => {
    try {
      const ruleData = {
        project_id: selectedProject,
        name: formData.name,
        trigger_type: formData.trigger_type,
        trigger_conditions: formData.trigger_conditions,
        action_type: formData.action_type,
        action_config: formData.action_config,
        delay_minutes: parseInt(formData.delay_minutes.toString()),
        max_executions: parseInt(formData.max_executions.toString()),
        is_active: true,
      };

      if (editingRule) {
        const { error } = await supabase
          .from('followup_rules')
          .update(ruleData)
          .eq('id', editingRule.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('followup_rules')
          .insert(ruleData);

        if (error) throw error;
      }

      await loadRulesData();
      setOpenDialog(false);
      setEditingRule(null);
      resetForm();
    } catch (error) {
      console.error('Error saving rule:', error);
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    try {
      const { error } = await supabase
        .from('followup_rules')
        .delete()
        .eq('id', ruleId);

      if (error) throw error;

      await loadRulesData();
      setDeleteTarget(null);
    } catch (error) {
      console.error('Error deleting rule:', error);
    }
  };

  const handleToggleActive = async (rule: FollowupRule) => {
    try {
      const { error } = await supabase
        .from('followup_rules')
        .update({ is_active: !rule.is_active })
        .eq('id', rule.id);

      if (error) throw error;

      await loadRulesData();
    } catch (error) {
      console.error('Error toggling rule status:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      trigger_type: 'no_response_after_send',
      trigger_conditions: { days_after: 3 },
      action_type: 'send_email',
      action_config: { template_id: '' },
      delay_minutes: 0,
      max_executions: 1,
    });
  };

  const openEditDialog = (rule: FollowupRule) => {
    setEditingRule(rule);
    setFormData({
      name: rule.name,
      trigger_type: rule.trigger_type,
      trigger_conditions: rule.trigger_conditions,
      action_type: rule.action_type,
      action_config: rule.action_config,
      delay_minutes: rule.delay_minutes,
      max_executions: rule.max_executions,
    });
    setOpenDialog(true);
  };

  const getTriggerLabel = (triggerType: string) => {
    return TRIGGER_TYPES.find((t) => t.value === triggerType)?.label || triggerType;
  };

  const getActionLabel = (actionType: string) => {
    return ACTION_TYPES.find((a) => a.value === actionType)?.label || actionType;
  };

  const formatDelay = (minutes: number) => {
    if (minutes < 60) return `${minutes}分`;
    if (minutes < 1440) return `${Math.floor(minutes / 60)}時間`;
    return `${Math.floor(minutes / 1440)}日`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p>読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            自動フォローアップルール
          </h1>
          <p className="text-gray-600">トリガーに基づいて自動フォローアップを設定</p>
        </div>

        {/* Project Selector */}
        <div className="mb-8">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            プロジェクト
          </label>
          <Select value={selectedProject} onValueChange={setSelectedProject}>
            <SelectTrigger className="w-80">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {projects.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  {project.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Create Rule Button */}
        <div className="mb-8">
          <Dialog open={openDialog} onOpenChange={setOpenDialog}>
            <DialogTrigger asChild>
              <Button
                onClick={() => {
                  resetForm();
                  setEditingRule(null);
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                新規ルール作成
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>
                  {editingRule ? 'ルール編集' : '新規ルール作成'}
                </DialogTitle>
                <DialogDescription>
                  フォローアップルールを設定してください
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                {/* Rule Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    ルール名
                  </label>
                  <Input
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    placeholder="ルール名を入力"
                  />
                </div>

                {/* Trigger Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    トリガータイプ
                  </label>
                  <Select
                    value={formData.trigger_type}
                    onValueChange={(value: any) =>
                      setFormData({ ...formData, trigger_type: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TRIGGER_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Trigger Conditions */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    トリガー条件
                  </label>
                  {formData.trigger_type === 'no_response_after_send' && (
                    <div>
                      <label className="text-xs text-gray-600">日数</label>
                      <Input
                        type="number"
                        value={
                          formData.trigger_conditions.days_after || 3
                        }
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            trigger_conditions: {
                              ...formData.trigger_conditions,
                              days_after: parseInt(e.target.value),
                            },
                          })
                        }
                      />
                    </div>
                  )}
                  {formData.trigger_type === 'engagement_score_threshold' && (
                    <div>
                      <label className="text-xs text-gray-600">最小スコア</label>
                      <Input
                        type="number"
                        value={
                          formData.trigger_conditions.min_score || 60
                        }
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            trigger_conditions: {
                              ...formData.trigger_conditions,
                              min_score: parseInt(e.target.value),
                            },
                          })
                        }
                      />
                    </div>
                  )}
                </div>

                {/* Action Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    アクションタイプ
                  </label>
                  <Select
                    value={formData.action_type}
                    onValueChange={(value: any) =>
                      setFormData({ ...formData, action_type: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ACTION_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Action Config */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    アクション設定
                  </label>
                  {['send_email', 'send_line'].includes(formData.action_type) && (
                    <div>
                      <label className="text-xs text-gray-600">テンプレートID</label>
                      <Input
                        value={formData.action_config.template_id || ''}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            action_config: {
                              ...formData.action_config,
                              template_id: e.target.value,
                            },
                          })
                        }
                        placeholder="template_id"
                      />
                    </div>
                  )}
                  {formData.action_type === 'create_task' && (
                    <div>
                      <label className="text-xs text-gray-600">メッセージ</label>
                      <Input
                        value={formData.action_config.message || ''}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            action_config: {
                              ...formData.action_config,
                              message: e.target.value,
                            },
                          })
                        }
                        placeholder="タスクメッセージ"
                      />
                    </div>
                  )}
                </div>

                {/* Delay */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    遅延 (分)
                  </label>
                  <Input
                    type="number"
                    value={formData.delay_minutes}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        delay_minutes: parseInt(e.target.value),
                      })
                    }
                    placeholder="0"
                  />
                </div>

                {/* Max Executions */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    会社ごとの最大実行回数
                  </label>
                  <Input
                    type="number"
                    value={formData.max_executions}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        max_executions: parseInt(e.target.value),
                      })
                    }
                    placeholder="1"
                  />
                </div>

                <Button onClick={handleSaveRule} className="w-full">
                  {editingRule ? 'ルール更新' : 'ルール作成'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Rules Table */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>フォローアップルール一覧</CardTitle>
            <CardDescription>
              合計 {rules.length} 件のルール
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ルール名</TableHead>
                    <TableHead>トリガー</TableHead>
                    <TableHead>アクション</TableHead>
                    <TableHead>遅延</TableHead>
                    <TableHead>最大実行回数</TableHead>
                    <TableHead>ステータス</TableHead>
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rules.map((rule) => (
                    <TableRow key={rule.id}>
                      <TableCell className="font-medium">{rule.name}</TableCell>
                      <TableCell className="text-sm">
                        {getTriggerLabel(rule.trigger_type)}
                      </TableCell>
                      <TableCell className="text-sm">
                        {getActionLabel(rule.action_type)}
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatDelay(rule.delay_minutes)}
                      </TableCell>
                      <TableCell className="text-sm">
                        {rule.max_executions}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={rule.is_active}
                            onCheckedChange={() => handleToggleActive(rule)}
                          />
                          <Badge
                            variant={rule.is_active ? 'default' : 'secondary'}
                          >
                            {rule.is_active ? '有効' : '無効'}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openEditDialog(rule)}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => setDeleteTarget(rule.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Execution Log */}
        {executions.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>実行ログ</CardTitle>
              <CardDescription>
                最近のルール実行履歴（最新50件）
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ルール</TableHead>
                      <TableHead>会社ID</TableHead>
                      <TableHead>実行日時</TableHead>
                      <TableHead>結果</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {executions.map((execution) => {
                      const rule = rules.find((r) => r.id === execution.rule_id);
                      return (
                        <TableRow key={execution.id}>
                          <TableCell className="text-sm font-medium">
                            {rule?.name || 'Unknown'}
                          </TableCell>
                          <TableCell className="text-sm">
                            {execution.company_id}
                          </TableCell>
                          <TableCell className="text-sm">
                            {new Date(execution.executed_at).toLocaleString(
                              'ja-JP'
                            )}
                          </TableCell>
                          <TableCell className="text-sm">
                            {execution.result?.status === 'success' ? (
                              <Badge className="bg-green-500">成功</Badge>
                            ) : (
                              <Badge className="bg-red-500">失敗</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
          <AlertDialogContent>
            <AlertDialogTitle>ルールを削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              この操作は取り消すことができません。ルールを削除してもよろしいですか？
            </AlertDialogDescription>
            <div className="flex gap-2 justify-end">
              <AlertDialogCancel>キャンセル</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteTarget && handleDeleteRule(deleteTarget)}
                className="bg-red-600 hover:bg-red-700"
              >
                削除
              </AlertDialogAction>
            </div>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
