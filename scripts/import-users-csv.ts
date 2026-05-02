#!/usr/bin/env tsx
// GAP-A: bulk-upsert homes_users from CSV (name,email,role,team_name)
import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'

const VALID_ROLES = ['APPOINTER', 'CLOSER', 'COLLECTOR', 'SV', 'PM', 'ADMIN'] as const
type Role = typeof VALID_ROLES[number]

function parseArgs(): { source: string } {
  const args = process.argv.slice(2)
  let source = ''
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--source' && args[i + 1]) {
      source = args[i + 1]
      i++
    }
  }
  if (!source) {
    console.error('--source <csv-path> is required')
    process.exit(1)
  }
  return { source }
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
      } else cur += ch
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

async function main() {
  const { source } = parseArgs()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const text = fs.readFileSync(source, 'utf8')
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0)
  if (lines.length === 0) {
    console.log('empty csv')
    return
  }
  const header = parseCsvLine(lines[0]).map((h) => h.trim())
  const idxName = header.indexOf('name')
  const idxEmail = header.indexOf('email')
  const idxRole = header.indexOf('role')
  const idxTeam = header.indexOf('team_name')
  if (idxName < 0 || idxEmail < 0 || idxRole < 0) {
    console.error('header must include name,email,role(,team_name)')
    process.exit(1)
  }

  const { data: teams } = await supabase.from('homes_teams').select('id, name')
  const teamMap = new Map<string, string>()
  for (const t of (teams ?? []) as { id: string; name: string }[]) {
    teamMap.set(t.name, t.id)
  }

  let succeeded = 0
  let failed = 0
  for (let i = 1; i < lines.length; i++) {
    const row = parseCsvLine(lines[i])
    const name = row[idxName]?.trim()
    const email = row[idxEmail]?.trim()
    const roleRaw = row[idxRole]?.trim().toUpperCase()
    const teamName = idxTeam >= 0 ? row[idxTeam]?.trim() : ''
    if (!name || !email || !roleRaw) {
      failed++
      console.log(`[${i}] skip: missing fields`)
      continue
    }
    if (!VALID_ROLES.includes(roleRaw as Role)) {
      failed++
      console.log(`[${i}] skip: invalid role ${roleRaw}`)
      continue
    }
    const team_id = teamName ? (teamMap.get(teamName) ?? null) : null
    const { error } = await supabase
      .from('homes_users')
      .upsert(
        { name, email, role: roleRaw, team_id, is_active: true },
        { onConflict: 'email' },
      )
    if (error) {
      failed++
      console.log(`[${i}] FAIL ${email}: ${error.message}`)
    } else {
      succeeded++
      console.log(`[${i}] OK ${email} (${roleRaw})`)
    }
  }

  console.log(`Done. succeeded=${succeeded} failed=${failed}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
