import express from 'express'
import { z } from 'zod'
import { authenticateToken } from './auth'
import { createVideoJob } from '../services/mediaJobs'
import { hasDb, prisma } from '../services/prisma'

const router = express.Router()

const createVideoSchema = z.object({
  prompt: z.string().trim().min(3).max(2_000),
  width: z.number().int().min(256).max(1_920).optional(),
  height: z.number().int().min(256).max(1_920).optional(),
  fps: z.number().int().min(8).max(30).optional(),
  numFrames: z.number().int().min(16).max(241).optional(),
})

function serialize(job: {
  id: string
  kind: string
  prompt: string
  status: string
  progress: number
  outputUrl: string | null
  error: string | null
  metadata: unknown
  createdAt: Date
  startedAt: Date | null
  completedAt: Date | null
}) {
  const metadata = (job.metadata && typeof job.metadata === 'object' ? job.metadata : {}) as Record<string, unknown>
  return {
    id: job.id,
    kind: job.kind,
    prompt: job.prompt,
    status: job.status,
    progress: job.progress,
    outputUrl: job.outputUrl,
    error: job.error,
    width: metadata.width,
    height: metadata.height,
    fps: metadata.fps,
    numFrames: metadata.numFrames,
    createdAt: job.createdAt,
    startedAt: job.startedAt,
    completedAt: job.completedAt,
  }
}

router.post('/video-jobs', authenticateToken, async (req, res) => {
  const parsed = createVideoSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Invalid video request', details: parsed.error.flatten() })

  try {
    const job = await createVideoJob((req as any).userId, {
      prompt: parsed.data.prompt,
      width: parsed.data.width ?? 960,
      height: parsed.data.height ?? 544,
      fps: parsed.data.fps ?? 24,
      numFrames: parsed.data.numFrames ?? 97,
    })
    res.status(202).json(serialize(job))
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not create video job'
    res.status(message.includes('configured') ? 503 : 500).json({ error: message })
  }
})

router.get('/jobs', authenticateToken, async (req, res) => {
  if (!hasDb || !prisma) return res.status(503).json({ error: 'Media jobs require a configured database' })
  const jobs = await prisma.mediaJob.findMany({
    where: { userId: (req as any).userId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })
  res.json(jobs.map(serialize))
})

router.get('/jobs/:id', authenticateToken, async (req, res) => {
  if (!hasDb || !prisma) return res.status(503).json({ error: 'Media jobs require a configured database' })
  const job = await prisma.mediaJob.findFirst({ where: { id: req.params.id, userId: (req as any).userId } })
  if (!job) return res.status(404).json({ error: 'Media job not found' })
  res.json(serialize(job))
})

router.post('/jobs/:id/cancel', authenticateToken, async (req, res) => {
  if (!hasDb || !prisma) return res.status(503).json({ error: 'Media jobs require a configured database' })
  const job = await prisma.mediaJob.updateMany({
    where: { id: req.params.id, userId: (req as any).userId, status: { in: ['queued', 'processing'] } },
    data: { status: 'cancelled', completedAt: new Date() },
  })
  if (!job.count) return res.status(404).json({ error: 'Active media job not found' })
  res.json({ ok: true })
})

export default router
