'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Upload, Download, FileSpreadsheet, CheckCircle, AlertCircle } from 'lucide-react';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setResult(null);
      setError(null);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(`${API_BASE_URL}/upload/companies`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        throw new Error('アップロードに失敗しました');
      }

      const data = await res.json();
      setResult(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const downloadTemplate = () => {
    window.open(`${API_BASE_URL}/upload/template`, '_blank');
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">CSVアップロード</h1>

      <div className="grid gap-6">
        {/* テンプレートダウンロード */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              テンプレート
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 mb-4">
              CSVファイルのテンプレートをダウンロードできます。
              このフォーマットに従ってデータを入力してください。
            </p>
            <Button variant="outline" onClick={downloadTemplate}>
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              テンプレートをダウンロード
            </Button>
          </CardContent>
        </Card>

        {/* ファイルアップロード */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              ファイルアップロード
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Label htmlFor="csv-file">CSVファイルを選択</Label>
                <Input
                  id="csv-file"
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  className="mt-2"
                />
              </div>

              {file && (
                <div className="text-sm text-gray-600">
                  選択されたファイル: {file.name}
                </div>
              )}

              <Button
                onClick={handleUpload}
                disabled={!file || uploading}
              >
                {uploading ? 'アップロード中...' : 'アップロード'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* エラー表示 */}
        {error && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-red-600">
                <AlertCircle className="h-5 w-5" />
                <span>{error}</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 結果表示 */}
        {result && (
          <Card className="border-green-200 bg-green-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-600">
                <CheckCircle className="h-5 w-5" />
                アップロード完了
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4">{result.message}</p>

              {result.data && result.data.length > 0 && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>企業名</TableHead>
                      <TableHead>業種</TableHead>
                      <TableHead>所在地</TableHead>
                      <TableHead>電話番号</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.data.slice(0, 10).map((company: any) => (
                      <TableRow key={company.id}>
                        <TableCell>{company.name}</TableCell>
                        <TableCell>{company.industry}</TableCell>
                        <TableCell>{company.location}</TableCell>
                        <TableCell>{company.phone}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}

              {result.data && result.data.length > 10 && (
                <p className="text-sm text-gray-500 mt-2">
                  他 {result.data.length - 10} 件
                </p>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}