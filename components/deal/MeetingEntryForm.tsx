/**
 * 商談入力フォーム — 17項目、meeting_seq 自動採番、ヨミ enum ツールチップ、口頭合意 B で collections 通知
 */
'use client'

import { useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { HelpCircle, Save, AlertCircle } from 'lucide-react'
import {
  MeetingEntrySchema,
  type MeetingEntryValues,
  type Yomi,
  YOMI_META,
  MEETING_NG_LABELS,
  type MeetingNgCode,
} from '@/lib/validation/meeting-schema'

interface MeetingEntryFormProps {
  dealId: string
  /** 自動採番された商談連番 */
  meetingSeq: number
  closerUserId: string
  onSubmit: (values: MeetingEntryValues, seq: number) => Promise<void>
}

const YOMI_OPTIONS: { value: Yomi; label: string }[] = (
  Object.keys(YOMI_META) as Yomi[]
).map((y) => ({ value: y, label: YOMI_META[y].label }))

const NG_REASON_OPTIONS = (Object.keys(MEETING_NG_LABELS) as MeetingNgCode[]).map((k) => ({
  value: k,
  label: MEETING_NG_LABELS[k],
}))

/** 商談入力フォーム (17項目) — ヨミ選択時にツールチップで確度説明を表示 */
export function MeetingEntryForm({
  dealId,
  meetingSeq,
  closerUserId,
  onSubmit,
}: MeetingEntryFormProps) {
  const [isPending, startTransition] = useTransition()

  const form = useForm<MeetingEntryValues>({
    resolver: zodResolver(MeetingEntrySchema),
    defaultValues: {
      scheduled_at: new Date().toISOString().slice(0, 16),
      meeting_type: 'web',
      status: 'done',
      yomi: undefined,
    },
  })

  const yomi = form.watch('yomi')
  const meetingResult = form.watch('meeting_result')
  const showNgCode = meetingResult === 'ng'
  const showBYomiDate =
    yomi === 'B' || yomi === 'b_circle' || yomi === 'won' || yomi === 'a_circle' || yomi === 'A'

  const handleSubmit = (values: MeetingEntryValues) => {
    startTransition(async () => {
      await onSubmit(values, meetingSeq)
    })
  }

  return (
    <TooltipProvider>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-5">
          {/* seq バッジ */}
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="text-sm px-3 py-1 border-blue-300 text-blue-700">
              商談 #{meetingSeq}
            </Badge>
            <span className="text-xs text-slate-400">deal_id: {dealId.slice(0, 8)}…</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 1. 商談日時 */}
            <FormField
              control={form.control}
              name="scheduled_at"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>商談日時 <span className="text-red-500">*</span></FormLabel>
                  <FormControl>
                    <Input type="datetime-local" aria-required="true" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* 2. 商談形式 */}
            <FormField
              control={form.control}
              name="meeting_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>商談形式</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="選択" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="phone">電話商談</SelectItem>
                      <SelectItem value="web">Web商談</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* 3. 商談ステータス */}
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>ステータス</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="done">完了</SelectItem>
                      <SelectItem value="rescheduled">リスケ</SelectItem>
                      <SelectItem value="disappeared">消滅</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* 4. 担当者名 */}
            <FormField
              control={form.control}
              name="contact_person_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>担当者名</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* 5. 担当者役職 */}
            <FormField
              control={form.control}
              name="contact_person_role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>担当者役職</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* 9. 商談結果 */}
            <FormField
              control={form.control}
              name="meeting_result"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>商談結果</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="選択" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="ok">継続</SelectItem>
                      <SelectItem value="ng">NG</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* 10. 商談NG理由コード (条件付き) */}
            {showNgCode && (
              <FormField
                control={form.control}
                name="ng_reason_code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      商談NG理由 <span className="text-red-500">*</span>
                    </FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger aria-required="true">
                          <SelectValue placeholder="NG理由を選択" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="max-h-60">
                        {NG_REASON_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* 13. ヨミ — ツールチップ付き */}
            <FormField
              control={form.control}
              name="yomi"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-1.5">
                    ヨミ <span className="text-red-500">*</span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="h-3.5 w-3.5 text-slate-400 cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs space-y-1.5 p-3">
                        {YOMI_OPTIONS.map((o) => {
                          const meta = YOMI_META[o.value]
                          return (
                            <div key={o.value} className="flex items-start gap-2">
                              <span className={['text-xs font-bold w-8 shrink-0', meta.color].join(' ')}>
                                {meta.label}
                              </span>
                              <span className="text-xs text-slate-400">{meta.description}</span>
                            </div>
                          )
                        })}
                      </TooltipContent>
                    </Tooltip>
                  </FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger aria-required="true">
                        <SelectValue placeholder="ヨミを選択" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {YOMI_OPTIONS.map((o) => {
                        const meta = YOMI_META[o.value]
                        return (
                          <SelectItem key={o.value} value={o.value}>
                            <span className={['font-semibold mr-2', meta.color].join(' ')}>
                              {meta.label}
                            </span>
                            <span className="text-xs text-slate-400">{Math.round(meta.rate * 100)}%</span>
                          </SelectItem>
                        )
                      })}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* 16. ヨミB確定日 (条件付き) */}
            {showBYomiDate && (
              <FormField
                control={form.control}
                name="b_yomi_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      口頭合意日 <span className="text-red-500">*</span>
                      {(yomi === 'B' || yomi === 'b_circle') && (
                        <Badge className="bg-blue-100 text-blue-700 text-xs">B確定</Badge>
                      )}
                    </FormLabel>
                    <FormControl>
                      <Input type="date" aria-required="true" {...field} />
                    </FormControl>
                    {(yomi === 'B' || yomi === 'b_circle') && (
                      <FormDescription className="flex items-center gap-1 text-blue-700">
                        <AlertCircle className="h-3.5 w-3.5" />
                        B確定後、申込書回収が自動で作成されます
                      </FormDescription>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* 12. 提案プラン */}
            <FormField
              control={form.control}
              name="proposal_plan"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>提案プラン</FormLabel>
                  <FormControl><Input placeholder="売買掲載 / 賃貸掲載 等" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* 17. 稟議番号 */}
            <FormField
              control={form.control}
              name="approval_no"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>稟議番号</FormLabel>
                  <FormControl>
                    <Input placeholder="KNP202600000000" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* 15. 商談期間 */}
            <FormField
              control={form.control}
              name="meeting_period"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>商談期間</FormLabel>
                  <FormControl><Input placeholder="例: 2026年6月〜" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* 6. 商談内容 (full-width) */}
          <FormField
            control={form.control}
            name="meeting_content"
            render={({ field }) => (
              <FormItem>
                <FormLabel>商談内容</FormLabel>
                <FormControl>
                  <Textarea
                    className="resize-none h-28"
                    placeholder="今回の商談で話した内容..."
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* 7. 次回内容 */}
          <FormField
            control={form.control}
            name="next_content"
            render={({ field }) => (
              <FormItem>
                <FormLabel>次回内容</FormLabel>
                <FormControl>
                  <Textarea
                    className="resize-none h-20"
                    placeholder="次回商談でやること..."
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* 8. 次回日程 */}
          <FormField
            control={form.control}
            name="next_date"
            render={({ field }) => (
              <FormItem className="max-w-xs">
                <FormLabel>次回日程</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* 11. NG理由備考 */}
          {showNgCode && (
            <FormField
              control={form.control}
              name="ng_reason_note"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>NG理由備考</FormLabel>
                  <FormControl>
                    <Textarea className="resize-none h-16" placeholder="補足..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          {/* 14. 課題合意 */}
          <FormField
            control={form.control}
            name="issue_agreement"
            render={({ field }) => (
              <FormItem>
                <FormLabel>課題合意</FormLabel>
                <FormControl>
                  <Textarea className="resize-none h-20" placeholder="課題・ニーズ合意内容..." {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* 保存ボタン */}
          <div className="flex items-center justify-between pt-2">
            <p className="text-xs text-slate-400">⌘↵ で保存</p>
            <Button
              type="submit"
              disabled={isPending}
              className="gap-2 min-w-[120px]"
              aria-keyshortcuts="Meta+Enter"
            >
              <Save className="h-4 w-4" />
              {isPending ? '保存中...' : '商談を保存'}
            </Button>
          </div>
        </form>
      </Form>
    </TooltipProvider>
  )
}
