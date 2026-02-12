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
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { AlertCircle, CheckCircle, Clock, Phone, Calendar } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface ClientPortalAccess {
  id: string;
  client_id: string;
  access_token: string;
  permissions: Record<string, boolean>;
  is_active: boolean;
  expires_at: string;
}

interface Client {
  id: string;
  name: string;
}

interface Project {
  id: string;
  name: string;
}

interface CallResult {
  id: string;
  client_id: string;
  call_date: string;
  call_type: string;
  result_status: string;
  duration_minutes?: number;
}

interface Appointment {
  id: string;
  client_id: string;
  scheduled_date: string;
  status: string;
  title: string;
}

interface GoldenCall {
  id: string;
  client_id: string;
  call_transcript: string;
  key_insights: string;
  call_date: string;
  is_client_visible: boolean;
}

interface PerformanceData {
  week: string;
  calls: number;
  appointments: number;
}

export default function ClientPortalPage({
  params,
}: {
  params: { token: string };
}) {
  const supabase = createClient();
  const [isValid, setIsValid] = useState<boolean | null>(null);
  const [accessData, setAccessData] = useState<ClientPortalAccess | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [callResults, setCallResults] = useState<CallResult[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [goldenCalls, setGoldenCalls] = useState<GoldenCall[]>([]);
  const [performanceData, setPerformanceData] = useState<PerformanceData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    verifyTokenAndLoadData();
  }, [params.token]);

  const verifyTokenAndLoadData = async () => {
    try {
      setLoading(true);

      // Verify token against portal_tokens table or project portal_access_token field
      let tokenData: any = null;
      let isTokenValid = false;

      // First, try to find in portal_tokens table
      try {
        const { data: portalTokenData, error: portalError } = await supabase
          .from('portal_tokens')
          .select('*')
          .eq('token', params.token)
          .single();

        if (!portalError && portalTokenData) {
          // Validate token from portal_tokens table
          if (portalTokenData.is_active && new Date(portalTokenData.expires_at) >= new Date()) {
            tokenData = {
              client_id: portalTokenData.client_id,
              access_token: portalTokenData.token,
              is_active: portalTokenData.is_active,
              expires_at: portalTokenData.expires_at,
              permissions: portalTokenData.permissions || {},
            };
            isTokenValid = true;
          }
        }
      } catch (e) {
        // portal_tokens table may not exist, fall back to client_portal_access
      }

      // Fallback: try client_portal_access table
      if (!isTokenValid) {
        try {
          const { data: accessData, error: accessError } = await supabase
            .from('client_portal_access')
            .select('*')
            .eq('access_token', params.token)
            .single();

          if (!accessError && accessData) {
            // Check if token is active and not expired
            if (accessData.is_active && new Date(accessData.expires_at) >= new Date()) {
              tokenData = accessData;
              isTokenValid = true;
            }
          }
        } catch (e) {
          // Error querying client_portal_access
        }
      }

      if (!isTokenValid || !tokenData) {
        setIsValid(false);
        return;
      }

      setIsValid(true);
      setAccessData(tokenData);

      // Load client info
      const { data: clientData, error: clientError } = await supabase
        .from('clients')
        .select('*')
        .eq('id', tokenData.client_id)
        .single();

      if (clientError) throw clientError;
      setClient(clientData);

      // Load project info (assuming there's a project associated with client)
      const { data: projectData, error: projectError } = await supabase
        .from('projects')
        .select('*')
        .eq('client_id', tokenData.client_id)
        .limit(1);

      if (projectError) throw projectError;
      if (projectData && projectData.length > 0) {
        setProject(projectData[0]);
      }

      // Load call results
      const { data: callsData, error: callsError } = await supabase
        .from('call_results')
        .select('*')
        .eq('client_id', tokenData.client_id)
        .order('call_date', { ascending: false })
        .limit(20);

      if (callsError) throw callsError;
      setCallResults(callsData || []);

      // Load upcoming appointments
      const { data: appointmentsData, error: appointmentsError } = await supabase
        .from('appointments')
        .select('*')
        .eq('client_id', tokenData.client_id)
        .gte('scheduled_date', new Date().toISOString())
        .eq('status', 'confirmed')
        .order('scheduled_date', { ascending: true });

      if (appointmentsError) throw appointmentsError;
      setAppointments(appointmentsData || []);

      // Load golden calls (only where is_client_visible = true)
      const { data: goldenCallsData, error: goldenCallsError } = await supabase
        .from('golden_calls')
        .select('*')
        .eq('client_id', tokenData.client_id)
        .eq('is_client_visible', true)
        .order('call_date', { ascending: false });

      if (goldenCallsError) throw goldenCallsError;
      setGoldenCalls(goldenCallsData || []);

      // Calculate performance data
      await loadPerformanceData(tokenData.client_id);
    } catch (error) {
      console.error('Error verifying token or loading data:', error);
      setIsValid(false);
    } finally {
      setLoading(false);
    }
  };

  const loadPerformanceData = async (clientId: string) => {
    try {
      // Get last 8 weeks of data
      const eightWeeksAgo = new Date();
      eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 56);

      // Load calls per week
      const { data: callsData, error: callsError } = await supabase
        .from('call_results')
        .select('call_date')
        .eq('client_id', clientId)
        .gte('call_date', eightWeeksAgo.toISOString());

      if (callsError) throw callsError;

      // Load appointments per week
      const { data: appointmentsData, error: appointmentsError } = await supabase
        .from('appointments')
        .select('scheduled_date')
        .eq('client_id', clientId)
        .gte('scheduled_date', eightWeeksAgo.toISOString());

      if (appointmentsError) throw appointmentsError;

      // Aggregate data by week
      const performanceByWeek: Record<string, PerformanceData> = {};

      callsData?.forEach((call) => {
        const date = new Date(call.call_date);
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        const weekKey = weekStart.toISOString().split('T')[0];

        if (!performanceByWeek[weekKey]) {
          performanceByWeek[weekKey] = { week: weekKey, calls: 0, appointments: 0 };
        }
        performanceByWeek[weekKey].calls++;
      });

      appointmentsData?.forEach((appt) => {
        const date = new Date(appt.scheduled_date);
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        const weekKey = weekStart.toISOString().split('T')[0];

        if (!performanceByWeek[weekKey]) {
          performanceByWeek[weekKey] = { week: weekKey, calls: 0, appointments: 0 };
        }
        performanceByWeek[weekKey].appointments++;
      });

      const chartData = Object.values(performanceByWeek).sort(
        (a, b) => new Date(a.week).getTime() - new Date(b.week).getTime()
      );

      setPerformanceData(chartData);
    } catch (error) {
      console.error('Error loading performance data:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-gray-600 text-lg">読み込み中...</p>
        </div>
      </div>
    );
  }

  if (!isValid) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              このアクセストークンは無効です。有効期限が切れているか、削除されている可能性があります。
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  const totalCalls = callResults.length;
  const totalAppointments = appointments.length;
  const appointmentRate =
    totalCalls > 0
      ? ((totalAppointments / totalCalls) * 100).toFixed(1)
      : '0';

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {client?.name || 'クライアント'} ポータル
            </h1>
            {project && (
              <p className="text-gray-600 mt-1">プロジェクト: {project.name}</p>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Overview Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Phone className="h-5 w-5 text-blue-600" />
                総コール数
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-gray-900">{totalCalls}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-green-600" />
                アポイント数
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-gray-900">
                {totalAppointments}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-purple-600" />
                アポ成約率
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-gray-900">
                {appointmentRate}%
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Performance Chart */}
        {performanceData.length > 0 && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>週ごとのパフォーマンス</CardTitle>
              <CardDescription>
                コール数とアポイント数の推移
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={performanceData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="week" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="calls" fill="#3b82f6" name="コール数" />
                  <Bar dataKey="appointments" fill="#10b981" name="アポイント数" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Recent Activity Timeline */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>最近のアクティビティ</CardTitle>
            <CardDescription>最新20件のコール結果</CardDescription>
          </CardHeader>
          <CardContent>
            {callResults.length > 0 ? (
              <div className="space-y-4">
                {callResults.map((call) => (
                  <div
                    key={call.id}
                    className="flex items-start gap-4 pb-4 border-b last:border-b-0"
                  >
                    <div className="flex-shrink-0 mt-1">
                      {call.result_status === 'success' ? (
                        <CheckCircle className="h-5 w-5 text-green-600" />
                      ) : call.result_status === 'pending' ? (
                        <Clock className="h-5 w-5 text-yellow-600" />
                      ) : (
                        <AlertCircle className="h-5 w-5 text-red-600" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{call.call_type}</p>
                      <p className="text-sm text-gray-600">
                        {new Date(call.call_date).toLocaleString('ja-JP')}
                      </p>
                      {call.duration_minutes && (
                        <p className="text-xs text-gray-500 mt-1">
                          通話時間: {call.duration_minutes}分
                        </p>
                      )}
                    </div>
                    <Badge
                      variant={
                        call.result_status === 'success'
                          ? 'default'
                          : 'secondary'
                      }
                    >
                      {call.result_status === 'success'
                        ? '成功'
                        : call.result_status === 'pending'
                          ? '保留中'
                          : '失敗'}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">
                まだコール結果がありません
              </p>
            )}
          </CardContent>
        </Card>

        {/* Upcoming Appointments */}
        {appointments.length > 0 && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>予定されているアポイント</CardTitle>
              <CardDescription>{appointments.length}件のアポイント</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>タイトル</TableHead>
                      <TableHead>予定日時</TableHead>
                      <TableHead>ステータス</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {appointments.map((appointment) => (
                      <TableRow key={appointment.id}>
                        <TableCell className="font-medium">
                          {appointment.title}
                        </TableCell>
                        <TableCell>
                          {new Date(appointment.scheduled_date).toLocaleString(
                            'ja-JP'
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge className="bg-green-500">確定</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Golden Calls Section */}
        {goldenCalls.length > 0 && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>ゴールデンコール</CardTitle>
              <CardDescription>
                注目すべき通話記録と洞察
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {goldenCalls.map((call) => (
                  <div
                    key={call.id}
                    className="border border-blue-200 rounded-lg p-6 bg-blue-50"
                  >
                    <div className="mb-4">
                      <p className="text-sm text-gray-600">
                        {new Date(call.call_date).toLocaleString('ja-JP')}
                      </p>
                      <h3 className="text-lg font-semibold text-gray-900 mt-1">
                        通話の重要な洞察
                      </h3>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <h4 className="font-medium text-gray-900 mb-2">
                          重要なポイント
                        </h4>
                        <p className="text-gray-700 text-sm">
                          {call.key_insights}
                        </p>
                      </div>
                      <div>
                        <h4 className="font-medium text-gray-900 mb-2">
                          通話記録
                        </h4>
                        <p className="text-gray-700 text-sm line-clamp-3">
                          {call.call_transcript}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Footer */}
      <div className="bg-gray-50 border-t border-gray-200 mt-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 text-center text-sm text-gray-600">
          <p>Powered by Toguna</p>
        </div>
      </div>
    </div>
  );
}
