/**
 * Realtime subscription — AI pipeline ステータス (completed / partial / failed) を購読し UI に即時反映
 */
'use client'

import { useEffect, useCallback, useReducer } from 'react'
import { createClient } from '@supabase/ssr'
import type { AISuggestion } from '@/lib/validation/call-entry-schema'

export type AIPipelineStatus = 'pending' | 'processing' | 'transcribed' | 'completed' | 'partial' | 'failed' | 'retry_pending'

export interface AIOutput {
  activity_id: string
  pipeline_status: AIPipelineStatus
  suggestions: AISuggestion[]
  summary?: string
  ng_reason_candidates?: string[]
  handover_draft?: string
  latency_ms?: number
  model_version?: string
}

interface State {
  status: AIPipelineStatus
  output: AIOutput | null
  error: string | null
  elapsed_sec: number
}

type Action =
  | { type: 'UPDATE'; payload: Partial<AIOutput> }
  | { type: 'ERROR'; error: string }
  | { type: 'TICK' }
  | { type: 'RESET' }

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'UPDATE':
      return {
        ...state,
        status: action.payload.pipeline_status ?? state.status,
        output: state.output
          ? { ...state.output, ...action.payload }
          : (action.payload as AIOutput),
        error: null,
      }
    case 'ERROR':
      return { ...state, status: 'failed', error: action.error }
    case 'TICK':
      return { ...state, elapsed_sec: state.elapsed_sec + 1 }
    case 'RESET':
      return { status: 'pending', output: null, error: null, elapsed_sec: 0 }
    default:
      return state
  }
}

interface UseAIPipelineStatusOptions {
  activityId: string | null
  /** 60秒 SLA タイムアウト後のコールバック */
  onTimeout?: () => void
  /** 完了時のコールバック */
  onCompleted?: (output: AIOutput) => void
}

/**
 * Supabase Realtime で lifull_ai_outputs の INSERT/UPDATE を購読。
 * ai_pipeline_status の変化を即時 UI に反映する。
 */
export function useAIPipelineStatus({
  activityId,
  onTimeout,
  onCompleted,
}: UseAIPipelineStatusOptions) {
  const [state, dispatch] = useReducer(reducer, {
    status: 'pending',
    output: null,
    error: null,
    elapsed_sec: 0,
  })

  // 経過秒数カウンタ (SLA 60秒 監視)
  useEffect(() => {
    if (!activityId || state.status === 'completed' || state.status === 'failed') return
    const timer = setInterval(() => dispatch({ type: 'TICK' }), 1000)
    return () => clearInterval(timer)
  }, [activityId, state.status])

  // SLA 超過検知
  useEffect(() => {
    if (state.elapsed_sec >= 60 && state.status === 'pending') {
      onTimeout?.()
    }
  }, [state.elapsed_sec, state.status, onTimeout])

  // Realtime subscription
  useEffect(() => {
    if (!activityId) return

    dispatch({ type: 'RESET' })

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )

    const channel = supabase
      .channel(`ai-pipeline-${activityId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'lifull_ai_outputs',
          filter: `activity_id=eq.${activityId}`,
        },
        (payload) => {
          const row = payload.new as Record<string, unknown>
          const suggestions: AISuggestion[] = Array.isArray(row.call_result_suggestions)
            ? (row.call_result_suggestions as AISuggestion[])
            : []

          const update: Partial<AIOutput> = {
            activity_id: activityId,
            pipeline_status: (row.ai_pipeline_status as AIPipelineStatus) ?? 'processing',
            suggestions,
            summary: (row.summary as string) ?? undefined,
            ng_reason_candidates: Array.isArray(row.highlights)
              ? []
              : undefined,
            handover_draft:
              typeof row.handover_draft === 'object' && row.handover_draft !== null
                ? JSON.stringify(row.handover_draft)
                : undefined,
            model_version: (row.model_version as string) ?? undefined,
          }

          dispatch({ type: 'UPDATE', payload: update })

          if (update.pipeline_status === 'completed' && onCompleted) {
            onCompleted({ ...update, activity_id: activityId } as AIOutput)
          }
        },
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          dispatch({ type: 'ERROR', error: 'Realtime チャンネルエラー' })
        }
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [activityId, onCompleted])

  const reset = useCallback(() => dispatch({ type: 'RESET' }), [])

  return {
    ...state,
    isLoading: state.status === 'pending' || state.status === 'processing' || state.status === 'transcribed',
    isCompleted: state.status === 'completed',
    isFailed: state.status === 'failed',
    isTimedOut: state.elapsed_sec >= 60 && state.status !== 'completed',
    reset,
  }
}
