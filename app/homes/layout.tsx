import './indigo.css'
import Link from 'next/link'
import { ReactNode } from 'react'
import HomesGlobalShell from './_components/HomesGlobalShell'

export const metadata = {
  title: 'TOGUNA — HOME\'S Operation Hub',
  description: 'テレマーケティング・オペレーション統合プラットフォーム',
}

const NAV = [
  { href: '/homes', label: 'Dashboard', section: 'S-01' },
  { href: '/homes/call', label: 'コール画面', section: 'S-02' },
  { href: '/homes/call-list', label: 'コールリスト', section: 'S-03' },
  { href: '/homes/deals', label: '案件管理表', section: 'S-04' },
  { href: '/homes/meetings', label: '商談管理表', section: 'S-05' },
  { href: '/homes/collections', label: '回収管理表', section: 'S-06' },
  { href: '/homes/analytics', label: '集計表', section: 'S-07' },
  { href: '/homes/activity', label: '行動管理表', section: 'S-08' },
]

const TABLES = [
  { href: '/homes/personal', label: '個人実績', section: 'M-01' },
  { href: '/homes/orders', label: '受注管理表', section: 'M-02' },
  { href: '/homes/audit', label: '審査管理表', section: 'M-03' },
  { href: '/homes/yomi', label: 'ヨミ別管理', section: 'M-04' },
  { href: '/homes/list-progress', label: 'リスト消化進捗', section: 'M-05' },
  { href: '/homes/team-stats', label: 'チーム実績比較', section: 'M-06' },
  { href: '/homes/ng-analysis', label: 'NG分析', section: 'M-07' },
  { href: '/homes/conversion', label: 'コンバージョン', section: 'M-08' },
]

const ADMIN = [
  { href: '/homes/lists', label: 'リスト管理' },
  { href: '/homes/users', label: 'ユーザー' },
  { href: '/homes/approvals', label: '稟議番号' },
  { href: '/homes/dispatch', label: 'AI割り振り' },
  { href: '/homes/settings', label: 'システム設定' },
]

export default function HomesLayout({ children }: { children: ReactNode }) {
  return (
    <div data-indigo>
      <div className="ink-shell">
        <aside className="ink-sidebar">
          <div>
            <h1 className="brand">TOGUNA</h1>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>HOME&apos;S Operation</p>
          </div>
          <nav className="col-tight">
            <p style={{ color: 'var(--text-muted)', fontSize: 12, fontWeight: 600, marginBottom: 8, paddingLeft: 12 }}>
              ワークフロー
            </p>
            {NAV.map((it) => (
              <Link key={it.href} href={it.href} prefetch={false}>
                <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>{it.label}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>{it.section}</span>
                </span>
              </Link>
            ))}
          </nav>
          <nav className="col-tight">
            <p style={{ color: 'var(--text-muted)', fontSize: 12, fontWeight: 600, marginBottom: 8, paddingLeft: 12 }}>
              管理表
            </p>
            {TABLES.map((it) => (
              <Link key={it.href} href={it.href} prefetch={false}>
                <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>{it.label}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>{it.section}</span>
                </span>
              </Link>
            ))}
          </nav>
          <nav className="col-tight">
            <p style={{ color: 'var(--text-muted)', fontSize: 12, fontWeight: 600, marginBottom: 8, paddingLeft: 12 }}>
              管理
            </p>
            {ADMIN.map((it) => (
              <Link key={it.href} href={it.href} prefetch={false}>{it.label}</Link>
            ))}
          </nav>
          <div style={{ marginTop: 'auto', fontSize: 12, color: 'var(--text-tertiary)', paddingLeft: 12 }}>
            v1.0 · FANVEST
          </div>
        </aside>
        <main className="ink-main">{children}</main>
      </div>
      <HomesGlobalShell />
    </div>
  )
}
