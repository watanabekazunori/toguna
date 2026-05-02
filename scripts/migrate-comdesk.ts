#!/usr/bin/env tsx
// GAP-J: migrate Comdesk CSV export into homes_companies (sample/full mode)
import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'

interface Args {
  mode: 'sample' | 'full'
  source: string
}

function parseArgs(): Args {
  const args = process.argv.slice(2)
  let mode: 'sample' | 'full' = 'sample'
  let source = ''
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--mode' && args[i + 1]) {
      const v = args[i + 1]
      if (v === 'sample' || v === 'full') mode = v
      i++
    } else if (args[i] === '--source' && args[i + 1]) {
      source = args[i + 1]
      i++
    }
  }
  if (!source) {
    console.error('--source <csv-path> is required')
    process.exit(1)
  }
  return { mode, source }
}

function parseCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"'
        i++
      } else if (ch === '"') {
        inQuotes = false
      } else {
        cur += ch
      }
    } else {
      if (ch === '"') inQuotes = true
      else if (ch === ',') {
        out.push(cur)
        cur = ''
      } else cur += ch
    }
  }
  out.push(cur)
  return out
}

function parseCsv(text: string): { header: string[]; rows: string[][] } {
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0)
  if (lines.length === 0) return { header: [], rows: [] }
  const header = parseCsvLine(lines[0]).map((h) => h.trim())
  const rows = lines.slice(1).map(parseCsvLine)
  return { header, rows }
}

const COLUMN_MAP: Record<string, string> = {
  '会社名': 'company_name',
  'company_name': 'company_name',
  '電話番号': 'phone',
  'phone': 'phone',
  '宅建番号': 'takken_license_no',
  'takken_license_no': 'takken_license_no',
  '都道府県': 'prefecture',
  'prefecture': 'prefecture',
  '市区町村': 'city',
  'city': 'city',
  '住所': 'address',
  'address': 'address',
  '代表者': 'representative_name',
  'representative_name': 'representative_name',
  '主要事業': 'main_business',
  'main_business': 'main_business',
  '資本金': 'capital',
  'capital': 'capital',
  '売上': 'revenue',
  'revenue': 'revenue',
  '従業員数': 'employees',
  'employees': 'employees',
}

async function main() {
  const { mode, source } = parseArgs()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const text = fs.readFileSync(source, 'utf8')
  const { header, rows } = parseCsv(text)
  const slice = mode === 'sample' ? rows.slice(0, 100) : rows
  console.log(`Comdesk migrate: mode=${mode} total=${slice.length}`)

  const errors: { row: number; error: string }[] = []
  let succeeded = 0
  let failed = 0

  for (let i = 0; i < slice.length; i++) {
    const row = slice[i]
    const record: Record<string, unknown> = {}
    for (let j = 0; j < header.length; j++) {
      const target = COLUMN_MAP[header[j]]
      if (!target) continue
      const v = row[j]?.trim()
      if (v === undefined || v === '') continue
      if (['capital', 'revenue', 'employees'].includes(target)) {
        const n = Number(v.replace(/[,円]/g, ''))
        if (!Number.isNaN(n)) record[target] = n
      } else {
        record[target] = v
      }
    }
    if (!record.takken_license_no && !record.company_name) {
      failed++
      errors.push({ row: i + 2, error: 'no key fields' })
      console.log(`[${i + 1}/${slice.length}] skipped: no key fields`)
      continue
    }
    const { error } = await supabase
      .from('homes_companies')
      .upsert(record, { onConflict: 'takken_license_no', ignoreDuplicates: true })
    if (error) {
      failed++
      errors.push({ row: i + 2, error: error.message })
      console.log(`[${i + 1}/${slice.length}] FAIL: ${error.message}`)
    } else {
      succeeded++
      console.log(`[${i + 1}/${slice.length}] OK: ${record.company_name ?? record.takken_license_no}`)
    }
  }

  await supabase.from('homes_migration_log').insert({
    migrated_at: new Date().toISOString(),
    source: 'comdesk',
    mode,
    total: slice.length,
    succeeded,
    failed,
    errors,
    notes: `csv=${source}`,
  })

  console.log(`Done. succeeded=${succeeded} failed=${failed}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
