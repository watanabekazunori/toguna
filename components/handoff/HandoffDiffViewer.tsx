"use client";

/**
 * AI ドラフト vs 編集中値 の field 単位 red/green diff 表示
 * defect_warnings がある場合は alert 表示。
 */
import { AlertTriangle } from "lucide-react";

interface Props {
  aiValue: Record<string, unknown>;
  workingValue: Record<string, unknown>;
  defectWarnings: string[];
}

/** field 単位 diff を表示する */
export function HandoffDiffViewer({
  aiValue,
  workingValue,
  defectWarnings,
}: Props) {
  const keys = Array.from(
    new Set([...Object.keys(aiValue ?? {}), ...Object.keys(workingValue ?? {})])
  );
  const diffs = keys
    .map((key) => {
      const ai = aiValue?.[key];
      const work = workingValue?.[key];
      const equal = serialize(ai) === serialize(work);
      return { key, ai, work, equal };
    })
    .filter((d) => !d.equal);

  if (diffs.length === 0 && defectWarnings.length === 0) {
    return (
      <div className="text-xs text-muted-foreground italic">
        AI ドラフトと差分なし
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {defectWarnings.length > 0 && (
        <div className="rounded border border-red-300 bg-red-50 p-3">
          <div className="flex items-center gap-2 text-sm font-medium text-red-900">
            <AlertTriangle className="h-4 w-4" />
            申込書不備事前検出 ({defectWarnings.length}件)
          </div>
          <ul className="mt-2 list-disc pl-5 text-xs text-red-800">
            {defectWarnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {diffs.length > 0 && (
        <div className="rounded border bg-muted/30 p-3">
          <div className="text-xs font-medium text-muted-foreground mb-2">
            AI ドラフトとの差分 ({diffs.length}件)
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="pr-2 py-1 w-40">フィールド</th>
                <th className="pr-2 py-1">AI ドラフト</th>
                <th className="py-1">編集中</th>
              </tr>
            </thead>
            <tbody>
              {diffs.map((d) => (
                <tr key={d.key} className="border-t align-top">
                  <td className="pr-2 py-2 font-mono">{d.key}</td>
                  <td className="pr-2 py-2">
                    <span className="block rounded bg-red-50 px-2 py-1 line-through text-red-700">
                      {display(d.ai)}
                    </span>
                  </td>
                  <td className="py-2">
                    <span className="block rounded bg-green-50 px-2 py-1 text-green-800">
                      {display(d.work)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function serialize(v: unknown): string {
  if (v == null) return "";
  if (Array.isArray(v)) return v.join("|");
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function display(v: unknown): string {
  if (v == null || v === "") return "(空)";
  if (Array.isArray(v)) return v.join(" / ");
  return String(v);
}

// END_OF_FILE
