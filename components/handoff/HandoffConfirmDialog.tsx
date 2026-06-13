"use client";

/**
 * 確定 modal — Salesforce 引き継ぎ用テキストを preview + Copy。
 */
import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Copy, Check } from "lucide-react";
import {
  type HandoffDraft,
  formatHandoffForSalesforce,
} from "@/lib/validation/handoff-schema";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draft: HandoffDraft;
  dealId: string;
  tenantId: string;
}

/** Salesforce 引き継ぎテキスト preview + Copy ダイアログ */
export function HandoffConfirmDialog({
  open,
  onOpenChange,
  draft,
  dealId,
  tenantId,
}: Props) {
  const [copied, setCopied] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const text = useMemo(() => formatHandoffForSalesforce(draft), [draft]);

  async function handleCopy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleSubmit() {
    setSubmitting(true);
    try {
      await fetch(`/api/lifull/handoff/${dealId}/finalize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant_id: tenantId,
          salesforce_text: text,
        }),
      });
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Salesforce 引き継ぎ確認</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Salesforce 担当へ送信される引き継ぎテキストの最終確認です。
            内容を確認し「クローザーへ送信」を押してください。
          </p>
          <Textarea
            value={text}
            readOnly
            rows={18}
            className="font-mono text-xs"
          />
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={handleCopy}>
              {copied ? (
                <>
                  <Check className="mr-1 h-3 w-3" /> コピー済み
                </>
              ) : (
                <>
                  <Copy className="mr-1 h-3 w-3" /> テキストをコピー
                </>
              )}
            </Button>
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            キャンセル
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? "送信中..." : "クローザーへ送信"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// END_OF_FILE
