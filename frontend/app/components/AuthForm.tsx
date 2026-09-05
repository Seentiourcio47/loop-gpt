'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Sparkles, Loader2, ArrowRight } from 'lucide-react'
import { API_URL, setAuth } from '../lib/api'
import { track } from './Analytics'

const PROVIDER_META: Record<string, { label: string; icon: JSX.Element }> = {
  google: {
    label: 'Google',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1Z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"/><path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z"/></svg>
    ),
  },
  github: {
    label: 'GitHub',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 1A11 11 0 0 0 8.52 22.44c.55.1.75-.24.75-.53v-1.87c-3.06.67-3.7-1.47-3.7-1.47-.5-1.27-1.22-1.61-1.22-1.61-1-.68.08-.67.08-.67 1.1.08 1.68 1.13 1.68 1.13.98 1.68 2.57 1.2 3.2.92.1-.71.38-1.2.7-1.47-2.45-.28-5.02-1.22-5.02-5.45 0-1.2.43-2.19 1.13-2.96-.11-.28-.49-1.4.11-2.92 0 0 .92-.3 3.02 1.13a10.4 10.4 0 0 1 5.5 0c2.1-1.43 3.02-1.13 3.02-1.13.6 1.52.22 2.64.11 2.92.7.77 1.13 1.76 1.13 2.96 0 4.24-2.58 5.17-5.03 5.44.39.34.74 1.01.74 2.04v3.03c0 .3.2.64.76.53A11 11 0 0 0 12 1Z"/></svg>
    ),
  },
}

export default function AuthForm({ mode }: { mode: 'login' | 'signup' }) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const isSignup = mode === 'signup'

  // Handle the OAuth redirect back: ?token=...&role=...&error=...
  useEffect(() => {
    if (typeof window === 'undefined') return
    const p = new URLSearchParams(window.location.search)
    const token = p.get('token')
    const err = p.get('error')
    if (err) {
      setError(
        err === 'db_required'
          ? 'Sign-in needs the database enabled.'
          : err === 'provider_unavailable'
          ? 'Social sign-in is not yet configured on this server. Please use email/password below.'
          : `Sign-in failed: ${err}`
      )
      window.history.replaceState({}, '', window.location.pathname)
      return
    }
    if (token) {
      setAuth(token, { id: '', email: p.get('email') || '', name: p.get('name') || '', role: p.get('role') || 'user' })
      track(p.get('welcome') ? 'signed_up' : 'logged_in', { method: 'oauth' })
      window.history.replaceState({}, '', window.location.pathname)
      router.push(p.get('role') === 'admin' ? '/admin' : '/chat')
    }
  }, [router])

  function social(provider: string) {
    window.location.href = `${API_URL}/api/auth/oauth/${provider}`
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch(`${API_URL}/api/auth/${isSignup ? 'register' : 'login'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isSignup ? { email, password, name } : { email, password }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || `Request failed (${res.status})`)
        setLoading(false)
        return
      }
      if (data.token) setAuth(data.token, data.user)
      track(isSignup ? 'signed_up' : 'logged_in', { method: 'email' })
      router.push(data.user?.role === 'admin' ? '/admin' : '/chat')
    } catch (err: any) {
      setError(err?.message || 'Network error')
      setLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center px-5 py-12 overflow-hidden">
      {/* aurora ambience — mirrors the landing hero */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="aurora aurora-iris w-[560px] h-[560px] -top-48 left-1/2 -translate-x-[65%] opacity-60" />
        <div className="aurora aurora-cyan w-[460px] h-[460px] -top-24 left-1/2 translate-x-[4%] opacity-50" />
        <div className="aurora aurora-plum w-[380px] h-[380px] bottom-[-180px] right-[-80px] opacity-40" />
      </div>

      <div className="relative w-full max-w-sm">
        {/* brand lockup */}
        <Link href="/" className="flex flex-col items-center gap-3 mb-9 group">
          <span className="relative w-14 h-14 rounded-2xl bg-gradient-to-br from-[#8b7cf8] to-[#5d4ded] flex items-center justify-center shadow-[0_10px_40px_-8px_rgba(117,102,244,.65)] ring-1 ring-white/20 group-hover:scale-105 transition-transform">
            <Sparkles size={26} className="text-white" />
          </span>
          <span className="text-2xl font-semibold tracking-tight text-slate-50">
            Loop <span className="text-gradient">GPT</span>
          </span>
          <span className="text-[12px] text-slate-500 -mt-1">The agentic chat portal</span>
        </Link>

        <div className="glass-strong border-gradient rounded-3xl p-7 shadow-[0_30px_80px_-30px_rgba(93,77,237,.4)]">
          <h1 className="text-[22px] font-semibold text-slate-50 mb-1 tracking-tight">{isSignup ? 'Create your account' : 'Welcome back'}</h1>
          <p className="text-[13.5px] text-slate-500 mb-6">{isSignup ? 'Start free — no card required.' : 'Log in to continue your threads.'}</p>

          {/* Social sign-in */}
          <div className="space-y-2.5 mb-5">
            {(['google', 'github'] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => social(p)}
                className="btn-ghost w-full py-3 text-[14px] !justify-center"
              >
                {PROVIDER_META[p].icon}
                Continue with {PROVIDER_META[p].label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3 mb-5">
            <div className="hairline-fade flex-1" />
            <span className="text-[10.5px] text-slate-600 uppercase tracking-[0.14em]">or email</span>
            <div className="hairline-fade flex-1" />
          </div>

          <form onSubmit={submit} className="space-y-3.5">
            {isSignup && (
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" className="w-full bg-white/[0.045] border border-white/10 rounded-xl px-3.5 py-3 text-slate-100 text-sm focus:outline-none focus:border-[#8b7cf8]/60 focus:bg-white/[0.06] placeholder-slate-600 transition" />
            )}
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="w-full bg-white/[0.045] border border-white/10 rounded-xl px-3.5 py-3 text-slate-100 text-sm focus:outline-none focus:border-[#8b7cf8]/60 focus:bg-white/[0.06] placeholder-slate-600 transition" />
            <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" className="w-full bg-white/[0.045] border border-white/10 rounded-xl px-3.5 py-3 text-slate-100 text-sm focus:outline-none focus:border-[#8b7cf8]/60 focus:bg-white/[0.06] placeholder-slate-600 transition" />
            {!isSignup && (
              <div className="text-right -mt-1"><Link href="/forgot" className="text-[12px] text-slate-500 hover:text-[#a78bfa] transition">Forgot password?</Link></div>
            )}
            {error && <div className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-xl px-3.5 py-2.5">{error}</div>}
            <button type="submit" disabled={loading} className="btn-primary w-full py-3.5 text-[14.5px] disabled:opacity-40">
              {loading ? <Loader2 size={16} className="animate-spin" /> : <>{isSignup ? 'Create account' : 'Log in'} <ArrowRight size={15} /></>}
            </button>
          </form>
          <div className="mt-5 text-center text-[13px] text-slate-500">
            {isSignup ? <>Already have an account? <Link href="/login" className="text-[#a78bfa] hover:text-white transition">Log in</Link></> : <>New here? <Link href="/signup" className="text-[#a78bfa] hover:text-white transition">Sign up</Link></>}
          </div>
        </div>

        <p className="text-center text-[11px] text-slate-600 mt-6">
          Secured by Loop GPT · <Link href="/privacy" className="hover:text-slate-400 transition">Privacy</Link> · <Link href="/terms" className="hover:text-slate-400 transition">Terms</Link>
        </p>
      </div>
    </div>
  )
}
