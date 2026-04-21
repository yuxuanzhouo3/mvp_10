'use client'

import { useState } from 'react'
import { Briefcase, Users, Zap, ArrowRight, Star, TrendingUp, Search } from 'lucide-react'
import { LoginPage } from '@/components/LoginPage'

export function LandingPage() {
  const [showLogin, setShowLogin] = useState(false)

  if (showLogin) {
    return <LoginPage />
  }

  return (
    <div className="min-h-screen bg-white text-gray-900">
      {/* Nav */}
      <nav className="flex items-center justify-between px-8 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
            <Briefcase className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-lg">mornjob招聘</span>
        </div>
        <div className="hidden md:flex items-center gap-8 text-sm text-gray-600">
          <a href="#" className="hover:text-gray-900 transition-colors">职位广场</a>
          <a href="#" className="hover:text-gray-900 transition-colors">AI 简历优化</a>
          <a href="#" className="hover:text-gray-900 transition-colors">招聘方入口</a>
        </div>
        <button
          onClick={() => setShowLogin(true)}
          className="px-5 py-2 rounded-full border border-gray-300 text-sm font-medium hover:bg-gray-50 transition-colors"
        >
          Log in
        </button>
      </nav>

      {/* Hero */}
      <section className="flex flex-col items-center text-center px-6 pt-24 pb-20">
        <span className="px-4 py-1.5 rounded-full bg-indigo-50 text-indigo-600 text-sm font-medium mb-8">
          AI 驱动的智能招聘平台
        </span>
        <h1 className="text-5xl md:text-6xl font-black leading-tight mb-4 max-w-3xl">
          找工作，招人才，
        </h1>
        <h1 className="text-5xl md:text-6xl font-black leading-tight mb-8 max-w-3xl bg-gradient-to-r from-indigo-500 to-purple-500 bg-clip-text text-transparent">
          全靠 AI 一站搞定
        </h1>
        <p className="text-gray-500 text-lg max-w-xl mb-10 leading-relaxed">
          mornjob招聘是面向求职者与招聘方的 AI 招聘操作系统。从简历优化到 AI 面试模拟，从岗位发布到智能初筛，一个平台全覆盖。
        </p>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setShowLogin(true)}
            className="flex items-center gap-2 px-7 py-3.5 rounded-full bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition-colors"
          >
            立即开始 <ArrowRight className="w-4 h-4" />
          </button>
          <button className="px-7 py-3.5 rounded-full border border-gray-300 font-semibold hover:bg-gray-50 transition-colors">
            查看演示
          </button>
        </div>
      </section>

      {/* Features */}
      <section className="bg-gray-50 py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-black text-center mb-14">核心功能</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <FeatureCard
              icon={<Search className="w-6 h-6 text-indigo-600" />}
              title="AI 职位匹配"
              desc="根据你的简历和偏好，智能推荐最适合的岗位，告别海投。"
            />
            <FeatureCard
              icon={<Star className="w-6 h-6 text-purple-600" />}
              title="简历分析优化"
              desc="AI 深度解析简历，给出针对性优化建议，提升面试通过率。"
            />
            <FeatureCard
              icon={<Zap className="w-6 h-6 text-pink-600" />}
              title="AI 面试模拟"
              desc="模拟真实面试场景，AI 实时反馈，帮你在正式面试前充分准备。"
            />
            <FeatureCard
              icon={<Users className="w-6 h-6 text-green-600" />}
              title="招聘方智能初筛"
              desc="自动筛选候选人，生成评估报告，让招聘效率提升 10 倍。"
            />
            <FeatureCard
              icon={<TrendingUp className="w-6 h-6 text-orange-600" />}
              title="数据驱动决策"
              desc="招聘漏斗、候选人质量、岗位热度，全维度数据一目了然。"
            />
            <FeatureCard
              icon={<Briefcase className="w-6 h-6 text-blue-600" />}
              title="双角色工作台"
              desc="求职者与招聘方各有专属工作台，流程清晰，操作高效。"
            />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6 text-center">
        <h2 className="text-4xl font-black mb-4">准备好了吗？</h2>
        <p className="text-gray-500 mb-8">加入数千名已经在使用mornjob招聘的求职者和招聘方</p>
        <button
          onClick={() => setShowLogin(true)}
          className="flex items-center gap-2 px-8 py-4 rounded-full bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition-colors mx-auto"
        >
          免费注册 <ArrowRight className="w-4 h-4" />
        </button>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-8 px-8 text-center text-sm text-gray-400">
        © 2025 mornjob招聘. All rights reserved.
      </footer>
    </div>
  )
}

function FeatureCard({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
      <div className="w-12 h-12 rounded-xl bg-gray-50 flex items-center justify-center mb-4">
        {icon}
      </div>
      <h3 className="font-bold text-lg mb-2">{title}</h3>
      <p className="text-gray-500 text-sm leading-relaxed">{desc}</p>
    </div>
  )
}
