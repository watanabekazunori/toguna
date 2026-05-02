'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { listCompanies, listLists, listUsers, bulkUpdateCompanies, type CompanyFilters } from '@/lib/homes/api'
import {
  CALL_RESTRICTION_LABEL,
  MAIN_BUSINESSES,
  type CallRestriction,
  type HomesCompany,
  type HomesList,
  type HomesUser,
} from '@/lib/homes/types'
import { SheetGrid, type SheetCol } from '../_components/SheetGrid'
import { ListTagFilter } from '../_components/ListTagFilter'

const PAGE_SIZE = 100
const PRESETS_KEY = 'homes_call_list_presets'

const PREFECTURES = [
  '北海道','青森県','岩手県','宮城県','秋田県','山形県','福島県','茨城県','栃木県','群馬県','埼玉県','千葉県','東京都','神奈川県',
  '新潟県','富山県','石川県','福井県','山梨県','長野県','岐阜県','静岡県','愛知県','三重県',
  '滋賀県','京都府','大阪府','兵庫県','奈良県','和歌山県',
  '鳥取県','島根県','岡山県','広島県','山口県','徳島県','香川県','愛媛県','高知県',
  '福岡県','佐賀県','長崎県','熊本県','大分県','宮崎県','鹿児島県','沖縄県',
]

const CALL_STATES: Array<{ key: string; label: string }> = [
  { key: 'untouched', label: '未架電' },
  { key: 'dialed', label: '発信済' },
  { key: 'connected', label: '通電' },
  { key: 'contacted', label: 'コンタクト' },
  { key: 'appointed', label: 'アポ' },
  { key: 'recall_scheduled', label: '再架電' },
  { key: 'ng', label: 'NG' },
]

type Filters = {
  q: string
  q_email: string
  q_representative: string
  list_id: string
  list_ids: string[]
  prefecture: string
  city: string
  call_restriction: string
  call_state: string
  main_business: string
  listing_status: string
  company_grade: string
  attack_target: string
  homes_usage: string
  assigned_user_id: string
  has_takken: '' | '1' | '0'
  unassigned: boolean
  capital_min: string
  capital_max: string
  revenue_min: string
  revenue_max: string
  employees_min: string
  employees_max: string
  established_year_min: string
  established_year_max: string
  call_count_min: string
  call_count_max: string
  priority_min: string
  priority_max: string
  last_call_from: string
  last_call_to: string
  last_call_is_null: boolean
  athome_min: string
  suumo_min: string
}

const EMPTY_FILTERS: Filters = {
  q: '', q_email: '', q_representative: '',
  list_id: '', list_ids: [], prefecture: '', city: '',
  call_restriction: '', call_state: '',
  main_business: '', listing_status: '', company_grade: '',
  attack_target: '', homes_usage: '', assigned_user_id: '',
  has_takken: '', unassigned: false,
  capital_min: '', capital_max: '',
  revenue_min: '', revenue_max: '',
  employees_min: '', employees_max: '',
  established_year_min: '', established_year_max: '',
  call_count_min: '', call_count_max: '',
  priority_min: '', priority_max: '',
  last_call_from: '', last_call_to: '', last_call_is_null: false,
  athome_min: '', suumo_min: '',
}

function buildFilters(f: Filters): CompanyFilters {
  const num = (s: string) => (s === '' ? undefined : Number(s))
  return {
    q: f.q || undefined,
    q_email: f.q_email || undefined,
    q_representative: f.q_representative || undefined,
    list_id: f.list_id || undefined,
    list_ids: f.list_ids.length > 0 ? f.list_ids : undefined,
    prefecture: f.prefecture || undefined,
    city: f.city || undefined,
    call_restriction: f.call_restriction || undefined,
    call_state: f.call_state || undefined,
    main_business: f.main_business || undefined,
    listing_status: f.listing_status || undefined,
    company_grade: f.company_grade || undefined,
    attack_target: f.attack_target || undefined,
    homes_usage: f.homes_usage || undefined,
    assigned_user_id: f.assigned_user_id || undefined,
    has_takken: f.has_takken === '' ? undefined : f.has_takken === '1',
    unassigned: f.unassigned || undefined,
    capital_min: num(f.capital_min),
    capital_max: num(f.capital_max),
    revenue_min: num(f.revenue_min),
    revenue_max: num(f.revenue_max),
    employees_min: num(f.employees_min),
    employees_max: num(f.employees_max),
    established_year_min: num(f.established_year_min),
    established_year_max: num(f.established_year_max),
    call_count_min: num(f.call_count_min),
    call_count_max: num(f.call_count_max),
    priority_min: num(f.priority_min),
    priority_max: num(f.priority_max),
    last_call_from: f.last_call_from || undefined,
    last_call_to: f.last_call_to ? `${f.last_call_to}T23:59:59Z` : undefined,
    last_call_is_null: f.last_call_is_null || undefined,
    athome_min: num(f.athome_min),
    suumo_min: num(f.suumo_min),
  }
}

function activeFilterCount(f: Filters): number {
  let n = 0
  for (const [k, v] of Object.entries(f)) {
    if (k === 'q' || k === 'list_id' || k === 'prefecture' || k === 'call_restriction') continue
    if (Array.isArray(v)) {
      if (v.length > 0) n++
    } else if (typeof v === 'boolean') {
      if (v) n++
    } else if (v) {
      n++
    }
  }
  return n
}

export default function CallListPage() {
  const [companies, setCompanies] = useState<HomesCompany[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [orderBy, setOrderBy] = useState<keyof HomesCompany>('last_call_at')
  const [orderDir, setOrderDir] = useState<'asc' | 'desc'>('asc')
  const [lists, setLists] = useState<HomesList[]>([])
  const [users, setUsers] = useState<HomesUser[]>([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [advOpen, setAdvOpen] = useState(false)
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)
  const [presets, setPresets] = useState<Array<{ name: string; filters: Filters }>>([])

  useEffect(() => {
    void listLists().then(setLists)
    void listUsers().then((u) => setUsers(u as unknown as HomesUser[]))
    try {
      const raw = localStorage.getItem(PRESETS_KEY)
      if (raw) setPresets(JSON.parse(raw))
    } catch {}
  }, [])

  async function load() {
    setLoading(true)
    try {
      const r = await listCompanies({
        ...buildFilters(filters),
        page,
        page_size: PAGE_SIZE,
        order_by: orderBy,
        order_dir: orderDir,
      })
      setCompanies(r.data)
      setTotal(r.total)
      setSelected(new Set())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, orderBy, orderDir])

  function applyAndReload() {
    setPage(1)
    void load()
  }

  function clearAll() {
    setFilters(EMPTY_FILTERS)
    setPage(1)
    setTimeout(() => void load(), 0)
  }

  function savePreset() {
    const name = prompt('プリセット名')
    if (!name) return
    const next = [...presets.filter((p) => p.name !== name), { name, filters }]
    setPresets(next)
    localStorage.setItem(PRESETS_KEY, JSON.stringify(next))
  }
  function loadPreset(name: string) {
    const p = presets.find((x) => x.name === name)
    if (!p) return
    setFilters(p.filters)
    setPage(1)
    setTimeout(() => void load(), 0)
  }
  function deletePreset(name: string) {
    if (!confirm(`プリセット「${name}」を削除？`)) return
    const next = presets.filter((p) => p.name !== name)
    setPresets(next)
    localStorage.setItem(PRESETS_KEY, JSON.stringify(next))
  }

  async function bulkSetRestriction(restriction: CallRestriction) {
    if (selected.size === 0) return alert('選択がありません')
    if (!confirm(`${selected.size}件に「${CALL_RESTRICTION_LABEL[restriction]}」を一括設定？`)) return
    await bulkUpdateCompanies(Array.from(selected), { call_restriction: restriction })
    await load()
  }

  async function bulkSetPriority(priority: number) {
    if (selected.size === 0) return alert('選択がありません')
    await bulkUpdateCompanies(Array.from(selected), { score_priority: priority })
    await load()
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)
  const cnt = activeFilterCount(filters)

  const cols = useMemo<SheetCol<HomesCompany>[]>(() => [
    {
      key: 'company_name', label: '法人名', width: 240, sticky: true,
      render: (c) => (
        <Link href={`/homes/call?company=${c.id}`} style={{ color: 'var(--accent)', fontWeight: 600 }}>{c.company_name}</Link>
      ),
      value: (c) => c.company_name,
    },
    { key: 'phone', label: '電話番号', width: 130, mono: true, value: (c) => c.phone },
    { key: 'prefecture', label: '都道府県', width: 90, value: (c) => c.prefecture },
    { key: 'city', label: '市区町村', width: 120, value: (c) => c.city },
    { key: 'main_business', label: '業態', width: 100, value: (c) => c.main_business },
    { key: 'company_grade', label: '会社規模', width: 90, value: (c) => c.company_grade },
    { key: 'capital', label: '資本金(千円)', width: 110, mono: true, align: 'right', agg: 'sum',
      value: (c) => c.capital, render: (c) => c.capital?.toLocaleString() ?? null },
    { key: 'revenue', label: '売上高(千円)', width: 110, mono: true, align: 'right', agg: 'sum',
      value: (c) => c.revenue, render: (c) => c.revenue?.toLocaleString() ?? null },
    { key: 'employees', label: '従業員', width: 70, mono: true, align: 'right', agg: 'sum',
      value: (c) => c.employees, render: (c) => c.employees?.toLocaleString() ?? null },
    { key: 'established_at', label: '設立年', width: 90, mono: true, value: (c) => c.established_at?.slice(0, 4) },
    { key: 'takken_license_no', label: '宅建免許', width: 130, mono: true, value: (c) => c.takken_license_no },
    { key: 'score_priority', label: '優先', width: 60, mono: true, align: 'right', agg: 'avg',
      value: (c) => c.score_priority, render: (c) => c.score_priority ?? null },
    { key: 'call_count', label: '発信数', width: 70, mono: true, align: 'right', agg: 'sum',
      value: (c) => c.call_count, render: (c) => c.call_count.toLocaleString() },
    { key: 'last_call_at', label: '最終発信', width: 130, mono: true,
      value: (c) => c.last_call_at,
      render: (c) => c.last_call_at?.slice(0, 16).replace('T', ' ') },
    { key: 'call_restriction', label: '規制', width: 110,
      value: (c) => CALL_RESTRICTION_LABEL[c.call_restriction],
      render: (c) => <span className="ink-badge">{CALL_RESTRICTION_LABEL[c.call_restriction]}</span> },
    { key: 'call_state', label: '状態', width: 100,
      value: (c) => c.call_state,
      render: (c) => <span className="ink-badge">{c.call_state}</span> },
    { key: 'athome_total', label: 'AtHome件数', width: 100, mono: true, align: 'right', agg: 'sum',
      value: (c) => (c.athome_rent_count ?? 0) + (c.athome_sale_count ?? 0) },
    { key: 'suumo_total', label: 'SUUMO件数', width: 100, mono: true, align: 'right', agg: 'sum',
      value: (c) => (c.suumo_rent_count ?? 0) + (c.suumo_sale_count ?? 0) },
    { key: 'representative_name', label: '代表者', width: 110, value: (c) => c.representative_name },
  ], [])

  return (
    <div className="stack">
      <header className="between">
        <div>
          <h1>コールリスト</h1>
          <p className="caption muted">S-03 / 14万件規模対応 / 高度フィルタ + Excel風集計</p>
        </div>
      </header>

      <div className="ink-card" style={{ padding: 12 }}>
        <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
          <input
            placeholder="法人名 / 電話 / 住所"
            className="ink-input"
            style={{ width: 260 }}
            value={filters.q}
            onChange={(e) => setFilters({ ...filters, q: e.target.value })}
            onKeyDown={(e) => { if (e.key === 'Enter') applyAndReload() }}
          />
          <select className="ink-select" style={{ width: 180 }} value={filters.list_id} onChange={(e) => setFilters({ ...filters, list_id: e.target.value })}>
            <option value="">全リスト</option>
            {lists.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
          <select className="ink-select" style={{ width: 130 }} value={filters.prefecture} onChange={(e) => setFilters({ ...filters, prefecture: e.target.value })}>
            <option value="">都道府県</option>
            {PREFECTURES.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <select className="ink-select" style={{ width: 160 }} value={filters.call_restriction} onChange={(e) => setFilters({ ...filters, call_restriction: e.target.value })}>
            <option value="">発信規制</option>
            {Object.entries(CALL_RESTRICTION_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <button className="ink-btn primary" onClick={applyAndReload}>検索</button>
          <button className="ink-btn" onClick={clearAll}>クリア</button>
          {cnt > 0 && <span className="filter-count">{cnt}</span>}
          <span style={{ flex: 1 }} />
          <Link href="/homes/lists" className="ink-btn">CSV インポート</Link>
        </div>
      </div>

      <div className={`filter-panel ${advOpen ? 'open' : ''}`}>
        <div className="filter-panel-head" onClick={() => setAdvOpen(!advOpen)}>
          <span className="filter-chevron">▶</span>
          <strong style={{ fontSize: 14 }}>詳細フィルタ</strong>
          <span className="caption muted">{cnt > 0 ? `${cnt}項目適用中` : '業態・財務・架電履歴・媒体掲載・担当者など'}</span>
          <span style={{ flex: 1 }} />
          <div className="row-tight" onClick={(e) => e.stopPropagation()}>
            {presets.length > 0 && (
              <select
                className="ink-select xs"
                style={{ width: 160 }}
                value=""
                onChange={(e) => { if (e.target.value === '__del__') return; if (e.target.value) loadPreset(e.target.value) }}
              >
                <option value="">プリセット読込...</option>
                {presets.map((p) => <option key={p.name} value={p.name}>{p.name}</option>)}
              </select>
            )}
            <button className="ink-btn xs" onClick={savePreset}>+保存</button>
            {presets.length > 0 && (
              <button className="ink-btn xs" onClick={() => { const n = prompt('削除するプリセット名'); if (n) deletePreset(n) }}>-削除</button>
            )}
          </div>
        </div>
        {advOpen && (
          <div className="filter-panel-body">
            <div style={{ marginBottom: 16 }}>
              <ListTagFilter
                selectedListIds={filters.list_ids}
                onChange={(ids) => setFilters({ ...filters, list_ids: ids, list_id: ids.length === 1 ? ids[0] : '' })}
              />
            </div>
            <div className="filter-grid">
              <label>
                <span>業態</span>
                <select className="ink-select" value={filters.main_business} onChange={(e) => setFilters({ ...filters, main_business: e.target.value })}>
                  <option value="">全て</option>
                  {MAIN_BUSINESSES.map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
              </label>
              <label>
                <span>市区町村</span>
                <input className="ink-input" value={filters.city} onChange={(e) => setFilters({ ...filters, city: e.target.value })} placeholder="例: 渋谷区" />
              </label>
              <label>
                <span>会社規模</span>
                <select className="ink-select" value={filters.company_grade} onChange={(e) => setFilters({ ...filters, company_grade: e.target.value })}>
                  <option value="">全て</option>
                  <option value="A">A</option><option value="B">B</option><option value="C">C</option><option value="D">D</option>
                </select>
              </label>
              <label>
                <span>上場区分</span>
                <select className="ink-select" value={filters.listing_status} onChange={(e) => setFilters({ ...filters, listing_status: e.target.value })}>
                  <option value="">全て</option>
                  <option value="上場">上場</option>
                  <option value="非上場">非上場</option>
                </select>
              </label>
              <label>
                <span>呼出状態</span>
                <select className="ink-select" value={filters.call_state} onChange={(e) => setFilters({ ...filters, call_state: e.target.value })}>
                  <option value="">全て</option>
                  {CALL_STATES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                </select>
              </label>
              <label>
                <span>担当者</span>
                <select className="ink-select" value={filters.assigned_user_id} onChange={(e) => setFilters({ ...filters, assigned_user_id: e.target.value, unassigned: false })}>
                  <option value="">全て</option>
                  {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </label>
              <label>
                <span>アタック対象</span>
                <select className="ink-select" value={filters.attack_target} onChange={(e) => setFilters({ ...filters, attack_target: e.target.value })}>
                  <option value="">全て</option>
                  <option value="representative">代表者</option>
                  <option value="decision_maker">決裁者</option>
                  <option value="contact_person">担当者</option>
                </select>
              </label>
              <label>
                <span>宅建免許</span>
                <select className="ink-select" value={filters.has_takken} onChange={(e) => setFilters({ ...filters, has_takken: e.target.value as Filters['has_takken'] })}>
                  <option value="">全て</option>
                  <option value="1">有</option>
                  <option value="0">無</option>
                </select>
              </label>

              <label>
                <span>資本金 (千円)</span>
                <div className="filter-range">
                  <input className="ink-input mono" type="number" placeholder="最小" value={filters.capital_min} onChange={(e) => setFilters({ ...filters, capital_min: e.target.value })} />
                  <span className="sep">〜</span>
                  <input className="ink-input mono" type="number" placeholder="最大" value={filters.capital_max} onChange={(e) => setFilters({ ...filters, capital_max: e.target.value })} />
                </div>
              </label>
              <label>
                <span>売上高 (千円)</span>
                <div className="filter-range">
                  <input className="ink-input mono" type="number" placeholder="最小" value={filters.revenue_min} onChange={(e) => setFilters({ ...filters, revenue_min: e.target.value })} />
                  <span className="sep">〜</span>
                  <input className="ink-input mono" type="number" placeholder="最大" value={filters.revenue_max} onChange={(e) => setFilters({ ...filters, revenue_max: e.target.value })} />
                </div>
              </label>
              <label>
                <span>従業員</span>
                <div className="filter-range">
                  <input className="ink-input mono" type="number" placeholder="最小" value={filters.employees_min} onChange={(e) => setFilters({ ...filters, employees_min: e.target.value })} />
                  <span className="sep">〜</span>
                  <input className="ink-input mono" type="number" placeholder="最大" value={filters.employees_max} onChange={(e) => setFilters({ ...filters, employees_max: e.target.value })} />
                </div>
              </label>
              <label>
                <span>設立年</span>
                <div className="filter-range">
                  <input className="ink-input mono" type="number" placeholder="例 1990" value={filters.established_year_min} onChange={(e) => setFilters({ ...filters, established_year_min: e.target.value })} />
                  <span className="sep">〜</span>
                  <input className="ink-input mono" type="number" placeholder="例 2024" value={filters.established_year_max} onChange={(e) => setFilters({ ...filters, established_year_max: e.target.value })} />
                </div>
              </label>

              <label>
                <span>優先度スコア</span>
                <div className="filter-range">
                  <input className="ink-input mono" type="number" placeholder="1" value={filters.priority_min} onChange={(e) => setFilters({ ...filters, priority_min: e.target.value })} />
                  <span className="sep">〜</span>
                  <input className="ink-input mono" type="number" placeholder="5" value={filters.priority_max} onChange={(e) => setFilters({ ...filters, priority_max: e.target.value })} />
                </div>
              </label>
              <label>
                <span>発信回数</span>
                <div className="filter-range">
                  <input className="ink-input mono" type="number" placeholder="0" value={filters.call_count_min} onChange={(e) => setFilters({ ...filters, call_count_min: e.target.value })} />
                  <span className="sep">〜</span>
                  <input className="ink-input mono" type="number" placeholder="∞" value={filters.call_count_max} onChange={(e) => setFilters({ ...filters, call_count_max: e.target.value })} />
                </div>
              </label>
              <label className="span-2">
                <span>最終発信日</span>
                <div className="filter-range">
                  <input className="ink-input mono" type="date" value={filters.last_call_from} onChange={(e) => setFilters({ ...filters, last_call_from: e.target.value, last_call_is_null: false })} />
                  <span className="sep">〜</span>
                  <input className="ink-input mono" type="date" value={filters.last_call_to} onChange={(e) => setFilters({ ...filters, last_call_to: e.target.value, last_call_is_null: false })} />
                </div>
              </label>

              <label>
                <span>AtHome掲載 (最小)</span>
                <input className="ink-input mono" type="number" placeholder="0" value={filters.athome_min} onChange={(e) => setFilters({ ...filters, athome_min: e.target.value })} />
              </label>
              <label>
                <span>SUUMO掲載 (最小)</span>
                <input className="ink-input mono" type="number" placeholder="0" value={filters.suumo_min} onChange={(e) => setFilters({ ...filters, suumo_min: e.target.value })} />
              </label>
              <label>
                <span>HOMES利用</span>
                <select className="ink-select" value={filters.homes_usage} onChange={(e) => setFilters({ ...filters, homes_usage: e.target.value })}>
                  <option value="">全て</option>
                  <option value="未利用">未利用</option>
                  <option value="利用中">利用中</option>
                  <option value="解約">解約</option>
                </select>
              </label>

              <label className="span-2">
                <span>担当者メール検索</span>
                <input className="ink-input" placeholder="contact@..." value={filters.q_email} onChange={(e) => setFilters({ ...filters, q_email: e.target.value })} />
              </label>
              <label className="span-2">
                <span>代表者・担当者名検索</span>
                <input className="ink-input" placeholder="氏名" value={filters.q_representative} onChange={(e) => setFilters({ ...filters, q_representative: e.target.value })} />
              </label>

              <label className="span-2" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <input type="checkbox" checked={filters.last_call_is_null} onChange={(e) => setFilters({ ...filters, last_call_is_null: e.target.checked, last_call_from: '', last_call_to: '' })} />
                <span style={{ fontSize: 12 }}>未架電のみ</span>
              </label>
              <label className="span-2" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <input type="checkbox" checked={filters.unassigned} onChange={(e) => setFilters({ ...filters, unassigned: e.target.checked, assigned_user_id: '' })} />
                <span style={{ fontSize: 12 }}>担当者未割当のみ</span>
              </label>
            </div>
            <div className="filter-actions">
              <button className="ink-btn" onClick={clearAll}>全てクリア</button>
              <button className="ink-btn primary" onClick={applyAndReload}>{cnt} 件のフィルタを適用</button>
            </div>
          </div>
        )}
      </div>

      {selected.size > 0 && (
        <div className="ink-card" style={{ padding: 8, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span className="caption" style={{ fontWeight: 600 }}>{selected.size} 件選択中</span>
          <span style={{ width: 1, height: 16, background: 'var(--border-soft)' }} />
          <span className="caption muted">規制:</span>
          <button className="ink-btn xs" onClick={() => bulkSetRestriction('lh_following')}>LH追客中</button>
          <button className="ink-btn xs" onClick={() => bulkSetRestriction('existing')}>既存</button>
          <button className="ink-btn xs" onClick={() => bulkSetRestriction('closed_business')}>廃業</button>
          <button className="ink-btn xs" onClick={() => bulkSetRestriction('none')}>解除</button>
          <span style={{ width: 1, height: 16, background: 'var(--border-soft)' }} />
          <span className="caption muted">優先度:</span>
          {[1, 2, 3, 4, 5].map((p) => (
            <button key={p} className="ink-btn xs" onClick={() => bulkSetPriority(p)}>{p}</button>
          ))}
        </div>
      )}

      <div className="row-tight" style={{ alignItems: 'center' }}>
        <span className="caption muted">並び順:</span>
        <select className="ink-select xs" value={orderBy} onChange={(e) => setOrderBy(e.target.value as keyof HomesCompany)}>
          <option value="last_call_at">最終発信日</option>
          <option value="call_count">発信回数</option>
          <option value="score_priority">優先度</option>
          <option value="capital">資本金</option>
          <option value="revenue">売上高</option>
          <option value="employees">従業員</option>
          <option value="established_at">設立日</option>
          <option value="company_name">法人名</option>
        </select>
        <select className="ink-select xs" value={orderDir} onChange={(e) => setOrderDir(e.target.value as 'asc' | 'desc')}>
          <option value="asc">昇順</option>
          <option value="desc">降順</option>
        </select>
      </div>

      <SheetGrid<HomesCompany>
        rows={companies}
        cols={cols}
        rowKey={(c) => c.id}
        loading={loading}
        empty="該当する法人がありません"
        height="calc(100vh - 460px)"
        filename="homes_companies"
        selectable
        selected={selected}
        onSelectChange={setSelected}
        caption={<strong style={{ fontSize: 13 }}>結果 ({total.toLocaleString()})</strong>}
      />

      <div className="between">
        <span className="caption muted">{((page - 1) * PAGE_SIZE + 1).toLocaleString()}-{Math.min(page * PAGE_SIZE, total).toLocaleString()} / {total.toLocaleString()}</span>
        <div className="row-tight">
          <button className="ink-btn xs" disabled={page === 1} onClick={() => setPage(page - 1)}>前へ</button>
          <span className="mono caption">{page} / {totalPages || 1}</span>
          <button className="ink-btn xs" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>次へ</button>
        </div>
      </div>
    </div>
  )
}
