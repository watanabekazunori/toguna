import { Router, Request, Response } from 'express';
import multer from 'multer';
import csv from 'csv-parser';
import { Readable } from 'stream';
import { supabase } from '../lib/supabase';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// CSVアップロード（企業リスト）
router.post('/companies', upload.single('file'), async (req: Request, res: Response) => {
  if (!req.file) {
    return res.status(400).json({ error: 'ファイルがありません' });
  }

  const results: any[] = [];
  const clientId = req.body.clientId;

  const stream = Readable.from(req.file.buffer.toString());
  
  stream
    .pipe(csv())
    .on('data', (data) => {
      results.push({
        name: data['企業名'] || data['company_name'] || data['name'],
        industry: data['業種'] || data['industry'] || '',
        employees: parseInt(data['従業員数'] || data['employees'] || '0') || null,
        location: data['所在地'] || data['location'] || data['住所'] || '',
        phone: data['電話番号'] || data['phone'] || data['tel'] || '',
        website: data['URL'] || data['website'] || data['ホームページ'] || '',
        status: '未架電',
        rank: 'B',
        client_id: clientId || null,
      });
    })
    .on('end', async () => {
      const { data, error } = await supabase
        .from('companies')
        .insert(results)
        .select();

      if (error) {
        return res.status(500).json({ error: error.message });
      }

      res.json({
        message: `${results.length}件の企業を登録しました`,
        count: results.length,
        data: data,
      });
    })
    .on('error', (error) => {
      res.status(500).json({ error: error.message });
    });
});

// CSVテンプレートダウンロード
router.get('/template', (req: Request, res: Response) => {
  const BOM = '\uFEFF';
  const template = BOM + '企業名,業種,従業員数,所在地,電話番号,URL\n株式会社サンプル,IT,100,東京都渋谷区,03-1234-5678,https://example.com';
  
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename=company_template.csv');
  res.send(template);
});

export default router;