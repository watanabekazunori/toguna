/**
 * レポートアクションバー — 印刷 / PDF / XLSX ダウンロードボタン
 * 朝会/夜会/週次レポートページで共通使用
 */
"use client";

import { useState } from "react";
import { PrinterIcon, FileDown, TableIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ReportActionBarProps {
  type: "morning" | "evening" | "weekly";
  period: string;
  className?: string;
}

const TYPE_LABEL: Record<string, string> = {
  morning: "朝会レポート",
  evening: "夜会レポート",
  weekly: "週次定例レポート",
};

/** レポートヘッダーアクションバー */
export function ReportActionBar({ type, period, className = "" }: ReportActionBarProps) {
  const [pdfLoading, setPdfLoading] = useState(false);
  const [xlsxLoading, setXlsxLoading] = useState(false);

  const baseUrl = `/api/lifull/reports/${type}/${period}`;

  async function handleDownload(accept: string, ext: string, setLoading: (v: boolean) => void) {
    setLoading(true);
    try {
      const res = await fetch(baseUrl, { headers: { Accept: accept } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${type}-report-${period}.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Download failed:", err);
      alert("ダウンロードに失敗しました。再試行してください。");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className="flex-1">
        <h2 className="text-sm font-semibold">
          {TYPE_LABEL[type]} — {period}
        </h2>
      </div>

      {/* 印刷 */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => window.print()}
        aria-label="印刷"
        className="gap-1.5"
      >
        <PrinterIcon size={14} aria-hidden />
        印刷
      </Button>

      {/* PDF ダウンロード */}
      <Button
        variant="outline"
        size="sm"
        disabled={pdfLoading}
        onClick={() =>
          handleDownload("application/pdf", "pdf", setPdfLoading)
        }
        aria-label="PDF ダウンロード"
        className="gap-1.5"
      >
        <FileDown size={14} aria-hidden />
        {pdfLoading ? "生成中..." : "PDF"}
      </Button>

      {/* XLSX ダウンロード */}
      <Button
        variant="outline"
        size="sm"
        disabled={xlsxLoading}
        onClick={() =>
          handleDownload(
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "xlsx",
            setXlsxLoading
          )
        }
        aria-label="XLSX ダウンロード"
        className="gap-1.5"
      >
        <TableIcon size={14} aria-hidden />
        {xlsxLoading ? "生成中..." : "XLSX"}
      </Button>
    </div>
  );
}

// END_OF_FILE
