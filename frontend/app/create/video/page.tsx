'use client'

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, CheckCircle2, Clapperboard, Clock3, Download, Film,
  Loader2, RefreshCw, Sparkles, Wand2, XCircle,
} from 'lucide-react'
import { API_URL, apiFetch } from '../../lib/api'

type VideoJobStatus = 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled'
type AspectRatio = '16:9' | '9:16' | '1:1'

interface VideoJob {
  id: string
  prompt: string
  status: VideoJobStatus
  width: number
  height: number
  fps: number
  numFrames: number
  progress: number
  outputUrl: string | null
  error?: string | null
  createdAt: string
}

const EXAMPLES = [
  'A tiny paper boat navigates a rain-filled city street at blue hour, cinematic macro photography',
  'A vivid aerial fly-through of a bioluminescent forest, soft drifting fog, slow camera movement',
  'An astronaut tending a greenhouse on Mars, warm window light, quiet and contemplative',
]

const STATUS_STYLE: Record<VideoJobStatus, string> = {
  queued: 'text-amber-300 bg-amber-400/10 border-amber-300/20',
  processing: 'text-sky-300 bg-sky-400/10 border-sky-300/20',
  completed: 'text-emerald-300 bg-emerald-400/10 border-emerald-300/20',
  failed: 'text-rose-300 bg-rose-400/10 border-rose-300/20',
  cancelled: 'text-slate-400 bg-white/[0.05] border-white/[0.08]',
}

function isActive(status: VideoJobStatus) {
  return status === 'queued' || status === 'processing'
}

function statusLabel(status: VideoJobStatus) {
  return status === 'completed' ? 'Ready' : status[0].toUpperCase() + status.slice(1)
}

function jobAspectRatio(job: VideoJob): AspectRatio {
  if (job.width === job.height) return '1:1'
  return job.width > job.height ? '16:9' : '9:16'
}

function jobDuration(job: VideoJob) {
  return Math.round(job.numFrames / job.fps)
}

function formatDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? 'Just now'
    : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

function mediaUrl(path: string): string {
  return path.startsWith('http') ? path : `${API_URL}${path}`
}

export default function CreateVideoPage() {
  const [prompt, setPrompt] = useState('')
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('16:9')
  const [durationSeconds, setDurationSeconds] = useState(5)
  const [jobs, setJobs] = useState<VideoJob[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [loadingJobs, setLoadingJobs] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const activeJobs = useMemo(() => jobs.filter((job) => isActive(job.status)), [jobs])

  const loadJobs = useCallback(async () => {
    try {
      setJobs(await apiFetch<VideoJob[]>('/api/media/jobs'))
    } catch (err: any) {
      setError(err?.message || 'Could not load your video jobs.')
    } finally {
      setLoadingJobs(false)
    }
  }, [])

  useEffect(() => {
    void loadJobs()
  }, [loadJobs])

  useEffect(() => {
    if (activeJobs.length === 0) return

    const poll = async () => {
      try {
        const refreshed = await Promise.all(
          activeJobs.map((job) => apiFetch<VideoJob>(`/api/media/jobs/${job.id}`)),
        )
        const byId = new Map(refreshed.map((job) => [job.id, job]))
        setJobs((current) => current.map((job) => byId.get(job.id) || job))
      } catch {
        // A transient polling failure should not discard a job already shown to the user.
      }
    }

    const timer = window.setInterval(() => void poll(), 3_000)
    return () => window.clearInterval(timer)
  }, [activeJobs])

  async function createJob(event: FormEvent) {
    event.preventDefault()
    const trimmedPrompt = prompt.trim()
    if (!trimmedPrompt || submitting) return

    setSubmitting(true)
    setError(null)
    try {
      const [width, height] = aspectRatio === '16:9'
        ? [960, 544]
        : aspectRatio === '9:16'
          ? [544, 960]
          : [720, 720]
      const job = await apiFetch<VideoJob>('/api/media/video-jobs', {
        method: 'POST',
        body: JSON.stringify({ prompt: trimmedPrompt, width, height, fps: 24, numFrames: durationSeconds * 24 }),
      })
      setJobs((current) => [job, ...current.filter((currentJob) => currentJob.id !== job.id)])
      setPrompt('')
    } catch (err: any) {
      setError(err?.message || 'Could not start this video job.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#111113] text-slate-200">
      <div className="mx-auto max-w-6xl px-5 py-7 sm:py-10">
        <header className="mb-9 flex items-center justify-between">
          <Link href="/chat" className="inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-slate-100">
            <ArrowLeft size={16} /> Back to chat
          </Link>
          <div className="flex items-center gap-2 text-sm font-medium text-slate-200">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#c96442]">
              <Sparkles size={14} className="text-white" />
            </span>
            Loop GPT
          </div>
        </header>

        <div className="mb-8 max-w-2xl">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#c96442]/25 bg-[#c96442]/10 px-3 py-1 text-xs font-medium text-[#e6b8a6]">
            <Clapperboard size={14} /> Text to video
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-50 sm:text-4xl">Turn an idea into motion.</h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-400 sm:text-base">
            Describe the scene, choose a format, and Loop will render it in the background. You can leave this page while the job runs.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <section className="glass-strong rounded-2xl p-5 sm:p-6">
            <form onSubmit={createJob}>
              <label htmlFor="video-prompt" className="mb-2 block text-sm font-medium text-slate-100">Describe your video</label>
              <textarea
                id="video-prompt"
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                maxLength={1_000}
                rows={6}
                placeholder="A clear subject, setting, action, camera movement, lighting, and mood..."
                className="w-full resize-y rounded-xl border border-white/[0.09] bg-black/20 px-4 py-3 text-sm leading-relaxed text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-[#c96442]/65 focus:ring-1 focus:ring-[#c96442]/35"
              />
              <div className="mt-2 flex justify-between text-xs text-slate-500">
                <span>Specific visual direction generally produces stronger results.</span>
                <span>{prompt.length}/1000</span>
              </div>

              <div className="mt-6 grid gap-5 sm:grid-cols-2">
                <fieldset>
                  <legend className="mb-2 text-sm font-medium text-slate-100">Format</legend>
                  <div className="flex gap-2">
                    {(['16:9', '9:16', '1:1'] as AspectRatio[]).map((ratio) => (
                      <button
                        key={ratio}
                        type="button"
                        onClick={() => setAspectRatio(ratio)}
                        className={`flex-1 rounded-lg border px-2 py-2 text-xs font-medium transition ${
                          aspectRatio === ratio
                            ? 'border-[#c96442]/60 bg-[#c96442]/15 text-[#f0c0af]'
                            : 'border-white/[0.08] bg-white/[0.03] text-slate-400 hover:bg-white/[0.06]'
                        }`}
                      >
                        {ratio}
                      </button>
                    ))}
                  </div>
                </fieldset>
                <fieldset>
                  <legend className="mb-2 text-sm font-medium text-slate-100">Length</legend>
                  <div className="flex gap-2">
                    {[5, 8].map((seconds) => (
                      <button
                        key={seconds}
                        type="button"
                        onClick={() => setDurationSeconds(seconds)}
                        className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition ${
                          durationSeconds === seconds
                            ? 'border-[#c96442]/60 bg-[#c96442]/15 text-[#f0c0af]'
                            : 'border-white/[0.08] bg-white/[0.03] text-slate-400 hover:bg-white/[0.06]'
                        }`}
                      >
                        {seconds} seconds
                      </button>
                    ))}
                  </div>
                </fieldset>
              </div>

              {error && (
                <div role="alert" className="mt-5 flex items-start gap-2 rounded-lg border border-rose-400/20 bg-rose-400/10 px-3 py-2.5 text-sm text-rose-200">
                  <XCircle size={16} className="mt-0.5 shrink-0" /> {error}
                </div>
              )}

              <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="flex items-center gap-1.5 text-xs text-slate-500"><Clock3 size={13} /> Generation time varies with queue demand.</p>
                <button
                  type="submit"
                  disabled={!prompt.trim() || submitting}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#c96442] px-5 py-2.5 text-sm font-medium text-white shadow-[0_2px_16px_rgba(201,100,66,0.25)] transition hover:bg-[#b5593a] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submitting ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}
                  {submitting ? 'Starting job…' : 'Generate video'}
                </button>
              </div>
            </form>
          </section>

          <aside className="glass rounded-2xl p-5">
            <h2 className="flex items-center gap-2 text-sm font-medium text-slate-100"><Wand2 size={15} className="text-[#c96442]" /> Prompt starters</h2>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">Use one as a starting point, then make it your own.</p>
            <div className="mt-4 space-y-2">
              {EXAMPLES.map((example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => setPrompt(example)}
                  className="w-full rounded-xl border border-white/[0.06] bg-white/[0.025] p-3 text-left text-xs leading-relaxed text-slate-400 transition hover:border-white/[0.12] hover:bg-white/[0.06] hover:text-slate-200"
                >
                  {example}
                </button>
              ))}
            </div>
          </aside>
        </div>

        <section className="mt-10">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-100">Your video jobs</h2>
              <p className="mt-1 text-xs text-slate-500">Completed videos remain available here.</p>
            </div>
            <button
              type="button"
              onClick={() => void loadJobs()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] px-3 py-1.5 text-xs text-slate-400 transition hover:bg-white/[0.05] hover:text-slate-200"
            >
              <RefreshCw size={13} className={loadingJobs ? 'animate-spin' : ''} /> Refresh
            </button>
          </div>

          {loadingJobs ? (
            <div className="glass rounded-2xl p-7 text-center text-sm text-slate-500"><Loader2 className="mx-auto mb-2 animate-spin" size={18} /> Loading jobs…</div>
          ) : jobs.length === 0 ? (
            <div className="glass rounded-2xl p-8 text-center">
              <Film size={22} className="mx-auto mb-3 text-slate-600" />
              <p className="text-sm text-slate-400">Your first video will appear here.</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {jobs.map((job) => (
                <article key={job.id} className="glass overflow-hidden rounded-2xl">
                  <div className="flex aspect-video items-center justify-center border-b border-white/[0.06] bg-black/25">
                    {job.status === 'completed' && job.outputUrl ? (
                      <video className="h-full w-full object-cover" controls preload="metadata" src={mediaUrl(job.outputUrl)} />
                    ) : job.status === 'failed' ? (
                      <div className="px-5 text-center text-sm text-rose-300"><XCircle className="mx-auto mb-2" size={20} /> {job.error || 'This video could not be generated.'}</div>
                    ) : (
                      <div className="text-center">
                        <Loader2 className="mx-auto mb-3 animate-spin text-[#c96442]" size={23} />
                        <p className="text-sm text-slate-300">{job.status === 'queued' ? 'Waiting in queue' : 'Rendering your video'}</p>
                        {typeof job.progress === 'number' && <p className="mt-1 text-xs text-slate-500">{Math.round(job.progress)}% complete</p>}
                      </div>
                    )}
                  </div>
                  <div className="p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[11px] font-medium ${STATUS_STYLE[job.status]}`}>
                        {job.status === 'completed' ? <CheckCircle2 size={12} /> : <Clapperboard size={12} />} {statusLabel(job.status)}
                      </span>
                      <span className="text-[11px] text-slate-500">{jobAspectRatio(job)} · {jobDuration(job)}s</span>
                    </div>
                    <p className="line-clamp-2 text-sm leading-relaxed text-slate-300">{job.prompt}</p>
                    <div className="mt-3 flex items-center justify-between">
                      <span className="text-[11px] text-slate-600">{formatDate(job.createdAt)}</span>
                      {job.status === 'completed' && job.outputUrl && (
                        <a href={mediaUrl(job.outputUrl)} download className="inline-flex items-center gap-1 text-xs text-[#e6b8a6] transition hover:text-white">
                          <Download size={13} /> Download
                        </a>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
