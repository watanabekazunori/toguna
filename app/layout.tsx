import type React from "react"
import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { AuthProvider } from "@/contexts/auth-context"
import { NotificationProvider } from "@/contexts/notification-context"
import { ErrorBoundaryWrapper } from "@/components/error-boundary-wrapper"
import "./globals.css"

const _geist = Geist({ subsets: ["latin"] })
const _geistMono = Geist_Mono({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: {
    default: 'Toguna - AI搭載B2Bテレマーケティングプラットフォーム',
    template: '%s | Toguna'
  },
  description: 'AIによる戦略構築、品質管理、ナーチャリング自動化を備えた次世代テレマーケティング管理システム',
  keywords: ['テレマーケティング', 'B2B', 'AI', '営業支援', 'コール管理', 'SaaS'],
  robots: { index: true, follow: true },
  generator: "v0.app",
  icons: {
    icon: [
      {
        url: "/icon-light-32x32.png",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/icon-dark-32x32.png",
        media: "(prefers-color-scheme: dark)",
      },
      {
        url: "/icon.svg",
        type: "image/svg+xml",
      },
    ],
    apple: "/apple-icon.png",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ja">
      <body className={`font-sans antialiased`}>
        <AuthProvider>
          <NotificationProvider>
            <ErrorBoundaryWrapper>
              {children}
            </ErrorBoundaryWrapper>
          </NotificationProvider>
        </AuthProvider>
        <Analytics />
      </body>
    </html>
  )
}
