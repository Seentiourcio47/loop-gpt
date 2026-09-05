'use client'

import Link from 'next/link'
import { useCallback, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import {
  Sparkles, Bot, Search, Image as ImageIcon, FileText, Cpu, Cable, Blocks,
  Check, ArrowRight, Globe, Smartphone, Apple, Monitor, TerminalSquare,
  Zap, ShieldCheck, Infinity as InfinityIcon, Gauge, ChevronDown, Menu, X, Eye,
} from 'lucide-react'

/* ── data ─────────────────────────────────────────────────────────── */

const FEATURES = [
  { icon: Bot, title: 'Agentic tool use', desc: 'A real tool-calling agent that searches, computes, reads, and acts — streamed live, step by step.', span: 'sm:col-span-2' },
  { icon: Search, title: 'Deep research', desc: 'Plans queries, reads sources, and writes a cited report you can trust.', span: '' },
  { icon: Eye, title: 'Vision', desc: 'Upload an image and ask about it — native multimodal understanding.', span: '' },
  { icon: ImageIcon, title: 'Image generation', desc: 'FLUX-grade generation from a prompt, right in the chat.', span: '' },
  { icon: Cpu, title: 'Agent Computer', desc: 'Every tool call streams in a live terminal — full transparency, zero black boxes.', span: 'sm:col-span-2' },
  { icon: FileText, title: 'Documents', desc: 'PDF, Word, Excel, and PowerPoint produced as downloadable outputs.', span: '' },
  { icon: Cable, title: 'MCP & connectors', desc: 'Plug in Model Context Protocol servers and external services.', span: '' },
  { icon: Blocks, title: 'Skills & builders', desc: 'Create reusable skills and no-code tools that extend the agent.', span: '' },
]

const PLATFORMS = [
  {
    icon: Monitor, name: 'Web', status: 'Live now', href: '/chat', primary: true,
    desc: 'The full workstation — chat, agents, canvas, and the Agent Computer in your browser.',
    foot: 'Installable PWA · keyboard-first',
  },
  {
    icon: Smartphone, name: 'Android', status: 'Beta wave', href: '/signup', primary: false,
    desc: 'Native speed, streaming responses, voice-ready microphone, and biometric sign-in.',
    foot: 'Join the beta waitlist from your account',
  },
  {
    icon: Apple, name: 'iOS', status: 'In review', href: '/signup', primary: false,
    desc: 'Handoff from web,widgets-ready, and buttery 120Hz scrolling through long threads.',
    foot: 'TestFlight invites rolling out',
  },
]

const PLANS = [
  {
    name: 'Free', price: '$0', period: 'forever', cta: 'Start free', href: '/signup', highlight: false,
    features: ['~30 messages/day', 'Chat + web search + calculator', '3 images/day', '1 deep-research/day', 'PDF export', 'Community support'],
  },
  {
    name: 'Pro', price: '$15', period: '/mo', cta: 'Go Pro', href: '/signup?plan=pro', highlight: true,
    features: ['High daily limits', 'All tools + deep research', 'Vision + unlimited docs', 'MCP, connectors, skills, builders', 'Priority (warm) model', 'No image watermark'],
  },
  {
    name: 'Gold', price: '$39', period: '/mo', cta: 'Go Gold', href: '/signup?plan=gold', highlight: false,
    features: ['5,000 credits/day', '500 images/day', 'Video generation with priority queue', 'Everything in Pro', 'Longest context windows', 'Priority support'],
  },
]

const API_PLANS = [
  {
    name: 'Pay as you go', price: '$0', period: 'no subscription', highlight: false,
    features: ['$2.00 / 1M input tokens', '$2.00 / 1M output tokens', '$0.05 per image', '$0.40 per 5s video', '20 req/min', 'Prepaid credit, never expires'],
  },
  {
    name: 'Developer', price: '$15', period: '/mo', highlight: true,
    features: ['5% off all usage', '60 requests/min', 'Unlimited API keys', 'OpenAI-compatible /v1', 'Usage dashboard', 'Email support'],
  },
  {
    name: 'Scale', price: '$150', period: '/mo', highlight: false,
    features: ['15% off all usage', '600 requests/min', '$150 credit included monthly', 'Priority render queue', 'Higher concurrency', 'Priority support'],
  },
]

const STATS = [
  { icon: Zap, kpi: '<800ms', label: 'first token, warm path' },
  { icon: InfinityIcon, kpi: '∞ keys', label: 'on the metered API' },
  { icon: Gauge, kpi: '384·30k', label: 'embed dims · context' },
  { icon: ShieldCheck, kpi: 'SOC-style', label: 'logging & audit trail' },
]

const FOOTER_COLS = [
  {
    head: 'Product',
    links: [
      { t: 'Chat', h: '/chat' },
      { t: 'Create video', h: '/create/video' },
      { t: 'Account', h: '/account' },
      { t: 'Developers', h: '/developers' },
    ],
  },
  {
    head: 'Platform',
    links: [
      { t: 'Web app', h: '/chat' },
      { t: 'Android beta', h: '/signup' },
      { t: 'iOS TestFlight', h: '/signup' },
      { t: 'API status', h: '/developers' },
    ],
  },
  {
    head: 'Resources',
    links: [
      { t: 'Pricing', h: '#pricing' },
      { t: 'API pricing', h: 'https://api.loop-gpt.cyou/v1/pricing' },
      { t: 'Model catalog', h: 'https://api.loop-gpt.cyou/v1/models' },
      { t: 'Sign up', h: '/signup' },
    ],
  },
  {
    head: 'Legal',
    links: [
      { t: 'Privacy', h: '/privacy' },
      { t: 'Terms', h: '/terms' },
      { t: 'Acceptable use', h: '/acceptable-use' },
      { t: 'Cookies', h: '/cookies' },
    ],
  },
]

/* ── shared bits ──────────────────────────────────────────────────── */

/** Cursor-tracking spotlight: writes --mx/--my custom props on the card. */
function useSpot<T extends HTMLElement>() {
  return useCallback((e: React.MouseEvent<T>) => {
    const el = e.currentTarget
    const r = el.getBoundingClientRect()
    el.style.setProperty('--mx', `${e.clientX - r.left}px`)
    el.style.setProperty('--my', `${e.clientY - r.top}px`)
  }, [])
}

function SectionHead({ eyebrow, title, sub }: { eyebrow: string; title: React.ReactNode; sub?: string }) {
  return (
    <div className="text-center mb-12">
      <span className="chip px-3.5 py-1.5 mb-5 uppercase tracking-[0.14em] font-medium">{eyebrow}</span>
      <h2 className="text-3xl sm:text-[2.6rem] font-semibold tracking-tight text-slate-50 leading-[1.12]">{title}</h2>
      {sub && <p className="text-slate-400 mt-4 max-w-2xl mx-auto text-[15px] leading-relaxed">{sub}</p>}
    </div>
  )
}

/* ── page ─────────────────────────────────────────────────────────── */

export default function Landing() {
  const spot = useSpot<HTMLDivElement>()
  const [menuOpen, setMenuOpen] = useState(false)
  const reduce = useReducedMotion()
  const railRef = useRef<HTMLDivElement>(null)

  const anim = (delay = 0): any =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, y: 14 },
          whileInView: { opacity: 1, y: 0 },
          viewport: { once: true, margin: '-60px' },
          transition: { duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] },
        }

  return (
    <div className="relative min-h-screen overflow-x-clip">
      {/* ── Nav ─────────────────────────────────────────────────── */}
      <header className="fixed top-0 inset-x-0 z-50">
        <div className="glass-strong border-x-0 border-t-0">
          <nav className="max-w-6xl mx-auto flex items-center justify-between px-5 h-16">
            <Link href="/" className="flex items-center gap-2.5 group">
              <span className="relative w-8 h-8 rounded-[10px] bg-gradient-to-br from-[#8b7cf8] to-[#5d4ded] flex items-center justify-center shadow-[0_2px_14px_rgba(117,102,244,.45)]">
                <Sparkles size={15} className="text-white" />
                <span className="absolute inset-0 rounded-[10px] ring-1 ring-white/25" />
              </span>
              <span className="font-semibold text-slate-50 text-[15px] tracking-tight">Loop&nbsp;GPT</span>
            </Link>

            <div className="hidden md:flex items-center gap-7 text-[13.5px]">
              <a href="#platforms" className="text-slate-400 hover:text-white transition">Platforms</a>
              <a href="#features" className="text-slate-400 hover:text-white transition">Features</a>
              <a href="#pricing" className="text-slate-400 hover:text-white transition">Pricing</a>
              <a href="#api" className="text-slate-400 hover:text-white transition">API</a>
              <Link href="/developers" className="text-slate-400 hover:text-white transition">Developers</Link>
            </div>

            <div className="flex items-center gap-2.5">
              <Link href="/login" className="hidden sm:inline-block text-[13.5px] text-slate-300 hover:text-white px-2 py-1.5 transition">Log in</Link>
              <Link href="/signup" className="btn-primary px-4 py-2 text-[13.5px]">
                Get started <ArrowRight size={14} />
              </Link>
              <button
                aria-label="Toggle menu"
                onClick={() => setMenuOpen((v) => !v)}
                className="md:hidden p-2 rounded-lg text-slate-300 hover:bg-white/[0.06] transition"
              >
                {menuOpen ? <X size={18} /> : <Menu size={18} />}
              </button>
            </div>
          </nav>

          {menuOpen && (
            <div className="md:hidden border-t border-white/[0.06] px-5 py-4 flex flex-col gap-3.5 text-[14px] bg-[#0a0a12]/95">
              {[
                ['#platforms', 'Platforms'], ['#features', 'Features'], ['#pricing', 'Pricing'], ['#api', 'API'],
              ].map(([h, t]) => (
                <a key={h} href={h} onClick={() => setMenuOpen(false)} className="text-slate-300 hover:text-white transition">{t}</a>
              ))}
              <hr className="border-white/[0.06]" />
              <Link href="/developers" className="text-slate-300 hover:text-white transition">Developers</Link>
              <Link href="/login" className="text-slate-300 hover:text-white transition">Log in</Link>
            </div>
          )}
        </div>
      </header>

      {/* ── Hero ────────────────────────────────────────────────── */}
      <section className="relative noise pt-36 sm:pt-44 pb-24">
        {/* aurora field */}
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="aurora aurora-iris w-[640px] h-[640px] -top-40 left-1/2 -translate-x-[70%] opacity-70" />
          <div className="aurora aurora-cyan w-[520px] h-[520px] -top-24 left-1/2 translate-x-[2%] opacity-60" />
          <div className="aurora aurora-plum w-[420px] h-[420px] top-40 right-[-120px] opacity-50" />
        </div>

        <div className="relative max-w-5xl mx-auto text-center px-5">
          <motion.div {...anim(0)}>
            <span className="chip px-4 py-1.5 mb-8">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 dot-live" />
              All platforms · one account · streaming everything
            </span>
          </motion.div>

          <motion.h1
            {...anim(0.06)}
            className="text-[2.9rem] sm:text-7xl font-semibold tracking-[-0.03em] leading-[1.04] text-slate-50"
          >
            The agentic chat portal<br className="hidden sm:block" /> that{' '}
            <span className="text-gradient">actually does the work.</span>
          </motion.h1>

          <motion.p {...anim(0.12)} className="mt-7 text-slate-400 text-[17px] sm:text-lg max-w-2xl mx-auto leading-relaxed">
            Deep research, vision, image &amp; document generation, MCP connectors, skills,
            and a live Agent Computer — on web, Android, and iOS.
          </motion.p>

          <motion.div {...anim(0.18)} className="mt-10 flex items-center justify-center gap-3.5 flex-wrap">
            <Link href="/signup" className="group btn-primary px-7 py-3.5 text-[15px] shadow-[0_8px_40px_-8px_rgba(117,102,244,.6)]">
              Try it free
              <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
            </Link>
            <a href="#platforms" className="btn-ghost px-7 py-3.5 text-[15px] hover:-translate-y-px">
              Explore platforms
            </a>
          </motion.div>

          {/* showcase: product glass */}
          <motion.div {...anim(0.26)} className="mt-16 sm:mt-20 max-w-3xl mx-auto" onMouseMove={spot}>
            <div className="card-spot glass-strong rounded-3xl overflow-hidden text-left shadow-[0_40px_120px_-40px_rgba(93,77,237,.35)]">
              {/* window chrome */}
              <div className="flex items-center gap-2 px-4 h-11 border-b border-white/[0.06] bg-white/[0.02]">
                <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]/80" />
                <span className="w-2.5 h-2.5 rounded-full bg-[#febc2e]/80" />
                <span className="w-2.5 h-2.5 rounded-full bg-[#28c840]/80" />
                <span className="ml-3 text-[11px] text-slate-500 font-medium tracking-wide">loop · agent computer</span>
                <span className="ml-auto chip px-2.5 py-0.5 text-emerald-300/90 text-[10.5px]">
                  <span className="w-1 h-1 rounded-full bg-emerald-400 mr-1 inline-block" /> live
                </span>
              </div>

              <div className="p-5 sm:p-7 space-y-5">
                {/* user turn */}
                <div className="flex justify-end">
                  <div className="max-w-[78%] rounded-2xl rounded-br-md px-4 py-3 text-[13.5px] text-slate-100 bg-gradient-to-br from-[#7566f4]/90 to-[#5d4ded]/90 shadow-[0_6px_24px_-8px_rgba(93,77,237,.5)]">
                    Research the top EV battery startups and sketch the landscape for my deck.
                  </div>
                </div>

                {/* tool ribbon */}
                <div className="flex flex-wrap gap-2">
                  <span className="chip px-2.5 py-1"><Search size={11} className="text-[#a78bfa]" /> web.search ×6</span>
                  <span className="chip px-2.5 py-1"><Globe size={11} className="text-[#67e8f9]" /> read.url ×4</span>
                  <span className="chip px-2.5 py-1"><TerminalSquare size={11} className="text-emerald-300/90" /> python.exec</span>
                </div>

                {/* assistant turn */}
                <div className="flex gap-3">
                  <span className="mt-1 w-7 h-7 shrink-0 rounded-lg bg-gradient-to-br from-[#8b7cf8] to-[#5d4ded] flex items-center justify-center">
                    <Sparkles size={12} className="text-white" />
                  </span>
                  <div className="text-[13.5px] text-slate-300 leading-relaxed space-y-2">
                    <p>
                      Done — compared 14 startups across chemistry, energy density, and funding.
                      The report is cited 23× and the <span className="text-slate-100 font-medium">landscape.png</span> chart
                      is dropped into your thread…
                    </p>
                    {/* artifact tiles */}
                    <div className="flex gap-3 pt-1">
                      <div className="w-28 h-20 rounded-xl border border-white/[0.08] bg-gradient-to-br from-[#8b7cf8]/25 via-[#4cc9f0]/15 to-transparent relative overflow-hidden">
                        <ImageIcon size={14} className="absolute bottom-2 right-2 text-white/70" />
                        <span className="absolute top-1.5 left-2 text-[9.5px] text-white/80 font-medium">landscape.png</span>
                      </div>
                      <div className="w-28 h-20 rounded-xl border border-white/[0.08] bg-gradient-to-br from-[#10b981]/20 to-transparent relative overflow-hidden">
                        <FileText size={14} className="absolute bottom-2 right-2 text-white/70" />
                        <span className="absolute top-1.5 left-2 text-[9.5px] text-white/80 font-medium">report.pdf</span>
                      </div>
                    </div>
                    <span className="cursor text-[13px]" />
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Stats band ──────────────────────────────────────────── */}
      <section className="relative max-w-6xl mx-auto px-5 -mt-2">
        <div className="glass rounded-2xl grid grid-cols-2 lg:grid-cols-4 divide-x divide-white/[0.05] overflow-hidden">
          {STATS.map((s, i) => {
            const Icon = s.icon
            return (
              <motion.div key={s.kpi} {...anim(i * 0.05)} className="px-6 py-6 text-center lg:text-left">
                <Icon size={15} className="text-[#a78bfa] mb-2 mx-auto lg:mx-0" />
                <div className="text-xl font-semibold text-slate-50 tracking-tight">{s.kpi}</div>
                <div className="text-[12px] text-slate-500 mt-0.5">{s.label}</div>
              </motion.div>
            )
          })}
        </div>
      </section>

      {/* ── Platforms ───────────────────────────────────────────── */}
      <section id="platforms" className="relative max-w-6xl mx-auto px-5 pt-28">
        <SectionHead
          eyebrow="Everywhere you work"
          title={<>One account.<br /><span className="text-gradient">Every platform.</span></>}
          sub="Pick up any thread where you left it — the web workstation, your phone, or straight through the API."
        />
        <div className="grid md:grid-cols-3 gap-5">
          {PLATFORMS.map((p, i) => {
            const Icon = p.icon
            return (
              <motion.div key={p.name} {...anim(i * 0.07)} onMouseMove={spot}>
                <div className={`card-spot rounded-3xl p-6 h-full flex flex-col relative overflow-hidden transition-transform hover:-translate-y-1 duration-300 ${
                  p.primary ? 'glass-strong accent-ring' : 'glass'
                }`}>
                  {p.primary && (
                    <div aria-hidden className="absolute -top-24 -right-24 w-64 h-64 rounded-full bg-[#8b7cf8]/20 blur-3xl" />
                  )}
                  <div className="flex items-center justify-between mb-5 relative">
                    <span className={`w-11 h-11 rounded-2xl flex items-center justify-center ${
                      p.primary
                        ? 'bg-gradient-to-br from-[#8b7cf8] to-[#5d4ded] shadow-[0_6px_20px_-6px_rgba(117,102,244,.6)]'
                        : 'bg-white/[0.05] border border-white/[0.07]'
                    }`}>
                      <Icon size={19} className={p.primary ? 'text-white' : 'text-slate-300'} />
                    </span>
                    <span className={`text-[10.5px] px-2.5 py-1 rounded-full font-medium tracking-wide ${
                      p.primary
                        ? 'bg-emerald-400/12 text-emerald-300 border border-emerald-400/25'
                        : 'chip text-[11px]'
                    }`}>{p.status}</span>
                  </div>
                  <h3 className="text-lg font-semibold text-slate-50 mb-2">{p.name}</h3>
                  <p className="text-[13.5px] text-slate-400 leading-relaxed flex-1">{p.desc}</p>
                  <div className="hairline-fade my-4" />
                  <div className="flex items-center justify-between">
                    <span className="text-[11.5px] text-slate-500">{p.foot}</span>
                    <Link href={p.href} className={`text-[12.5px] font-medium inline-flex items-center gap-1 ${
                      p.primary ? 'text-[#a78bfa] hover:text-white' : 'text-slate-400 hover:text-white'
                    } transition`}>
                      Open <ChevronDown size={13} className="-rotate-90" />
                    </Link>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>
      </section>

      {/* ── Features (bento) ────────────────────────────────────── */}
      <section id="features" className="relative max-w-6xl mx-auto px-5 pt-28">
        <SectionHead
          eyebrow="Capabilities"
          title={<>Everything a flagship assistant has —<br className="hidden sm:block" /> <span className="text-gradient">and the receipts.</span></>}
          sub="Watch every search, computation, and generation happen in real time. Nothing happens behind a curtain."
        />
        <div ref={railRef} className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {FEATURES.map((f, i) => {
            const Icon = f.icon
            return (
              <motion.div key={f.title} {...anim((i % 4) * 0.05)} onMouseMove={spot} className={f.span}>
                <div className="card-spot glass rounded-3xl p-6 h-full hover:border-white/[0.13] hover:bg-white/[0.055] transition-colors cursor-default">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#8b7cf8]/18 to-[#4cc9f0]/10 border border-[#8b7cf8]/25 flex items-center justify-center mb-4">
                    <Icon size={17} className="text-[#a78bfa]" />
                  </div>
                  <div className="font-medium text-slate-100 text-[14.5px] mb-1.5">{f.title}</div>
                  <div className="text-[13px] text-slate-500 leading-relaxed">{f.desc}</div>
                </div>
              </motion.div>
            )
          })}
        </div>
      </section>

      {/* ── Pricing ─────────────────────────────────────────────── */}
      <section id="pricing" className="relative max-w-6xl mx-auto px-5 pt-28">
        <SectionHead
          eyebrow="Pricing"
          title={<>Start free. Scale <span className="text-gradient">when it clicks.</span></>}
          sub="Usage-metered credits keep the free tier honest. Cancel anytime, keep your data."
        />
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {PLANS.map((p, i) => (
            <motion.div key={p.name} {...anim(i * 0.06)} onMouseMove={spot}>
              <div className={`card-spot rounded-3xl p-7 h-full flex flex-col relative ${
                p.highlight ? 'glass-strong border-gradient' : 'glass'
              }`}>
                <div className="flex items-center justify-between mb-4">
                  <span className="font-semibold text-[17px] text-slate-50">{p.name}</span>
                  {p.highlight && (
                    <span className="text-[10.5px] px-2.5 py-1 rounded-full bg-[#8b7cf8]/15 text-[#c4b8fd] border border-[#8b7cf8]/30 font-medium tracking-wide">
                      Most popular
                    </span>
                  )}
                </div>
                <div className="mb-6">
                  <span className="text-[2.6rem] font-semibold tracking-tight text-white">{p.price}</span>
                  <span className="text-slate-500 ml-1.5 text-[13.5px]">{p.period}</span>
                </div>
                <ul className="space-y-2.5 mb-7 flex-1">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-[13px] text-slate-300">
                      <span className="w-4 h-4 rounded-full bg-emerald-400/12 border border-emerald-400/30 flex items-center justify-center mt-0.5 shrink-0">
                        <Check size={9} className="text-emerald-300" />
                      </span>
                      {f}
                    </li>
                  ))}
                </ul>
                <Link href={p.href} className={`${p.highlight ? 'btn-primary' : 'btn-ghost hover:!text-white'} w-full py-3 text-[14px]`}>
                  {p.cta}
                </Link>
              </div>
            </motion.div>
          ))}
        </div>
        <p className="text-center text-[12px] text-slate-600 mt-7">
          AI usage is metered with credits so the free tier stays sustainable. Cancel anytime.
        </p>
      </section>

      {/* ── Developer API ───────────────────────────────────────── */}
      <section id="api" className="relative max-w-6xl mx-auto px-5 pt-28">
        <SectionHead
          eyebrow="For developers"
          title={<>Build on the <span className="text-gradient">same rails.</span></>}
          sub="One OpenAI-compatible endpoint for chat, embeddings, image and video models — priced per token, prepaid, no lock-in. Change one line, keep your SDK."
        />

        <div className="grid lg:grid-cols-5 gap-5 mb-10">
          {/* code panel */}
          <motion.div {...anim(0)} onMouseMove={spot} className="lg:col-span-3">
            <div className="card-spot terminal rounded-3xl overflow-hidden h-full">
              <div className="flex items-center gap-2 px-4 h-10 border-b border-white/[0.06] bg-white/[0.02]">
                <span className="w-2 h-2 rounded-full bg-[#8b7cf8]/70" />
                <span className="text-[11px] text-slate-500 font-medium">quickstart.ts</span>
                <a
                  href="/developers"
                  className="ml-auto text-[11px] text-[#a78bfa] hover:text-white transition"
                >
                  Get a key →
                </a>
              </div>
              <pre className="p-5 text-[12.5px] leading-relaxed overflow-x-auto"><code>
<span className="text-slate-500">{'// drop-in: keep your OpenAI SDK'}</span>{'\n'}
<span className="text-[#c4b8fd]">const</span> <span className="text-slate-200">client</span> <span className="text-slate-500">=</span> <span className="text-[#c4b8fd]">new</span> <span className="text-[#67e8f9]">OpenAI</span><span className="text-slate-400">({'{'}</span>{'\n'}
{'  '}<span className="text-[#fbbf24]">apiKey</span><span className="text-slate-500">:</span> <span className="text-emerald-300/90">{'\'sk-loop-…\''}</span><span className="text-slate-500">,</span>{'\n'}
{'  '}<span className="text-[#fbbf24]">baseURL</span><span className="text-slate-500">:</span> <span className="text-emerald-300/90">{'\'https://api.loop-gpt.cyou/v1\''}</span><span className="text-slate-500">,</span>{'\n'}
<span className="text-slate-400">{'}'})</span>{'\n\n'}
<span className="text-[#c4b8fd]">const</span> <span className="text-slate-200">res</span> <span className="text-slate-500">=</span> <span className="text-[#c4b8fd]">await</span> <span className="text-slate-200">client.chat.completions.create</span><span className="text-slate-400">({'{'}</span>{'\n'}
{'  '}<span className="text-[#fbbf24]">model</span><span className="text-slate-500">:</span> <span className="text-emerald-300/90">{'\'loop-chat\''}</span><span className="text-slate-500">,</span>{'\n'}
{'  '}<span className="text-[#fbbf24]">messages</span><span className="text-slate-500">:</span> <span className="text-slate-400">[{'{'}</span> <span className="text-[#fbbf24]">role</span><span className="text-slate-500">:</span> <span className="text-emerald-300/90">{'\'user\''}</span><span className="text-slate-500">,</span> <span className="text-[#fbbf24]">content</span><span className="text-slate-500">:</span> <span className="text-emerald-300/90">{'\'Ship it.\''}</span> <span className="text-slate-400">{'}'},]</span><span className="text-slate-500">,</span>{'\n'}
<span className="text-slate-400">{'}'})</span>
</code></pre>
            </div>
          </motion.div>

          {/* API value bullets */}
          <motion.div {...anim(0.08)} onMouseMove={spot} className="lg:col-span-2">
            <div className="card-spot glass rounded-3xl p-7 h-full flex flex-col justify-center gap-5">
              {[
                { icon: Cable, t: 'OpenAI-compatible /v1', d: 'chat · embeddings · images · video — same shapes, same SDK' },
                { icon: Zap, t: 'Metered per token', d: 'real usage billing with prepaid credit that never expires' },
                { icon: ShieldCheck, t: 'Keys & dashboards', d: 'unlimited keys, live usage, balances — all in /developers' },
              ].map((row) => {
                const Icon = row.icon
                return (
                  <div key={row.t} className="flex gap-3.5">
                    <span className="w-9 h-9 shrink-0 rounded-xl bg-white/[0.05] border border-white/[0.07] flex items-center justify-center">
                      <Icon size={15} className="text-[#a78bfa]" />
                    </span>
                    <div>
                      <div className="text-[13.5px] font-medium text-slate-100">{row.t}</div>
                      <div className="text-[12.5px] text-slate-500 mt-0.5 leading-relaxed">{row.d}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </motion.div>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {API_PLANS.map((p, i) => (
            <motion.div key={p.name} {...anim(i * 0.06)} onMouseMove={spot}>
              <div className={`card-spot rounded-3xl p-6 h-full flex flex-col ${p.highlight ? 'glass-strong border-gradient' : 'glass'}`}>
                <div className="flex items-center justify-between mb-4">
                  <span className="font-semibold text-[16px] text-slate-50">{p.name}</span>
                  {p.highlight && (
                    <span className="text-[10.5px] px-2.5 py-1 rounded-full bg-[#8b7cf8]/15 text-[#c4b8fd] border border-[#8b7cf8]/30 font-medium">
                      Popular
                    </span>
                  )}
                </div>
                <div className="mb-5">
                  <span className="text-3xl font-semibold tracking-tight text-white">{p.price}</span>
                  <span className="text-slate-500 ml-1.5 text-[13px]">{p.period}</span>
                </div>
                <ul className="space-y-2 flex-1">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-[13px] text-slate-300">
                      <span className="w-4 h-4 rounded-full bg-emerald-400/12 border border-emerald-400/25 flex items-center justify-center mt-0.5 shrink-0">
                        <Check size={9} className="text-emerald-300" />
                      </span>
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── Final CTA ───────────────────────────────────────────── */}
      <section className="relative max-w-6xl mx-auto px-5 pt-28 pb-24">
        <motion.div {...anim(0)} onMouseMove={spot}>
          <div className="card-spot relative rounded-[2rem] overflow-hidden glass-strong px-6 py-16 sm:py-20 text-center">
            <div aria-hidden className="absolute inset-0 pointer-events-none">
              <div className="aurora aurora-iris w-[480px] h-[480px] -bottom-56 left-1/4 opacity-60" />
              <div className="aurora aurora-cyan w-[420px] h-[420px] -top-52 right-1/4 opacity-50" />
            </div>
            <div className="relative">
              <h2 className="text-3xl sm:text-5xl font-semibold tracking-tight text-slate-50 leading-[1.1]">
                Give your ideas<br /><span className="text-gradient">an agent that ships.</span>
              </h2>
              <p className="text-slate-400 mt-5 max-w-xl mx-auto text-[15px]">
                Free tier, no card. Your first API key comes with a dollar of credit — enough to feel the difference tonight.
              </p>
              <div className="mt-9 flex items-center justify-center gap-3.5 flex-wrap">
                <Link href="/signup" className="group btn-primary px-8 py-3.5 text-[15px] shadow-[0_10px_46px_-10px_rgba(117,102,244,.65)]">
                  Create your account <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
                </Link>
                <Link href="/developers" className="btn-ghost px-7 py-3.5 text-[15px]">Read the API docs</Link>
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────── */}
      <footer className="relative border-t border-white/[0.05] bg-[#08080e]/60">
        <div className="max-w-6xl mx-auto px-5 py-14">
          <div className="grid grid-cols-2 md:grid-cols-6 gap-10">
            <div className="col-span-2">
              <div className="flex items-center gap-2.5 mb-4">
                <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#8b7cf8] to-[#5d4ded] flex items-center justify-center">
                  <Sparkles size={13} className="text-white" />
                </span>
                <span className="font-semibold text-slate-100 text-[14.5px]">Loop GPT</span>
              </div>
              <p className="text-[12.5px] text-slate-500 leading-relaxed max-w-[220px]">
                The agentic chat portal — web, Android, iOS, and an OpenAI-compatible API.
              </p>
              <div className="flex items-center gap-2 mt-5">
                <span className="chip px-2.5 py-1 text-[10.5px]"><Monitor size={10} /> Web</span>
                <span className="chip px-2.5 py-1 text-[11px]"><Smartphone size={10} /> Android</span>
                <span className="chip px-2.5 py-1 text-[11px]"><Apple size={11} /> iOS</span>
              </div>
            </div>
            {FOOTER_COLS.map((col) => (
              <div key={col.head}>
                <div className="text-[12px] font-semibold text-slate-300 uppercase tracking-[0.12em] mb-4">{col.head}</div>
                <ul className="space-y-2.5">
                  {col.links.map((l) => (
                    <li key={l.t}>
                      {l.h.startsWith('#') || l.h.startsWith('http') ? (
                        <a href={l.h} className="text-[13px] text-slate-500 hover:text-slate-200 transition">{l.t}</a>
                      ) : (
                        <Link href={l.h} className="text-[13px] text-slate-500 hover:text-slate-200 transition">{l.t}</Link>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="hairline-fade my-9" />
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-[12px] text-slate-600">
            <span>© {new Date().getFullYear()} Loop GPT. All rights reserved.</span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              All systems operational
            </span>
          </div>
        </div>
      </footer>
    </div>
  )
}
