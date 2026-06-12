'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import NextImage from 'next/image'
import { motion } from 'framer-motion'
import {
  ArrowRight,
  BarChart3,
  Bot,
  CheckCircle2,
  CircleDollarSign,
  Monitor,
  UserRound,
  LayoutDashboard,
  ShieldCheck,
  Check,
  PlayCircle,
  Menu,
  X,
  Star
} from 'lucide-react'

type LandingStat = {
  value: string
  label: string
}

type TaskitLandingPageProps = {
  dashboardHref: string
  isSignedIn: boolean
  liveStats?: LandingStat[]
}

export default function TaskitLandingPage({ dashboardHref, isSignedIn, liveStats = [] }: TaskitLandingPageProps) {
  const [scrolled, setScrolled] = useState(false)
  const [annual, setAnnual] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const primaryHref = isSignedIn ? dashboardHref : '/signup'
  const primaryLabel = isSignedIn ? 'Open workspace' : 'Start free'

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div className="min-h-screen bg-[#090A0F] text-slate-300 font-sans selection:bg-blue-500/30 selection:text-blue-200">
      {/* Navigation */}
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 border-b ${
          scrolled
            ? 'bg-[#090A0F]/80 backdrop-blur-md border-white/10'
            : 'bg-transparent border-transparent'
        }`}
      >
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2 text-white font-bold tracking-tight text-xl">
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shadow-[0_0_15px_rgba(37,99,235,0.5)]">
                <LayoutDashboard size={18} className="text-white" />
              </div>
              TASKIT
            </Link>
            <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
              <a href="#product" className="hover:text-white transition-colors">Product</a>
              <a href="#features" className="hover:text-white transition-colors">Features</a>
              <a href="#testimonials" className="hover:text-white transition-colors">Customers</a>
              <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
            </nav>
          </div>
          <div className="hidden md:flex items-center gap-4">
            <Link href={isSignedIn ? dashboardHref : '/login'} className="text-sm font-medium hover:text-white transition-colors">
              {isSignedIn ? 'Workspace' : 'Log in'}
            </Link>
            <Link
              href={primaryHref}
              data-analytics="nav-cta"
              className="h-9 px-4 inline-flex items-center justify-center gap-2 rounded-full bg-white text-slate-900 text-sm font-semibold hover:bg-slate-200 transition-colors"
            >
              {primaryLabel}
              <ArrowRight size={14} />
            </Link>
          </div>
          <button className="md:hidden text-white" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 overflow-hidden" id="product">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/20 via-[#090A0F] to-[#090A0F] -z-10" />
        
        <div className="max-w-7xl mx-auto px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-sm font-medium mb-8"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
            </span>
            TASKIT 2.0 is now live
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-5xl md:text-7xl font-extrabold text-white tracking-tight leading-tight mb-6 max-w-4xl mx-auto"
          >
            Run your entire agency <br className="hidden md:block" />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-cyan-300">
              without the chaos.
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed"
          >
            TASKIT unifies your clients, campaigns, team workload, and billing into one seamless workspace—powered by AI. Built for creative and marketing teams of 5 to 50.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-6"
          >
            <Link
              href={primaryHref}
              data-analytics="hero-cta"
              className="h-12 px-8 w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-full bg-blue-600 text-white text-base font-semibold hover:bg-blue-500 transition-all shadow-[0_0_30px_rgba(37,99,235,0.3)] hover:shadow-[0_0_40px_rgba(37,99,235,0.5)]"
            >
              Start free
              <ArrowRight size={16} />
            </Link>
            <a
              href="#demo"
              data-analytics="hero-demo"
              className="h-12 px-8 w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-full bg-white/5 text-white border border-white/10 hover:bg-white/10 transition-colors font-semibold"
            >
              <PlayCircle size={18} />
              Watch demo
            </a>
          </motion.div>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="text-sm text-slate-500 font-medium"
          >
            No credit card · Free forever · Setup in 2 min
          </motion.p>
        </div>

        {/* Dashboard Mockup */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="mt-20 max-w-[1000px] mx-auto px-6"
        >
          <div className="relative rounded-2xl overflow-hidden border border-white/10 shadow-2xl shadow-blue-900/20 bg-[#12141D]">
            {/* Top Bar */}
            <div className="h-12 border-b border-white/10 bg-white/[0.02] flex items-center px-4 gap-4">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500/80" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                <div className="w-3 h-3 rounded-full bg-green-500/80" />
              </div>
              <div className="flex-1 max-w-sm mx-auto h-7 bg-black/40 rounded border border-white/5 flex items-center px-3 text-xs text-slate-500">
                app.taskit.os / workspace
              </div>
            </div>
            {/* Body */}
            <div className="flex h-[400px] md:h-[500px]">
              {/* Sidebar */}
              <div className="w-48 border-r border-white/10 bg-black/20 p-4 hidden md:flex flex-col gap-1">
                {['Dashboard', 'Campaigns', 'Clients', 'Finance', 'Reports'].map((item, i) => (
                  <div key={i} className={`px-3 py-2 rounded-lg text-sm font-medium ${i === 0 ? 'bg-blue-500/10 text-blue-400' : 'text-slate-400 hover:bg-white/5'}`}>
                    {item}
                  </div>
                ))}
              </div>
              {/* Main Area */}
              <div className="flex-1 p-6 md:p-8 bg-[#0D0F16]">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-lg font-semibold text-white">Campaign Overview</h3>
                  <div className="h-8 px-3 rounded bg-blue-600 text-white text-sm font-medium flex items-center">New Campaign</div>
                </div>
                <div className="grid grid-cols-3 gap-4 mb-6">
                  {[
                    { label: 'Active Projects', value: '12', trend: '+2' },
                    { label: 'Monthly Revenue', value: '$45,200', trend: '+14%' },
                    { label: 'Team Capacity', value: '78%', trend: '-4%' },
                  ].map((stat, i) => (
                    <div key={i} className="p-4 rounded-xl border border-white/5 bg-white/[0.02]">
                      <div className="text-xs text-slate-400 mb-1">{stat.label}</div>
                      <div className="flex items-baseline gap-2">
                        <div className="text-2xl font-bold text-white">{stat.value}</div>
                        <div className={`text-xs ${stat.trend.startsWith('+') ? 'text-green-400' : 'text-red-400'}`}>{stat.trend}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="h-48 rounded-xl border border-white/5 bg-white/[0.02] p-4 relative overflow-hidden">
                   <div className="text-sm font-medium text-slate-300 mb-4">Revenue Pipeline</div>
                   {/* Fake chart lines */}
                   <div className="absolute bottom-4 left-4 right-4 h-32 flex items-end justify-between gap-2 opacity-50">
                     {[40, 60, 45, 80, 55, 90, 70, 100].map((h, i) => (
                       <div key={i} className="w-full bg-blue-500/20 rounded-t-sm" style={{ height: `${h}%` }}>
                         <div className="w-full bg-blue-500/40 rounded-t-sm" style={{ height: '4px' }} />
                       </div>
                     ))}
                   </div>
                </div>
              </div>
            </div>
            {/* Overlay Gradient */}
            <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[#090A0F] to-transparent pointer-events-none" />
          </div>
        </motion.div>
      </section>

      {/* Logos */}
      <section className="py-10 border-y border-white/5 bg-white/[0.01]">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <p className="text-sm font-semibold text-slate-500 uppercase tracking-widest mb-8">Trusted by 500+ fast-growing agencies</p>
          <div className="flex flex-wrap justify-center gap-12 md:gap-24 opacity-50 grayscale">
            {['Studio Neo', 'PixelWorks', 'Creative Lab', 'Brand Co.', 'Agency X'].map((logo, i) => (
              <span key={i} className="text-xl font-bold font-display tracking-tight text-white">{logo}</span>
            ))}
          </div>
        </div>
      </section>

      {/* Features Bento Box */}
      <section className="py-24 md:py-32" id="features">
        <div className="max-w-7xl mx-auto px-6">
          <div className="mb-16 md:text-center max-w-3xl md:mx-auto">
            <h2 className="text-3xl md:text-5xl font-bold text-white tracking-tight mb-6">
              Everything you need. <br />
              <span className="text-slate-400">Nothing you don't.</span>
            </h2>
            <p className="text-lg text-slate-400">
              Replace Asana, Monday, Stripe, and Google Drive with one native OS designed specifically for agency workflows.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Feature 1 */}
            <div className="group rounded-3xl border border-white/10 bg-white/5 p-8 hover:bg-white/10 transition-colors">
              <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center mb-6">
                <UserRound className="text-blue-400" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-3">Client & CRM Portal</h3>
              <p className="text-slate-400 mb-8 leading-relaxed">
                Never drop a lead or lose a brief. Manage relationships, track deals, and give clients a premium, white-labeled portal experience to approve deliverables.
              </p>
              <div className="h-48 rounded-xl bg-black/40 border border-white/5 p-4 flex flex-col gap-3 relative overflow-hidden">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-white/5">
                  <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-xs text-white font-bold">JD</div>
                  <div className="flex-1"><div className="text-sm text-white font-medium">John Doe</div><div className="text-xs text-slate-500">Acme Corp</div></div>
                  <div className="px-2 py-1 rounded text-[10px] bg-green-500/20 text-green-400">Deal Won</div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-white/5">
                  <div className="w-8 h-8 rounded-full bg-rose-500 flex items-center justify-center text-xs text-white font-bold">SW</div>
                  <div className="flex-1"><div className="text-sm text-white font-medium">Sarah Wong</div><div className="text-xs text-slate-500">TechFlow</div></div>
                  <div className="px-2 py-1 rounded text-[10px] bg-blue-500/20 text-blue-400">In Review</div>
                </div>
              </div>
            </div>

            {/* Feature 2 */}
            <div className="group rounded-3xl border border-white/10 bg-white/5 p-8 hover:bg-white/10 transition-colors">
              <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center mb-6">
                <Monitor className="text-purple-400" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-3">Campaign OS</h3>
              <p className="text-slate-400 mb-8 leading-relaxed">
                From brief to delivery, perfectly tracked. Use visual Kanban boards, balance team workloads, and trigger one-click creative approvals.
              </p>
              <div className="h-48 rounded-xl bg-black/40 border border-white/5 p-4 flex gap-4 overflow-hidden">
                <div className="w-1/3 flex flex-col gap-2">
                  <div className="text-xs text-slate-500 font-medium">To Do</div>
                  <div className="p-3 rounded border border-white/5 bg-white/5"><div className="w-full h-2 bg-slate-600 rounded mb-2" /><div className="w-2/3 h-2 bg-slate-700 rounded" /></div>
                  <div className="p-3 rounded border border-white/5 bg-white/5"><div className="w-full h-2 bg-slate-600 rounded mb-2" /><div className="w-1/2 h-2 bg-slate-700 rounded" /></div>
                </div>
                <div className="w-1/3 flex flex-col gap-2">
                  <div className="text-xs text-slate-500 font-medium">In Progress</div>
                  <div className="p-3 rounded border border-white/5 bg-blue-500/10"><div className="w-full h-2 bg-blue-400/50 rounded mb-2" /><div className="w-3/4 h-2 bg-blue-400/30 rounded" /></div>
                </div>
              </div>
            </div>

            {/* Feature 3 */}
            <div className="group rounded-3xl border border-white/10 bg-white/5 p-8 hover:bg-white/10 transition-colors md:col-span-2 lg:col-span-1">
              <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center mb-6">
                <CircleDollarSign className="text-green-400" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-3">Finance & Billing</h3>
              <p className="text-slate-400 mb-8 leading-relaxed">
                Get paid faster. Track every dollar. Integrated invoicing, expense tracking, and subscription billing powered by Stripe.
              </p>
              <div className="h-32 rounded-xl bg-black/40 border border-white/5 p-5 flex flex-col justify-center">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-sm text-slate-400">Invoice #INV-2026</span>
                  <span className="px-2 py-1 rounded text-xs bg-green-500/20 text-green-400 border border-green-500/20">Paid</span>
                </div>
                <div className="flex justify-between items-end">
                  <div className="text-2xl font-bold text-white">$12,450.00</div>
                  <div className="text-sm text-slate-500">via Stripe</div>
                </div>
              </div>
            </div>

            {/* Feature 4 */}
            <div className="group rounded-3xl border border-white/10 bg-white/5 p-8 hover:bg-white/10 transition-colors md:col-span-2 lg:col-span-1">
              <div className="w-12 h-12 rounded-xl bg-cyan-500/20 flex items-center justify-center mb-6">
                <Bot className="text-cyan-400" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-3">AI Intelligence</h3>
              <p className="text-slate-400 mb-8 leading-relaxed">
                Your 24/7 agency copilot. AI automatically summarizes long briefs, flags delayed projects, and predicts team capacity bottlenecks.
              </p>
              <div className="h-32 rounded-xl bg-black/40 border border-white/5 p-5 flex gap-4 items-start">
                <div className="w-8 h-8 rounded-full bg-cyan-500/20 flex items-center justify-center shrink-0">
                  <Bot size={14} className="text-cyan-400" />
                </div>
                <div>
                  <div className="text-sm text-white font-medium mb-1">Capacity Warning</div>
                  <div className="text-sm text-slate-400 leading-relaxed">
                    Based on current velocity, the design team will be over capacity by Thursday. I recommend reassigning the "Web Redesign" tasks.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-24 border-y border-white/5 bg-white/[0.01]" id="testimonials">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold text-white tracking-tight mb-6">Loved by agencies</h2>
            <p className="text-lg text-slate-400 max-w-2xl mx-auto">
              See why hundreds of creative teams have switched from fragmented toolchains to TASKIT.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-8 rounded-3xl border border-white/10 bg-[#090A0F] relative">
              <div className="flex text-yellow-500 mb-6"><Star size={16} fill="currentColor" /><Star size={16} fill="currentColor" /><Star size={16} fill="currentColor" /><Star size={16} fill="currentColor" /><Star size={16} fill="currentColor" /></div>
              <p className="text-lg text-slate-300 mb-8 leading-relaxed">"TASKIT replaced Asana, Monday, and our messy spreadsheets. We saved $800/mo on software and reclaimed 14 hours a week in operational admin."</p>
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500" />
                <div>
                  <div className="text-white font-semibold">Sarah Jenkins</div>
                  <div className="text-sm text-slate-500">Ops Director @ Studio Neo</div>
                </div>
              </div>
            </div>
            <div className="p-8 rounded-3xl border border-white/10 bg-[#090A0F] relative">
              <div className="flex text-yellow-500 mb-6"><Star size={16} fill="currentColor" /><Star size={16} fill="currentColor" /><Star size={16} fill="currentColor" /><Star size={16} fill="currentColor" /><Star size={16} fill="currentColor" /></div>
              <p className="text-lg text-slate-300 mb-8 leading-relaxed">"The automated billing and client portal alone paid for the platform in our first month. Absolutely game-changing for our presentation."</p>
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500" />
                <div>
                  <div className="text-white font-semibold">Marcus Reed</div>
                  <div className="text-sm text-slate-500">Founder @ PixelWorks</div>
                </div>
              </div>
            </div>
            <div className="p-8 rounded-3xl border border-white/10 bg-[#090A0F] relative">
              <div className="flex text-yellow-500 mb-6"><Star size={16} fill="currentColor" /><Star size={16} fill="currentColor" /><Star size={16} fill="currentColor" /><Star size={16} fill="currentColor" /><Star size={16} fill="currentColor" /></div>
              <p className="text-lg text-slate-300 mb-8 leading-relaxed">"Having our briefs, assets, and invoices in the same place as client feedback has sped up our delivery times by 30%. It just works."</p>
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-rose-400 to-orange-500" />
                <div>
                  <div className="text-white font-semibold">Elena Rostova</div>
                  <div className="text-sm text-slate-500">Creative Lead @ Brand Co.</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-24 md:py-32" id="pricing">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold text-white tracking-tight mb-6">Simple, transparent pricing</h2>
            <p className="text-lg text-slate-400 max-w-2xl mx-auto mb-10">
              Per-seat pricing that scales with your agency. Start free, upgrade when ready.
            </p>
            
            <div className="inline-flex items-center gap-3 p-1 rounded-full border border-white/10 bg-white/5">
              <button 
                onClick={() => setAnnual(false)} 
                className={`px-6 py-2 rounded-full text-sm font-semibold transition-all ${!annual ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
              >
                Monthly
              </button>
              <button 
                onClick={() => setAnnual(true)} 
                className={`px-6 py-2 rounded-full text-sm font-semibold transition-all flex items-center gap-2 ${annual ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
              >
                Annually <span className={`text-[10px] px-2 py-0.5 rounded-full ${annual ? 'bg-white/20' : 'bg-blue-500/20 text-blue-400'}`}>Save 20%</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 max-w-6xl mx-auto items-end">
            {/* Free */}
            <div className="p-8 rounded-3xl border border-white/10 bg-white/[0.02]">
              <h3 className="text-xl font-bold text-white mb-2">Free</h3>
              <p className="text-sm text-slate-400 mb-6 h-10">For individuals and tiny teams getting started.</p>
              <div className="mb-8">
                <span className="text-4xl font-extrabold text-white">$0</span>
                <span className="text-slate-500">/mo</span>
              </div>
              <Link href="/signup" data-analytics="pricing-free-cta" className="block w-full py-3 px-4 bg-white/5 border border-white/10 rounded-xl text-center text-white font-semibold hover:bg-white/10 transition-colors mb-8">
                Start for free
              </Link>
              <ul className="space-y-4 text-sm text-slate-300">
                <li className="flex gap-3"><Check size={16} className="text-blue-400 shrink-0" /> Up to 3 users</li>
                <li className="flex gap-3"><Check size={16} className="text-blue-400 shrink-0" /> Core task management</li>
                <li className="flex gap-3"><Check size={16} className="text-blue-400 shrink-0" /> Client portal</li>
                <li className="flex gap-3"><Check size={16} className="text-blue-400 shrink-0" /> Standard support</li>
              </ul>
            </div>

            {/* Starter */}
            <div className="p-8 rounded-3xl border border-white/10 bg-white/[0.02]">
              <h3 className="text-xl font-bold text-white mb-2">Starter</h3>
              <p className="text-sm text-slate-400 mb-6 h-10">For growing agencies that need more power.</p>
              <div className="mb-8">
                <span className="text-4xl font-extrabold text-white">{annual ? '$10' : '$12'}</span>
                <span className="text-slate-500">/seat/mo</span>
              </div>
              <Link href="/signup" data-analytics="pricing-starter-cta" className="block w-full py-3 px-4 bg-white/5 border border-white/10 rounded-xl text-center text-white font-semibold hover:bg-white/10 transition-colors mb-8">
                Get started
              </Link>
              <ul className="space-y-4 text-sm text-slate-300">
                <li className="flex gap-3"><Check size={16} className="text-blue-400 shrink-0" /> Up to 15 users</li>
                <li className="flex gap-3"><Check size={16} className="text-blue-400 shrink-0" /> Custom workflows</li>
                <li className="flex gap-3"><Check size={16} className="text-blue-400 shrink-0" /> Basic automations</li>
                <li className="flex gap-3"><Check size={16} className="text-blue-400 shrink-0" /> Priority support</li>
              </ul>
            </div>

            {/* Pro */}
            <div className="p-8 rounded-3xl border-2 border-blue-500 bg-gradient-to-b from-blue-900/20 to-transparent relative transform md:-translate-y-4">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-blue-500 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide">
                Most Popular
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Pro</h3>
              <p className="text-sm text-blue-200/60 mb-6 h-10">The complete OS for established agencies.</p>
              <div className="mb-8">
                <span className="text-4xl font-extrabold text-white">{annual ? '$24' : '$29'}</span>
                <span className="text-slate-500">/seat/mo</span>
              </div>
              <Link href="/signup" data-analytics="pricing-pro-cta" className="block w-full py-3 px-4 bg-blue-600 rounded-xl text-center text-white font-semibold hover:bg-blue-500 transition-colors shadow-[0_0_20px_rgba(37,99,235,0.3)] hover:shadow-[0_0_30px_rgba(37,99,235,0.5)] mb-8">
                Start Pro trial
              </Link>
              <ul className="space-y-4 text-sm text-slate-200">
                <li className="flex gap-3"><Check size={16} className="text-blue-400 shrink-0" /> Unlimited users</li>
                <li className="flex gap-3"><Check size={16} className="text-blue-400 shrink-0" /> Advanced AI Copilot</li>
                <li className="flex gap-3"><Check size={16} className="text-blue-400 shrink-0" /> Full finance suite (Stripe)</li>
                <li className="flex gap-3"><Check size={16} className="text-blue-400 shrink-0" /> Team capacity planning</li>
              </ul>
            </div>

            {/* Enterprise */}
            <div className="p-8 rounded-3xl border border-white/10 bg-white/[0.02]">
              <h3 className="text-xl font-bold text-white mb-2">Enterprise</h3>
              <p className="text-sm text-slate-400 mb-6 h-10">For large organizations requiring security.</p>
              <div className="mb-8 flex items-end h-[44px]">
                <span className="text-3xl font-extrabold text-white">Custom</span>
              </div>
              <Link href="/contact" data-analytics="pricing-enterprise-cta" className="block w-full py-3 px-4 bg-white/5 border border-white/10 rounded-xl text-center text-white font-semibold hover:bg-white/10 transition-colors mb-8">
                Contact sales
              </Link>
              <ul className="space-y-4 text-sm text-slate-300">
                <li className="flex gap-3"><Check size={16} className="text-blue-400 shrink-0" /> Dedicated onboarding</li>
                <li className="flex gap-3"><Check size={16} className="text-blue-400 shrink-0" /> SLA uptime guarantee</li>
                <li className="flex gap-3"><Check size={16} className="text-blue-400 shrink-0" /> Audit trails & SSO</li>
                <li className="flex gap-3"><Check size={16} className="text-blue-400 shrink-0" /> Custom integrations</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-blue-600/10" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-blue-500/20 blur-[120px] rounded-full pointer-events-none" />
        
        <div className="max-w-4xl mx-auto px-6 text-center relative z-10">
          <h2 className="text-4xl md:text-6xl font-extrabold text-white tracking-tight mb-8">
            Ready to scale your agency?
          </h2>
          <p className="text-xl text-blue-100/70 mb-10 max-w-2xl mx-auto">
            Join 500+ modern agencies running their entire operation on TASKIT.
          </p>
          <Link
            href={primaryHref}
            data-analytics="bottom-cta"
            className="h-14 px-10 inline-flex items-center justify-center gap-2 rounded-full bg-white text-slate-900 text-lg font-bold hover:bg-slate-200 transition-all shadow-[0_0_30px_rgba(255,255,255,0.2)] hover:shadow-[0_0_40px_rgba(255,255,255,0.4)]"
          >
            Start your free workspace
            <ArrowRight size={18} />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 bg-[#090A0F] pt-20 pb-10">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-10 mb-16">
            <div className="col-span-2">
              <Link href="/" className="flex items-center gap-2 text-white font-bold tracking-tight text-xl mb-6">
                <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
                  <LayoutDashboard size={18} className="text-white" />
                </div>
                TASKIT
              </Link>
              <p className="text-slate-400 text-sm max-w-xs leading-relaxed">
                The all-in-one operating system for modern agencies. Manage clients, campaigns, and finance without the chaos.
              </p>
            </div>
            
            <div>
              <h4 className="text-white font-semibold mb-4">Product</h4>
              <ul className="space-y-3 text-sm text-slate-400">
                <li><a href="#" className="hover:text-white transition-colors">Features</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Pricing</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Changelog</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Integrations</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="text-white font-semibold mb-4">Resources</h4>
              <ul className="space-y-3 text-sm text-slate-400">
                <li><a href="#" className="hover:text-white transition-colors">Documentation</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Blog</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Agency Guides</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Help Center</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="text-white font-semibold mb-4">Company</h4>
              <ul className="space-y-3 text-sm text-slate-400">
                <li><a href="#" className="hover:text-white transition-colors">About Us</a></li>
                <li><a href="/privacy" className="hover:text-white transition-colors">Privacy Policy</a></li>
                <li><a href="/terms" className="hover:text-white transition-colors">Terms of Service</a></li>
                <li><a href="/ai-transparency" className="hover:text-white transition-colors">AI Transparency</a></li>
              </ul>
            </div>
          </div>
          
          <div className="pt-8 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm text-slate-500">
              © {new Date().getFullYear()} TASKIT OS. All rights reserved.
            </p>
            <div className="flex gap-4">
              {/* Social icons placeholders */}
              <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors cursor-pointer text-slate-400 hover:text-white">𝕏</div>
              <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors cursor-pointer text-slate-400 hover:text-white">in</div>
              <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors cursor-pointer text-slate-400 hover:text-white">gh</div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
