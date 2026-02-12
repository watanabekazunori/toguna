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
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Mail, MessageSquare, Send } from 'lucide-react';
import { useForm } from 'react-hook-form';

interface ChannelConfig {
  id: string;
  channel_type: 'email' | 'line' | 'sms';
  config_data: Record<string, any>;
  is_active: boolean;
  created_at: string;
}

interface DocumentSend {
  id: string;
  channel: string;
  recipient: string;
  status: string;
  sent_at: string;
  delivered_at?: string;
  opened_at?: string;
}

interface ChannelMetrics {
  total_sends: number;
  delivery_rate: number;
  open_rate: number;
}

export default function ChannelsPage() {
  const supabase = createClient();
  const [channels, setChannels] = useState<ChannelConfig[]>([]);
  const [sends, setSends] = useState<DocumentSend[]>([]);
  const [metrics, setMetrics] = useState<Record<string, ChannelMetrics>>({});
  const [loading, setLoading] = useState(true);
  const [testMessageLoading, setTestMessageLoading] = useState<string | null>(
    null
  );

  const emailForm = useForm({
    defaultValues: {
      smtp_server: '',
      smtp_port: '',
      smtp_username: '',
      smtp_password: '',
    },
  });

  const lineForm = useForm({
    defaultValues: {
      line_channel_access_token: '',
      line_webhook_url: '',
    },
  });

  const smsForm = useForm({
    defaultValues: {
      twilio_account_sid: '',
      twilio_auth_token: '',
      twilio_from_number: '',
    },
  });

  useEffect(() => {
    loadChannelData();
  }, []);

  const loadChannelData = async () => {
    try {
      setLoading(true);

      // Load channel configs
      const { data: channelData, error: channelError } = await supabase
        .from('channel_configs')
        .select('*');

      if (channelError) throw channelError;
      setChannels(channelData || []);

      // Load document sends
      const { data: sendsData, error: sendsError } = await supabase
        .from('document_sends')
        .select(
          'id, channel, recipient, status, sent_at, delivered_at, opened_at'
        )
        .order('sent_at', { ascending: false })
        .limit(100);

      if (sendsError) throw sendsError;
      setSends(sendsData || []);

      // Calculate metrics per channel
      const metricsData: Record<string, ChannelMetrics> = {};
      const channels_list = ['email', 'line', 'sms'];

      channels_list.forEach((channel) => {
        const channelSends = sendsData?.filter((s) => s.channel === channel) || [];
        const totalSends = channelSends.length;
        const deliveredSends = channelSends.filter(
          (s) => s.status === 'delivered' || s.delivered_at
        ).length;
        const openedSends = channelSends.filter((s) => s.opened_at).length;

        metricsData[channel] = {
          total_sends: totalSends,
          delivery_rate: totalSends > 0 ? (deliveredSends / totalSends) * 100 : 0,
          open_rate: totalSends > 0 ? (openedSends / totalSends) * 100 : 0,
        };
      });

      setMetrics(metricsData);
    } catch (error) {
      console.error('Error loading channel data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveEmailConfig = async (data: any) => {
    try {
      const existingEmailChannel = channels.find(
        (c) => c.channel_type === 'email'
      );

      if (existingEmailChannel) {
        const { error } = await supabase
          .from('channel_configs')
          .update({
            config_data: {
              smtp_server: data.smtp_server,
              smtp_port: parseInt(data.smtp_port),
              smtp_username: data.smtp_username,
              smtp_password: data.smtp_password,
            },
            is_active: true,
          })
          .eq('id', existingEmailChannel.id);

        if (error) throw error;
      } else {
        const { error } = await supabase.from('channel_configs').insert({
          channel_type: 'email',
          config_data: {
            smtp_server: data.smtp_server,
            smtp_port: parseInt(data.smtp_port),
            smtp_username: data.smtp_username,
            smtp_password: data.smtp_password,
          },
          is_active: true,
        });

        if (error) throw error;
      }

      await loadChannelData();
      emailForm.reset();
    } catch (error) {
      console.error('Error saving email config:', error);
    }
  };

  const handleSaveLineConfig = async (data: any) => {
    try {
      const existingLineChannel = channels.find((c) => c.channel_type === 'line');

      if (existingLineChannel) {
        const { error } = await supabase
          .from('channel_configs')
          .update({
            config_data: {
              line_channel_access_token: data.line_channel_access_token,
              line_webhook_url: data.line_webhook_url,
            },
            is_active: true,
          })
          .eq('id', existingLineChannel.id);

        if (error) throw error;
      } else {
        const { error } = await supabase.from('channel_configs').insert({
          channel_type: 'line',
          config_data: {
            line_channel_access_token: data.line_channel_access_token,
            line_webhook_url: data.line_webhook_url,
          },
          is_active: true,
        });

        if (error) throw error;
      }

      await loadChannelData();
      lineForm.reset();
    } catch (error) {
      console.error('Error saving LINE config:', error);
    }
  };

  const handleSaveSmsConfig = async (data: any) => {
    try {
      const existingSmsChannel = channels.find((c) => c.channel_type === 'sms');

      if (existingSmsChannel) {
        const { error } = await supabase
          .from('channel_configs')
          .update({
            config_data: {
              twilio_account_sid: data.twilio_account_sid,
              twilio_auth_token: data.twilio_auth_token,
              twilio_from_number: data.twilio_from_number,
            },
            is_active: true,
          })
          .eq('id', existingSmsChannel.id);

        if (error) throw error;
      } else {
        const { error } = await supabase.from('channel_configs').insert({
          channel_type: 'sms',
          config_data: {
            twilio_account_sid: data.twilio_account_sid,
            twilio_auth_token: data.twilio_auth_token,
            twilio_from_number: data.twilio_from_number,
          },
          is_active: true,
        });

        if (error) throw error;
      }

      await loadChannelData();
      smsForm.reset();
    } catch (error) {
      console.error('Error saving SMS config:', error);
    }
  };

  const handleSendTestMessage = async (channelType: string) => {
    try {
      setTestMessageLoading(channelType);
      // In a real implementation, this would call your API endpoint
      // to send a test message through the specified channel
      console.log(`Sending test message via ${channelType}`);
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (error) {
      console.error('Error sending test message:', error);
    } finally {
      setTestMessageLoading(null);
    }
  };

  const getChannelStatus = (channelType: string) => {
    const channel = channels.find((c) => c.channel_type === channelType);
    return channel && channel.is_active ? 'active' : 'inactive';
  };

  const getStatusBadge = (status: string) => {
    if (status === 'active') {
      return <Badge className="bg-green-500">有効</Badge>;
    } else if (status === 'inactive') {
      return <Badge className="bg-gray-500">無効</Badge>;
    }
    return <Badge className="bg-yellow-500">セットアップ中</Badge>;
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
            マルチチャネル統合
          </h1>
          <p className="text-gray-600">複数チャネル経由でのコミュニケーション管理</p>
        </div>

        {/* Channel Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Email Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Mail className="h-5 w-5" />
                  <CardTitle>メール</CardTitle>
                </div>
                {getStatusBadge(getChannelStatus('email'))}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-gray-600">合計配信</p>
                  <p className="text-2xl font-bold">
                    {metrics['email']?.total_sends || 0}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">配信率</p>
                  <p className="text-lg font-semibold">
                    {metrics['email']?.delivery_rate.toFixed(1)}%
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">開封率</p>
                  <p className="text-lg font-semibold">
                    {metrics['email']?.open_rate.toFixed(1)}%
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* LINE Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  <CardTitle>LINE</CardTitle>
                </div>
                {getStatusBadge(getChannelStatus('line'))}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-gray-600">合計配信</p>
                  <p className="text-2xl font-bold">
                    {metrics['line']?.total_sends || 0}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">配信率</p>
                  <p className="text-lg font-semibold">
                    {metrics['line']?.delivery_rate.toFixed(1)}%
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">開封率</p>
                  <p className="text-lg font-semibold">
                    {metrics['line']?.open_rate.toFixed(1)}%
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* SMS Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Send className="h-5 w-5" />
                  <CardTitle>SMS</CardTitle>
                </div>
                {getStatusBadge(getChannelStatus('sms'))}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-gray-600">合計配信</p>
                  <p className="text-2xl font-bold">
                    {metrics['sms']?.total_sends || 0}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">配信率</p>
                  <p className="text-lg font-semibold">
                    {metrics['sms']?.delivery_rate.toFixed(1)}%
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">開封率</p>
                  <p className="text-lg font-semibold">
                    {metrics['sms']?.open_rate.toFixed(1)}%
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Channel Configuration Section */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>チャネル設定</CardTitle>
            <CardDescription>各チャネルの認証情報を設定してください</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="email" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="email">メール</TabsTrigger>
                <TabsTrigger value="line">LINE</TabsTrigger>
                <TabsTrigger value="sms">SMS</TabsTrigger>
              </TabsList>

              {/* Email Tab */}
              <TabsContent value="email" className="space-y-4">
                <form onSubmit={emailForm.handleSubmit(handleSaveEmailConfig)}>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        SMTPサーバー
                      </label>
                      <Input
                        placeholder="smtp.example.com"
                        {...emailForm.register('smtp_server')}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        ポート
                      </label>
                      <Input
                        type="number"
                        placeholder="587"
                        {...emailForm.register('smtp_port')}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        ユーザー名
                      </label>
                      <Input
                        placeholder="your-email@example.com"
                        {...emailForm.register('smtp_username')}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        パスワード
                      </label>
                      <Input
                        type="password"
                        placeholder="••••••••"
                        {...emailForm.register('smtp_password')}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button type="submit">設定を保存</Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => handleSendTestMessage('email')}
                        disabled={testMessageLoading === 'email'}
                      >
                        {testMessageLoading === 'email'
                          ? '送信中...'
                          : 'テストメール送信'}
                      </Button>
                    </div>
                  </div>
                </form>
              </TabsContent>

              {/* LINE Tab */}
              <TabsContent value="line" className="space-y-4">
                <form onSubmit={lineForm.handleSubmit(handleSaveLineConfig)}>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        LINE チャネルアクセストークン
                      </label>
                      <Input
                        placeholder="Channel Access Token"
                        type="password"
                        {...lineForm.register('line_channel_access_token')}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Webhook URL
                      </label>
                      <Input
                        placeholder="https://your-domain.com/api/line/webhook"
                        {...lineForm.register('line_webhook_url')}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button type="submit">設定を保存</Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => handleSendTestMessage('line')}
                        disabled={testMessageLoading === 'line'}
                      >
                        {testMessageLoading === 'line'
                          ? '送信中...'
                          : 'テストメッセージ送信'}
                      </Button>
                    </div>
                  </div>
                </form>
              </TabsContent>

              {/* SMS Tab */}
              <TabsContent value="sms" className="space-y-4">
                <form onSubmit={smsForm.handleSubmit(handleSaveSmsConfig)}>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Twilio Account SID
                      </label>
                      <Input
                        placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                        type="password"
                        {...smsForm.register('twilio_account_sid')}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Twilio Auth Token
                      </label>
                      <Input
                        placeholder="••••••••"
                        type="password"
                        {...smsForm.register('twilio_auth_token')}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        From Number
                      </label>
                      <Input
                        placeholder="+1234567890"
                        {...smsForm.register('twilio_from_number')}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button type="submit">設定を保存</Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => handleSendTestMessage('sms')}
                        disabled={testMessageLoading === 'sms'}
                      >
                        {testMessageLoading === 'sms'
                          ? '送信中...'
                          : 'テストメール送信'}
                      </Button>
                    </div>
                  </div>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Recent Sends Section */}
        <Card>
          <CardHeader>
            <CardTitle>最近の配信</CardTitle>
            <CardDescription>チャネルごとの最近の配信履歴</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>チャネル</TableHead>
                  <TableHead>受信者</TableHead>
                  <TableHead>ステータス</TableHead>
                  <TableHead>送信日時</TableHead>
                  <TableHead>配信日時</TableHead>
                  <TableHead>開封日時</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sends.slice(0, 10).map((send) => (
                  <TableRow key={send.id}>
                    <TableCell>
                      <Badge variant="outline">{send.channel}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">{send.recipient}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          send.status === 'delivered' ? 'default' : 'secondary'
                        }
                      >
                        {send.status === 'delivered' ? '配信済' : send.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {new Date(send.sent_at).toLocaleString('ja-JP')}
                    </TableCell>
                    <TableCell className="text-sm">
                      {send.delivered_at
                        ? new Date(send.delivered_at).toLocaleString('ja-JP')
                        : '-'}
                    </TableCell>
                    <TableCell className="text-sm">
                      {send.opened_at
                        ? new Date(send.opened_at).toLocaleString('ja-JP')
                        : '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
