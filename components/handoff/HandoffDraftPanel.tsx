"use client";

/**
 * 引き継ぎドラフト 5カテゴリ tab パネル
 * 各 field の「確定 / 編集 / リセット」操作と保存を担う。
 */
import { useState, useTransition } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { HandoffDiffViewer } from "./HandoffDiffViewer";
import { HandoffConfirmDialog } from "./HandoffConfirmDialog";
import {
  type HandoffDraft,
  type HandoffCategoryKey,
  HANDOFF_CATEGORIES,
} from "@/lib/validation/handoff-schema";

type PartialBlocks = {
  [K in HandoffCategoryKey]: HandoffDraft[K] | null;
};

interface Props {
  dealId: string;
  tenantId: string;
  aiDraft: PartialBlocks;
  confirmed: PartialBlocks;
  defectWarnings: string[];
}

type DraftWorking = Record<HandoffCategoryKey, Record<string, unknown>>;

/** 引き継ぎドラフト 5カテゴリ確認パネル */
export function HandoffDraftPanel({
  dealId,
  tenantId,
  aiDraft,
  confirmed,
  defectWarnings,
}: Props) {
  const [working, setWorking] = useState<DraftWorking>(() =>
    HANDOFF_CATEGORIES.reduce((acc, c) => {
      acc[c.key] =
        (confirmed[c.key] as Record<string, unknown> | null) ??
        (aiDraft[c.key] as Record<string, unknown> | null) ??
        {};
      return acc;
    }, {} as DraftWorking)
  );
  const [confirmedMap, setConfirmedMap] = useState(() =>
    HANDOFF_CATEGORIES.reduce<Record<HandoffCategoryKey, boolean>>(
      (acc, c) => {
        acc[c.key] = confirmed[c.key] != null;
        return acc;
      },
      {} as Record<HandoffCategoryKey, boolean>
    )
  );
  const [dialogOpen, setDialogOpen] = useState(false);
  const [, startTransition] = useTransition();

  const allConfirmed = HANDOFF_CATEGORIES.every((c) => confirmedMap[c.key]);

  function updateField(cat: HandoffCategoryKey, field: string, value: unknown) {
    setWorking((prev) => ({ ...prev, [cat]: { ...prev[cat], [field]: value } }));
  }

  function resetCategory(cat: HandoffCategoryKey) {
    setWorking((prev) => ({
      ...prev,
      [cat]: (aiDraft[cat] as Record<string, unknown> | null) ?? {},
    }));
  }

  function confirmCategory(cat: HandoffCategoryKey) {
    startTransition(async () => {
      await fetch(`/api/lifull/handoff/${dealId}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant_id: tenantId,
          category: cat,
          payload: working[cat],
        }),
      });
      setConfirmedMap((prev) => ({ ...prev, [cat]: true }));
    });
  }

  return (
    <section>
      <Tabs defaultValue={HANDOFF_CATEGORIES[0].key} className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          {HANDOFF_CATEGORIES.map((c) => (
            <TabsTrigger key={c.key} value={c.key} className="text-xs">
              {c.label}
              {confirmedMap[c.key] && (
                <span className="ml-1 text-green-600">✓</span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>

        {HANDOFF_CATEGORIES.map((c) => {
          const ai = (aiDraft[c.key] as Record<string, unknown> | null) ?? {};
          const work = working[c.key];
          const fields = Object.keys(ai).length > 0 ? Object.keys(ai) : Object.keys(work);
          return (
            <TabsContent key={c.key} value={c.key} className="space-y-4 pt-4">
              <HandoffDiffViewer
                aiValue={ai}
                workingValue={work}
                defectWarnings={c.key === "contract_block" ? defectWarnings : []}
              />
              <div className="space-y-3">
                {fields.map((field) => {
                  const v = work[field];
                  const isArray = Array.isArray(v);
                  const isLong =
                    typeof v === "string" && (v as string).length > 80;
                  return (
                    <div key={field} className="grid gap-1">
                      <label className="text-xs font-medium text-muted-foreground">
                        {field}
                      </label>
                      {isArray ? (
                        <Textarea
                          value={(v as string[]).join("\n")}
                          onChange={(e) =>
                            updateField(
                              c.key,
                              field,
                              e.target.value.split("\n").filter(Boolean)
                            )
                          }
                          rows={3}
                        />
                      ) : isLong ? (
                        <Textarea
                          value={String(v ?? "")}
                          onChange={(e) =>
                            updateField(c.key, field, e.target.value)
                          }
                          rows={3}
                        />
                      ) : (
                        <Input
                          value={String(v ?? "")}
                          onChange={(e) =>
                            updateField(c.key, field, e.target.value)
                          }
                        />
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-2">
                <Button onClick={() => confirmCategory(c.key)} size="sm">
                  確定
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => resetCategory(c.key)}
                >
                  AI ドラフトにリセット
                </Button>
              </div>
            </TabsContent>
          );
        })}
      </Tabs>

      <div className="mt-6 flex justify-end">
        <Button
          disabled={!allConfirmed}
          onClick={() => setDialogOpen(true)}
        >
          {allConfirmed
            ? "クローザーに送信 (Salesforce 引き継ぎ)"
            : `残り ${
                HANDOFF_CATEGORIES.length -
                Object.values(confirmedMap).filter(Boolean).length
              } カテゴリ`}
        </Button>
      </div>

      <HandoffConfirmDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        draft={{
          contact_block: working.contact_block as never,
          company_block: working.company_block as never,
          appointment_block: working.appointment_block as never,
          negotiation_block: working.negotiation_block as never,
          contract_block: working.contract_block as never,
          optional_notes: "",
          defect_warnings: defectWarnings,
        }}
        dealId={dealId}
        tenantId={tenantId}
      />
    </section>
  );
}

// END_OF_FILE
