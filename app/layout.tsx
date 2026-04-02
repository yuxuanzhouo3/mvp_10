import './globals.css'
import { Inter } from 'next/font/google'
import { Providers } from '@/components/Providers'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: 'AI 招聘与求职平台',
  description: '支持求职者与招聘方双角色的 AI 招聘平台，包含岗位推荐、简历分析、AI 面试与自动初筛。',
  keywords: 'AI 招聘, AI 面试, 简历分析, 岗位推荐, 招聘工作台',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN">
      <head>
        <meta name="google" content="notranslate" />
      </head>
      <body className={inter.className}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
} 
