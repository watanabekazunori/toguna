/**
 * G-01 免許番号パーサ
 *
 * 例: 「福岡県知事免許 (09)第010303号」
 *  → { authority: '福岡県知事', renewalCount: 9, baseNo: '010303' }
 *
 * 例: 「国土交通大臣免許 (3) 第008976号」
 *  → { authority: '国土交通大臣', renewalCount: 3, baseNo: '008976' }
 *
 * 議事録 00:11:52 — 法人番号は欠損, 宅建番号は変更可, 免許番号が最も確実な識別子。
 * 更新回数は番号末尾で増えていくため除外し、authority+baseNo で同一企業を特定する。
 */

export interface ParsedLicense {
  authority: string         // '福岡県知事' | '国土交通大臣' | etc.
  renewalCount: number | null  // 9 (更新回数。参考値)
  baseNo: string            // '010303' (重複削除キー)
  raw: string               // 元の文字列
}

const FULL_TO_HALF_DIGIT: Record<string, string> = {
  '０':'0','１':'1','２':'2','３':'3','４':'4',
  '５':'5','６':'6','７':'7','８':'8','９':'9',
}

function normalize(s: string): string {
  return s
    .replace(/[０-９]/g, (d) => FULL_TO_HALF_DIGIT[d] ?? d)
    .replace(/[\u3000\s]+/g, ' ')
    .trim()
}

const AUTHORITY_RE = /^([\u4e00-\u9fffぁ-んァ-ヶー]+(?:都|道|府|県|大臣))/
const PAREN_RE = /[\(（]\s*(\d+)\s*[\)）]/
const BASE_NO_RE = /第\s*(\d+)\s*号/

export function parseLicense(input: string | null | undefined): ParsedLicense | null {
  if (!input) return null
  const raw = input
  const s = normalize(input)

  const authMatch = s.match(AUTHORITY_RE)
  if (!authMatch) return null
  const authority = authMatch[1]

  const renewalMatch = s.match(PAREN_RE)
  const renewalCount = renewalMatch ? Number(renewalMatch[1]) : null

  const baseMatch = s.match(BASE_NO_RE)
  if (!baseMatch) return null
  const baseNo = baseMatch[1]

  return { authority, renewalCount, baseNo, raw }
}

/**
 * 重複検出用キー (authority + baseNo)
 * 同一企業の更新で renewalCount が変わっても安定する
 */
export function licenseDedupeKey(license: ParsedLicense): string {
  return `${license.authority}|${license.baseNo}`
}

/**
 * バルクインポート時に CSV/XLSX の行配列から重複検出する
 */
export function detectDuplicates<T extends { license_no?: string | null }>(
  rows: T[],
): Map<string, T[]> {
  const map = new Map<string, T[]>()
  for (const r of rows) {
    const parsed = parseLicense(r.license_no)
    if (!parsed) continue
    const key = licenseDedupeKey(parsed)
    const arr = map.get(key) ?? []
    arr.push(r)
    map.set(key, arr)
  }
  return new Map(Array.from(map.entries()).filter(([, v]) => v.length > 1))
}
