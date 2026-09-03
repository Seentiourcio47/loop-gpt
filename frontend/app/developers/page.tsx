'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  Check,
  Copy,
  KeyRound,
  Loader2,
  Plus,
  Trash2,
  Wallet,
  Zap,
  BookOpen,
  AlertTriangle,
} from 'lucide-react'
import { API_URL, apiFetch, getToken } from '../lib/api'

interface ApiKeyRow {
  id: string
  name: string
  prefix: string
  masked: string
  revoked: boolean
  lastUsedAt: string | null
  createdAt: string
}

interface UsageRow {
  id: string
  kind: string
  model: string | null
  tokensIn: number
  tokensOut: number
  units: number
  costUsd: number
  createdAt: string
}

interface ApiPlan {
  id: string
  name: string
  priceUsd: number
  discountPercent: number
  rateLimitPerMin: number
  includedCreditUsd: number
  highlights: string[]
}

interface Pricing {
  currency: string
  rates: {
    chatInputPerMillionTokens: number
    chatOutputPerMillionTokens: number
    cachedInputMultiplier: number
    perImage: number
    perVideo: number
  }
  plans: ApiPlan[]
  models?: PricingModel[]
  payAsYouGo: { rateLimitPerMin: number; previewCreditUsd: number }
  topUps: number[]
}

interface PricingModel {
  id: string
  tier: 'standard' | 'large'
  label: string
  description: string
  contextTokens: number
  inputPerMillionTokens: number
  outputPerMillionTokens: number
}

interface Overview {
  balanceUsd: number
  plan: string | null
  planName: string | null
  discountPercent: number
  rateLimitPerMin: number
  previewGranted: boolean
  previewCreditUsd: number
  keys: ApiKeyRow[]
  usage: { requests: number; tokensIn: number; tokensOut: number; units: number; spendUsd: number }
  recent: UsageRow[]
  pricing: Pricing
}

const usd = (n: number, dp = 2) => `$${n.toFixed(dp)}`

function Stat({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <div className="glass rounded-xl p-4 flex flex-col gap-1">
      <div className="flex items-center gap-2 text-slate-400 text-xs">
        {icon}
        {label}
      </div>
      <div className="text-2xl font-semibold text-slate-100">{value}</div>
      {sub && <div className="text-xs text-slate-500">{sub}</div>}
    </div>
  )
}

function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="relative group">
      <pre className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 text-xs text-slate-300 overflow-x-auto">
        <code>{code}</code>
      </pre>
      <button
        type="button"
        onClick={() => {
          navigator.clipboard.writeText(code)
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        }}
        className="absolute top-2 right-2 p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 opacity-0 group-hover:opacity-100 transition"
        aria-label="Copy code"
      >
        {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
      </button>
    </div>
  )
}

export default function DevelopersPage() {
  const [data, setData] = useState<Overview | null>(null)
  const [pricing, setPricing] = useState<Pricing | null>(null)
  const [loading, setLoading] = useState(true)
  const [signedIn, setSignedIn] = useState(false)
  const [creating, setCreating] = useState(false)
  const [keyName, setKeyName] = useState('')
  const [newKey, setNewKey] = useState<{ key: string; grantedPreview: boolean; previewCreditUsd: number } | null>(null)
  const [copied, setCopied] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [billing, setBilling] = useState<{ enabled: boolean } | null>(null)
  const [tab, setTab] = useState<'keys' | 'pricing' | 'docs'>('keys')

  const load = useCallback(async () => {
    try {
      setData(await apiFetch<Overview>('/api/developer/overview'))
      setSignedIn(true)
    } catch {
      setSignedIn(false)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (getToken()) {
      setSignedIn(true)
      load()
    } else {
      setLoading(false)
    }
    apiFetch<Pricing>('/api/developer/pricing').then(setPricing).catch(() => {})
    apiFetch<any>('/api/billing/config').then(setBilling).catch(() => setBilling(null))
  }, [load])

  const rates = data?.pricing || pricing

  async function createKey(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
    setMsg(null)
    try {
      const r = await apiFetch<any>('/api/developer/keys', {
        method: 'POST',
        body: JSON.stringify({ name: keyName.trim() || undefined }),
      })
      setNewKey({ key: r.key, grantedPreview: r.grantedPreview, previewCreditUsd: r.previewCreditUsd })
      setKeyName('')
      load()
    } catch (err: any) {
      setMsg({ ok: false, text: err?.message || 'Could not create key.' })
    } finally {
      setCreating(false)
    }
  }

  async function revoke(id: string) {
    if (!confirm('Revoke this key? Any application using it will stop working immediately.')) return
    setBusy(id)
    try {
      await apiFetch(`/api/developer/keys/${id}`, { method: 'DELETE' })
      setMsg({ ok: true, text: 'Key revoked.' })
      load()
    } catch (err: any) {
      setMsg({ ok: false, text: err?.message || 'Could not revoke key.' })
    } finally {
      setBusy(null)
    }
  }

  async function topUp(amountUsd: number) {
    if (!signedIn) {
      window.location.href = '/signup'
      return
    }
    setBusy(`topup-${amountUsd}`)
    setMsg(null)
    try {
      const r = await apiFetch<{ url: string }>('/api/billing/topup', {
        method: 'POST',
        body: JSON.stringify({ amountUsd }),
      })
      if (r.url) window.location.href = r.url
    } catch (err: any) {
      setMsg({ ok: false, text: err?.message || 'Top-ups are not available yet.' })
      setBusy(null)
    }
  }

  async function subscribe(plan: string) {
    if (!signedIn) {
      window.location.href = '/signup'
      return
    }
    setBusy(`plan-${plan}`)
    setMsg(null)
    try {
      const r = await apiFetch<{ url: string }>('/api/billing/api-checkout', {
        method: 'POST',
        body: JSON.stringify({ plan }),
      })
      if (r.url) window.location.href = r.url
    } catch (err: any) {
      setMsg({ ok: false, text: err?.message || 'Plans are not available yet.' })
      setBusy(null)
    }
  }

  const base = API_URL.replace(/\/+$/, '')
  const sampleKey = newKey?.key || 'sk-loop-xxxxxxxxxxxxxxxx'
  const previewCredit = rates?.payAsYouGo.previewCreditUsd ?? 1

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <Link
              href="/chat"
              className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-100 transition"
              aria-label="Back to chat"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-semibold text-slate-100 flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-indigo-400" /> Developers
              </h1>
              <p className="text-sm text-slate-400">
                OpenAI-compatible API for chat, image and video. Pay only for what you use.
              </p>
            </div>
          </div>
          <Link href="/account" className="text-sm text-indigo-400 hover:text-indigo-300">
            Account &rarr;
          </Link>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-slate-800">
          {(
            [
              ['keys', 'API keys'],
              ['pricing', 'Pricing & plans'],
              ['docs', 'Quickstart'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id as any)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm border-b-2 transition ${
                tab === id
                  ? 'border-indigo-500 text-slate-100'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              {id === 'keys' && <KeyRound className="w-4 h-4" />}
              {id === 'pricing' && <Wallet className="w-4 h-4" />}
              {id === 'docs' && <BookOpen className="w-4 h-4" />}
              {label}
            </button>
          ))}
        </div>

        {msg && (
          <div
            className={`rounded-xl px-4 py-3 text-sm ${
              msg.ok
                ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30'
                : 'bg-rose-500/10 text-rose-300 border border-rose-500/30'
            }`}
          >
            {msg.text}
          </div>
        )}

        {/* ---------------- KEYS TAB ---------------- */}
        {tab === 'keys' && (
          <div className="space-y-6">
            {loading ? (
              <div className="flex items-center gap-2 text-slate-400 py-12 justify-center">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading your developer account…
              </div>
            ) : !signedIn ? (
              <div className="glass rounded-2xl p-8 text-center space-y-4">
                <KeyRound className="w-8 h-8 text-indigo-400 mx-auto" />
                <h2 className="text-lg font-semibold text-slate-100">Sign in to get an API key</h2>
                <p className="text-sm text-slate-400 max-w-md mx-auto">
                  Create a free account and we&apos;ll drop {usd(previewCredit)} of API credit into it — no card
                  required.
                </p>
                <div className="flex gap-3 justify-center">
                  <Link
                    href="/signup"
                    className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition"
                  >
                    Create account
                  </Link>
                  <Link
                    href="/login"
                    className="px-5 py-2.5 rounded-xl border border-slate-700 hover:bg-slate-800 text-sm transition"
                  >
                    Sign in
                  </Link>
                </div>
              </div>
            ) : (
              <>
                {/* Balance / usage */}
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <Stat
                    icon={<Wallet className="w-3.5 h-3.5" />}
                    label="Credit balance"
                    value={usd(data?.balanceUsd ?? 0, 4)}
                    sub="Never expires"
                  />
                  <Stat
                    icon={<Zap className="w-3.5 h-3.5" />}
                    label="Plan"
                    value={data?.planName || 'Pay as you go'}
                    sub={
                      data?.discountPercent
                        ? `${data.discountPercent}% usage discount`
                        : `${data?.rateLimitPerMin ?? 20} req/min`
                    }
                  />
                  <Stat
                    icon={<BookOpen className="w-3.5 h-3.5" />}
                    label="Requests (30d)"
                    value={String(data?.usage.requests ?? 0)}
                    sub={`${((data?.usage.tokensIn ?? 0) + (data?.usage.tokensOut ?? 0)).toLocaleString()} tokens`}
                  />
                  <Stat
                    icon={<Wallet className="w-3.5 h-3.5" />}
                    label="Spend (30d)"
                    value={usd(data?.usage.spendUsd ?? 0, 4)}
                    sub={`${data?.usage.units ?? 0} media units`}
                  />
                </div>

                {(data?.balanceUsd ?? 0) <= 0 && (
                  <div className="rounded-xl px-4 py-3 text-sm bg-amber-500/10 text-amber-300 border border-amber-500/30 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    Your balance is empty — API calls will return 402 until you top up.
                  </div>
                )}

                {/* Top up */}
                <div className="glass rounded-2xl p-5 space-y-3">
                  <h2 className="text-sm font-semibold text-slate-200">Add credit</h2>
                  <p className="text-xs text-slate-400">
                    Prepaid, never expires, no subscription required. Charged at list rates minus any plan discount.
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    {(rates?.topUps || [10, 25, 100]).map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => topUp(amt)}
                        disabled={busy === `topup-${amt}`}
                        className="px-5 py-2.5 rounded-xl border border-slate-700 hover:border-indigo-500 hover:bg-slate-800 text-sm font-medium transition disabled:opacity-50"
                      >
                        {busy === `topup-${amt}` ? <Loader2 className="w-4 h-4 animate-spin" /> : `Add $${amt}`}
                      </button>
                    ))}
                  </div>
                  {billing && !billing.enabled && (
                    <p className="text-xs text-amber-400/80">
                      Card payments are being switched on. Contact support for a credit voucher in the meantime.
                    </p>
                  )}
                </div>

                {/* Create key */}
                <div className="glass rounded-2xl p-5 space-y-4">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <h2 className="text-sm font-semibold text-slate-200">API keys</h2>
                    {!data?.previewGranted && (
                      <span className="text-xs text-emerald-400">
                        First key includes {usd(previewCredit)} free credit
                      </span>
                    )}
                  </div>

                  <form onSubmit={createKey} className="flex gap-2 flex-wrap">
                    <input
                      value={keyName}
                      onChange={(e) => setKeyName(e.target.value)}
                      placeholder="Key name (e.g. production-bot)"
                      maxLength={60}
                      className="flex-1 min-w-[200px] bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-indigo-500"
                    />
                    <button
                      type="submit"
                      disabled={creating}
                      className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition disabled:opacity-50 flex items-center gap-2"
                    >
                      {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                      Create key
                    </button>
                  </form>

                  {!data?.keys.length ? (
                    <p className="text-sm text-slate-500 py-4 text-center">
                      No keys yet. Create one to start calling the API.
                    </p>
                  ) : (
                    <div className="divide-y divide-slate-800">
                      {data.keys.map((k) => (
                        <div key={k.id} className="py-3 flex items-center justify-between gap-3 flex-wrap">
                          <div className="min-w-0">
                            <div className="text-sm text-slate-200 truncate">{k.name}</div>
                            <div className="text-xs text-slate-500 font-mono">{k.masked}</div>
                            <div className="text-[11px] text-slate-600">
                              Created {new Date(k.createdAt).toLocaleDateString()} ·{' '}
                              {k.lastUsedAt ? `last used ${new Date(k.lastUsedAt).toLocaleString()}` : 'never used'}
                            </div>
                          </div>
                          {k.revoked ? (
                            <span className="text-xs text-rose-400 px-2 py-1 rounded bg-rose-500/10">Revoked</span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => revoke(k.id)}
                              disabled={busy === k.id}
                              className="p-2 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition disabled:opacity-50"
                              aria-label="Revoke key"
                            >
                              {busy === k.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Trash2 className="w-4 h-4" />
                              )}
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Recent usage */}
                {!!data?.recent.length && (
                  <div className="glass rounded-2xl p-5 space-y-3">
                    <h2 className="text-sm font-semibold text-slate-200">Recent activity</h2>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead className="text-slate-500 text-left">
                          <tr>
                            <th className="py-2 pr-4 font-medium">When</th>
                            <th className="py-2 pr-4 font-medium">Type</th>
                            <th className="py-2 pr-4 font-medium">Model</th>
                            <th className="py-2 pr-4 font-medium">Tokens</th>
                            <th className="py-2 font-medium text-right">Cost</th>
                          </tr>
                        </thead>
                        <tbody className="text-slate-300">
                          {data.recent.map((r) => (
                            <tr key={r.id} className="border-t border-slate-800/60">
                              <td className="py-2 pr-4 whitespace-nowrap text-slate-500">
                                {new Date(r.createdAt).toLocaleString()}
                              </td>
                              <td className="py-2 pr-4 capitalize">{r.kind}</td>
                              <td className="py-2 pr-4 truncate max-w-[160px]">{r.model || '—'}</td>
                              <td className="py-2 pr-4 whitespace-nowrap">
                                {r.kind === 'chat' ? `${r.tokensIn} in / ${r.tokensOut} out` : `${r.units} unit(s)`}
                              </td>
                              <td className="py-2 text-right font-mono">{usd(r.costUsd, 5)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ---------------- PRICING TAB ---------------- */}
        {tab === 'pricing' &&
          (rates ? (
            <div className="space-y-6">
              <div className="glass rounded-2xl p-5 space-y-4">
                <h2 className="text-sm font-semibold text-slate-200">Pay-as-you-go rates</h2>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-slate-800 p-4">
                    <div className="text-xs text-slate-400">Chat — input</div>
                    <div className="text-xl font-semibold text-slate-100">
                      {usd(rates.rates.chatInputPerMillionTokens)}
                      <span className="text-xs text-slate-500 font-normal"> / 1M tokens</span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1">
                      Cached input at {Math.round(rates.rates.cachedInputMultiplier * 100)}%
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-800 p-4">
                    <div className="text-xs text-slate-400">Chat — output</div>
                    <div className="text-xl font-semibold text-slate-100">
                      {usd(rates.rates.chatOutputPerMillionTokens)}
                      <span className="text-xs text-slate-500 font-normal"> / 1M tokens</span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1">Same price as input — no output premium</div>
                  </div>
                  <div className="rounded-xl border border-slate-800 p-4">
                    <div className="text-xs text-slate-400">Image &amp; video</div>
                    <div className="text-xl font-semibold text-slate-100">
                      {usd(rates.rates.perImage)}
                      <span className="text-xs text-slate-500 font-normal"> / image</span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1">{usd(rates.rates.perVideo)} per 5s video</div>
                  </div>
                </div>
                <p className="text-xs text-slate-500">
                  No minimums, prepaid credit never expires, and {rates.payAsYouGo.rateLimitPerMin} req/min included
                  without a plan.
                </p>
              </div>

              {rates.models && rates.models.length > 1 && (
                <div className="glass rounded-2xl p-5 space-y-4">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-200">Chat models</h2>
                    <p className="text-xs text-slate-500 mt-1">
                      Pass the model id as <code className="px-1 bg-white/5 rounded text-slate-300">model</code> in
                      any request. Defaults to <code className="px-1 bg-white/5 rounded text-slate-300">loop-chat</code>.
                    </p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-[11px] uppercase tracking-wide text-slate-500 border-b border-slate-800">
                          <th className="py-2 pr-4 font-medium">Model</th>
                          <th className="py-2 pr-4 font-medium">Context</th>
                          <th className="py-2 pr-4 font-medium">Input / 1M</th>
                          <th className="py-2 font-medium">Output / 1M</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rates.models.map((m) => (
                          <tr key={m.id} className="border-b border-slate-800/60 last:border-0">
                            <td className="py-3 pr-4">
                              <div className="flex items-center gap-2">
                                <span className="text-slate-100">{m.label}</span>
                                {m.tier === 'large' && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#c96442]/15 text-[#c96442] border border-[#c96442]/25">
                                    Flagship
                                  </span>
                                )}
                              </div>
                              <code className="text-[11px] text-slate-500">{m.id}</code>
                              <div className="text-[11px] text-slate-500 mt-0.5">{m.description}</div>
                            </td>
                            <td className="py-3 pr-4 text-slate-300 whitespace-nowrap">
                              {Math.round(m.contextTokens / 1000)}K
                            </td>
                            <td className="py-3 pr-4 text-slate-300 whitespace-nowrap">
                              {usd(m.inputPerMillionTokens)}
                            </td>
                            <td className="py-3 text-slate-300 whitespace-nowrap">{usd(m.outputPerMillionTokens)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-3">
                {rates.plans.map((p) => (
                  <div
                    key={p.id}
                    className="glass rounded-2xl p-5 flex flex-col gap-3 border border-slate-800 hover:border-indigo-500/50 transition"
                  >
                    <div>
                      <div className="text-sm font-semibold text-slate-100">{p.name}</div>
                      <div className="text-2xl font-semibold text-slate-100 mt-1">
                        {usd(p.priceUsd, 0)}
                        <span className="text-sm text-slate-500 font-normal">/mo</span>
                      </div>
                    </div>
                    <ul className="text-xs text-slate-400 space-y-1.5 flex-1">
                      {p.highlights.map((h) => (
                        <li key={h} className="flex gap-2">
                          <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                          {h}
                        </li>
                      ))}
                    </ul>
                    <button
                      type="button"
                      onClick={() => subscribe(p.id)}
                      disabled={busy === `plan-${p.id}` || data?.plan === p.id}
                      className={`w-full px-4 py-2.5 rounded-xl text-sm font-medium transition disabled:opacity-70 ${
                        data?.plan === p.id
                          ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-600/40'
                          : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                      }`}
                    >
                      {data?.plan === p.id ? (
                        'Current plan'
                      ) : busy === `plan-${p.id}` ? (
                        <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                      ) : (
                        `Choose ${p.name}`
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-slate-400 py-12 justify-center">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading pricing…
            </div>
          ))}

        {/* ---------------- DOCS TAB ---------------- */}
        {tab === 'docs' && (
          <div className="space-y-6">
            <div className="glass rounded-2xl p-5 space-y-3">
              <h2 className="text-sm font-semibold text-slate-200">Base URL</h2>
              <CodeBlock code={`${base}/v1`} />
              <p className="text-xs text-slate-400">
                The API is OpenAI-compatible: point any OpenAI SDK at this base URL and use your{' '}
                <span className="font-mono text-slate-300">sk-loop-…</span> key.
              </p>
            </div>

            <div className="glass rounded-2xl p-5 space-y-3">
              <h2 className="text-sm font-semibold text-slate-200">Chat completions — cURL</h2>
              <CodeBlock
                code={`curl ${base}/v1/chat/completions \\
  -H "Authorization: Bearer ${sampleKey}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "loop-chat",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'`}
              />
            </div>

            <div className="glass rounded-2xl p-5 space-y-3">
              <h2 className="text-sm font-semibold text-slate-200">JavaScript (openai SDK)</h2>
              <CodeBlock
                code={`import OpenAI from 'openai'

const client = new OpenAI({
  apiKey: '${sampleKey}',
  baseURL: '${base}/v1',
})

const res = await client.chat.completions.create({
  model: 'loop-chat',
  messages: [{ role: 'user', content: 'Write a haiku about loops.' }],
})
console.log(res.choices[0].message.content)`}
              />
            </div>

            <div className="glass rounded-2xl p-5 space-y-3">
              <h2 className="text-sm font-semibold text-slate-200">Python — streaming</h2>
              <CodeBlock
                code={`from openai import OpenAI

client = OpenAI(api_key="${sampleKey}", base_url="${base}/v1")

stream = client.chat.completions.create(
    model="loop-chat",
    messages=[{"role": "user", "content": "Explain recursion briefly."}],
    stream=True,
)
for chunk in stream:
    print(chunk.choices[0].delta.content or "", end="")`}
              />
            </div>

            <div className="glass rounded-2xl p-5 space-y-3">
              <h2 className="text-sm font-semibold text-slate-200">Images</h2>
              <CodeBlock
                code={`curl ${base}/v1/images/generations \\
  -H "Authorization: Bearer ${sampleKey}" \\
  -H "Content-Type: application/json" \\
  -d '{"model":"loop-image","prompt":"a neon loop in the fog","response_format":"url"}'`}
              />
            </div>

            <div className="glass rounded-2xl p-5 space-y-3">
              <h2 className="text-sm font-semibold text-slate-200">Video (async)</h2>
              <p className="text-xs text-slate-400">
                Video renders take several minutes. Submit a job, then poll it until{' '}
                <span className="font-mono text-slate-300">status</span> is{' '}
                <span className="font-mono text-slate-300">completed</span>.
              </p>
              <CodeBlock
                code={`# 1. submit
curl ${base}/v1/videos/generations \\
  -H "Authorization: Bearer ${sampleKey}" \\
  -H "Content-Type: application/json" \\
  -d '{"model":"loop-video","prompt":"a drone shot over neon city streets"}'

# 2. poll  ->  { "status": "completed", "url": "https://…mp4" }
curl ${base}/v1/videos/generations/JOB_ID \\
  -H "Authorization: Bearer ${sampleKey}"`}
              />
            </div>

            <div className="glass rounded-2xl p-5 space-y-3">
              <h2 className="text-sm font-semibold text-slate-200">Balance &amp; errors</h2>
              <CodeBlock code={`curl ${base}/v1/usage -H "Authorization: Bearer ${sampleKey}"`} />
              <ul className="text-xs text-slate-400 space-y-1.5">
                <li>
                  <span className="font-mono text-rose-300">401</span> — missing, malformed or revoked key
                </li>
                <li>
                  <span className="font-mono text-amber-300">402</span> — credit balance exhausted, top up to continue
                </li>
                <li>
                  <span className="font-mono text-amber-300">429</span> — plan rate limit exceeded, retry after the
                  window
                </li>
                <li>
                  <span className="font-mono text-rose-300">502</span> — upstream model error, safe to retry
                </li>
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* Copy-once key modal */}
      {newKey && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="glass rounded-2xl p-6 max-w-lg w-full space-y-4 border border-slate-700">
            <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-indigo-400" /> Your new API key
            </h2>
            <p className="text-sm text-amber-300 flex gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              Copy it now — this is the only time it will be shown.
            </p>
            <div className="flex gap-2">
              <code className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-emerald-300 break-all">
                {newKey.key}
              </code>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(newKey.key)
                  setCopied(true)
                  setTimeout(() => setCopied(false), 1500)
                }}
                className="px-3 rounded-xl border border-slate-700 hover:bg-slate-800 transition"
                aria-label="Copy API key"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
            {newKey.grantedPreview && (
              <p className="text-sm text-emerald-300">
                🎉 We added {usd(newKey.previewCreditUsd)} of free credit to your account.
              </p>
            )}
            <button
              type="button"
              onClick={() => {
                setNewKey(null)
                setTab('docs')
              }}
              className="w-full px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition"
            >
              I&apos;ve saved it — show me the quickstart
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
