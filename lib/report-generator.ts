export function generateSubsidyReportHTML(report: {
  client_name: string
  report_type: string
  period_start: string
  period_end: string
  metrics: Record<string, any>
  productivity_data: Record<string, any>
  wage_data: Record<string, any>
}): string {
  const generatedDate = new Date().toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })

  const metricsEntries = Object.entries(report.metrics)
  const productivityEntries = Object.entries(report.productivity_data)
  const wageEntries = Object.entries(report.wage_data)

  return `
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${report.client_name} - 補助金レポート</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      font-size: 11pt;
      line-height: 1.6;
      color: #333;
      background: white;
    }

    @media print {
      body {
        margin: 0;
        padding: 0;
      }

      .page {
        page-break-after: always;
        margin: 0;
        padding: 20mm;
      }

      .no-print {
        display: none;
      }
    }

    .container {
      max-width: 210mm;
      min-height: 297mm;
      margin: 0 auto;
      padding: 20mm;
      background: white;
      box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
    }

    /* Header */
    .header {
      text-align: center;
      margin-bottom: 30px;
      padding-bottom: 20px;
      border-bottom: 3px solid #0066cc;
    }

    .header h1 {
      font-size: 28pt;
      color: #0066cc;
      margin-bottom: 10px;
      font-weight: bold;
    }

    .header .subtitle {
      font-size: 14pt;
      color: #666;
      margin-bottom: 5px;
    }

    /* Metadata */
    .metadata {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin-bottom: 30px;
      padding: 15px;
      background: #f5f5f5;
      border-radius: 4px;
    }

    .metadata-item {
      font-size: 10pt;
    }

    .metadata-item label {
      font-weight: bold;
      color: #0066cc;
      display: block;
      margin-bottom: 3px;
    }

    .metadata-item value {
      display: block;
      color: #333;
    }

    /* Section */
    .section {
      margin-bottom: 25px;
      page-break-inside: avoid;
    }

    .section-title {
      font-size: 14pt;
      font-weight: bold;
      color: #0066cc;
      margin-bottom: 12px;
      padding-bottom: 8px;
      border-bottom: 2px solid #0066cc;
    }

    /* Tables */
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 15px;
      font-size: 10pt;
    }

    th {
      background-color: #0066cc;
      color: white;
      padding: 8px;
      text-align: left;
      font-weight: bold;
      border: 1px solid #004399;
    }

    td {
      padding: 8px;
      border: 1px solid #ddd;
    }

    tr:nth-child(even) {
      background-color: #f9f9f9;
    }

    tr:hover {
      background-color: #f0f5ff;
    }

    /* Footer */
    .footer {
      margin-top: 40px;
      padding-top: 15px;
      border-top: 1px solid #ddd;
      text-align: center;
      font-size: 9pt;
      color: #999;
    }

    .footer-line {
      margin: 3px 0;
    }

    /* Print Controls */
    .print-controls {
      text-align: center;
      margin: 20px 0;
      padding: 15px;
      background: #f0f5ff;
      border-radius: 4px;
    }

    .print-controls button {
      padding: 10px 20px;
      margin: 0 5px;
      font-size: 11pt;
      background: #0066cc;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
    }

    .print-controls button:hover {
      background: #004399;
    }
  </style>
</head>
<body>
  <div class="print-controls no-print">
    <button onclick="window.print()">印刷 / PDF保存</button>
  </div>

  <div class="container">
    <!-- Header -->
    <div class="header">
      <h1>補助金レポート</h1>
      <div class="subtitle">${report.report_type}</div>
    </div>

    <!-- Metadata -->
    <div class="metadata">
      <div class="metadata-item">
        <label>クライアント名</label>
        <value>${report.client_name}</value>
      </div>
      <div class="metadata-item">
        <label>レポートタイプ</label>
        <value>${report.report_type}</value>
      </div>
      <div class="metadata-item">
        <label>開始日</label>
        <value>${report.period_start}</value>
      </div>
      <div class="metadata-item">
        <label>終了日</label>
        <value>${report.period_end}</value>
      </div>
    </div>

    <!-- Metrics Summary Section -->
    ${metricsEntries.length > 0 ? `
    <div class="section">
      <h2 class="section-title">指標サマリー</h2>
      <table>
        <thead>
          <tr>
            <th>指標</th>
            <th>値</th>
          </tr>
        </thead>
        <tbody>
          ${metricsEntries.map(([key, value]) => `
          <tr>
            <td><strong>${key}</strong></td>
            <td>${typeof value === 'object' ? JSON.stringify(value) : value}</td>
          </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    ` : ''}

    <!-- Productivity Data Section -->
    ${productivityEntries.length > 0 ? `
    <div class="section">
      <h2 class="section-title">生産性データ比較（前/後）</h2>
      <table>
        <thead>
          <tr>
            <th>項目</th>
            <th>値</th>
          </tr>
        </thead>
        <tbody>
          ${productivityEntries.map(([key, value]) => `
          <tr>
            <td><strong>${key}</strong></td>
            <td>${typeof value === 'object' ? JSON.stringify(value) : value}</td>
          </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    ` : ''}

    <!-- Wage Data Section -->
    ${wageEntries.length > 0 ? `
    <div class="section">
      <h2 class="section-title">賃金データ</h2>
      <table>
        <thead>
          <tr>
            <th>項目</th>
            <th>値</th>
          </tr>
        </thead>
        <tbody>
          ${wageEntries.map(([key, value]) => `
          <tr>
            <td><strong>${key}</strong></td>
            <td>${typeof value === 'object' ? JSON.stringify(value) : value}</td>
          </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    ` : ''}

    <!-- Footer -->
    <div class="footer">
      <div class="footer-line">生成日時: ${generatedDate}</div>
      <div class="footer-line">©TOGUNA - Subsidy Report System</div>
      <div class="footer-line">このレポートは機密情報です</div>
    </div>
  </div>
</body>
</html>
  `.trim()
}
