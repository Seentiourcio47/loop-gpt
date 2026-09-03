/**
 * Public developer API — OpenAI-compatible surface mounted at `/v1`.
 *
 * Point any OpenAI SDK at `https://<host>/v1` with an `sk-loop-…` key:
 *   const client = new OpenAI({ apiKey: 'sk-loop-…', baseURL: 'https://…/v1' })
 *
 * Every route authenticates the key, checks prepaid balance, meters real token
 * usage and debits the account. Errors use the OpenAI error envelope.
 */
import express from 'express'
import { z } from 'zod'
import { createClient } from '../agent/llmClient'
import { getHFModel } from '../services/aiProviders'
import { resolveChatTarget, chatModelCatalog } from '../services/chatModels'
import { saveArtifact } from '../agent/artifacts'
import { createVideoJob } from '../services/mediaJobs'
import { prisma, hasDb } from '../services/prisma'
import { authenticateApiKey, requireBalance, apiError, type ApiRequest } from '../middleware/apiAuth'
import {
  chargeUsage,
  grossCostMicros,
  netCostMicros,
  pricingConfig,
  MICROS_PER_USD,
} from '../services/apiBilling'

const router = express.Router()

/** Rough token estimate used when the upstream provider reports no usage. */
function estimateTokens(text: string): number {
  if (!text) return 0
  return Math.max(1, Math.ceil(text.length / 4))
}

function defaultModel(): string {
  return getHFModel() || process.env.HF_MODEL || 'Qwen/Qwen3.8-27B'
}

/** Public catalogue. `id` values are what callers pass as `model`. */
function modelCatalog() {
  const chat = defaultModel()
  const entries: Array<{ id: string; object: string; owned_by: string; kind: string; upstream: string }> = []
  for (const m of chatModelCatalog()) {
    entries.push({ id: m.id, object: 'model', owned_by: 'loop-gpt', kind: 'chat', upstream: m.label })
  }
  // Keep the raw upstream chat model addressable for backwards compatibility.
  entries.push({ id: chat, object: 'model', owned_by: 'loop-gpt', kind: 'chat', upstream: chat })
  entries.push({ id: 'loop-image', object: 'model', owned_by: 'loop-gpt', kind: 'image', upstream: 'FLUX.1-dev' })
  entries.push({ id: 'loop-video', object: 'model', owned_by: 'loop-gpt', kind: 'video', upstream: 'skyreels-v2-df-14b' })
  return entries
}

/** GET /v1/models — catalogue for SDK `client.models.list()`. */
router.get('/models', authenticateApiKey, (_req, res) => {
  res.json({
    object: 'list',
    data: modelCatalog().map((m) => ({
      id: m.id,
      object: 'model',
      created: 1700000000,
      owned_by: m.owned_by,
    })),
  })
})

/** GET /v1/pricing — public rate card (no auth needed). */
router.get('/pricing', (_req, res) => res.json(pricingConfig()))

const chatSchema = z.object({
  model: z.string().optional(),
  messages: z
    .array(
      z.object({
        role: z.enum(['system', 'user', 'assistant', 'tool']),
        content: z.union([z.string(), z.array(z.any()), z.null()]).optional(),
        name: z.string().optional(),
      })
    )
    .min(1),
  stream: z.boolean().optional(),
  temperature: z.number().min(0).max(2).optional(),
  max_tokens: z.number().int().min(1).max(32_000).optional(),
  top_p: z.number().min(0).max(1).optional(),
  stop: z.union([z.string(), z.array(z.string())]).optional(),
})

/** POST /v1/chat/completions — streaming and non-streaming chat. */
router.post('/chat/completions', authenticateApiKey, requireBalance, async (req: ApiRequest, res) => {
  const parsed = chatSchema.safeParse(req.body)
  if (!parsed.success) {
    return apiError(
      res,
      400,
      parsed.error.issues[0]?.message || 'Invalid request body.',
      'invalid_request_error',
      'invalid_body'
    )
  }
  const ctx = req.api!
  const body = parsed.data
  const requestedModel = body.model || 'loop-chat'
  const target = resolveChatTarget(requestedModel)
  const model = target.model
  const messages = body.messages.map((m) => ({
    role: m.role,
    content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content ?? ''),
  })) as any[]

  const promptText = messages.map((m) => String(m.content || '')).join('\n')
  const client = createClient('huggingface', undefined, target.baseUrl)
  const id = `chatcmpl-${Date.now().toString(36)}`
  const created = Math.floor(Date.now() / 1000)

  try {
    if (body.stream) {
      res.setHeader('Content-Type', 'text/event-stream')
      res.setHeader('Cache-Control', 'no-cache, no-transform')
      res.setHeader('Connection', 'keep-alive')
      res.flushHeaders?.()

      const stream = await client.chat.completions.create({
        model,
        messages,
        stream: true,
        temperature: body.temperature ?? 0.7,
        max_tokens: body.max_tokens ?? (Number(process.env.HF_MAX_TOKENS) || 4096),
        top_p: body.top_p,
        stop: body.stop as any,
      })

      let full = ''
      let usageIn = 0
      let usageOut = 0
      for await (const chunk of stream as any) {
        const delta = chunk?.choices?.[0]?.delta?.content || ''
        if (delta) full += delta
        if (chunk?.usage) {
          usageIn = chunk.usage.prompt_tokens || usageIn
          usageOut = chunk.usage.completion_tokens || usageOut
        }
        // Re-emit with our own ids so the response is self-consistent.
        const out = {
          id,
          object: 'chat.completion.chunk',
          created,
          model: requestedModel,
          choices: [
            {
              index: 0,
              delta: chunk?.choices?.[0]?.delta || {},
              finish_reason: chunk?.choices?.[0]?.finish_reason ?? null,
            },
          ],
        }
        res.write(`data: ${JSON.stringify(out)}\n\n`)
      }

      const tokensIn = usageIn || estimateTokens(promptText)
      const tokensOut = usageOut || estimateTokens(full)
      await chargeUsage({
        userId: ctx.userId,
        apiKeyId: ctx.apiKeyId,
        kind: 'chat',
        model: requestedModel,
        tokensIn,
        tokensOut,
        planId: ctx.plan,
        tier: target.tier,
      }).catch(() => {})

      res.write(
        `data: ${JSON.stringify({
          id,
          object: 'chat.completion.chunk',
          created,
          model: requestedModel,
          choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
          usage: { prompt_tokens: tokensIn, completion_tokens: tokensOut, total_tokens: tokensIn + tokensOut },
        })}\n\n`
      )
      res.write('data: [DONE]\n\n')
      return res.end()
    }

    const completion: any = await client.chat.completions.create({
      model,
      messages,
      temperature: body.temperature ?? 0.7,
      max_tokens: body.max_tokens ?? (Number(process.env.HF_MAX_TOKENS) || 4096),
      top_p: body.top_p,
      stop: body.stop as any,
    })

    const content = completion?.choices?.[0]?.message?.content || ''
    const tokensIn = completion?.usage?.prompt_tokens || estimateTokens(promptText)
    const tokensOut = completion?.usage?.completion_tokens || estimateTokens(content)
    const cost = await chargeUsage({
      userId: ctx.userId,
      apiKeyId: ctx.apiKeyId,
      kind: 'chat',
      model: requestedModel,
      tokensIn,
      tokensOut,
      planId: ctx.plan,
      tier: target.tier,
    }).catch(() => 0)

    res.setHeader('X-Loop-Cost-USD', (cost / MICROS_PER_USD).toFixed(6))
    return res.json({
      id,
      object: 'chat.completion',
      created,
      model: requestedModel,
      choices: [
        {
          index: 0,
          message: { role: 'assistant', content },
          finish_reason: completion?.choices?.[0]?.finish_reason || 'stop',
        },
      ],
      usage: {
        prompt_tokens: tokensIn,
        completion_tokens: tokensOut,
        total_tokens: tokensIn + tokensOut,
      },
    })
  } catch (error: any) {
    console.error('[v1/chat] error:', error?.message)
    if (res.headersSent) return res.end()
    return apiError(
      res,
      502,
      error?.message || 'Upstream model error.',
      'api_error',
      'upstream_error'
    )
  }
})

/**
 * Call the dedicated HF image endpoint once.
 *
 * The endpoint scales to zero, so the first request after an idle period comes
 * back 503 while a GPU replica boots (~90s). Retry through that rather than
 * surfacing a spurious failure to API consumers.
 */
async function generateOne(endpoint: string, prompt: string): Promise<string> {
  const deadline = Date.now() + 240_000
  let lastError = 'image endpoint unavailable'

  while (Date.now() < deadline) {
    let upstream: Response
    try {
      upstream = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.HF_TOKEN || process.env.HF_API_TOKEN || ''}`,
          'Content-Type': 'application/json',
          Accept: 'image/png',
        },
        body: JSON.stringify({
          inputs: prompt,
          parameters: { num_inference_steps: 28, guidance_scale: 3.5 },
        }),
        signal: AbortSignal.timeout(300_000),
      })
    } catch (e: any) {
      lastError = e?.message || 'image endpoint request failed'
      await new Promise((r) => setTimeout(r, 8_000))
      continue
    }

    // 503/502/504 mean the endpoint is still waking up — keep waiting.
    if (upstream.status === 503 || upstream.status === 502 || upstream.status === 504) {
      lastError = `image endpoint warming up (HTTP ${upstream.status})`
      await new Promise((r) => setTimeout(r, 8_000))
      continue
    }
    if (!upstream.ok) {
      throw new Error(`image endpoint returned HTTP ${upstream.status}: ${(await upstream.text()).slice(0, 200)}`)
    }

    const contentType = upstream.headers.get('content-type') || ''
    if (contentType.includes('application/json')) {
      const payload: any = await upstream.json()
      const b64 =
        payload?.image || payload?.[0]?.image || payload?.images?.[0]?.b64_json || payload?.data?.[0]?.b64_json
      if (b64) return String(b64)
      throw new Error('image endpoint returned JSON without image data')
    }
    return Buffer.from(await upstream.arrayBuffer()).toString('base64')
  }

  throw new Error(lastError)
}

const imageSchema = z.object({
  prompt: z.string().trim().min(1).max(2_000),
  model: z.string().optional(),
  n: z.number().int().min(1).max(4).optional(),
  size: z.string().optional(),
  response_format: z.enum(['b64_json', 'url']).optional(),
})

/** POST /v1/images/generations — text-to-image. */
router.post('/images/generations', authenticateApiKey, requireBalance, async (req: ApiRequest, res) => {
  const parsed = imageSchema.safeParse(req.body)
  if (!parsed.success) {
    return apiError(
      res,
      400,
      parsed.error.issues[0]?.message || 'Invalid request body.',
      'invalid_request_error',
      'invalid_body'
    )
  }
  const ctx = req.api!
  const { prompt, n = 1, response_format = 'url' } = parsed.data

  const endpoint = (process.env.HF_IMAGE_ENDPOINT_URL || '').replace(/\/+$/, '')
  if (!endpoint) {
    return apiError(res, 503, 'Image generation is not configured.', 'api_error', 'not_configured')
  }

  try {
    const images: { b64: string }[] = []
    for (let i = 0; i < n; i++) {
      images.push({ b64: await generateOne(endpoint, prompt) })
    }

    const cost = await chargeUsage({
      userId: ctx.userId,
      apiKeyId: ctx.apiKeyId,
      kind: 'image',
      model: parsed.data.model || 'loop-image',
      units: images.length,
      planId: ctx.plan,
    }).catch(() => 0)

    res.setHeader('X-Loop-Cost-USD', (cost / MICROS_PER_USD).toFixed(6))
    const data = images.map((img, idx) => {
      if (response_format === 'b64_json') return { b64_json: img.b64 }
      const artifact = saveArtifact(
        `api-${Date.now().toString(36)}-${idx}.png`,
        Buffer.from(img.b64, 'base64')
      )
      const base = (process.env.PUBLIC_API_URL || '').replace(/\/+$/, '')
      return { url: base ? `${base}${artifact.url}` : artifact.url }
    })
    return res.json({ created: Math.floor(Date.now() / 1000), data })
  } catch (error: any) {
    console.error('[v1/images] error:', error?.message)
    return apiError(res, 502, error?.message || 'Image generation failed.', 'api_error', 'upstream_error')
  }
})

const videoSchema = z.object({
  prompt: z.string().trim().min(3).max(2_000),
  model: z.string().optional(),
  width: z.number().int().min(256).max(1_920).optional(),
  height: z.number().int().min(256).max(1_920).optional(),
  fps: z.number().int().min(8).max(30).optional(),
  num_frames: z.number().int().min(16).max(241).optional(),
})

function serializeVideoJob(job: any) {
  return {
    id: job.id,
    object: 'video.generation',
    status: job.status, // queued | processing | completed | failed | cancelled
    progress: job.progress,
    prompt: job.prompt,
    url: job.outputUrl
      ? `${(process.env.PUBLIC_API_URL || '').replace(/\/+$/, '')}${job.outputUrl}`
      : null,
    error: job.error,
    created_at: job.createdAt,
    completed_at: job.completedAt,
  }
}

/** POST /v1/videos/generations — async; returns 202 with a job to poll. */
router.post('/videos/generations', authenticateApiKey, requireBalance, async (req: ApiRequest, res) => {
  const parsed = videoSchema.safeParse(req.body)
  if (!parsed.success) {
    return apiError(
      res,
      400,
      parsed.error.issues[0]?.message || 'Invalid request body.',
      'invalid_request_error',
      'invalid_body'
    )
  }
  const ctx = req.api!
  try {
    const job = await createVideoJob(ctx.userId, {
      prompt: parsed.data.prompt,
      width: parsed.data.width ?? 832,
      height: parsed.data.height ?? 480,
      fps: parsed.data.fps ?? 24,
      numFrames: parsed.data.num_frames ?? 49,
    })
    const cost = await chargeUsage({
      userId: ctx.userId,
      apiKeyId: ctx.apiKeyId,
      kind: 'video',
      model: parsed.data.model || 'loop-video',
      units: 1,
      planId: ctx.plan,
    }).catch(() => 0)
    res.setHeader('X-Loop-Cost-USD', (cost / MICROS_PER_USD).toFixed(6))
    return res.status(202).json(serializeVideoJob(job))
  } catch (error: any) {
    const message = error?.message || 'Could not create video job.'
    return apiError(
      res,
      message.includes('configured') ? 503 : 500,
      message,
      'api_error',
      'video_error'
    )
  }
})

/** GET /v1/videos/generations/:id — poll an async video job. */
router.get('/videos/generations/:id', authenticateApiKey, async (req: ApiRequest, res) => {
  if (!hasDb || !prisma) {
    return apiError(res, 503, 'Video jobs require a database.', 'api_error', 'not_configured')
  }
  const job = await prisma.mediaJob.findFirst({
    where: { id: req.params.id, userId: req.api!.userId },
  })
  if (!job) return apiError(res, 404, 'Video job not found.', 'invalid_request_error', 'not_found')
  return res.json(serializeVideoJob(job))
})

/** GET /v1/usage — balance and recent spend for the calling key's account. */
router.get('/usage', authenticateApiKey, async (req: ApiRequest, res) => {
  if (!hasDb || !prisma) {
    return apiError(res, 503, 'Usage requires a database.', 'api_error', 'not_configured')
  }
  const ctx = req.api!
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const [user, agg] = await Promise.all([
    prisma.user.findUnique({
      where: { id: ctx.userId },
      select: { apiBalanceMicros: true, apiPlan: true },
    }),
    prisma.apiUsage.aggregate({
      where: { userId: ctx.userId, createdAt: { gte: since } },
      _sum: { costMicros: true, tokensIn: true, tokensOut: true, units: true },
      _count: true,
    }),
  ])
  return res.json({
    object: 'usage',
    balance_usd: Number(user?.apiBalanceMicros ?? 0n) / MICROS_PER_USD,
    plan: user?.apiPlan ?? null,
    last_30_days: {
      requests: agg._count,
      tokens_in: agg._sum.tokensIn || 0,
      tokens_out: agg._sum.tokensOut || 0,
      units: agg._sum.units || 0,
      spend_usd: Number(agg._sum.costMicros ?? 0n) / MICROS_PER_USD,
    },
  })
})

/** Unknown /v1 path — OpenAI-style 404 so SDKs report it cleanly. */
router.use((req, res) =>
  apiError(res, 404, `Unknown endpoint: ${req.method} /v1${req.path}`, 'invalid_request_error', 'unknown_endpoint')
)

export default router
