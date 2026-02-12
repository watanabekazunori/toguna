import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: {
    template: '%s | ディレクター',
    default: 'ディレクターダッシュボード',
  },
  description: 'TOGUNA ディレクターダッシュボード - プロジェクト管理、オペレーター管理、品質監視',
}

export default function DirectorLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
