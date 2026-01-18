/**
 * エクスポート機能ライブラリ
 * Excel (xlsx) と PDF 形式でのデータエクスポートをサポート
 */

// ====== Excel Export (CSV形式 - ブラウザネイティブ) ======

export type ExportColumn<T> = {
  key: keyof T | string
  header: string
  formatter?: (value: unknown, row: T) => string | number
}

/**
 * データをCSV形式でエクスポート
 */
export function exportToCSV<T extends Record<string, unknown>>(
  data: T[],
  columns: ExportColumn<T>[],
  filename: string
): void {
  // BOM付きUTF-8でExcelでも文字化けしない
  const BOM = '\uFEFF'

  // ヘッダー行
  const headers = columns.map((col) => `"${col.header}"`).join(',')

  // データ行
  const rows = data.map((row) => {
    return columns
      .map((col) => {
        const value = col.formatter
          ? col.formatter(getNestedValue(row, col.key as string), row)
          : getNestedValue(row, col.key as string)

        // 文字列はダブルクォートでエスケープ
        if (typeof value === 'string') {
          return `"${value.replace(/"/g, '""')}"`
        }
        return value ?? ''
      })
      .join(',')
  })

  const csvContent = BOM + headers + '\n' + rows.join('\n')

  // ダウンロード
  downloadFile(csvContent, `${filename}.csv`, 'text/csv;charset=utf-8')
}

/**
 * ネストされたオブジェクトの値を取得
 */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce((acc: unknown, key: string) => {
    if (acc && typeof acc === 'object' && key in acc) {
      return (acc as Record<string, unknown>)[key]
    }
    return undefined
  }, obj)
}

/**
 * ファイルをダウンロード
 */
function downloadFile(content: string | Blob, filename: string, mimeType: string): void {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)

  URL.revokeObjectURL(url)
}

// ====== レポート用エクスポート関数 ======

export type CallLogExport = {
  date: string
  companyName: string
  operatorName: string
  result: string
  duration: number
  notes: string
}

export type DailyReportExport = {
  date: string
  totalCalls: number
  connections: number
  appointments: number
  connectionRate: number
  appointmentRate: number
}

export type OperatorReportExport = {
  operatorName: string
  totalCalls: number
  connections: number
  appointments: number
  connectionRate: number
  appointmentRate: number
  averageDuration: number
}

/**
 * 架電ログをCSVエクスポート
 */
export function exportCallLogs(data: CallLogExport[], filename = '架電履歴'): void {
  const columns: ExportColumn<CallLogExport>[] = [
    { key: 'date', header: '日時' },
    { key: 'companyName', header: '企業名' },
    { key: 'operatorName', header: 'オペレーター' },
    { key: 'result', header: '結果' },
    {
      key: 'duration',
      header: '通話時間(秒)',
      formatter: (v) => (typeof v === 'number' ? v : 0),
    },
    { key: 'notes', header: 'メモ' },
  ]

  exportToCSV(data, columns, filename)
}

/**
 * 日別レポートをCSVエクスポート
 */
export function exportDailyReport(data: DailyReportExport[], filename = '日別レポート'): void {
  const columns: ExportColumn<DailyReportExport>[] = [
    { key: 'date', header: '日付' },
    { key: 'totalCalls', header: '架電数' },
    { key: 'connections', header: '接続数' },
    { key: 'appointments', header: 'アポ獲得数' },
    {
      key: 'connectionRate',
      header: '接続率(%)',
      formatter: (v) => (typeof v === 'number' ? `${v.toFixed(1)}%` : '0%'),
    },
    {
      key: 'appointmentRate',
      header: 'アポ率(%)',
      formatter: (v) => (typeof v === 'number' ? `${v.toFixed(2)}%` : '0%'),
    },
  ]

  exportToCSV(data, columns, filename)
}

/**
 * オペレーター別レポートをCSVエクスポート
 */
export function exportOperatorReport(
  data: OperatorReportExport[],
  filename = 'オペレーター別レポート'
): void {
  const columns: ExportColumn<OperatorReportExport>[] = [
    { key: 'operatorName', header: 'オペレーター名' },
    { key: 'totalCalls', header: '架電数' },
    { key: 'connections', header: '接続数' },
    { key: 'appointments', header: 'アポ獲得数' },
    {
      key: 'connectionRate',
      header: '接続率(%)',
      formatter: (v) => (typeof v === 'number' ? `${v.toFixed(1)}%` : '0%'),
    },
    {
      key: 'appointmentRate',
      header: 'アポ率(%)',
      formatter: (v) => (typeof v === 'number' ? `${v.toFixed(2)}%` : '0%'),
    },
    {
      key: 'averageDuration',
      header: '平均通話時間(秒)',
      formatter: (v) => (typeof v === 'number' ? Math.round(v) : 0),
    },
  ]

  exportToCSV(data, columns, filename)
}

/**
 * 企業リストをCSVエクスポート
 */
export type CompanyExport = {
  name: string
  phone: string
  industry: string
  employees: number
  location: string
  rank: string
  status: string
}

export function exportCompanyList(data: CompanyExport[], filename = '企業リスト'): void {
  const columns: ExportColumn<CompanyExport>[] = [
    { key: 'name', header: '企業名' },
    { key: 'phone', header: '電話番号' },
    { key: 'industry', header: '業界' },
    { key: 'employees', header: '従業員数' },
    { key: 'location', header: '所在地' },
    { key: 'rank', header: 'AIランク' },
    { key: 'status', header: 'ステータス' },
  ]

  exportToCSV(data, columns, filename)
}

// ====== PDF Export (HTML to Print) ======

export type PDFReportData = {
  title: string
  subtitle?: string
  generatedAt: string
  summary: {
    label: string
    value: string | number
  }[]
  tableData?: {
    headers: string[]
    rows: (string | number)[][]
  }
}

/**
 * PDFレポートを生成（印刷ダイアログ経由）
 */
export function exportToPDF(data: PDFReportData): void {
  const printWindow = window.open('', '_blank')
  if (!printWindow) {
    alert('ポップアップがブロックされました。許可してください。')
    return
  }

  const html = `
    <!DOCTYPE html>
    <html lang="ja">
    <head>
      <meta charset="UTF-8">
      <title>${data.title}</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body {
          font-family: "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Yu Gothic", sans-serif;
          padding: 40px;
          color: #1e293b;
          line-height: 1.6;
        }
        .header {
          text-align: center;
          margin-bottom: 40px;
          padding-bottom: 20px;
          border-bottom: 2px solid #3b82f6;
        }
        .header h1 {
          font-size: 24px;
          color: #1e40af;
          margin-bottom: 8px;
        }
        .header .subtitle {
          font-size: 14px;
          color: #64748b;
        }
        .header .generated-at {
          font-size: 12px;
          color: #94a3b8;
          margin-top: 8px;
        }
        .summary {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 20px;
          margin-bottom: 40px;
        }
        .summary-item {
          background: #f8fafc;
          padding: 20px;
          border-radius: 8px;
          text-align: center;
        }
        .summary-item .label {
          font-size: 12px;
          color: #64748b;
          margin-bottom: 8px;
        }
        .summary-item .value {
          font-size: 28px;
          font-weight: bold;
          color: #1e293b;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 20px;
        }
        th, td {
          padding: 12px;
          text-align: left;
          border-bottom: 1px solid #e2e8f0;
        }
        th {
          background: #f1f5f9;
          font-weight: 600;
          font-size: 12px;
          color: #475569;
        }
        td {
          font-size: 14px;
        }
        tr:nth-child(even) {
          background: #f8fafc;
        }
        .footer {
          margin-top: 40px;
          padding-top: 20px;
          border-top: 1px solid #e2e8f0;
          text-align: center;
          font-size: 12px;
          color: #94a3b8;
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
      <div class="header">
        <h1>${data.title}</h1>
        ${data.subtitle ? `<p class="subtitle">${data.subtitle}</p>` : ''}
        <p class="generated-at">生成日時: ${data.generatedAt}</p>
      </div>

      <div class="summary">
        ${data.summary
          .map(
            (item) => `
          <div class="summary-item">
            <div class="label">${item.label}</div>
            <div class="value">${item.value}</div>
          </div>
        `
          )
          .join('')}
      </div>

      ${
        data.tableData
          ? `
        <table>
          <thead>
            <tr>
              ${data.tableData.headers.map((h) => `<th>${h}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${data.tableData.rows
              .map(
                (row) => `
              <tr>
                ${row.map((cell) => `<td>${cell}</td>`).join('')}
              </tr>
            `
              )
              .join('')}
          </tbody>
        </table>
      `
          : ''
      }

      <div class="footer">
        TOGUNA - AI搭載テレマーケティング支援プラットフォーム
      </div>

      <script>
        window.onload = function() {
          window.print();
        }
      </script>
    </body>
    </html>
  `

  printWindow.document.write(html)
  printWindow.document.close()
}

/**
 * 日付をフォーマット
 */
export function formatDateForExport(date: Date): string {
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`
}

/**
 * 日時をフォーマット
 */
export function formatDateTimeForExport(date: Date): string {
  return `${date.getFullYear()}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getDate().toString().padStart(2, '0')} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
}
