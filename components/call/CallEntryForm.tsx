/**
 * コール入力フォーム — react-hook-form + zod、46項目を6カテゴリで accordion 表示
 * result_primary 値による条件付き必須切替、Cmd+Enter 保存
 */
'use client'

import { useEffect, useTransition } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
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
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Save, ChevronDown } from 'lucide-react'
import {
  CallEntryFormSchema,
  type CallEntryFormValues,
  type AISuggestion,
} from '@/lib/validation/call-entry-schema'

// ---- ラベル定数 ----

const RESULT_PRIMARY_OPTIONS = [
  { value: 'no_answer', label: '無応答' },
  { value: 'absent', label: '不在' },
  { value: 'reception_ng', label: '受付NG' },
  { value: 'contact', label: 'コンタクト' },
]

const RESULT_SECONDARY_OPTIONS = [
  { value: 'appointment', label: 'アポ獲得' },
  { value: 'lead', label: 'アポネタ' },
  { value: 'recall', label: '再架電' },
  { value: 'document_send', label: '資料送付' },
  { value: 'ng', label: 'NG' },
]

const NG_REASON_OPTIONS = [
  { value: 'listing_ng', label: '掲載NG' },
  { value: 'sourcing_ng', label: '仕入NG' },
  { value: 'current_ng', label: '現状NG' },
  { value: 'other_media_ng', label: '他媒体NG' },
  { value: 'sales_ng', label: '営業NG' },
  { value: 'timing_ng', label: '時期NG' },
  { value: 'workload_ng', label: '工数NG' },
  { value: 'price_ng', label: '金額NG' },
  { value: 'homes_ng', label: 'HOMES NG' },
  { value: 'closed_business', label: '廃業' },
  { value: 'duplicate', label: '重複' },
  { value: 'other', label: 'その他' },
]

const APPT_FORMAT_OPTIONS = [
  { value: 'オンライン', label: 'オンライン' },
  { value: '来訪', label: '来訪' },
  { value: '電話商談', label: '電話商談' },
]

const COOLTIME_OPTIONS = Array.from({ length: 9 }, (_, i) => ({
  value: String(i + 1),
  label: `クール${i + 1}`,
}))

const CALL_RESTRICTION_OPTIONS = [
  { value: 'existing', label: '既存契約' },
  { value: 'lh_following', label: 'LH追客中' },
  { value: 'anti_social', label: '反社' },
  { value: 'legal_ng', label: '法的NG' },
  { value: 'other', label: 'その他' },
]

interface CallEntryFormProps {
  companyId: string
  listId?: string
  appointerUserId: string
  zoomCallId?: string
  /** AI 確定時に form に値をセット */
  aiSuggestion?: AISuggestion | null
  onSubmit: (values: CallEntryFormValues) => Promise<void>
}

/** react-hook-form + zod、46項目を6カテゴリ accordion 表示 */
export function CallEntryForm({
  companyId,
  listId,
  appointerUserId,
  zoomCallId,
  aiSuggestion,
  onSubmit,
}: CallEntryFormProps) {
  const [isPending, startTransition] = useTransition()

  const form = useForm<CallEntryFormValues>({
    resolver: zodResolver(CallEntryFormSchema),
    defaultValues: {
      company_id: companyId,
      list_id: listId,
      appointer_user_id: appointerUserId,
      zoom_call_id: zoomCallId,
      result_primary: undefined,
      call_restriction: [],
      action_date: new Date().toISOString().split('T')[0],
    },
  })

  const { watch, setValue, unregister } = form
  const resultPrimary = watch('result_primary')
  const resultSecondary = watch('result_secondary')

  // AI 候補確定時に form へセット
  useEffect(() => {
    if (!aiSuggestion) return
    setValue('result_primary', aiSuggestion.result_primary, { shouldValidate: true })
    if (aiSuggestion.result_secondary) {
      setValue('result_secondary', aiSuggestion.result_secondary, { shouldValidate: true })
    }
    if (aiSuggestion.ng_reason_code) {
      setValue('ng_reason_code', aiSuggestion.ng_reason_code, { shouldValidate: true })
    }
  }, [aiSuggestion, setValue])

  // Zoom call_id 更新
  useEffect(() => {
    if (zoomCallId) setValue('zoom_call_id', zoomCallId)
  }, [zoomCallId, setValue])

  // 非表示フィールドを unregister して送信値から除外
  useEffect(() => {
    if (resultPrimary !== 'contact') {
      unregister(['result_secondary', 'appt_datetime', 'appt_format', 'closer_id'])
    }
    if (resultPrimary !== 'absent' && resultPrimary !== 'contact') {
      unregister('next_call_at')
    }
    if (resultPrimary !== 'no_answer' && resultPrimary !== 'contact') {
      unregister(['ng_reason_code', 'ng_reason_detail'])
    }
  }, [resultPrimary, unregister])

  // Cmd+Enter 保存
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault()
        form.handleSubmit(handleSubmit)()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const handleSubmit = (values: CallEntryFormValues) => {
    startTransition(async () => {
      await onSubmit(values)
    })
  }

  const showSecondary = resultPrimary === 'contact'
  const showNg =
    resultPrimary === 'contact' && resultSecondary === 'ng'
  const showAppt =
    resultPrimary === 'contact' && resultSecondary === 'appointment'
  const showNextCall =
    resultPrimary === 'absent' ||
    (resultPrimary === 'contact' && resultSecondary === 'recall')

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
        {/* ---- カテゴリ B: コール制御 (最重要 — 常に開く) ---- */}
        <Accordion type="multiple" defaultValue={['cat-b', 'cat-a']} className="space-y-2">
          <AccordionItem value="cat-b" className="border rounded-lg overflow-hidden">
            <AccordionTrigger className="px-4 py-3 bg-slate-50 hover:bg-slate-100 text-sm font-semibold">
              <span className="flex items-center gap-2">
                B: コール結果
                <Badge variant="destructive" className="text-xs">必須</Badge>
              </span>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4 pt-2 space-y-4">
              {/* result_primary */}
              <FormField
                control={form.control}
                name="result_primary"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>コール結果 第1階層 <span className="text-red-500">*</span></FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger aria-required="true">
                          <SelectValue placeholder="選択してください" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {RESULT_PRIMARY_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* result_secondary (contact 時のみ) */}
              {showSecondary && (
                <FormField
                  control={form.control}
                  name="result_secondary"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>コール結果 第2階層 <span className="text-red-500">*</span></FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger aria-required="true">
                            <SelectValue placeholder="選択してください" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {RESULT_SECONDARY_OPTIONS.map((o) => (
                            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* NG 理由 */}
              {showNg && (
                <>
                  <FormField
                    control={form.control}
                    name="ng_reason_code"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>NG理由コード <span className="text-red-500">*</span></FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger aria-required="true">
                              <SelectValue placeholder="NG理由を選択" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {NG_REASON_OPTIONS.map((o) => (
                              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="ng_reason_detail"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>NG理由詳細</FormLabel>
                        <FormControl>
                          <Textarea placeholder="補足..." className="resize-none h-20" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}

              {/* 次回架電日時 */}
              {showNextCall && (
                <FormField
                  control={form.control}
                  name="next_call_at"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>次回架電日時 <span className="text-red-500">*</span></FormLabel>
                      <FormControl>
                        <Input type="datetime-local" aria-required="true" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* コンタクト先 */}
              <FormField
                control={form.control}
                name="contact_person"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>コンタクト先</FormLabel>
                    <FormControl>
                      <Input placeholder="担当者名" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* コールメモ */}
              <FormField
                control={form.control}
                name="call_memo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>コールメモ</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="通話内容のメモを入力..."
                        className="resize-none h-24"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* 架電禁止フラグ */}
              <div>
                <FormLabel className="mb-2 block">架電禁止フラグ</FormLabel>
                <div className="flex flex-wrap gap-3">
                  {CALL_RESTRICTION_OPTIONS.map((opt) => (
                    <Controller
                      key={opt.value}
                      control={form.control}
                      name="call_restriction"
                      render={({ field }) => (
                        <div className="flex items-center gap-1.5">
                          <Checkbox
                            id={`restriction-${opt.value}`}
                            checked={field.value?.includes(opt.value as never) ?? false}
                            onCheckedChange={(checked) => {
                              const current = field.value ?? []
                              field.onChange(
                                checked
                                  ? [...current, opt.value]
                                  : current.filter((v) => v !== opt.value),
                              )
                            }}
                          />
                          <label
                            htmlFor={`restriction-${opt.value}`}
                            className="text-xs text-slate-600 cursor-pointer"
                          >
                            {opt.label}
                          </label>
                        </div>
                      )}
                    />
                  ))}
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* ---- カテゴリ A: 企業基本情報 ---- */}
          <AccordionItem value="cat-a" className="border rounded-lg overflow-hidden">
            <AccordionTrigger className="px-4 py-3 bg-slate-50 hover:bg-slate-100 text-sm font-semibold">
              A: 企業基本情報
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4 pt-2 grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="company_name"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>会社名 <span className="text-red-500">*</span></FormLabel>
                    <FormControl><Input aria-required="true" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="corporate_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>法人番号</FormLabel>
                    <FormControl><Input maxLength={13} {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="representative_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>代表者名</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>電話番号 <span className="text-red-500">*</span></FormLabel>
                    <FormControl><Input type="tel" aria-required="true" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="fax"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>FAX番号</FormLabel>
                    <FormControl><Input type="tel" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="postal_code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>郵便番号</FormLabel>
                    <FormControl><Input maxLength={8} placeholder="000-0000" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>住所</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="industry"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>業種</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="property_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>物件種別</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="existing_contract_status"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>既存ポータルサイト契約状況</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </AccordionContent>
          </AccordionItem>

          {/* ---- カテゴリ C: アポ獲得時 (条件付き表示) ---- */}
          {showAppt && (
            <AccordionItem value="cat-c" className="border border-green-200 rounded-lg overflow-hidden">
              <AccordionTrigger className="px-4 py-3 bg-green-50 hover:bg-green-100 text-sm font-semibold text-green-800">
                <span className="flex items-center gap-2">
                  C: アポ獲得情報
                  <Badge className="bg-green-600 text-xs">アポ獲得時必須</Badge>
                </span>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4 pt-2 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="appt_datetime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>アポ日時 <span className="text-red-500">*</span></FormLabel>
                        <FormControl>
                          <Input type="datetime-local" aria-required="true" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="appt_format"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>アポ形式 <span className="text-red-500">*</span></FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger aria-required="true">
                              <SelectValue placeholder="選択" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {APPT_FORMAT_OPTIONS.map((o) => (
                              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="appt_contact_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>担当者名</FormLabel>
                        <FormControl><Input {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="appt_contact_role"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>担当者役職</FormLabel>
                        <FormControl><Input {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="closer_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>担当クローザー <span className="text-red-500">*</span></FormLabel>
                        <FormControl>
                          <Input placeholder="クローザー UUID" aria-required="true" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="meeting_place"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>商談場所</FormLabel>
                        <FormControl><Input {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="proposal_plan_draft"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>提案プラン(仮)</FormLabel>
                      <FormControl>
                        <Input placeholder="提案プランメモ" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="appt_memo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>アポメモ</FormLabel>
                      <FormControl>
                        <Textarea className="resize-none h-20" placeholder="引き継ぎ事項等..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="handover_draft"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>引き継ぎ事項 初稿</FormLabel>
                      <FormControl>
                        <Textarea className="resize-none h-28" placeholder="AI 生成またはメモ..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </AccordionContent>
            </AccordionItem>
          )}

          {/* ---- カテゴリ E: Zoom連携 (read-only) ---- */}
          <AccordionItem value="cat-e" className="border rounded-lg overflow-hidden">
            <AccordionTrigger className="px-4 py-3 bg-slate-50 hover:bg-slate-100 text-sm font-semibold">
              E: Zoom連携 (自動入力)
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4 pt-2 grid grid-cols-2 gap-3">
              {[
                { name: 'zoom_call_id' as const, label: 'Zoom Call ID' },
                { name: 'caller_number' as const, label: '発信番号' },
                { name: 'call_started_at' as const, label: '通話開始時刻' },
                { name: 'call_ended_at' as const, label: '通話終了時刻' },
                { name: 'call_duration_sec' as const, label: '通話時間(秒)' },
                { name: 'recording_url' as const, label: '録音URL' },
              ].map((f) => (
                <FormField
                  key={f.name}
                  control={form.control}
                  name={f.name}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs text-slate-500">{f.label}</FormLabel>
                      <FormControl>
                        <Input
                          className="text-xs bg-slate-50"
                          readOnly
                          tabIndex={-1}
                          {...field}
                          value={field.value != null ? String(field.value) : ''}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              ))}
            </AccordionContent>
          </AccordionItem>

          {/* ---- カテゴリ F: 管理 ---- */}
          <AccordionItem value="cat-f" className="border rounded-lg overflow-hidden">
            <AccordionTrigger className="px-4 py-3 bg-slate-50 hover:bg-slate-100 text-sm font-semibold">
              F: 管理情報
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4 pt-2 grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="appointer_user_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>担当アポインター <span className="text-red-500">*</span></FormLabel>
                    <FormControl>
                      <Input readOnly aria-required="true" className="bg-slate-50" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="list_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>リスト名</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="action_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>行動日</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="cooltime_division"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>クール区分 <span className="text-red-500">*</span></FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger aria-required="true">
                          <SelectValue placeholder="クール" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {COOLTIME_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </AccordionContent>
          </AccordionItem>
        </Accordion>

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
            {isPending ? '保存中...' : '保存'}
          </Button>
        </div>
      </form>
    </Form>
  )
}
