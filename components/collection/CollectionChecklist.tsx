"use client";

/**
 * 申込書回収チェックリスト + AI 不備事前検出 alert。
 * react-hook-form。POST /api/lifull/collections/:id で保存。
 * 社内画面なので「GID確認書」ラベル使用可 [obs_id:con-10]。
 */
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const ITEMS: { key: string; label: string }[] = [
  { key: "application_pdf", label: "申込書PDF" },
  { key: "gid_kakuninsho", label: "GID確認書 (社内ラベル)" },
  { key: "company_registry", label: "登記簿謄本" },
  { key: "rep_id", label: "代表者身分証" },
  { key: "bank_info", label: "口座振替依頼書" },
  { key: "consent_form", label: "電子契約同意書" },
];

interface FormValues {
  checklist: Record<string, boolean>;
  received_at: string;
  collected_at: string;
  ftp_uploaded_at: string;
  dw_stored_at: string;
  defect_notes: string;
}

interface Props {
  collectionId: string;
  dealId: string;
  companyName: string;
  defectWarnings: string[];
  initialChecklist: Record<string, boolean>;
  receivedAt: string | null;
  collectedAt: string | null;
  ftpUploadedAt: string | null;
  dwStoredAt: string | null;
}

function dateInput(v: string | null): string {
  return v ? v.slice(0, 10) : "";
}

/** 申込書回収チェックリストフォーム */
export function CollectionChecklist(props: Props) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);

  const { register, handleSubmit, formState } = useForm<FormValues>({
    defaultValues: {
      checklist: ITEMS.reduce(
        (acc, i) => ({ ...acc, [i.key]: props.initialChecklist[i.key] ?? false }),
        {} as Record<string, boolean>
      ),
      received_at: dateInput(props.receivedAt),
      collected_at: dateInput(props.collectedAt),
      ftp_uploaded_at: dateInput(props.ftpUploadedAt),
      dw_stored_at: dateInput(props.dwStoredAt),
      defect_notes: "",
    },
  });

  const progress = ITEMS.filter(
    (i) => props.initialChecklist[i.key]
  ).length;

  async function onSubmit(values: FormValues) {
    setSaving(true);
    setSaved(null);
    try {
      const res = await fetch(`/api/lifull/collections/${props.collectionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) throw new Error(await res.text());
      setSaved(new Date().toLocaleTimeString("ja-JP"));
    } catch (e) {
      setSaved(`エラー: ${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <header>
        <h2 className="text-base font-medium">{props.companyName}</h2>
        <p className="text-xs text-muted-foreground">
          進捗 {progress} / {ITEMS.length}
        </p>
      </header>

      {props.defectWarnings.length > 0 && (
        <Alert variant="destructive">
          <AlertTitle>AI 不備事前検出 ({props.defectWarnings.length}件)</AlertTitle>
          <AlertDescription>
            <ul className="list-disc pl-5">
              {props.defectWarnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        {ITEMS.map((it) => (
          <label key={it.key} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              {...register(`checklist.${it.key}` as const)}
              className="h-4 w-4"
            />
            {it.label}
          </label>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label htmlFor="received_at">受領日</Label>
          <Input id="received_at" type="date" {...register("received_at")} />
        </div>
        <div>
          <Label htmlFor="collected_at">回収日</Label>
          <Input id="collected_at" type="date" {...register("collected_at")} />
        </div>
        <div>
          <Label htmlFor="ftp_uploaded_at">FTP アップロード</Label>
          <Input id="ftp_uploaded_at" type="date" {...register("ftp_uploaded_at")} />
        </div>
        <div>
          <Label htmlFor="dw_stored_at">DW 格納</Label>
          <Input id="dw_stored_at" type="date" {...register("dw_stored_at")} />
        </div>
      </div>

      <div>
        <Label htmlFor="defect_notes">不備メモ</Label>
        <Input id="defect_notes" placeholder="(任意)" {...register("defect_notes")} />
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={saving || formState.isSubmitting}>
          {saving ? "保存中..." : "保存"}
        </Button>
        {saved && <span className="text-xs text-muted-foreground">{saved}</span>}
      </div>
    </form>
  );
}

// END_OF_FILE
