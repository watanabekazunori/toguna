'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { FileText, Plus, DollarSign, AlertTriangle, CheckCircle, Download } from 'lucide-react';

interface Invoice {
  id: string;
  client_id: string;
  project_id: string;
  invoice_number: string;
  amount: number;
  tax_amount: number;
  total_amount: number;
  billing_period_start: string;
  billing_period_end: string;
  issued_at: string;
  due_date: string;
  status: 'draft' | 'issued' | 'sent' | 'paid' | 'overdue' | 'cancelled';
  payment_method: string;
  notes: string;
  created_at: string;
  client_name?: string;
  project_name?: string;
}

interface Client {
  id: string;
  name: string;
}

interface Project {
  id: string;
  name: string;
}

interface Stats {
  totalOutstanding: number;
  overdueCount: number;
  thisMonthTotal: number;
}

export default function InvoicesPage() {
  const { user, isLoading: authLoading } = useAuth();
  const supabase = createClient();

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats>({ totalOutstanding: 0, overdueCount: 0, thisMonthTotal: 0 });
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterClient, setFilterClient] = useState<string>('all');
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Form state
  const [formClientId, setFormClientId] = useState('');
  const [formProjectId, setFormProjectId] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formTaxAmount, setFormTaxAmount] = useState('');
  const [formBillingStart, setFormBillingStart] = useState('');
  const [formBillingEnd, setFormBillingEnd] = useState('');
  const [formDueDate, setFormDueDate] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formPaymentMethod, setFormPaymentMethod] = useState('bank_transfer');

  useEffect(() => {
    if (authLoading || !user) return;
    loadClients();
    loadProjects();
    loadInvoices();
  }, [user, authLoading]);

  const loadClients = async () => {
    try {
      const { data } = await supabase.from('clients').select('id, name');
      setClients(data || []);
      if (data?.[0]) {
        setFormClientId(data[0].id);
      }
    } catch (error) {
      console.error('Error loading clients:', error);
    }
  };

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

  const loadInvoices = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.from('invoices').select(`
        *,
        client:clients(name),
        project:projects(name)
      `);

      if (error) throw error;

      const formattedInvoices = data?.map((item: any) => ({
        ...item,
        client_name: item.client?.name || 'Unknown',
        project_name: item.project?.name || 'Unknown',
      })) || [];

      setInvoices(formattedInvoices);
      calculateStats(formattedInvoices);
    } catch (error) {
      console.error('Error loading invoices:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (invoiceList: Invoice[]) => {
    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const outstanding = invoiceList.filter((inv) => ['issued', 'sent', 'overdue'].includes(inv.status));
    const overdue = invoiceList.filter((inv) => inv.status === 'overdue');
    const thisMonth = invoiceList.filter((inv) => {
      const issuedDate = new Date(inv.issued_at);
      return issuedDate >= thisMonthStart;
    });

    const totalOutstanding = outstanding.reduce((sum, inv) => sum + inv.total_amount, 0);
    const thisMonthTotal = thisMonth.reduce((sum, inv) => sum + inv.total_amount, 0);

    setStats({
      totalOutstanding,
      overdueCount: overdue.length,
      thisMonthTotal,
    });
  };

  const handleCreateInvoice = async () => {
    if (
      !formClientId ||
      !formProjectId ||
      !formAmount ||
      !formBillingStart ||
      !formBillingEnd ||
      !formDueDate
    ) {
      return;
    }

    try {
      const amount = parseFloat(formAmount);
      const taxAmount = parseFloat(formTaxAmount) || 0;
      const totalAmount = amount + taxAmount;

      const invoiceNumber = `INV-${Date.now()}`;

      const { error } = await supabase.from('invoices').insert({
        client_id: formClientId,
        project_id: formProjectId,
        invoice_number: invoiceNumber,
        amount,
        tax_amount: taxAmount,
        total_amount: totalAmount,
        billing_period_start: formBillingStart,
        billing_period_end: formBillingEnd,
        issued_at: new Date().toISOString().split('T')[0],
        due_date: formDueDate,
        status: 'draft',
        payment_method: formPaymentMethod,
        notes: formNotes,
      });

      if (error) throw error;

      setFormAmount('');
      setFormTaxAmount('');
      setFormBillingStart('');
      setFormBillingEnd('');
      setFormDueDate('');
      setFormNotes('');
      setFormPaymentMethod('bank_transfer');
      setDialogOpen(false);
      loadInvoices();
    } catch (error) {
      console.error('Error creating invoice:', error);
    }
  };

  const updateInvoiceStatus = async (invoiceId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('invoices')
        .update({ status: newStatus })
        .eq('id', invoiceId);

      if (error) throw error;
      loadInvoices();
    } catch (error) {
      console.error('Error updating invoice:', error);
    }
  };

  const formatCurrency = (amount: number) => {
    return `¥${amount.toLocaleString('ja-JP', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      draft: 'bg-gray-100 text-gray-800',
      issued: 'bg-blue-100 text-blue-800',
      sent: 'bg-purple-100 text-purple-800',
      paid: 'bg-green-100 text-green-800',
      overdue: 'bg-red-100 text-red-800',
      cancelled: 'bg-slate-100 text-slate-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      draft: '下書き',
      issued: '発行済み',
      sent: '送付済み',
      paid: '入金済み',
      overdue: '期限切れ',
      cancelled: 'キャンセル',
    };
    return labels[status] || status;
  };

  const exportInvoicePDF = (invoice: Invoice) => {
    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    printWindow.document.write(`
      <html>
        <head>
          <title>請求書 #${invoice.invoice_number}</title>
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            body {
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              padding: 40px;
              background: white;
              color: #333;
            }
            .container {
              max-width: 900px;
              margin: 0 auto;
            }
            .header {
              text-align: center;
              margin-bottom: 40px;
              border-bottom: 2px solid #007bff;
              padding-bottom: 20px;
            }
            .header h1 {
              font-size: 32px;
              margin-bottom: 10px;
            }
            .invoice-details {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 20px;
              margin-bottom: 30px;
              font-size: 14px;
            }
            .detail-group {
              line-height: 1.8;
            }
            .detail-group strong {
              display: inline-block;
              width: 100px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin: 20px 0;
            }
            th {
              background-color: #f0f0f0;
              border: 1px solid #ddd;
              padding: 12px;
              text-align: left;
              font-weight: 600;
            }
            td {
              border: 1px solid #ddd;
              padding: 12px;
            }
            tr:nth-child(even) {
              background-color: #f9f9f9;
            }
            .amount-column {
              text-align: right;
            }
            .summary {
              display: flex;
              justify-content: flex-end;
              margin-top: 30px;
            }
            .summary-table {
              width: 300px;
            }
            .summary-table td {
              border: none;
              padding: 8px;
            }
            .summary-table .label {
              text-align: right;
              font-weight: 500;
              width: 60%;
            }
            .summary-table .value {
              text-align: right;
              width: 40%;
              font-weight: 600;
            }
            .total-row .value {
              font-size: 18px;
              border-top: 2px solid #007bff;
              padding-top: 10px;
            }
            .footer {
              margin-top: 40px;
              font-size: 12px;
              color: #666;
              border-top: 1px solid #ddd;
              padding-top: 20px;
            }
            @media print {
              body {
                padding: 20px;
              }
              .no-print {
                display: none;
              }
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>請求書</h1>
            </div>

            <div class="invoice-details">
              <div class="detail-group">
                <div><strong>請求書番号:</strong> ${invoice.invoice_number}</div>
                <div><strong>発行日:</strong> ${new Date(invoice.issued_at || invoice.created_at).toLocaleDateString('ja-JP')}</div>
                <div><strong>支払期日:</strong> ${new Date(invoice.due_date).toLocaleDateString('ja-JP')}</div>
              </div>
              <div class="detail-group">
                <div><strong>顧客:</strong> ${invoice.client_name}</div>
                <div><strong>プロジェクト:</strong> ${invoice.project_name}</div>
                <div><strong>ステータス:</strong> ${getStatusLabel(invoice.status)}</div>
              </div>
            </div>

            <table>
              <thead>
                <tr>
                  <th>内容</th>
                  <th class="amount-column">金額</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>サービス提供</td>
                  <td class="amount-column">¥${invoice.amount.toLocaleString('ja-JP', { minimumFractionDigits: 0 })}</td>
                </tr>
              </tbody>
            </table>

            <div class="summary">
              <table class="summary-table">
                <tr>
                  <td class="label">小計:</td>
                  <td class="value">¥${invoice.amount.toLocaleString('ja-JP', { minimumFractionDigits: 0 })}</td>
                </tr>
                <tr>
                  <td class="label">税金:</td>
                  <td class="value">¥${invoice.tax_amount.toLocaleString('ja-JP', { minimumFractionDigits: 0 })}</td>
                </tr>
                <tr class="total-row">
                  <td class="label">合計:</td>
                  <td class="value">¥${invoice.total_amount.toLocaleString('ja-JP', { minimumFractionDigits: 0 })}</td>
                </tr>
              </table>
            </div>

            <div class="footer">
              <p>お支払い方法: ${invoice.payment_method === 'bank_transfer' ? '銀行振込' : invoice.payment_method === 'credit_card' ? 'クレジットカード' : '現金'}</p>
              ${invoice.notes ? `<p>備考: ${invoice.notes}</p>` : ''}
            </div>
          </div>
        </body>
      </html>
    `)
    printWindow.document.close()
    setTimeout(() => {
      printWindow.print()
    }, 100)
  };

  const filteredInvoices = invoices.filter((inv) => {
    if (filterStatus !== 'all' && inv.status !== filterStatus) return false;
    if (filterClient !== 'all' && inv.client_id !== filterClient) return false;
    return true;
  });

  if (authLoading) {
    return <div className="p-8 text-center">読み込み中...</div>;
  }

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">インボイス管理</h1>
          <p className="text-gray-600">請求書の作成・管理</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              新規作成
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>新規請求書を作成</DialogTitle>
              <DialogDescription>顧客への請求書を新規作成します</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 max-h-[calc(100vh-200px)] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">顧客</label>
                  <Select value={formClientId} onValueChange={setFormClientId}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {clients.map((client) => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.name}
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
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">金額</label>
                  <Input
                    type="number"
                    value={formAmount}
                    onChange={(e) => setFormAmount(e.target.value)}
                    placeholder="0"
                    step="0.01"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">税金</label>
                  <Input
                    type="number"
                    value={formTaxAmount}
                    onChange={(e) => setFormTaxAmount(e.target.value)}
                    placeholder="0"
                    step="0.01"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">
                    請求期間開始
                  </label>
                  <Input
                    type="date"
                    value={formBillingStart}
                    onChange={(e) => setFormBillingStart(e.target.value)}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">
                    請求期間終了
                  </label>
                  <Input
                    type="date"
                    value={formBillingEnd}
                    onChange={(e) => setFormBillingEnd(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">支払期日</label>
                  <Input
                    type="date"
                    value={formDueDate}
                    onChange={(e) => setFormDueDate(e.target.value)}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">支払方法</label>
                  <Select value={formPaymentMethod} onValueChange={setFormPaymentMethod}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bank_transfer">銀行振込</SelectItem>
                      <SelectItem value="credit_card">クレジットカード</SelectItem>
                      <SelectItem value="cash">現金</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">備考</label>
                <textarea
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="備考を入力"
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </div>

              <Button onClick={handleCreateInvoice} className="w-full">
                作成
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              未収金
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-orange-600">{formatCurrency(stats.totalOutstanding)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              期限切れ
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-600">{stats.overdueCount}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              今月の売上
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">{formatCurrency(stats.thisMonthTotal)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-4 flex-wrap">
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="ステータスで絞り込み" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">すべて</SelectItem>
            <SelectItem value="draft">下書き</SelectItem>
            <SelectItem value="issued">発行済み</SelectItem>
            <SelectItem value="sent">送付済み</SelectItem>
            <SelectItem value="paid">入金済み</SelectItem>
            <SelectItem value="overdue">期限切れ</SelectItem>
            <SelectItem value="cancelled">キャンセル</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filterClient} onValueChange={setFilterClient}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="顧客で絞り込み" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">すべての顧客</SelectItem>
            {clients.map((client) => (
              <SelectItem key={client.id} value={client.id}>
                {client.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Invoices Table */}
      {loading ? (
        <div className="text-center py-8 text-gray-500">読み込み中...</div>
      ) : filteredInvoices.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-gray-500">
            <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p>請求書がありません</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                      請求書番号
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                      顧客名
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                      金額
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                      支払期日
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                      ステータス
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                      アクション
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInvoices.map((invoice, idx) => (
                    <tr key={invoice.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">
                        {invoice.invoice_number}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">{invoice.client_name}</td>
                      <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                        {formatCurrency(invoice.total_amount)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">
                        {new Date(invoice.due_date).toLocaleDateString('ja-JP')}
                      </td>
                      <td className="px-6 py-4">
                        <Badge className={getStatusColor(invoice.status)}>
                          {getStatusLabel(invoice.status)}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-sm space-y-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => exportInvoicePDF(invoice)}
                          className="w-full gap-2"
                        >
                          <Download className="w-4 h-4" />
                          PDF出力
                        </Button>
                        {invoice.status !== 'paid' && invoice.status !== 'cancelled' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateInvoiceStatus(invoice.id, 'paid')}
                            className="w-full"
                          >
                            入金済みに変更
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
