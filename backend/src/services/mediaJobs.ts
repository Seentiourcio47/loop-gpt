import { saveArtifact } from '../agent/artifacts'
import { hasDb, prisma } from './prisma'

const DEFAULT_MAX_WAIT_MS = 1_800_000
const INITIAL_POLL_MS = 1_000
const POLL_MS = 5_000
const MAX_CONSECUTIVE_MISSES = 20

export interface CreateVideoJobInput {
  prompt: string
  width: number
  height: number
  fps: number
  numFrames: number
}

interface ProviderJobResponse {
  job_id?: string
  status_url?: string
  result_url?: string
  status?: string
  progress?: number | string
  message?: string
  error?: string
}

function configuredEndpoint(): string {
  return (process.env.HF_VIDEO_ENDPOINT || '').replace(/\/+$/, '')
}

function maxWaitMs(): number {
  const configured = Number(process.env.HF_VIDEO_MAX_WAIT_MS)
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_MAX_WAIT_MS
}

function asProgress(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.max(0, Math.min(100, Math.round(value)))
  if (typeof value === 'string') {
    // Only trust an explicit percentage; provider status strings such as
    // "Generating 257 frames (10.7s) at 540P..." contain unrelated numbers.
    const match = value.match(/(\d{1,3})\s*%/)
    if (match) return Math.max(0, Math.min(100, Number(match[1])))
  }
  return fallback
}

function resolveProviderUrl(baseUrl: string, value: string): string {
  return new URL(value, `${baseUrl}/`).toString()
}

function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return {
    Authorization: `Bearer ${process.env.HF_TOKEN || ''}`,
    ...extra,
  }
}

async function updateJob(id: string, data: Record<string, unknown>): Promise<void> {
  if (!prisma) return
  await prisma.mediaJob.update({ where: { id }, data })
}

async function providerRequest(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  return fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) })
}

async function ensureNotCancelled(id: string): Promise<boolean> {
  if (!prisma) return true
  const job = await prisma.mediaJob.findUnique({ where: { id }, select: { status: true } })
  return job?.status !== 'cancelled'
}

async function fetchCompletedVideo(baseUrl: string, resultUrl: string): Promise<Buffer> {
  // Same replica caveat as polling: retry a few times on 404 before failing.
  let lastStatus = 0
  for (let attempt = 0; attempt < 6; attempt++) {
    const response = await providerRequest(
      resolveProviderUrl(baseUrl, resultUrl),
      { headers: authHeaders({ Accept: 'video/mp4' }) },
      120_000
    )
    if (response.ok) return Buffer.from(await response.arrayBuffer())
    lastStatus = response.status
    if (response.status !== 404) break
    await new Promise((resolve) => setTimeout(resolve, POLL_MS))
  }
  throw new Error(`Video result returned HTTP ${lastStatus}`)
}

async function pollProviderJob(
  id: string,
  baseUrl: string,
  statusUrl: string,
  resultUrl: string
): Promise<Buffer | null> {
  const startedAt = Date.now()
  let attempt = 0
  let consecutiveMisses = 0

  while (Date.now() - startedAt < maxWaitMs()) {
    if (!(await ensureNotCancelled(id))) return null
    await new Promise((resolve) => setTimeout(resolve, attempt === 0 ? INITIAL_POLL_MS : POLL_MS))
    attempt++

    const response = await providerRequest(
      resolveProviderUrl(baseUrl, statusUrl),
      { headers: authHeaders() },
      30_000
    )
    // The provider keeps its job registry in memory per replica, so a poll that
    // lands on a different replica (or on a cold one) legitimately 404s while the
    // job is still running. Only give up after many *consecutive* misses.
    if (response.status === 404) {
      consecutiveMisses++
      if (consecutiveMisses <= MAX_CONSECUTIVE_MISSES) continue
      throw new Error('Video status returned HTTP 404')
    }
    if (!response.ok) throw new Error(`Video status returned HTTP ${response.status}`)
    consecutiveMisses = 0

    const status = (await response.json()) as ProviderJobResponse
    const normalized = String(status.status || '').toLowerCase()
    await updateJob(id, { progress: asProgress(status.progress, Math.min(95, 10 + attempt * 5)) })

    if (normalized === 'completed' || normalized === 'succeeded') {
      return fetchCompletedVideo(baseUrl, resultUrl)
    }
    if (normalized === 'failed' || normalized === 'cancelled') {
      throw new Error(status.error || status.message || 'Video generation failed')
    }
  }

  throw new Error('Video generation timed out')
}

async function submitVideoJob(id: string, input: CreateVideoJobInput): Promise<Buffer | null> {
  const endpoint = configuredEndpoint()
  if (!endpoint || !process.env.HF_TOKEN) throw new Error('Video generation is not configured')

  const response = await providerRequest(
    endpoint,
    {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json', Accept: 'application/json, video/mp4' }),
      body: JSON.stringify({
        inputs: input.prompt,
        parameters: {
          width: input.width,
          height: input.height,
          fps: input.fps,
          num_frames: input.numFrames,
        },
      }),
    },
    180_000
  )
  if (!response.ok) throw new Error(`Video provider returned HTTP ${response.status}: ${(await response.text()).slice(0, 240)}`)

  const contentType = response.headers.get('content-type') || ''
  if (!contentType.includes('application/json')) return Buffer.from(await response.arrayBuffer())

  const data = (await response.json()) as ProviderJobResponse
  if (data.job_id && data.status_url && data.result_url) {
    await updateJob(id, {
      providerJobId: data.job_id,
      statusUrl: data.status_url,
      resultUrl: data.result_url,
      progress: asProgress(data.progress, 5),
    })
    return pollProviderJob(id, endpoint, data.status_url, data.result_url)
  }
  throw new Error('Video provider returned an unsupported response')
}

async function completeJob(id: string, buffer: Buffer): Promise<void> {
  const artifact = saveArtifact(`loop-video-${id}.mp4`, buffer)
  await updateJob(id, {
    status: 'completed',
    progress: 100,
    outputUrl: artifact.url,
    completedAt: new Date(),
    error: null,
  })
}

export async function processVideoJob(id: string): Promise<void> {
  if (!hasDb || !prisma) return
  const job = await prisma.mediaJob.findUnique({ where: { id } })
  if (!job || job.status === 'completed' || job.status === 'cancelled') return

  try {
    await updateJob(id, { status: 'processing', progress: Math.max(job.progress, 1), startedAt: job.startedAt || new Date(), error: null })
    const input = job.metadata as unknown as CreateVideoJobInput
    const buffer = job.statusUrl && job.resultUrl
      ? await pollProviderJob(id, configuredEndpoint(), job.statusUrl, job.resultUrl)
      : await submitVideoJob(id, input)
    if (buffer && (await ensureNotCancelled(id))) await completeJob(id, buffer)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Video generation failed'
    await updateJob(id, { status: 'failed', error: message, completedAt: new Date() })
  }
}

export async function createVideoJob(userId: string, input: CreateVideoJobInput) {
  if (!hasDb || !prisma) throw new Error('Video jobs require a configured database')
  if (!configuredEndpoint() || !process.env.HF_TOKEN) throw new Error('Video generation is not configured')

  const job = await prisma.mediaJob.create({
    data: {
      userId,
      kind: 'video',
      prompt: input.prompt,
      metadata: {
        prompt: input.prompt,
        width: input.width,
        height: input.height,
        fps: input.fps,
        numFrames: input.numFrames,
      },
    },
  })
  void processVideoJob(job.id)
  return job
}

export async function resumeMediaJobs(): Promise<void> {
  if (!hasDb || !prisma) return
  const jobs = await prisma.mediaJob.findMany({
    where: { kind: 'video', status: { in: ['queued', 'processing'] } },
    select: { id: true },
  })
  await Promise.allSettled(jobs.map((job) => processVideoJob(job.id)))
}
