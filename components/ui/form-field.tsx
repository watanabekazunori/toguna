'use client'

/**
 * react-hook-form + zod + shadcn Form の汎用フィールドラッパー
 * 条件付き必須インジケータ、エラーメッセージ aria-describedby 付き
 */

import { useId } from 'react'
import {
  type UseFormReturn,
  type FieldValues,
  type Path,
  type PathValue,
  Controller,
} from 'react-hook-form'
import {
  FormControl,
  FormField as ShadcnFormField,
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
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type FieldType = 'text' | 'email' | 'tel' | 'number' | 'datetime-local' | 'textarea' | 'select'

interface SelectOption {
  value: string
  label: string
  disabled?: boolean
}

interface FormFieldProps<TFieldValues extends FieldValues> {
  /** react-hook-form の form インスタンス */
  form: UseFormReturn<TFieldValues>
  /** フィールド名 (TFieldValues のキー) */
  name: Path<TFieldValues>
  /** ラベルテキスト */
  label: string
  /** フィールドタイプ */
  type?: FieldType
  /** プレースホルダー */
  placeholder?: string
  /** 必須フィールドか */
  required?: boolean
  /** 条件付き必須か (通常必須ではないが、特定条件下で必須になる) */
  conditionallyRequired?: boolean
  /** 無効化するか */
  disabled?: boolean
  /** 読み取り専用か */
  readOnly?: boolean
  /** Select 用オプション */
  options?: SelectOption[]
  /** ヒントテキスト (エラーがない場合に表示) */
  hint?: string
  /** テキストエリア行数 */
  rows?: number
  /** 追加クラス */
  className?: string
}

// ---------------------------------------------------------------------------
// Required indicator
// ---------------------------------------------------------------------------

function RequiredIndicator({
  required,
  conditionallyRequired,
}: {
  required?: boolean
  conditionallyRequired?: boolean
}) {
  if (required) {
    return (
      <span aria-hidden="true" className="ml-0.5 text-destructive">
        *
      </span>
    )
  }
  if (conditionallyRequired) {
    return (
      <span
        aria-hidden="true"
        className="ml-1 text-xs text-amber-600 dark:text-amber-400"
        title="特定の条件下で必須"
      >
        (条件付き必須)
      </span>
    )
  }
  return null
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

/**
 * 汎用フォームフィールドラッパー。
 *
 * react-hook-form + zod + shadcn/ui Form コンポーネントを統合。
 * エラー時に aria-invalid="true" + aria-describedby でスクリーンリーダーにエラーを連結。
 *
 * 使用例:
 * ```tsx
 * <FormField
 *   form={form}
 *   name="company_name"
 *   label="会社名"
 *   required
 *   placeholder="株式会社〇〇"
 * />
 * ```
 */
export function FormField<TFieldValues extends FieldValues>({
  form,
  name,
  label,
  type = 'text',
  placeholder,
  required,
  conditionallyRequired,
  disabled,
  readOnly,
  options,
  hint,
  rows = 3,
  className,
}: FormFieldProps<TFieldValues>) {
  const hintId = useId()
  const errorId = useId()

  return (
    <ShadcnFormField
      control={form.control}
      name={name}
      render={({ field, fieldState }) => {
        const hasError = !!fieldState.error
        const ariaDescribedBy = [
          hasError ? errorId : null,
          hint && !hasError ? hintId : null,
        ]
          .filter(Boolean)
          .join(' ')

        return (
          <FormItem className={cn('space-y-1.5', className)}>
            <FormLabel
              className={cn(
                'flex items-center text-sm font-medium',
                hasError && 'text-destructive'
              )}
            >
              {label}
              <RequiredIndicator
                required={required}
                conditionallyRequired={conditionallyRequired}
              />
            </FormLabel>

            <FormControl>
              {type === 'textarea' ? (
                <Textarea
                  {...field}
                  id={field.name}
                  placeholder={placeholder}
                  disabled={disabled}
                  readOnly={readOnly}
                  rows={rows}
                  aria-required={required || conditionallyRequired}
                  aria-invalid={hasError}
                  aria-describedby={ariaDescribedBy || undefined}
                  className={cn(
                    readOnly && 'bg-muted cursor-default resize-none',
                    hasError && 'border-destructive focus-visible:ring-destructive'
                  )}
                />
              ) : type === 'select' ? (
                <Select
                  value={field.value as string}
                  onValueChange={field.onChange}
                  disabled={disabled}
                >
                  <SelectTrigger
                    id={field.name}
                    aria-required={required || conditionallyRequired}
                    aria-invalid={hasError}
                    aria-describedby={ariaDescribedBy || undefined}
                    className={cn(hasError && 'border-destructive focus:ring-destructive')}
                  >
                    <SelectValue placeholder={placeholder} />
                  </SelectTrigger>
                  <SelectContent>
                    {options?.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value} disabled={opt.disabled}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  {...field}
                  id={field.name}
                  type={type}
                  placeholder={placeholder}
                  disabled={disabled}
                  readOnly={readOnly}
                  aria-required={required || conditionallyRequired}
                  aria-invalid={hasError}
                  aria-describedby={ariaDescribedBy || undefined}
                  value={field.value ?? ''}
                  className={cn(
                    readOnly && 'bg-muted cursor-default',
                    hasError && 'border-destructive focus-visible:ring-destructive'
                  )}
                />
              )}
            </FormControl>

            {/* ヒントテキスト (エラーがない場合のみ表示) */}
            {hint && !hasError && (
              <p id={hintId} className="text-xs text-muted-foreground">
                {hint}
              </p>
            )}

            {/* エラーメッセージ — aria-describedby で連結済み */}
            <FormMessage id={errorId} className="text-xs" />
          </FormItem>
        )
      }}
    />
  )
}
