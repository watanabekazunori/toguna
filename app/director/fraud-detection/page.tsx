'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ShieldAlert, Eye, UserX, AlertTriangle } from 'lucide-react';

interface FraudAlert {
  id: string;
  operator_id: string;
  fraud_type: 'ghost_call' | 'fake_appointment' | 'data_manipulation' | 'time_fraud';
  risk_score: number;
  evidence: Record<string, unknown>;
  detected_at: string;
  status: 'pending' | 'investigating' | 'confirmed' | 'dismissed';
  operator_name?: string;
}

interface Stats {
  total: number;
  pending: number;
  confirmed: number;
}

export default function FraudDetectionPage() {
  const { user, isLoading: authLoading } = useAuth();
  const supabase = createClient();

  const [alerts, setAlerts] = useState<FraudAlert[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, pending: 0, confirmed: 0 });
  const [loading, setLoading] = useState(true);
  const [filterFraudType, setFilterFraudType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [expandedAlert, setExpandedAlert] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading || !user) return;
    loadAlerts();
  }, [user, authLoading]);

  const loadAlerts = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('operator_fraud_scores')
        .select(`
          *,
          operator:operators(name)
        `)
        .order('risk_score', { ascending: false });

      const { data, error } = await query;

      if (error) throw error;

      const formattedAlerts = data?.map((item: any) => ({
        ...item,
        operator_name: item.operator?.name || 'Unknown',
      })) || [];

      setAlerts(formattedAlerts);

      // Calculate stats
      setStats({
        total: formattedAlerts.length,
        pending: formattedAlerts.filter((a) => a.status === 'pending').length,
        confirmed: formattedAlerts.filter((a) => a.status === 'confirmed').length,
      });
    } catch (error) {
      console.error('Error loading fraud alerts:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredAlerts = alerts.filter((alert) => {
    if (filterFraudType !== 'all' && alert.fraud_type !== filterFraudType) return false;
    if (filterStatus !== 'all' && alert.status !== filterStatus) return false;
    return true;
  });

  const updateAlertStatus = async (alertId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('operator_fraud_scores')
        .update({ status: newStatus })
        .eq('id', alertId);

      if (error) throw error;
      loadAlerts();
    } catch (error) {
      console.error('Error updating alert:', error);
    }
  };

  const getRiskColor = (score: number) => {
    if (score > 80) return 'bg-red-100 text-red-800';
    if (score > 50) return 'bg-yellow-100 text-yellow-800';
    return 'bg-green-100 text-green-800';
  };

  const getFraudTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      ghost_call: 'ゴーストコール',
      fake_appointment: '偽装アポ',
      data_manipulation: 'データ改ざん',
      time_fraud: '時間詐欺',
    };
    return labels[type] || type;
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      pending: '保留中',
      investigating: '調査中',
      confirmed: '確定',
      dismissed: '却下',
    };
    return labels[status] || status;
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-gray-100 text-gray-800',
      investigating: 'bg-blue-100 text-blue-800',
      confirmed: 'bg-red-100 text-red-800',
      dismissed: 'bg-green-100 text-green-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  if (authLoading) {
    return <div className="p-8 text-center">読み込み中...</div>;
  }

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">オペレーター不正検知</h1>
        <p className="text-gray-600">不正行為の検知・管理</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4" />
              全アラート数
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-gray-900">{stats.total}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              保留中
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-yellow-600">{stats.pending}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
              <UserX className="w-4 h-4" />
              確定
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-red-600">{stats.confirmed}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-4 flex-wrap">
        <Select value={filterFraudType} onValueChange={setFilterFraudType}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="不正タイプで絞り込み" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">すべて</SelectItem>
            <SelectItem value="ghost_call">ゴーストコール</SelectItem>
            <SelectItem value="fake_appointment">偽装アポ</SelectItem>
            <SelectItem value="data_manipulation">データ改ざん</SelectItem>
            <SelectItem value="time_fraud">時間詐欺</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="ステータスで絞り込み" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">すべて</SelectItem>
            <SelectItem value="pending">保留中</SelectItem>
            <SelectItem value="investigating">調査中</SelectItem>
            <SelectItem value="confirmed">確定</SelectItem>
            <SelectItem value="dismissed">却下</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Alerts List */}
      {loading ? (
        <div className="text-center py-8 text-gray-500">読み込み中...</div>
      ) : filteredAlerts.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-gray-500">
            <Eye className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p>アラートはありません</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredAlerts.map((alert) => (
            <Card key={alert.id}>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  {/* Header Row */}
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold text-gray-900">{alert.operator_name}</h3>
                        <Badge className={getRiskColor(alert.risk_score)}>
                          リスク: {alert.risk_score}
                        </Badge>
                        <Badge className="bg-blue-100 text-blue-800">
                          {getFraudTypeLabel(alert.fraud_type)}
                        </Badge>
                        <Badge className={getStatusColor(alert.status)}>
                          {getStatusLabel(alert.status)}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600">
                        検知日時: {new Date(alert.detected_at).toLocaleString('ja-JP')}
                      </p>
                    </div>
                  </div>

                  {/* Evidence Section */}
                  <div>
                    <button
                      onClick={() =>
                        setExpandedAlert(expandedAlert === alert.id ? null : alert.id)
                      }
                      className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                    >
                      {expandedAlert === alert.id ? '▼ 詳細を非表示' : '▶ 詳細を表示'}
                    </button>

                    {expandedAlert === alert.id && (
                      <div className="mt-3 p-3 bg-gray-50 rounded text-sm text-gray-700">
                        <pre className="font-mono text-xs overflow-auto">
                          {JSON.stringify(alert.evidence, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-2 border-t">
                    {alert.status !== 'investigating' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateAlertStatus(alert.id, 'investigating')}
                      >
                        調査開始
                      </Button>
                    )}
                    {alert.status !== 'confirmed' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateAlertStatus(alert.id, 'confirmed')}
                      >
                        確定
                      </Button>
                    )}
                    {alert.status !== 'dismissed' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => updateAlertStatus(alert.id, 'dismissed')}
                      >
                        却下
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
