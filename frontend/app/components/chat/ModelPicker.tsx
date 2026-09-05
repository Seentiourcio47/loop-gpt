'use client'

import { useEffect, useRef, useState } from 'react'
import { Sparkles, Brain, ChevronDown, Check } from 'lucide-react'
import { fetchChatModels, getChatModel, setChatModel, type ChatModelOption } from '../../lib/api'

/**
 * Chat model tier selector.
 *
 * Self-contained: it loads the catalogue from the backend and persists the
 * choice to localStorage, which `getProviderSettings()` already reads when the
 * composer sends a message. Hidden entirely when only one tier is configured.
 */
export default function ModelPicker() {
  const [models, setModels] = useState<ChatModelOption[]>([])
  const [selected, setSelected] = useState('')
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchChatModels().then(setModels)
    setSelected(getChatModel())
  }, [])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  // Only worth showing when there is an actual choice to make.
  if (models.length < 2) return null

  const current = models.find((m) => m.id === selected) || models[0]
  const isLarge = current.tier === 'large'

  const choose = (m: ChatModelOption) => {
    // The first entry is the server default — store it as blank.
    const id = m.id === models[0].id ? '' : m.id
    setChatModel(id)
    setSelected(id)
    setOpen(false)
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={current.description}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`h-8 px-2.5 flex items-center gap-1.5 rounded-xl border text-xs font-medium transition ${
          isLarge
            ? 'border-[#8b7cf8]/40 bg-[#8b7cf8]/12 text-[#cabffb] hover:bg-[#8b7cf8]/20'
            : 'border-white/[0.09] text-slate-300 hover:bg-white/[0.06] hover:text-white'
        }`}
      >
        {isLarge ? <Brain size={13} className="text-[#a78bfa]" /> : <Sparkles size={13} className="text-emerald-300/90" />}
        <span className="hidden sm:inline">Loop {isLarge ? 'Large' : 'Standard'}</span>
        <ChevronDown size={12} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute bottom-full mb-2.5 left-0 w-[19rem] glass-strong rounded-2xl border border-white/[0.09] overflow-hidden z-30 shadow-[0_24px_70px_-24px_rgba(0,0,0,.75)]"
        >
          <div className="px-4 pt-3 pb-2 flex items-center justify-between">
            <span className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-slate-500">Loop GPT engine</span>
            <span className="chip px-2 py-0.5 text-[9.5px]"><span className="w-1 h-1 rounded-full bg-emerald-400" /> live</span>
          </div>
          {models.map((m) => {
            const active = m.id === current.id
            const large = m.tier === 'large'
            const Icon = large ? Brain : Sparkles
            return (
              <button
                key={m.id}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => choose(m)}
                className={`w-full flex items-start gap-3 px-4 py-3 text-left transition ${
                  active ? 'bg-gradient-to-r from-[#8b7cf8]/16 to-transparent' : 'hover:bg-white/[0.05]'
                }`}
              >
                <span className={`w-9 h-9 shrink-0 rounded-xl flex items-center justify-center ${
                  large
                    ? 'bg-gradient-to-br from-[#8b7cf8]/28 to-[#4cc9f0]/14 border border-[#8b7cf8]/35'
                    : 'bg-gradient-to-br from-emerald-400/16 to-cyan-400/10 border border-emerald-400/25'
                }`}>
                  <Icon size={15} className={large ? 'text-[#a78bfa]' : 'text-emerald-300'} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="text-[13.5px] font-medium text-slate-100">Loop {m.label}</span>
                    {large && <span className="text-[9.5px] px-1.5 py-0.5 rounded-full bg-[#8b7cf8]/18 text-[#cabffb] border border-[#8b7cf8]/30 font-medium">PRO</span>}
                    {active && <Check size={13} className="text-[#a78bfa] ml-auto" />}
                  </span>
                  <span className="block text-[11.5px] text-slate-500 leading-snug mt-0.5">{m.description}</span>
                  <span className="block text-[10px] text-slate-600 mt-1">
                    {Math.round(m.contextTokens / 1000)}K context · streaming · agentic tools
                  </span>
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
