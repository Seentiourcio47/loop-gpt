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
        className="h-8 px-2.5 flex items-center gap-1.5 rounded-lg border border-white/[0.08] text-slate-400 hover:bg-white/[0.05] hover:text-slate-200 text-xs transition"
      >
        {isLarge ? <Brain size={13} className="text-[#c96442]" /> : <Sparkles size={13} />}
        <span className="hidden sm:inline">{isLarge ? 'Large' : 'Standard'}</span>
        <ChevronDown size={12} className="text-slate-600" />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute bottom-full mb-2 left-0 w-72 glass rounded-xl border border-white/[0.08] overflow-hidden z-20 shadow-panel"
        >
          {models.map((m) => {
            const active = m.id === current.id
            const Icon = m.tier === 'large' ? Brain : Sparkles
            return (
              <button
                key={m.id}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => choose(m)}
                className="w-full flex items-start gap-2.5 px-3 py-2.5 text-left hover:bg-white/[0.05] transition"
              >
                <Icon size={14} className={`mt-0.5 shrink-0 ${m.tier === 'large' ? 'text-[#c96442]' : 'text-slate-400'}`} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="text-sm text-slate-200">{m.label}</span>
                    {active && <Check size={12} className="text-[#c96442]" />}
                  </span>
                  <span className="block text-[11px] text-slate-500 leading-snug mt-0.5">{m.description}</span>
                  <span className="block text-[10px] text-slate-600 mt-1">
                    {Math.round(m.contextTokens / 1000)}K context
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
